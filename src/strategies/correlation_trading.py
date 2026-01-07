"""
Enhanced Correlation Trading Strategy
Based on the ETH leading altcoins algorithm from bonus_algos
Optimized for Hyperliquid with high-frequency execution and lag detection
"""

import asyncio
import time
import logging
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import ccxt

from ..utils.hyperliquid_client import HyperliquidClient, MarketData, Position

logger = logging.getLogger(__name__)


@dataclass
class CorrelationConfig:
    """Configuration for correlation trading strategy"""

    leader_symbol: str  # ETH
    follower_symbols: List[str]  # BTC, SOL, ADA, DOT, etc.
    timeframe: str = "5m"
    lookback_period: int = 20
    lag_threshold_percentage: Decimal = Decimal("0.5")  # 0.5% lag threshold
    stop_loss_percentage: Decimal = Decimal("0.002")  # 0.2% stop loss
    take_profit_percentage: Decimal = Decimal("0.0025")  # 0.25% take profit
    size: Decimal = Decimal("1")
    max_positions: int = 3
    min_correlation: Decimal = Decimal("0.7")  # Minimum correlation threshold
    entry_cooldown_minutes: int = 30  # Cooldown between entries


@dataclass
class CorrelationSignal:
    """Represents a correlation trading signal"""

    leader_symbol: str
    follower_symbol: str
    direction: str  # "long" or "short"
    entry_price: Decimal
    lag_percentage: Decimal
    correlation_strength: Decimal
    timestamp: float


