"""
Enhanced Mean Reversion Strategy
Based on the 74-ticker multi-crypto algorithm from bonus_algos
Optimized for Hyperliquid with statistical analysis and dynamic entry/exit
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
import statistics

from ..utils.hyperliquid_client import HyperliquidClient, MarketData, Position

logger = logging.getLogger(__name__)

@dataclass
class MeanReversionConfig:
    """Configuration for mean reversion strategy"""
    symbols: List[str]  # List of symbols to trade
    timeframe: str = "15m"
    sma_period: int = 20
    entry_threshold_deviation: float = 2.0  # Entry at 2 standard deviations
    exit_threshold_deviation: float = 0.5  # Exit at 0.5 standard deviations
    max_positions: int = 10
    size_per_position: Decimal = Decimal('200')
    lookback_period: int = 100
    min_volume_threshold: float = 1000000  # Minimum 24h volume
    volatility_threshold: float = 0.05  # 5% daily volatility threshold
    correlation_threshold: float = 0.7  # Avoid highly correlated positions

@dataclass
class MeanReversionSignal:
    """Represents a mean reversion signal"""
    symbol: str
    direction: str  # "long" or "short"
    entry_price: Decimal
    deviation: float  # Number of standard deviations
    sma_value: Decimal
    volatility: float
    z_score: float
    confidence: float  # Signal confidence (0-1)
    timestamp: float

class MeanReversionTrader:
    """
    Advanced mean reversion strategy for multiple cryptocurrencies
    Features:
    - Statistical arbitrage across multiple assets
    - Dynamic standard deviation analysis
    - Correlation-based position filtering
    - Volatility-adjusted position sizing
    - Risk management with portfolio exposure limits
    - High-frequency execution
    """

    def __init__(self, client: HyperliquidClient, config: MeanReversionConfig):
        self.client = client
        self.config = config
        self.active_positions: Dict[str, Position] = {}
        self.price_history: Dict[str, List[Tuple[float, Decimal]]] = {}
        self.market_stats: Dict[str, Dict] = {}
        self.correlation_matrix: Dict[str, Dict[str, float]] = {}
        self.total_trades = 0
        self.winning_trades = 0
        self.total_pnl = Decimal('0')
        self.daily_pnl = Decimal('0')

        logger.info(f"Initialized Mean Reversion Trader for {len(config.symbols)} symbols")

    async def start(self):
        """Start the mean reversion trading bot"""
        logger.info(f"📊 Starting Mean Reversion Trader for {len(self.config.symbols)} symbols")

        # Initialize data
        await self._initialize_market_data()

        while True:
            try:
                # Update market data for all symbols
                await self._update_all_market_data()

                # Calculate market statistics
                await self._calculate_market_statistics()

                # Calculate correlation matrix
                await self._calculate_correlation_matrix()

                # Identify mean reversion opportunities
                signals = await self._identify_mean_reversion_signals()

                # Filter signals based on portfolio constraints
                filtered_signals = await self._filter_signals(signals)

                # Execute valid signals
                await self._execute_signals(filtered_signals)

                # Manage existing positions
                await self._manage_positions()

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Error in mean reversion trading loop: {e}")
                await asyncio.sleep(60)

    async def _initialize_market_data(self):
        """Initialize historical market data for all symbols"""
        try:
            for symbol in self.config.symbols:
                logger.info(f"Initializing data for {symbol}")

                # Get historical OHLCV data
                ohlcv_data = await self.client.get_ohlcv(
                    symbol,
                    self.config.timeframe,
                    self.config.lookback_period + 50
                )

                # Get market data for current stats
                market_data = await self.client.get_market_data(symbol)

                # Store price history
                price_history = []
                for candle in ohlcv_data:
                    price_history.append((candle[0], Decimal(str(candle[4]))))  # (timestamp, close)

                self.price_history[symbol] = price_history

                # Initialize market stats
                self.market_stats[symbol] = {
                    'current_price': market_data.last_price,
                    'volume_24h': float(market_data.volume_24h),
                    'bid': market_data.bid,
                    'ask': market_data.ask,
                    'spread_percentage': float((market_data.ask - market_data.bid) / market_data.last_price * 100),
                    'last_update': time.time()
                }

                # Small delay to respect rate limits
                await asyncio.sleep(0.1)

            logger.info(f"✅ Initialized data for {len(self.config.symbols)} symbols")

        except Exception as e:
            logger.error(f"Error initializing market data: {e}")

    async def _update_all_market_data(self):
        """Update market data for all symbols"""
        try:
            current_time = time.time()

            for symbol in self.config.symbols:
                # Get current market data
                market_data = await self.client.get_market_data(symbol)
                current_price = market_data.last_price

                # Update price history
                if symbol not in self.price_history:
                    self.price_history[symbol] = []

                self.price_history[symbol].append((current_time * 1000, current_price))

                # Keep only recent data
                if len(self.price_history[symbol]) > 1000:
                    self.price_history[symbol] = self.price_history[symbol][-1000:]

                # Update market stats
                self.market_stats[symbol] = {
                    'current_price': current_price,
                    'volume_24h': float(market_data.volume_24h),
                    'bid': market_data.bid,
                    'ask': market_data.ask,
                    'spread_percentage': float((market_data.ask - market_data.bid) / current_price * 100),
                    'last_update': current_time
                }

                # Small delay to respect rate limits
                await asyncio.sleep(0.05)

        except Exception as e:
            logger.error(f"Error updating market data: {e}")

    async def _calculate_market_statistics(self):
        """Calculate statistical metrics for all symbols"""
        try:
            for symbol in self.config.symbols:
                if symbol not in self.price_history or len(self.price_history[symbol]) < self.config.lookback_period:
                    continue

                # Extract recent prices
                recent_prices = [float(price) for _, price in self.price_history[symbol][-self.config.lookback_period:]]

                if len(recent_prices) < self.config.sma_period:
                    continue

                # Calculate SMA
                sma_values = []
                for i in range(self.config.sma_period, len(recent_prices)):
                    sma = np.mean(recent_prices[i - self.config.sma_period:i])
                    sma_values.append(sma)

                current_sma = sma_values[-1] if sma_values else recent_prices[-1]

                # Calculate standard deviation
                deviations = []
                for i in range(self.config.sma_period, len(recent_prices)):
                    price = recent_prices[i]
                    sma = sma_values[i - self.config.sma_period] if i - self.config.sma_period < len(sma_values) else current_sma
                    deviation = price - sma
                    deviations.append(deviation)

                std_dev = np.std(deviations) if deviations else 0

                # Calculate current z-score
                current_price = recent_prices[-1]
                current_deviation = current_price - current_sma
                current_z_score = current_deviation / std_dev if std_dev != 0 else 0

                # Calculate volatility (standard deviation of returns)
                returns = []
                for i in range(1, len(recent_prices)):
                    if recent_prices[i-1] != 0:
                        return_rate = (recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1]
                        returns.append(return_rate)

                volatility = np.std(returns) if returns else 0

                # Update market stats
                self.market_stats[symbol].update({
                    'sma': current_sma,
                    'std_dev': std_dev,
                    'z_score': current_z_score,
                    'volatility': volatility,
                    'deviation': current_deviation
                })

        except Exception as e:
            logger.error(f"Error calculating market statistics: {e}")

    async def _calculate_correlation_matrix(self):
        """Calculate correlation matrix between all symbols"""
        try:
            symbols = self.config.symbols
            returns_data = {}

            # Calculate returns for each symbol
            for symbol in symbols:
                if symbol not in self.price_history or len(self.price_history[symbol]) < 50:
                    continue

                prices = [float(price) for _, price in self.price_history[symbol][-50:]]
                returns = []

                for i in range(1, len(prices)):
                    if prices[i-1] != 0:
                        return_rate = (prices[i] - prices[i-1]) / prices[i-1]
                        returns.append(return_rate)

                if len(returns) >= 20:
                    returns_data[symbol] = returns[-20:]  # Use last 20 returns

            # Calculate correlations
            self.correlation_matrix = {}
            for symbol1 in symbols:
                if symbol1 not in returns_data:
                    continue

                self.correlation_matrix[symbol1] = {}
                for symbol2 in symbols:
                    if symbol2 not in returns_data:
                        continue

                    if symbol1 == symbol2:
                        self.correlation_matrix[symbol1][symbol2] = 1.0
                    else:
                        correlation = self._calculate_correlation(
                            returns_data[symbol1],
                            returns_data[symbol2]
                        )
                        self.correlation_matrix[symbol1][symbol2] = correlation

        except Exception as e:
            logger.error(f"Error calculating correlation matrix: {e}")

    def _calculate_correlation(self, x: List[float], y: List[float]) -> float:
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

            return numerator / denominator

        except Exception as e:
            logger.error(f"Error calculating correlation: {e}")
            return 0.0

    async def _identify_mean_reversion_signals(self) -> List[MeanReversionSignal]:
        """Identify mean reversion opportunities across all symbols"""
        try:
            signals = []
            current_time = time.time()

            for symbol in self.config.symbols:
                if symbol not in self.market_stats:
                    continue

                stats = self.market_stats[symbol]

                # Check minimum volume requirement
                if stats['volume_24h'] < self.config.min_volume_threshold:
                    continue

                # Check volatility threshold
                if stats['volatility'] > self.config.volatility_threshold:
                    continue

                # Check if we already have a position
                if symbol in self.active_positions:
                    continue

                # Get z-score and deviation
                z_score = stats.get('z_score', 0)
                sma = stats.get('sma', stats['current_price'])
                deviation = stats.get('deviation', 0)
                std_dev = stats.get('std_dev', 1)

                # Generate signals based on deviation from mean
                if z_score <= -self.config.entry_threshold_deviation:
                    # Price is significantly below mean - potential long entry
                    confidence = min(1.0, abs(z_score) / self.config.entry_threshold_deviation)

                    signal = MeanReversionSignal(
                        symbol=symbol,
                        direction="long",
                        entry_price=stats['bid'],  # Buy at bid
                        deviation=abs(z_score),
                        sma_value=Decimal(str(sma)),
                        volatility=stats['volatility'],
                        z_score=z_score,
                        confidence=confidence,
                        timestamp=current_time
                    )
                    signals.append(signal)

                elif z_score >= self.config.entry_threshold_deviation:
                    # Price is significantly above mean - potential short entry
                    confidence = min(1.0, abs(z_score) / self.config.entry_threshold_deviation)

                    signal = MeanReversionSignal(
                        symbol=symbol,
                        direction="short",
                        entry_price=stats['ask'],  # Sell at ask
                        deviation=abs(z_score),
                        sma_value=Decimal(str(sma)),
                        volatility=stats['volatility'],
                        z_score=z_score,
                        confidence=confidence,
                        timestamp=current_time
                    )
                    signals.append(signal)

            # Sort by confidence and deviation
            signals.sort(key=lambda x: (x.confidence, x.deviation), reverse=True)

            return signals

        except Exception as e:
            logger.error(f"Error identifying mean reversion signals: {e}")
            return []

    async def _filter_signals(self, signals: List[MeanReversionSignal]) -> List[MeanReversionSignal]:
        """Filter signals based on portfolio constraints and correlation"""
        try:
            filtered_signals = []
            current_positions = set(self.active_positions.keys())
            max_new_positions = self.config.max_positions - len(current_positions)

            if max_new_positions <= 0:
                return []

            for signal in signals:
                if len(filtered_signals) >= max_new_positions:
                    break

                symbol = signal.symbol

                # Check correlation with existing positions
                correlation_ok = True
                for existing_symbol in current_positions:
                    if (symbol in self.correlation_matrix and
                        existing_symbol in self.correlation_matrix[symbol] and
                        abs(self.correlation_matrix[symbol][existing_symbol]) > self.config.correlation_threshold):
                        correlation_ok = False
                        logger.debug(f"Skipping {symbol} - high correlation with {existing_symbol}")
                        break

                if correlation_ok:
                    filtered_signals.append(signal)

            return filtered_signals

        except Exception as e:
            logger.error(f"Error filtering signals: {e}")
            return []

    async def _execute_signals(self, signals: List[MeanReversionSignal]):
        """Execute mean reversion signals"""
        try:
            for signal in signals:
                logger.info(f"🎯 Executing mean reversion signal: {signal.direction} {signal.symbol}")
                logger.info(f"   Z-Score: {signal.z_score:.2f}, Deviation: {signal.deviation:.2f}σ, Confidence: {signal.confidence:.2f}")

                # Calculate position size based on confidence and volatility
                position_size = await self._calculate_position_size(signal)

                if position_size == 0:
                    logger.warning(f"Position size calculated as 0 for {signal.symbol}")
                    continue

                # Place entry order
                if signal.direction == "long":
                    await self._enter_long_position(signal, position_size)
                else:
                    await self._enter_short_position(signal, position_size)

                self.total_trades += 1

        except Exception as e:
            logger.error(f"Error executing signals: {e}")

    async def _calculate_position_size(self, signal: MeanReversionSignal) -> Decimal:
        """Calculate position size based on confidence and volatility"""
        try:
            # Base size adjusted by confidence
            confidence_adjusted_size = self.config.size_per_position * Decimal(str(signal.confidence))

            # Adjust for volatility (lower volatility = larger position)
            if signal.volatility > 0:
                volatility_adjustment = min(2.0, self.config.volatility_threshold / signal.volatility)
            else:
                volatility_adjustment = 2.0

            final_size = confidence_adjusted_size * Decimal(str(volatility_adjustment))

            return final_size

        except Exception as e:
            logger.error(f"Error calculating position size: {e}")
            return Decimal('0')

    async def _enter_long_position(self, signal: MeanReversionSignal, size: Decimal):
        """Enter a long position based on mean reversion signal"""
        try:
            order_response = await self.client.place_order(
                symbol=signal.symbol,
                side="buy",
                size=size,
                order_type="limit",
                price=signal.entry_price,
                time_in_force="PostOnly"
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Long mean reversion order placed: {size} {signal.symbol} @ {signal.entry_price}")
            else:
                logger.error(f"Failed to place long order: {order_response}")

        except Exception as e:
            logger.error(f"Error entering long position: {e}")

    async def _enter_short_position(self, signal: MeanReversionSignal, size: Decimal):
        """Enter a short position based on mean reversion signal"""
        try:
            order_response = await self.client.place_order(
                symbol=signal.symbol,
                side="sell",
                size=size,
                order_type="limit",
                price=signal.entry_price,
                time_in_force="PostOnly"
            )

            if order_response.get("status") == "ok":
                logger.info(f"✅ Short mean reversion order placed: {size} {signal.symbol} @ {signal.entry_price}")
            else:
                logger.error(f"Failed to place short order: {order_response}")

        except Exception as e:
            logger.error(f"Error entering short position: {e}")

    async def _manage_positions(self):
        """Manage existing mean reversion positions"""
        try:
            # Update positions from exchange
            positions = await self.client.get_positions()
            self.active_positions = {}

            for position in positions:
                if position.symbol in self.config.symbols and abs(position.size) > 0:
                    self.active_positions[position.symbol] = position

            # Check exit conditions for each position
            for symbol, position in list(self.active_positions.items()):
                await self._check_exit_conditions(symbol, position)

        except Exception as e:
            logger.error(f"Error managing positions: {e}")

    async def _check_exit_conditions(self, symbol: str, position: Position):
        """Check if position should be closed based on mean reversion"""
        try:
            if symbol not in self.market_stats:
                return

            stats = self.market_stats[symbol]
            current_z_score = stats.get('z_score', 0)

            exit_triggered = False
            exit_reason = ""

            # Exit if price has reverted to near the mean
            if abs(current_z_score) <= self.config.exit_threshold_deviation:
                exit_triggered = True
                exit_reason = "mean_reversion"

            # Calculate PnL
            current_price = stats['current_price']
            if position.side == "long":
                pnl = (current_price - position.entry_price) * position.size
                pnl_percentage = ((current_price - position.entry_price) / position.entry_price) * 100
            else:
                pnl = (position.entry_price - current_price) * position.size
                pnl_percentage = ((position.entry_price - current_price) / position.entry_price) * 100

            # Emergency exit if loss is too large
            if pnl_percentage <= -5.0:  # 5% loss threshold
                exit_triggered = True
                exit_reason = "stop_loss"

            if exit_triggered:
                logger.info(f"📤 Exiting {symbol} position: {exit_reason}, Z-Score: {current_z_score:.2f}, PnL: {pnl_percentage:.2f}%")
                await self._close_position(symbol, position)

                # Update performance metrics
                if pnl > 0:
                    self.winning_trades += 1
                self.total_pnl += pnl
                self.daily_pnl += pnl

        except Exception as e:
            logger.error(f"Error checking exit conditions: {e}")

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
                reduce_only=True
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

            # Get current market statistics
            current_opportunities = 0
            for symbol in self.config.symbols:
                if symbol in self.market_stats:
                    z_score = self.market_stats[symbol].get('z_score', 0)
                    if abs(z_score) >= self.config.exit_threshold_deviation:
                        current_opportunities += 1

            return {
                "total_trades": self.total_trades,
                "winning_trades": self.winning_trades,
                "win_rate": win_rate,
                "total_pnl": float(self.total_pnl),
                "daily_pnl": float(self.daily_pnl),
                "active_positions": len(self.active_positions),
                "active_position_symbols": list(self.active_positions.keys()),
                "total_symbols_tracked": len(self.config.symbols),
                "current_opportunities": current_opportunities,
                "avg_position_size": float(self.config.size_per_position)
            }
        except Exception as e:
            logger.error(f"Error getting performance stats: {e}")
            return {}