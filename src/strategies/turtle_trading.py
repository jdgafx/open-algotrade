"""
Enhanced Turtle Trading Strategy
Based on the classic 55-bar breakout system with ATR-based stops
Optimized for Hyperliquid with high-frequency execution and risk management
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
class TurtleConfig:
    """Configuration for turtle trading strategy"""
    symbol: str
    timeframe: str  # "1m", "5m", "15m", "1h", "4h"
    lookback_period: int = 55
    atr_period: int = 20
    atr_multiplier: Decimal = Decimal('2.0')
    take_profit_percentage: Decimal = Decimal('0.002')  # 0.2%
    size: Decimal
    leverage: int = 5
    trading_hours_only: bool = True
    exit_friday: bool = True
    max_position_size: Decimal

class EnhancedTurtleTrader:
    """
    Enhanced Turtle Trading System with advanced risk management
    Features:
    - 55-bar breakout entry signals
    - 2x ATR stop losses
    - 0.2% take profit targets
    - Time-based trading (9:30 AM - 4:00 PM ET, Mon-Fri)
    - Friday position exit before close
    - Multiple timeframe support
    - High-frequency execution
    - Advanced position sizing
    """

    def __init__(self, client: HyperliquidClient, config: TurtleConfig):
        self.client = client
        self.config = config
        self.current_position: Optional[Position] = None
        self.entry_price: Optional[Decimal] = None
        self.entry_time: Optional[float] = None
        self.stop_loss_price: Optional[Decimal] = None
        self.take_profit_price: Optional[Decimal] = None

        # Performance tracking
        self.total_trades = 0
        self.winning_trades = 0
        self.total_pnl = Decimal('0')
        self.max_drawdown = Decimal('0')
        self.peak_balance = Decimal('0')

        logger.info(f"Initialized Enhanced Turtle Trader for {config.symbol} on {config.timeframe}")

    async def start(self):
        """Start the turtle trading bot"""
        logger.info(f"🐢 Starting Enhanced Turtle Trader for {self.config.symbol}")

        while True:
            try:
                # Check if we should be trading (time-based)
                if self.config.trading_hours_only and not await self._is_trading_time():
                    logger.debug("Outside trading hours, waiting...")
                    await asyncio.sleep(60)
                    continue

                # Friday exit check
                if self.config.exit_friday and await self._is_friday_close():
                    await self._close_friday_position()
                    await asyncio.sleep(300)  # Wait 5 minutes
                    continue

                # Get current market data and position
                market_data = await self.client.get_market_data(self.config.symbol)
                positions = await self.client.get_positions()

                # Update current position
                self.current_position = next(
                    (pos for pos in positions if pos.symbol == self.config.symbol),
                    None
                )

                # Get OHLCV data for analysis
                ohlcv_data = await self.client.get_ohlcv(
                    self.config.symbol,
                    self.config.timeframe,
                    self.config.lookback_period + 20
                )

                if len(ohlcv_data) < self.config.lookback_period:
                    logger.warning("Insufficient OHLCV data")
                    await asyncio.sleep(10)
                    continue

                # Analyze market and make trading decisions
                await self._analyze_and_trade(market_data, ohlcv_data)

                await asyncio.sleep(self._get_sleep_interval())

            except Exception as e:
                logger.error(f"Error in turtle trading loop: {e}")
                await asyncio.sleep(30)

    async def _analyze_and_trade(self, market_data: MarketData, ohlcv_data: List[Tuple]):
        """Main analysis and trading logic"""
        try:
            # Convert to DataFrame for easier analysis
            df = pd.DataFrame(ohlcv_data, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

            # Calculate ATR
            df = self._calculate_atr(df)

            # Get the last completed candle
            last_candle = df.iloc[-2]  # -2 because -1 is the current incomplete candle
            current_price = market_data.last_price

            if not self.current_position or abs(self.current_position.size) == 0:
                # No position - look for entry signals
                await self._check_entry_signals(df, current_price, last_candle)
            else:
                # In position - manage exits
                await self._manage_position(df, current_price)

        except Exception as e:
            logger.error(f"Error in analysis: {e}")

    async def _check_entry_signals(self, df: pd.DataFrame, current_price: Decimal, last_candle: pd.Series):
        """Check for turtle trading entry signals"""
        try:
            # Calculate 55-bar high and low
            lookback_data = df.tail(self.config.lookback_period)
            highest_high = lookback_data['high'].max()
            lowest_low = lookback_data['low'].min()

            # Current candle's open and close
            current_open = df.iloc[-1]['open']
            current_close = df.iloc[-1]['close']

            # Long entry: breakout above 55-bar high
            if (current_price >= highest_high and
                current_open < highest_high and
                current_close > last_candle['close']):

                logger.info(f"🟢 LONG SIGNAL: Price {current_price} broke above 55-bar high {highest_high}")
                await self._enter_long(current_price, df.iloc[-1]['atr'])

            # Short entry: breakdown below 55-bar low
            elif (current_price <= lowest_low and
                  current_open > lowest_low and
                  current_close < last_candle['close']):

                logger.info(f"🔴 SHORT SIGNAL: Price {current_price} broke below 55-bar low {lowest_low}")
                await self._enter_short(current_price, df.iloc[-1]['atr'])

            else:
                logger.debug(f"No entry signal. Current: {current_price}, High: {highest_high}, Low: {lowest_low}")

        except Exception as e:
            logger.error(f"Error checking entry signals: {e}")

    async def _enter_long(self, entry_price: Decimal, atr: Decimal):
        """Enter a long position"""
        try:
            # Calculate position size based on risk
            position_size = await self._calculate_position_size(entry_price, atr)

            if position_size == 0:
                logger.warning("Position size calculated as 0, skipping entry")
                return

            # Place limit order at bid for better execution
            market_data = await self.client.get_market_data(self.config.symbol)
            limit_price = market_data.bid

            # Place the order
            order_response = await self.client.place_order(
                symbol=self.config.symbol,
                side="buy",
                size=position_size,
                order_type="limit",
                price=limit_price,
                time_in_force="PostOnly"
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Long entry order placed: {position_size} @ {limit_price}")

                # Set exit levels
                self.entry_price = limit_price
                self.entry_time = time.time()
                self.stop_loss_price = limit_price - (atr * self.config.atr_multiplier)
                self.take_profit_price = limit_price * (Decimal('1') + self.config.take_profit_percentage)

                self.total_trades += 1

            else:
                logger.error(f"Failed to place long order: {order_response}")

        except Exception as e:
            logger.error(f"Error entering long position: {e}")

    async def _enter_short(self, entry_price: Decimal, atr: Decimal):
        """Enter a short position"""
        try:
            # Calculate position size based on risk
            position_size = await self._calculate_position_size(entry_price, atr)

            if position_size == 0:
                logger.warning("Position size calculated as 0, skipping entry")
                return

            # Place limit order at ask for better execution
            market_data = await self.client.get_market_data(self.config.symbol)
            limit_price = market_data.ask

            # Place the order
            order_response = await self.client.place_order(
                symbol=self.config.symbol,
                side="sell",
                size=position_size,
                order_type="limit",
                price=limit_price,
                time_in_force="PostOnly"
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Short entry order placed: {position_size} @ {limit_price}")

                # Set exit levels
                self.entry_price = limit_price
                self.entry_time = time.time()
                self.stop_loss_price = limit_price + (atr * self.config.atr_multiplier)
                self.take_profit_price = limit_price * (Decimal('1') - self.config.take_profit_percentage)

                self.total_trades += 1

            else:
                logger.error(f"Failed to place short order: {order_response}")

        except Exception as e:
            logger.error(f"Error entering short position: {e}")

    async def _manage_position(self, df: pd.DataFrame, current_price: Decimal):
        """Manage existing position with stop loss and take profit"""
        try:
            if not self.current_position:
                return

            # Update stop loss with trailing ATR
            current_atr = df.iloc[-1]['atr']
            await self._update_trailing_stop(current_price, current_atr)

            # Check if price hit stop loss or take profit
            position_side = self.current_position.side

            if position_side == "long":
                # Check stop loss
                if current_price <= self.stop_loss_price:
                    await self._exit_position("stop_loss")
                # Check take profit
                elif current_price >= self.take_profit_price:
                    await self._exit_position("take_profit")

            elif position_side == "short":
                # Check stop loss
                if current_price >= self.stop_loss_price:
                    await self._exit_position("stop_loss")
                # Check take profit
                elif current_price <= self.take_profit_price:
                    await self._exit_position("take_profit")

        except Exception as e:
            logger.error(f"Error managing position: {e}")

    async def _update_trailing_stop(self, current_price: Decimal, atr: Decimal):
        """Update trailing stop loss"""
        try:
            if not self.current_position:
                return

            position_side = self.current_position.side

            if position_side == "long":
                # For long positions, trail stop up
                new_stop = current_price - (atr * self.config.atr_multiplier)
                if new_stop > self.stop_loss_price:
                    self.stop_loss_price = new_stop
                    logger.debug(f"Updated trailing stop to {self.stop_loss_price}")

            elif position_side == "short":
                # For short positions, trail stop down
                new_stop = current_price + (atr * self.config.atr_multiplier)
                if new_stop < self.stop_loss_price:
                    self.stop_loss_price = new_stop
                    logger.debug(f"Updated trailing stop to {self.stop_loss_price}")

        except Exception as e:
            logger.error(f"Error updating trailing stop: {e}")

    async def _exit_position(self, exit_reason: str):
        """Exit current position"""
        try:
            if not self.current_position:
                return

            position_size = abs(self.current_position.size)
            position_side = self.current_position.side
            exit_side = "sell" if position_side == "long" else "buy"

            # Use market order for immediate execution
            order_response = await self.client.place_order(
                symbol=self.config.symbol,
                side=exit_side,
                size=position_size,
                order_type="market",
                reduce_only=True
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Position exited via {exit_reason}: {position_size} {exit_side}")

                # Update performance metrics
                if self.current_position.unrealized_pnl > 0:
                    self.winning_trades += 1

                self.total_pnl += self.current_position.unrealized_pnl

                # Reset position tracking
                self.current_position = None
                self.entry_price = None
                self.entry_time = None
                self.stop_loss_price = None
                self.take_profit_price = None

            else:
                logger.error(f"Failed to exit position: {order_response}")

        except Exception as e:
            logger.error(f"Error exiting position: {e}")

    async def _calculate_position_size(self, entry_price: Decimal, atr: Decimal) -> Decimal:
        """Calculate optimal position size based on risk"""
        try:
            # Get account information
            account_info = await self.client.get_account_info()
            available_balance = account_info.get("available_balance", Decimal('0'))

            # Risk per trade: 1% of account or 2x ATR, whichever is smaller
            max_risk_per_trade = min(
                available_balance * Decimal('0.01'),  # 1% of account
                atr * self.config.atr_multiplier * self.config.size  # 2x ATR risk
            )

            # Calculate position size
            if atr > 0:
                position_size = max_risk_per_trade / (atr * self.config.atr_multiplier)
            else:
                position_size = self.config.size

            # Apply maximum position size limit
            position_size = min(position_size, self.config.max_position_size)

            # Ensure minimum position size
            if position_size < self.config.size * Decimal('0.1'):
                position_size = Decimal('0')

            return position_size

        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return Decimal('0')

    def _calculate_atr(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate Average True Range"""
        try:
            # Calculate True Range
            df['previous_close'] = df['close'].shift(1)
            df['high-low'] = abs(df['high'] - df['low'])
            df['high-pc'] = abs(df['high'] - df['previous_close'])
            df['low-pc'] = abs(df['low'] - df['previous_close'])
            df['tr'] = df[['high-low', 'high-pc', 'low-pc']].max(axis=1)

            # Calculate ATR
            df['atr'] = df['tr'].rolling(window=self.config.atr_period).mean()

            return df

        except Exception as e:
            logger.error(f"Error calculating ATR: {e}")
            df['atr'] = 0
            return df

    async def _is_trading_time(self) -> bool:
        """Check if current time is within allowed trading hours (9:30 AM - 4:00 PM ET)"""
        try:
            # Get current time in ET
            current_time = datetime.now()

            # Convert to ET (assuming server is in UTC)
            et_time = current_time - timedelta(hours=5)  # UTC to ET

            # Check if it's weekday (Monday=0, Friday=5)
            if et_time.weekday() > 4:  # Saturday or Sunday
                return False

            # Check if it's within trading hours (9:30 AM - 4:00 PM)
            current_time_minutes = et_time.hour * 60 + et_time.minute
            start_time = 9 * 60 + 30  # 9:30 AM
            end_time = 16 * 60  # 4:00 PM

            return start_time <= current_time_minutes < end_time

        except Exception as e:
            logger.error(f"Error checking trading time: {e}")
            return True  # Default to allowing trading

    async def _is_friday_close(self) -> bool:
        """Check if it's time to exit positions on Friday"""
        try:
            current_time = datetime.now()
            et_time = current_time - timedelta(hours=5)

            # Check if it's Friday after 3:45 PM ET
            if et_time.weekday() == 4:  # Friday
                current_time_minutes = et_time.hour * 60 + et_time.minute
                close_time = 15 * 60 + 45  # 3:45 PM

                return current_time_minutes >= close_time

            return False

        except Exception as e:
            logger.error(f"Error checking Friday close: {e}")
            return False

    async def _close_friday_position(self):
        """Close any open positions on Friday"""
        try:
            if self.current_position and abs(self.current_position.size) > 0:
                logger.info("📅 Friday close detected - exiting all positions")
                await self._exit_position("friday_close")

        except Exception as e:
            logger.error(f"Error closing Friday position: {e}")

    def _get_sleep_interval(self) -> int:
        """Get sleep interval based on timeframe"""
        timeframe_intervals = {
            "1m": 10,
            "5m": 30,
            "15m": 60,
            "1h": 300,
            "4h": 600
        }
        return timeframe_intervals.get(self.config.timeframe, 60)

    def get_performance_stats(self) -> Dict:
        """Get current performance statistics"""
        try:
            win_rate = (self.winning_trades / max(self.total_trades, 1)) * 100

            return {
                "total_trades": self.total_trades,
                "winning_trades": self.winning_trades,
                "losing_trades": self.total_trades - self.winning_trades,
                "win_rate": win_rate,
                "total_pnl": float(self.total_pnl),
                "average_pnl_per_trade": float(self.total_pnl / max(self.total_trades, 1)),
                "current_position": {
                    "symbol": self.current_position.symbol if self.current_position else None,
                    "size": float(self.current_position.size) if self.current_position else 0,
                    "side": self.current_position.side if self.current_position else None,
                    "unrealized_pnl": float(self.current_position.unrealized_pnl) if self.current_position else 0
                },
                "time_in_position": (time.time() - self.entry_time) if self.entry_time else 0,
                "stop_loss": float(self.stop_loss_price) if self.stop_loss_price else None,
                "take_profit": float(self.take_profit_price) if self.take_profit_price else None
            }
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {}