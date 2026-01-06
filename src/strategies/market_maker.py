"""
Enhanced Market Making Strategy
Based on the 32KB sophisticated market-maker.py from bonus algorithms
Optimized for Hyperliquid with high-frequency execution and advanced risk management
"""

import asyncio
import time
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from ..utils.hyperliquid_client import HyperliquidClient, MarketData, Position

logger = logging.getLogger(__name__)

@dataclass
class MarketMakerConfig:
    """Configuration for market making strategy"""
    symbol: str
    base_size: Decimal
    max_position_size: Decimal
    risk_limit: Decimal
    spread_percentage: Decimal
    time_limit_minutes: int
    kill_switch_enabled: bool
    atr_period: int = 7
    max_true_range: Decimal = Decimal('550')
    price_levels: int = 3
    size_distribution: List[float] = None  # Percentage distribution across price levels

    def __post_init__(self):
        if self.size_distribution is None:
            # Default: 20% on level 1, 30% on level 2, 50% on level 3
            self.size_distribution = [0.2, 0.3, 0.5]

@dataclass
class OrderLevel:
    """Represents a price level for market making"""
    level: int
    price: Decimal
    size: Decimal
    side: str
    order_id: Optional[str] = None
    timestamp: Optional[float] = None

class EnhancedMarketMaker:
    """
    Advanced market making strategy with sophisticated risk management
    Features:
    - Multi-level order placement
    - Dynamic spread adjustment
    - ATR-based volatility filtering
    - Position size management
    - Kill switch protection
    - Real-time PnL monitoring
    - Adaptive pricing
    """

    def __init__(self, client: HyperliquidClient, config: MarketMakerConfig):
        self.client = client
        self.config = config
        self.active_orders: List[OrderLevel] = []
        self.current_position: Optional[Position] = None
        self.entry_time: Optional[float] = None
        self.recent_trades: List[Dict] = []
        self.atr_values: List[Decimal] = []

        # Performance metrics
        self.total_trades = 0
        self.total_pnl = Decimal('0')
        self.successful_trades = 0

        logger.info(f"Initialized Enhanced Market Maker for {config.symbol}")

    async def start(self):
        """Start the market making bot"""
        logger.info(f"🚀 Starting Enhanced Market Maker for {self.config.symbol}")

        while True:
            try:
                # Risk management checks
                await self._risk_management_checks()

                # Update market data and position
                market_data = await self.client.get_market_data(self.config.symbol)
                positions = await self.client.get_positions()

                # Update current position
                self.current_position = next(
                    (pos for pos in positions if pos.symbol == self.config.symbol),
                    None
                )

                # Calculate ATR and volatility
                atr = await self._calculate_atr()
                volatility_filter = await self._volatility_filter(atr, market_data)

                if not volatility_filter:
                    logger.warning("🛑 Volatility filter triggered - skipping this cycle")
                    await asyncio.sleep(5)
                    continue

                # Update orders
                await self._update_orders(market_data)

                # Check exit conditions
                await self._check_exit_conditions()

                # Performance monitoring
                await self._update_metrics()

                await asyncio.sleep(1)  # High-frequency execution

            except Exception as e:
                logger.error(f"Error in market making loop: {e}")
                await asyncio.sleep(5)

    async def _risk_management_checks(self):
        """Comprehensive risk management checks"""
        # Check if position size exceeds risk limits
        if self.current_position:
            position_cost = abs(self.current_position.size * self.current_position.entry_price)

            if position_cost > self.config.risk_limit:
                logger.error(f"🚨 EMERGENCY: Position cost {position_cost} exceeds risk limit {self.config.risk_limit}")
                await self._emergency_close()
                return

        # Kill switch activation
        if self.config.kill_switch_enabled:
            await self._check_kill_switch_conditions()

        # Daily loss limit
        account_info = await self.client.get_account_info()
        # Note: You would need to implement daily PnL tracking
        # if daily_pnl < -max_daily_loss:
        #     await self.client.kill_switch()

    async def _calculate_atr(self) -> Decimal:
        """Calculate Average True Range for volatility measurement"""
        try:
            # Get OHLCV data
            ohlcv_data = await self.client.get_ohlcv(
                self.config.symbol,
                "5m",
                self.config.atr_period + 20
            )

            if len(ohlcv_data) < self.config.atr_period:
                return Decimal('0')

            # Create DataFrame for ATR calculation
            df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # Calculate True Range
            df['previous_close'] = df['close'].shift(1)
            df['high-low'] = abs(df['high'] - df['low'])
            df['high-pc'] = abs(df['high'] - df['previous_close'])
            df['low-pc'] = abs(df['low'] - df['previous_close'])
            df['tr'] = df[['high-low', 'high-pc', 'low-pc']].max(axis=1)

            # Calculate ATR
            atr = df['tr'].rolling(window=self.config.atr_period).mean().iloc[-1]

            if pd.isna(atr):
                return Decimal('0')

            # Update ATR history
            self.atr_values.append(Decimal(str(atr)))
            if len(self.atr_values) > 100:
                self.atr_values.pop(0)

            return Decimal(str(atr))

        except Exception as e:
            logger.error(f"Error calculating ATR: {e}")
            return Decimal('0')

    async def _volatility_filter(self, atr: Decimal, market_data: MarketData) -> bool:
        """Check if market conditions are suitable for market making"""
        try:
            # Get recent price data
            ohlcv_data = await self.client.get_ohlcv(self.config.symbol, "15m", 180)

            if len(ohlcv_data) < 20:
                return False

            df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

            # Check if current price is making new highs/lows
            current_price = market_data.last_price
            recent_highs = df['high'].tail(17)
            recent_lows = df['low'].tail(17)

            # Filter condition: price should not be making extreme new highs/lows
            if current_price >= recent_highs.max() or current_price <= recent_lows.min():
                return False

            # ATR filter - avoid extremely volatile markets
            if atr > self.config.max_true_range:
                return False

            return True

        except Exception as e:
            logger.error(f"Error in volatility filter: {e}")
            return False

    async def _update_orders(self, market_data: MarketData):
        """Update market making orders based on current conditions"""
        try:
            # Cancel existing orders that are no longer valid
            await self._cancel_stale_orders()

            if not self.current_position or abs(self.current_position.size) == 0:
                # No position - place both bid and ask orders
                await self._place_entry_orders(market_data)
            else:
                # Have position - place exit orders
                await self._place_exit_orders(market_data)

        except Exception as e:
            logger.error(f"Error updating orders: {e}")

    async def _place_entry_orders(self, market_data: MarketData):
        """Place entry orders when no position exists"""
        try:
            # Calculate price levels
            spread = market_data.last_price * self.config.spread_percentage

            # Buy orders (below current price)
            buy_prices = [
                market_data.bid * (Decimal('1') - Decimal('0.0009')),  # Level 1: 0.09% below bid
                market_data.bid * (Decimal('1') - Decimal('0.003')),   # Level 2: 0.3% below bid
                market_data.bid * (Decimal('1') - Decimal('0.005'))    # Level 3: 0.5% below bid
            ]

            # Sell orders (above current price)
            sell_prices = [
                market_data.ask * (Decimal('1') + Decimal('0.0009')),  # Level 1: 0.09% above ask
                market_data.ask * (Decimal('1') + Decimal('0.003')),   # Level 2: 0.3% above ask
                market_data.ask * (Decimal('1') + Decimal('0.005'))    # Level 3: 0.5% above ask
            ]

            # Calculate sizes for each level
            for i, (buy_price, sell_price) in enumerate(zip(buy_prices, sell_prices)):
                size = self.config.base_size * Decimal(str(self.config.size_distribution[i]))

                # Place buy order
                buy_order = await self.client.place_order(
                    symbol=self.config.symbol,
                    side="buy",
                    size=size,
                    order_type="limit",
                    price=buy_price,
                    time_in_force="PostOnly"
                )

                if buy_order.get("status") == "ok":
                    order_id = buy_order.get("response", {}).get("statuses", [{}])[0].get("resting", {}).get("oid")
                    self.active_orders.append(OrderLevel(
                        level=i+1,
                        price=buy_price,
                        size=size,
                        side="buy",
                        order_id=str(order_id),
                        timestamp=time.time()
                    ))

                # Place sell order
                sell_order = await self.client.place_order(
                    symbol=self.config.symbol,
                    side="sell",
                    size=size,
                    order_type="limit",
                    price=sell_price,
                    time_in_force="PostOnly"
                )

                if sell_order.get("status") == "ok":
                    order_id = sell_order.get("response", {}).get("statuses", [{}])[0].get("resting", {}).get("oid")
                    self.active_orders.append(OrderLevel(
                        level=i+1,
                        price=sell_price,
                        size=size,
                        side="sell",
                        order_id=str(order_id),
                        timestamp=time.time()
                    ))

            logger.info(f"Placed {len(buy_prices) + len(sell_prices)} entry orders")

        except Exception as e:
            logger.error(f"Error placing entry orders: {e}")

    async def _place_exit_orders(self, market_data: MarketData):
        """Place exit orders when in position"""
        try:
            if not self.current_position:
                return

            # Calculate exit price based on position side
            if self.current_position.side == "long":
                # For long position, place sell orders above entry
                exit_prices = [
                    self.current_position.entry_price * (Decimal('1') + Decimal('0.004')),  # 0.4% profit
                    self.current_position.entry_price * (Decimal('1') + Decimal('0.006')),  # 0.6% profit
                    self.current_position.entry_price * (Decimal('1') + Decimal('0.008'))   # 0.8% profit
                ]
                side = "sell"
            else:
                # For short position, place buy orders below entry
                exit_prices = [
                    self.current_position.entry_price * (Decimal('1') - Decimal('0.004')),  # 0.4% profit
                    self.current_position.entry_price * (Decimal('1') - Decimal('0.006')),  # 0.6% profit
                    self.current_position.entry_price * (Decimal('1') - Decimal('0.008'))   # 0.8% profit
                ]
                side = "buy"

            # Place stop loss order
            stop_loss_price = await self._calculate_stop_loss()

            # Cancel existing exit orders first
            await self.client.cancel_all_orders(self.config.symbol)

            # Place exit orders
            for i, exit_price in enumerate(exit_prices):
                size = min(abs(self.current_position.size), self.config.base_size)

                exit_order = await self.client.place_order(
                    symbol=self.config.symbol,
                    side=side,
                    size=size,
                    order_type="limit",
                    price=exit_price,
                    reduce_only=True,
                    time_in_force="PostOnly"
                )

                if exit_order.get("status") == "ok":
                    order_id = exit_order.get("response", {}).get("statuses", [{}])[0].get("resting", {}).get("oid")
                    self.active_orders.append(OrderLevel(
                        level=i+1,
                        price=exit_price,
                        size=size,
                        side=side,
                        order_id=str(order_id),
                        timestamp=time.time()
                    ))

            # Place stop loss
            if stop_loss_price:
                await self._place_stop_loss(stop_loss_price)

            logger.info(f"Placed exit orders for {side} position of {abs(self.current_position.size)}")

        except Exception as e:
            logger.error(f"Error placing exit orders: {e}")

    async def _calculate_stop_loss(self) -> Optional[Decimal]:
        """Calculate stop loss price based on ATR"""
        try:
            if not self.current_position:
                return None

            # Get recent ATR
            atr = await self._calculate_atr()
            if atr == 0:
                return None

            # Calculate stop loss using 2x ATR
            if self.current_position.side == "long":
                stop_loss = self.current_position.entry_price - (atr * 2)
            else:
                stop_loss = self.current_position.entry_price + (atr * 2)

            return stop_loss

        except Exception as e:
            logger.error(f"Error calculating stop loss: {e}")
            return None

    async def _place_stop_loss(self, stop_price: Decimal):
        """Place stop loss order"""
        try:
            if not self.current_position:
                return

            side = "sell" if self.current_position.side == "long" else "buy"
            size = abs(self.current_position.size)

            # Create stop limit order
            stop_order = await self.client.place_order(
                symbol=self.config.symbol,
                side=side,
                size=size,
                order_type="stop_limit",
                price=stop_price,
                reduce_only=True
            )

            if stop_order.get("status") == "ok":
                logger.info(f"Placed stop loss at {stop_price}")

        except Exception as e:
            logger.error(f"Error placing stop loss: {e}")

    async def _cancel_stale_orders(self):
        """Cancel orders that are no longer valid"""
        try:
            current_time = time.time()
            orders_to_cancel = []

            for order in self.active_orders:
                # Cancel orders older than 5 minutes or that don't match current strategy
                if current_time - order.timestamp > 300:  # 5 minutes
                    orders_to_cancel.append(order)

            for order in orders_to_cancel:
                if order.order_id:
                    await self.client.cancel_order(self.config.symbol, order.order_id)
                    self.active_orders.remove(order)

        except Exception as e:
            logger.error(f"Error canceling stale orders: {e}")

    async def _check_exit_conditions(self):
        """Check if position should be exited"""
        try:
            if not self.current_position or self.entry_time is None:
                return

            current_time = time.time()
            time_in_position = current_time - self.entry_time

            # Time-based exit
            if time_in_position > self.config.time_limit_minutes * 60:
                logger.info(f"Time limit reached ({self.config.time_limit_minutes} minutes), exiting position")
                await self._emergency_close()
                return

            # Profit target check
            unrealized_pnl = self.current_position.unrealized_pnl
            entry_value = abs(self.current_position.size * self.current_position.entry_price)
            pnl_percentage = (unrealized_pnl / entry_value) * 100

            if pnl_percentage > 0.5:  # 0.5% profit target
                logger.info(f"Profit target reached ({pnl_percentage:.2f}%), exiting position")
                await self._emergency_close()
                return

        except Exception as e:
            logger.error(f"Error checking exit conditions: {e}")

    async def _check_kill_switch_conditions(self):
        """Check conditions for kill switch activation"""
        try:
            if not self.current_position:
                return

            # Extreme PnL loss
            entry_value = abs(self.current_position.size * self.current_position.entry_price)
            pnl_percentage = (self.current_position.unrealized_pnl / entry_value) * 100

            if pnl_percentage < -2.0:  # 2% loss triggers kill switch
                logger.error(f"🚨 KILL SWITCH: Extreme loss detected ({pnl_percentage:.2f}%)")
                await self.client.kill_switch(self.config.symbol)
                return

            # Position size exceeds limits
            if abs(self.current_position.size) > self.config.max_position_size:
                logger.error(f"🚨 KILL SWITCH: Position size {self.current_position.size} exceeds limit {self.config.max_position_size}")
                await self.client.kill_switch(self.config.symbol)
                return

        except Exception as e:
            logger.error(f"Error checking kill switch conditions: {e}")

    async def _emergency_close(self):
        """Emergency close all positions and orders"""
        try:
            logger.warning("🚨 EMERGENCY CLOSE ACTIVATED")
            await self.client.kill_switch(self.config.symbol)
            self.active_orders.clear()
            self.current_position = None
            self.entry_time = None
        except Exception as e:
            logger.error(f"Error in emergency close: {e}")

    async def _update_metrics(self):
        """Update performance metrics"""
        try:
            if self.current_position and self.current_position.unrealized_pnl != 0:
                # Track performance
                self.total_pnl += self.current_position.unrealized_pnl

        except Exception as e:
            logger.error(f"Error updating metrics: {e}")

    def get_performance_stats(self) -> Dict:
        """Get current performance statistics"""
        return {
            "total_trades": self.total_trades,
            "total_pnl": float(self.total_pnl),
            "successful_trades": self.successful_trades,
            "success_rate": (self.successful_trades / max(self.total_trades, 1)) * 100,
            "current_position": {
                "symbol": self.current_position.symbol if self.current_position else None,
                "size": float(self.current_position.size) if self.current_position else 0,
                "side": self.current_position.side if self.current_position else None,
                "unrealized_pnl": float(self.current_position.unrealized_pnl) if self.current_position else 0
            },
            "active_orders": len(self.active_orders),
            "atr_average": float(np.mean([float(atr) for atr in self.atr_values[-20:]])) if self.atr_values else 0
        }