class CorrelationTrader:
    """
    Advanced correlation trading strategy that identifies lagging assets
    Features:
    - ETH as leader cryptocurrency
    - Multiple follower cryptocurrencies
    - Real-time correlation analysis
    - Lag detection and exploitation
    - Dynamic position sizing
    - Risk management with correlation filters
    - High-frequency execution
    """

    def __init__(self, client: HyperliquidClient, config: CorrelationConfig):
        self.client = client
        self.config = config
        self.active_positions: Dict[str, Position] = {}
        self.correlation_history: Dict[Tuple[str, str], List[float]] = {}
        self.price_history: Dict[
            str, List[Tuple[float, Decimal]]
        ] = {}  # (timestamp, price)
        self.last_entry_times: Dict[str, float] = {}
        self.total_trades = 0
        self.winning_trades = 0
        self.total_pnl = Decimal("0")

        logger.info(
            f"Initialized Correlation Trader with leader {config.leader_symbol}"
        )

    async def start(self):
        """Start the correlation trading bot"""
        logger.info(
            f"🔗 Starting Correlation Trader with leader {self.config.leader_symbol}"
        )

        # Initialize price history
        await self._initialize_price_history()

        while True:
            try:
                # Update price data
                await self._update_price_data()

                # Update active positions
                await self._update_positions()

                # Calculate correlations
                correlations = await self._calculate_correlations()

                # Identify trading opportunities
                signals = await self._identify_trading_opportunities(correlations)

                # Execute valid signals
                await self._execute_signals(signals)

                # Manage existing positions
                await self._manage_positions()

                await asyncio.sleep(15)  # Check every 15 seconds
            except Exception as e:
                logger.error(f"Error in correlation trading loop: {e}")
                await asyncio.sleep(30)

    async def iteration(self):
        """Single iteration for backtesting compatibility"""
        try:
            # Update price data
            await self._update_price_data()

            # Update active positions
            await self._update_positions()

            # Calculate correlations
            correlations = await self._calculate_correlations()

            # Identify trading opportunities
            signals = await self._identify_trading_opportunities(correlations)

            # Execute valid signals
            await self._execute_signals(signals)

            # Manage existing positions
            await self._manage_positions()
        except Exception as e:
            logger.error(f"Error in correlation iteration: {e}")

    async def _initialize_price_history(self):
        """Initialize historical price data for all symbols"""
        try:
            all_symbols = [self.config.leader_symbol] + self.config.follower_symbols

            for symbol in all_symbols:
                # Get historical data
                ohlcv_data = await self.client.get_ohlcv(
                    symbol, self.config.timeframe, self.config.lookback_period + 50
                )

                # Convert to price history
                price_history = []
                for candle in ohlcv_data:
                    price_history.append(
                        (candle[0], Decimal(str(candle[4])))
                    )  # (timestamp, close)

                self.price_history[symbol] = price_history
                logger.debug(
                    f"Initialized price history for {symbol}: {len(price_history)} points"
                )

        except Exception as e:
            logger.error(f"Error initializing price history: {e}")

    async def _update_price_data(self):
        """Update current prices for all symbols"""
        try:
            all_symbols = [self.config.leader_symbol] + self.config.follower_symbols
            current_time = time.time()

            for symbol in all_symbols:
                # Get current market data
                market_data = await self.client.get_market_data(symbol)
                current_price = market_data.last_price

                # Add to price history
                if symbol not in self.price_history:
                    self.price_history[symbol] = []

                self.price_history[symbol].append((current_time * 1000, current_price))

                # Keep only recent data (last 500 points)
                if len(self.price_history[symbol]) > 500:
                    self.price_history[symbol] = self.price_history[symbol][-500:]

        except Exception as e:
            logger.error(f"Error updating price data: {e}")

    async def _update_positions(self):
        """Update active positions from exchange"""
        try:
            positions = await self.client.get_positions()
            self.active_positions = {}

            for position in positions:
                if (
                    position.symbol in self.config.follower_symbols
                    and abs(position.size) > 0
                ):
                    self.active_positions[position.symbol] = position

        except Exception as e:
            logger.error(f"Error updating positions: {e}")

    async def _calculate_correlations(self) -> Dict[str, float]:
        """Calculate rolling correlations between leader and followers"""
        try:
            correlations = {}
            leader_prices = self._get_price_returns(self.config.leader_symbol)

            if len(leader_prices) < 10:
                return correlations

            for follower in self.config.follower_symbols:
                follower_prices = self._get_price_returns(follower)

                if len(follower_prices) >= len(leader_prices):
                    # Calculate correlation
                    correlation = self._calculate_correlation_coefficient(
                        leader_prices[-len(follower_prices) :], follower_prices
                    )
                    correlations[follower] = correlation

                    # Store in history
                    pair_key = (self.config.leader_symbol, follower)
                    if pair_key not in self.correlation_history:
                        self.correlation_history[pair_key] = []

                    self.correlation_history[pair_key].append(correlation)

                    # Keep only recent correlation values
                    if len(self.correlation_history[pair_key]) > 100:
                        self.correlation_history[pair_key] = self.correlation_history[
                            pair_key
                        ][-100:]

            return correlations

        except Exception as e:
            logger.error(f"Error calculating correlations: {e}")
            return {}

    def _get_price_returns(self, symbol: str) -> List[float]:
        """Calculate price returns for correlation analysis"""
        try:
            if symbol not in self.price_history or len(self.price_history[symbol]) < 2:
                return []

            prices = [float(price) for _, price in self.price_history[symbol]]
            returns = []

            for i in range(1, len(prices)):
                if prices[i - 1] != 0:
                    return_rate = (prices[i] - prices[i - 1]) / prices[i - 1]
                    returns.append(return_rate)

            return returns

        except Exception as e:
            logger.error(f"Error calculating price returns for {symbol}: {e}")
            return []

    def _calculate_correlation_coefficient(
        self, x: List[float], y: List[float]
    ) -> float:
        """Calculate Pearson correlation coefficient"""
        try:
            if len(x) != len(y) or len(x) < 2:
                return 0.0

            x_mean = np.mean(x)
            y_mean = np.mean(y)

            numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y))
            x_variance = sum((xi - x_mean) ** 2 for xi in x)
            y_variance = sum((yi - y_mean) ** 2 for yi in y)

            denominator = np.sqrt(x_variance * y_variance)

            if denominator == 0:
                return 0.0

            correlation = numerator / denominator
            return correlation

        except Exception as e:
            logger.error(f"Error calculating correlation: {e}")
            return 0.0

    async def _identify_trading_opportunities(
        self, correlations: Dict[str, float]
    ) -> List[CorrelationSignal]:
        """Identify lagging cryptocurrencies that are likely to follow the leader"""
        try:
            signals = []
            current_time = time.time()

            # Get current market data for all symbols
            all_symbols = [self.config.leader_symbol] + self.config.follower_symbols
            market_data = {}

            for symbol in all_symbols:
                market_data[symbol] = await self.client.get_market_data(symbol)

            # Get recent price movement of leader
            leader_data = market_data[self.config.leader_symbol]
            leader_price = leader_data.last_price

            # Calculate leader's recent movement (last few candles)
            leader_movement = await self._calculate_recent_movement(
                self.config.leader_symbol
            )

            for follower in self.config.follower_symbols:
                # Check if correlation is strong enough
                correlation = correlations.get(follower, 0)
                if abs(correlation) < float(self.config.min_correlation):
                    continue

                # Check cooldown period
                last_entry = self.last_entry_times.get(follower, 0)
                if current_time - last_entry < self.config.entry_cooldown_minutes * 60:
                    continue

                # Check if we already have a position in this follower
                if follower in self.active_positions:
                    continue

                # Calculate follower's movement
                follower_movement = await self._calculate_recent_movement(follower)
                follower_market_data = market_data[follower]

                # Identify lagging behavior
                lag_percentage = self._calculate_lag_percentage(
                    leader_movement, follower_movement, correlation
                )

                # Generate signals based on leader's direction and follower's lag
                if (
                    leader_movement > 0
                    and lag_percentage > self.config.lag_threshold_percentage
                ):
                    # Leader is strong, follower is lagging upward - go long
                    signal = CorrelationSignal(
                        leader_symbol=self.config.leader_symbol,
                        follower_symbol=follower,
                        direction="long",
                        entry_price=follower_market_data.bid,  # Buy at bid
                        lag_percentage=lag_percentage,
                        correlation_strength=abs(correlation),
                        timestamp=current_time,
                    )
                    signals.append(signal)

                elif (
                    leader_movement < 0
                    and lag_percentage > self.config.lag_threshold_percentage
                ):
                    # Leader is weak, follower is lagging downward - go short
                    signal = CorrelationSignal(
                        leader_symbol=self.config.leader_symbol,
                        follower_symbol=follower,
                        direction="short",
                        entry_price=follower_market_data.ask,  # Sell at ask
                        lag_percentage=lag_percentage,
                        correlation_strength=abs(correlation),
                        timestamp=current_time,
                    )
                    signals.append(signal)

            # Sort signals by lag percentage (highest lag first)
            signals.sort(key=lambda x: x.lag_percentage, reverse=True)

            # Limit number of concurrent positions
            max_new_positions = self.config.max_positions - len(self.active_positions)
            return signals[:max_new_positions]

        except Exception as e:
            logger.error(f"Error identifying trading opportunities: {e}")
            return []

    async def _calculate_recent_movement(self, symbol: str) -> float:
        """Calculate recent price movement percentage"""
        try:
            if (
                symbol not in self.price_history
                or len(self.price_history[symbol]) < self.config.lookback_period
            ):
                return 0.0

            # Get price at the beginning of lookback period
            old_price = self.price_history[symbol][-self.config.lookback_period][1]
            current_price = self.price_history[symbol][-1][1]

            if old_price == 0:
                return 0.0

            movement = (float(current_price - old_price) / float(old_price)) * 100
            return movement

        except Exception as e:
            logger.error(f"Error calculating recent movement for {symbol}: {e}")
            return 0.0

    def _calculate_lag_percentage(
        self, leader_movement: float, follower_movement: float, correlation: float
    ) -> Decimal:
        """Calculate how much the follower is lagging behind the leader"""
        try:
            # Expected follower movement based on correlation
            expected_follower_movement = leader_movement * correlation

            # Actual lag
            lag = abs(expected_follower_movement - follower_movement)

            return Decimal(str(lag))

        except Exception as e:
            logger.error(f"Error calculating lag percentage: {e}")
            return Decimal("0")

    async def _execute_signals(self, signals: List[CorrelationSignal]):
        """Execute correlation trading signals"""
        try:
            for signal in signals:
                logger.info(
                    f"🎯 Executing correlation signal: {signal.direction} {signal.follower_symbol}"
                )
                logger.info(
                    f"   Lag: {signal.lag_percentage:.3f}%, Correlation: {signal.correlation_strength:.3f}"
                )

                # Calculate position size
                position_size = await self._calculate_position_size(signal)

                if position_size == 0:
                    logger.warning(
                        f"Position size calculated as 0 for {signal.follower_symbol}"
                    )
                    continue

                # Place entry order
                if signal.direction == "long":
                    await self._enter_long_position(signal, position_size)
                else:
                    await self._enter_short_position(signal, position_size)

                # Update last entry time
                self.last_entry_times[signal.follower_symbol] = signal.timestamp

                self.total_trades += 1

        except Exception as e:
            logger.error(f"Error executing signals: {e}")

    async def _enter_long_position(self, signal: CorrelationSignal, size: Decimal):
        """Enter a long position based on correlation signal"""
        try:
            # Place limit order at bid price
            order_response = await self.client.place_order(
                symbol=signal.follower_symbol,
                side="buy",
                size=size,
                order_type="limit",
                price=signal.entry_price,
                time_in_force="PostOnly",
            )

            if order_response.get("status") == "ok":
                logger.info(
                    f"✅ Long correlation order placed: {size} {signal.follower_symbol} @ {signal.entry_price}"
                )

                # Place stop loss and take profit orders
                stop_loss_price = signal.entry_price * (
                    Decimal("1") - self.config.stop_loss_percentage
                )
                take_profit_price = signal.entry_price * (
                    Decimal("1") + self.config.take_profit_percentage
                )

                # Note: In a real implementation, you would place stop orders
                # For now, we'll track them in memory and manage them manually
                logger.info(
                    f"   Stop Loss: {stop_loss_price}, Take Profit: {take_profit_price}"
                )

            else:
                logger.error(
                    f"Failed to place long correlation order: {order_response}"
                )

        except Exception as e:
            logger.error(f"Error entering long position: {e}")

    async def _enter_short_position(self, signal: CorrelationSignal, size: Decimal):
        """Enter a short position based on correlation signal"""
        try:
            # Place limit order at ask price
            order_response = await self.client.place_order(
                symbol=signal.follower_symbol,
                side="sell",
                size=size,
                order_type="limit",
                price=signal.entry_price,
                time_in_force="PostOnly",
            )

            if order_response.get("status") == "ok":
                logger.info(
                    f"✅ Short correlation order placed: {size} {signal.follower_symbol} @ {signal.entry_price}"
                )

                # Place stop loss and take profit orders
                stop_loss_price = signal.entry_price * (
                    Decimal("1") + self.config.stop_loss_percentage
                )
                take_profit_price = signal.entry_price * (
                    Decimal("1") - self.config.take_profit_percentage
                )

                # Note: In a real implementation, you would place stop orders
                logger.info(
                    f"   Stop Loss: {stop_loss_price}, Take Profit: {take_profit_price}"
                )

            else:
                logger.error(
                    f"Failed to place short correlation order: {order_response}"
                )

        except Exception as e:
            logger.error(f"Error entering short position: {e}")

    async def _calculate_position_size(self, signal: CorrelationSignal) -> Decimal:
        """Calculate optimal position size based on correlation strength and risk"""
        try:
            # Base size adjusted by correlation strength
            adjusted_size = self.config.size * Decimal(str(signal.correlation_strength))

            # Adjust by lag percentage (higher lag = more confident)
            lag_multiplier = min(
                Decimal("2.0"), Decimal("1") + (signal.lag_percentage / Decimal("100"))
            )
            final_size = adjusted_size * lag_multiplier

            return final_size

        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return Decimal("0")

    async def _manage_positions(self):
        """Manage existing correlation positions"""
        try:
            for symbol, position in list(self.active_positions.items()):
                # Get current market data
                market_data = await self.client.get_market_data(symbol)
                current_price = market_data.last_price

                # Calculate PnL
                if position.side == "long":
                    pnl = (current_price - position.entry_price) * position.size
                    pnl_percentage = (
                        (current_price - position.entry_price) / position.entry_price
                    ) * 100
                else:
                    pnl = (position.entry_price - current_price) * position.size
                    pnl_percentage = (
                        (position.entry_price - current_price) / position.entry_price
                    ) * 100

                # Check exit conditions
                exit_triggered = False
                exit_reason = ""

                # Take profit
                if pnl_percentage >= float(self.config.take_profit_percentage) * 100:
                    exit_triggered = True
                    exit_reason = "take_profit"

                # Stop loss
                elif pnl_percentage <= -float(self.config.stop_loss_percentage) * 100:
                    exit_triggered = True
                    exit_reason = "stop_loss"

                # Time-based exit (correlation may have broken)
                elif await self._should_exit_due_to_correlation_breakdown(symbol):
                    exit_triggered = True
                    exit_reason = "correlation_breakdown"

                if exit_triggered:
                    logger.info(
                        f"📤 Exiting {symbol} position: {exit_reason}, PnL: {pnl_percentage:.2f}%"
                    )
                    await self._close_position(symbol, position)

                    # Update performance metrics
                    if pnl > 0:
                        self.winning_trades += 1
                    self.total_pnl += pnl

        except Exception as e:
            logger.error(f"Error managing positions: {e}")

    async def _should_exit_due_to_correlation_breakdown(self, symbol: str) -> bool:
        """Check if correlation has broken down and position should be exited"""
        try:
            pair_key = (self.config.leader_symbol, symbol)
            if (
                pair_key not in self.correlation_history
                or len(self.correlation_history[pair_key]) < 5
            ):
                return False

            # Get recent correlations
            recent_correlations = self.correlation_history[pair_key][-5:]
            avg_correlation = np.mean(recent_correlations)

            # Exit if correlation has dropped significantly
            if avg_correlation < float(self.config.min_correlation) * 0.5:
                return True

            return False

        except Exception as e:
            logger.error(f"Error checking correlation breakdown: {e}")
            return False

    async def _close_position(self, symbol: str, position: Position):
        """Close a position"""
        try:
            close_side = "sell" if position.side == "long" else "buy"
            size = abs(position.size)

            # Use market order for immediate execution
            order_response = await self.client.place_order(
                symbol=symbol,
                side=close_side,
                size=size,
                order_type="market",
                reduce_only=True,
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Position closed: {size} {symbol}")
                # Remove from active positions
                if symbol in self.active_positions:
                    del self.active_positions[symbol]
            else:
                logger.error(f"Failed to close position: {order_response}")

        except Exception as e:
            logger.error(f"Error closing position: {e}")

    def get_performance_stats(self) -> Dict:
        """Get current performance statistics"""
        try:
            win_rate = (self.winning_trades / max(self.total_trades, 1)) * 100

            # Calculate current correlations
            current_correlations = {}
            for pair_key, history in self.correlation_history.items():
                if history:
                    current_correlations[f"{pair_key[0]}-{pair_key[1]}"] = history[-1]

            return {
                "total_trades": self.total_trades,
                "winning_trades": self.winning_trades,
                "win_rate": win_rate,
                "total_pnl": float(self.total_pnl),
                "active_positions": len(self.active_positions),
                "active_position_symbols": list(self.active_positions.keys()),
                "current_correlations": current_correlations,
                "leader_symbol": self.config.leader_symbol,
                "follower_symbols": self.config.follower_symbols,
            }
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {}
