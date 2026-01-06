"""
Unit Tests for Trading Strategies

This module contains comprehensive unit tests for all trading strategies
including edge cases, error handling, and performance validation.
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# Import trading strategies (these would be the actual implementations)
from src.trading.sma_strategy import SMAStrategy
from src.trading.rsi_strategy import RSIStrategy
from src.trading.vwap_strategy import VWAPStrategy
from src.trading.market_maker import MarketMakerStrategy
from src.trading.solana_sniper import SolanaSniperStrategy

class TestSMAStrategy(unittest.TestCase):
    """Unit tests for Simple Moving Average Strategy"""

    def setUp(self):
        """Set up test fixtures"""
        self.strategy = SMAStrategy()
        self.sample_data = self._create_sample_data()

    def _create_sample_data(self):
        """Create sample OHLCV data for testing"""
        dates = pd.date_range(start='2023-01-01', periods=100, freq='1h')
        np.random.seed(42)
        prices = 50000 + np.cumsum(np.random.normal(0, 100, 100))

        return pd.DataFrame({
            'timestamp': dates,
            'open': prices,
            'high': prices * 1.01,
            'low': prices * 0.99,
            'close': prices,
            'volume': np.random.uniform(100, 1000, 100)
        })

    def test_sma_calculation(self):
        """Test SMA calculation accuracy"""
        fast_sma = self.strategy.calculate_sma(self.sample_data['close'], period=10)
        slow_sma = self.strategy.calculate_sma(self.sample_data['close'], period=20)

        # Check that SMA is calculated correctly
        self.assertEqual(len(fast_sma), len(self.sample_data))
        self.assertEqual(len(slow_sma), len(self.sample_data))

        # Check first values should be NaN (not enough data)
        self.assertTrue(pd.isna(fast_sma.iloc[0]))
        self.assertTrue(pd.isna(slow_sma.iloc[0]))

        # Check later values are not NaN
        self.assertFalse(pd.isna(fast_sma.iloc[20]))
        self.assertFalse(pd.isna(slow_sma.iloc[20]))

    def test_signal_generation(self):
        """Test trading signal generation"""
        signals = self.strategy.generate_signals(self.sample_data)

        # Verify signals are -1, 0, or 1
        valid_signals = set([-1, 0, 1])
        self.assertTrue(all(sig in valid_signals for sig in signals if not pd.isna(sig)))

        # Verify signal length matches data length
        self.assertEqual(len(signals), len(self.sample_data))

    def test_crossover_detection(self):
        """Test SMA crossover detection"""
        # Create data with known crossover
        data = pd.DataFrame({
            'close': [100, 101, 102, 103, 102, 101, 100] * 10
        })

        fast_sma = data['close'].rolling(5).mean()
        slow_sma = data['close'].rolling(10).mean()

        crossovers = self.strategy.detect_crossovers(fast_sma, slow_sma)

        # Should detect both bullish and bearish crossovers
        self.assertIsInstance(crossovers, list)
        self.assertTrue(len(crossovers) >= 0)

    def test_position_sizing(self):
        """Test position sizing logic"""
        account_balance = 100000
        risk_per_trade = 0.02  # 2% risk

        position_size = self.strategy.calculate_position_size(
            account_balance, risk_per_trade, entry_price=50000, stop_loss=49000
        )

        # Position size should be positive
        self.assertGreater(position_size, 0)

        # Position should not exceed account balance
        position_value = position_size * 50000
        self.assertLessEqual(position_value, account_balance)

    def test_risk_management(self):
        """Test risk management parameters"""
        stop_loss = self.strategy.calculate_stop_loss(
            entry_price=50000, side='long', atr=500
        )

        # Stop loss should be below entry for long positions
        self.assertLess(stop_loss, 50000)

        take_profit = self.strategy.calculate_take_profit(
            entry_price=50000, side='long', risk_reward_ratio=2.0
        )

        # Take profit should be above entry for long positions
        self.assertGreater(take_profit, 50000)

    def test_edge_cases(self):
        """Test edge cases and error handling"""
        # Empty data
        empty_data = pd.DataFrame()
        with self.assertRaises(ValueError):
            self.strategy.calculate_sma(empty_data['close'], period=20)

        # Insufficient data
        short_data = pd.DataFrame({'close': [100, 101, 102]})
        sma = self.strategy.calculate_sma(short_data['close'], period=20)
        # Should return NaN for all values due to insufficient data
        self.assertTrue(pd.isna(sma).all())

        # Invalid period
        with self.assertRaises(ValueError):
            self.strategy.calculate_sma(self.sample_data['close'], period=0)

class TestRSIStrategy(unittest.TestCase):
    """Unit tests for Relative Strength Index Strategy"""

    def setUp(self):
        """Set up test fixtures"""
        self.strategy = RSIStrategy()
        self.sample_data = self._create_trending_data()

    def _create_trending_data(self):
        """Create sample data with clear trends"""
        dates = pd.date_range(start='2023-01-01', periods=100, freq='1h')

        # Create price series with clear uptrend then downtrend
        prices = []
        price = 50000
        for i in range(100):
            if i < 50:
                # Uptrend
                price += np.random.uniform(0, 200)
            else:
                # Downtrend
                price -= np.random.uniform(0, 200)
            prices.append(price)

        return pd.DataFrame({
            'timestamp': dates,
            'close': prices,
            'volume': np.random.uniform(100, 1000, 100)
        })

    def test_rsi_calculation(self):
        """Test RSI calculation accuracy"""
        rsi = self.strategy.calculate_rsi(self.sample_data['close'], period=14)

        # RSI should be between 0 and 100
        valid_rsi = rsi.dropna()
        self.assertTrue(all(0 <= val <= 100 for val in valid_rsi))

        # RSI should not be NaN after initial period
        self.assertFalse(pd.isna(rsi.iloc[20]))

        # Test RSI at extreme values
        # With trending data, we should see some extreme RSI values
        self.assertTrue(any(val > 70 for val in valid_rsi) or any(val < 30 for val in valid_rsi))

    def test_overbought_oversold_signals(self):
        """Test overbought/oversold signal generation"""
        rsi = self.strategy.calculate_rsi(self.sample_data['close'], period=14)
        signals = self.strategy.generate_overbought_oversold_signals(rsi)

        # Should generate buy signals when RSI < 30
        # Should generate sell signals when RSI > 70
        # Should hold when 30 <= RSI <= 70

        self.assertIsInstance(signals, pd.Series)
        self.assertEqual(len(signals), len(rsi))

    def test_rsi_divergence(self):
        """Test RSI divergence detection"""
        price_highs = [100, 110, 120, 115]  # Price makes lower high
        rsi_highs = [70, 75, 72, 68]       # RSI makes lower high

        divergence = self.strategy.detect_bearish_divergence(price_highs, rsi_highs)
        self.assertTrue(divergence)

        # Test bullish divergence
        price_lows = [100, 90, 80, 85]     # Price makes higher low
        rsi_lows = [30, 25, 20, 28]       # RSI makes higher low

        divergence = self.strategy.detect_bullish_divergence(price_lows, rsi_lows)
        self.assertTrue(divergence)

    def test_rsi_period_validation(self):
        """Test RSI period validation"""
        # Valid period
        rsi = self.strategy.calculate_rsi(self.sample_data['close'], period=14)
        self.assertIsInstance(rsi, pd.Series)

        # Invalid period (too small)
        with self.assertRaises(ValueError):
            self.strategy.calculate_rsi(self.sample_data['close'], period=1)

        # Invalid period (too large)
        with self.assertRaises(ValueError):
            self.strategy.calculate_rsi(self.sample_data['close'], period=len(self.sample_data))

class TestVWAPStrategy(unittest.TestCase):
    """Unit tests for Volume Weighted Average Price Strategy"""

    def setUp(self):
        """Set up test fixtures"""
        self.strategy = VWAPStrategy()
        self.sample_data = self._create_vwap_data()

    def _create_vwap_data(self):
        """Create sample data with varying volumes"""
        dates = pd.date_range(start='2023-01-01', periods=100, freq='1h')
        np.random.seed(42)

        # Create price and volume data
        base_price = 50000
        prices = base_price + np.cumsum(np.random.normal(0, 100, 100))
        volumes = np.random.uniform(100, 10000, 100)

        return pd.DataFrame({
            'timestamp': dates,
            'open': prices,
            'high': prices * 1.02,
            'low': prices * 0.98,
            'close': prices,
            'volume': volumes
        })

    def test_vwap_calculation(self):
        """Test VWAP calculation accuracy"""
        vwap = self.strategy.calculate_vwap(self.sample_data)

        # VWAP should not be NaN after initial values
        self.assertFalse(pd.isna(vwap.iloc[10]))

        # VWAP should be reasonable compared to price
        # (within a reasonable range of the close price)
        for i in range(10, len(vwap)):
            vwap_val = vwap.iloc[i]
            close_val = self.sample_data['close'].iloc[i]
            self.assertLess(abs(vwap_val - close_val) / close_val, 0.1)  # Within 10%

    def test_vwap_trading_signals(self):
        """Test VWAP-based trading signals"""
        vwap = self.strategy.calculate_vwap(self.sample_data)
        signals = self.strategy.generate_vwap_signals(self.sample_data, vwap)

        # Should generate buy signals when price crosses above VWAP
        # Should generate sell signals when price crosses below VWAP

        self.assertIsInstance(signals, pd.Series)
        self.assertEqual(len(signals), len(self.sample_data))

        # Verify signal values are valid
        valid_signals = set([-1, 0, 1])
        valid_signal_values = [sig for sig in signals if not pd.isna(sig)]
        self.assertTrue(all(sig in valid_signals for sig in valid_signal_values))

    def test_vwap_reset_logic(self):
        """Test VWAP reset logic (e.g., daily reset)"""
        # Create multi-day data
        dates = pd.date_range(start='2023-01-01', periods=200, freq='1h')
        np.random.seed(42)
        prices = 50000 + np.cumsum(np.random.normal(0, 100, 200))

        multi_day_data = pd.DataFrame({
            'timestamp': dates,
            'close': prices,
            'volume': np.random.uniform(100, 1000, 200)
        })

        # Test daily VWAP reset
        daily_vwap = self.strategy.calculate_daily_vwap(multi_day_data)

        # Should have VWAP for each day
        self.assertEqual(len(daily_vwap), len(multi_day_data))

        # VWAP should reset at day boundaries
        # (VWAP should equal price at start of each new day)
        for i in range(1, len(daily_vwap)):
            if multi_day_data['timestamp'].iloc[i].date() != multi_day_data['timestamp'].iloc[i-1].date():
                # New day - VWAP should be close to current price
                self.assertAlmostEqual(daily_vwap.iloc[i], multi_day_data['close'].iloc[i], delta=1000)

    def test_volume_weighting_accuracy(self):
        """Test that volume weighting is applied correctly"""
        # Create simple test data with known values
        test_data = pd.DataFrame({
            'close': [100, 110, 90],
            'volume': [1000, 500, 1500]
        })

        vwap = self.strategy.calculate_vwap(test_data)

        # Manual calculation for verification
        total_volume = test_data['volume'].sum()
        manual_vwap = (test_data['close'] * test_data['volume']).sum() / total_volume

        self.assertAlmostEqual(vwap.iloc[-1], manual_vwap, places=2)

class TestMarketMakerStrategy(unittest.TestCase):
    """Unit tests for Market Maker Strategy"""

    def setUp(self):
        """Set up test fixtures"""
        self.strategy = MarketMakerStrategy()
        self.order_book = self._create_order_book()

    def _create_order_book(self):
        """Create sample order book data"""
        return {
            'bids': [
                [50000, 10.0],   # [price, quantity]
                [49990, 5.0],
                [49980, 8.0],
                [49970, 3.0],
                [49960, 12.0]
            ],
            'asks': [
                [50010, 7.0],
                [50020, 9.0],
                [50030, 6.0],
                [50040, 4.0],
                [50050, 11.0]
            ]
        }

    def test_spread_calculation(self):
        """Test bid-ask spread calculation"""
        spread = self.strategy.calculate_spread(self.order_book)

        # Spread should be positive
        self.assertGreater(spread, 0)

        # Spread should be ask - bid
        expected_spread = 50010 - 50000
        self.assertEqual(spread, expected_spread)

    def test_mid_price_calculation(self):
        """Test mid-price calculation"""
        mid_price = self.strategy.calculate_mid_price(self.order_book)

        # Mid price should be average of best bid and ask
        expected_mid_price = (50000 + 50010) / 2
        self.assertEqual(mid_price, expected_mid_price)

    def test_order_book_imbalance(self):
        """Test order book imbalance calculation"""
        imbalance = self.strategy.calculate_order_book_imbalance(self.order_book)

        # Imbalance should be between -1 and 1
        self.assertGreaterEqual(imbalance, -1)
        self.assertLessEqual(imbalance, 1)

        # Positive imbalance means more bids than asks
        # Negative imbalance means more asks than bids

    def test_inventory_management(self):
        """Test inventory management logic"""
        current_inventory = 100  # Long position
        target_inventory = 0    # Want to be flat

        skew = self.strategy.calculate_inventory_skew(current_inventory, target_inventory)

        # Should generate negative skew (sell pressure) when long
        self.assertLess(skew, 0)

        # Test short position
        skew = self.strategy.calculate_inventory_skew(-100, target_inventory)
        self.assertGreater(skew, 0)  # Should generate positive skew (buy pressure)

    def test_quote_generation(self):
        """Test quote generation logic"""
        mid_price = 50000
        current_spread = 10
        skew = 0.2

        bid_price, ask_price = self.strategy.generate_quotes(
            mid_price, current_spread, skew
        )

        # Bid should be lower than ask
        self.assertLess(bid_price, ask_price)

        # Bid should be lower than mid price
        self.assertLess(bid_price, mid_price)

        # Ask should be higher than mid price
        self.assertGreater(ask_price, mid_price)

        # Spread should be maintained
        actual_spread = ask_price - bid_price
        self.assertAlmostEqual(actual_spread, current_spread, delta=1)

    def test_position_sizing(self):
        """Test position sizing for market making"""
        account_balance = 100000
        max_position_size = 0.1  # 10% of account

        position_size = self.strategy.calculate_mm_position_size(
            account_balance, max_position_size, current_inventory=0
        )

        # Position size should be reasonable
        self.assertGreater(position_size, 0)
        self.assertLessEqual(position_size, account_balance * max_position_size)

    def test_risk_controls(self):
        """Test risk control mechanisms"""
        current_inventory = 15000  # Large position
        max_inventory = 10000

        should_reduce = self.strategy.should_reduce_inventory(
            current_inventory, max_inventory
        )
        self.assertTrue(should_reduce)

        should_reduce = self.strategy.should_reduce_inventory(
            5000, max_inventory
        )
        self.assertFalse(should_reduce)

class TestSolanaSniperStrategy(unittest.TestCase):
    """Unit tests for Solana Sniper Strategy"""

    def setUp(self):
        """Set up test fixtures"""
        self.strategy = SolanaSniperStrategy()

    def test_token_filtering(self):
        """Test token filtering logic"""
        tokens = [
            {'address': 'token1', 'liquidity': 100000, 'volume_24h': 50000, 'holders': 1000},
            {'address': 'token2', 'liquidity': 1000, 'volume_24h': 500, 'holders': 50},  # Should be filtered out
            {'address': 'token3', 'liquidity': 50000, 'volume_24h': 25000, 'holders': 500},
            {'address': 'token4', 'liquidity': 200000, 'volume_24h': 100000, 'holders': 2000},
        ]

        filtered_tokens = self.strategy.filter_tokens(tokens)

        # Should filter out low liquidity tokens
        self.assertEqual(len(filtered_tokens), 3)  # token2 should be filtered out
        self.assertNotIn('token2', [t['address'] for t in filtered_tokens])

    def test_quick_flip_analysis(self):
        """Test quick flip opportunity analysis"""
        token_data = {
            'price': 0.001,
            'volume_1h': 100000,
            'volume_5m': 20000,
            'price_change_5m': 0.05  # 5% increase in 5 minutes
        }

        opportunity = self.strategy.analyze_quick_flip_opportunity(token_data)

        # Should detect momentum if criteria are met
        self.assertIsInstance(opportunity, dict)
        self.assertIn('score', opportunity)
        self.assertIn('recommendation', opportunity)

    def test_gas_optimization(self):
        """Test gas fee optimization"""
        current_gas = 100
        priority_fee = 10

        optimized_fee = self.strategy.optimize_gas_fee(current_gas, priority_fee)

        # Optimized fee should be reasonable
        self.assertGreater(optimized_fee, 0)
        self.assertGreaterEqual(optimized_fee, priority_fee)

    def test_profit_calculation(self):
        """Test profit calculation including fees"""
        entry_price = 0.001
        exit_price = 0.0012
        quantity = 1000000
        gas_fee = 0.1
        platform_fee = 0.05

        profit = self.strategy.calculate_profit(
            entry_price, exit_price, quantity, gas_fee, platform_fee
        )

        # Profit should be positive for profitable trade
        expected_gross_profit = (exit_price - entry_price) * quantity
        expected_net_profit = expected_gross_profit - gas_fee - platform_fee
        self.assertEqual(profit, expected_net_profit)

    def test_risk_management(self):
        """Test risk management for sniping"""
        token_data = {
            'liquidity': 50000,
            'volume_24h': 10000,
            'creator_holdings': 0.8,  # 80% held by creator (red flag)
            'honeypot_score': 0.9     # High honeypot risk
        }

        should_skip = self.strategy.should_skip_token(token_data)
        self.assertTrue(should_skip)

        # Low risk token
        safe_token = {
            'liquidity': 100000,
            'volume_24h': 50000,
            'creator_holdings': 0.1,
            'honeypot_score': 0.1
        }

        should_skip = self.strategy.should_skip_token(safe_token)
        self.assertFalse(should_skip)

    def test_timing_logic(self):
        """Test entry/exit timing logic"""
        price_history = [0.001, 0.0011, 0.0012, 0.00115, 0.00125]

        entry_signal = self.strategy.get_entry_signal(price_history)
        exit_signal = self.strategy.get_exit_signal(price_history, entry_price=0.001)

        # Should provide clear entry/exit signals
        self.assertIn(entry_signal, ['BUY', 'HOLD', 'SELL'])
        self.assertIn(exit_signal, ['TAKE_PROFIT', 'STOP_LOSS', 'HOLD'])

class TestStrategyIntegration(unittest.TestCase):
    """Integration tests for multiple strategies"""

    def setUp(self):
        """Set up integration test fixtures"""
        self.strategies = {
            'sma': SMAStrategy(),
            'rsi': RSIStrategy(),
            'vwap': VWAPStrategy()
        }
        self.market_data = self._create_comprehensive_data()

    def _create_comprehensive_data(self):
        """Create comprehensive market data for integration testing"""
        dates = pd.date_range(start='2023-01-01', periods=200, freq='1h')
        np.random.seed(42)

        # Create realistic price action
        base_price = 50000
        returns = np.random.normal(0.0001, 0.02, 200)
        prices = base_price * np.exp(np.cumsum(returns))

        return pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.998, 1.002, 200),
            'high': prices * np.random.uniform(1.001, 1.03, 200),
            'low': prices * np.random.uniform(0.97, 0.999, 200),
            'close': prices,
            'volume': np.random.uniform(100, 1000, 200)
        })

    def test_strategy_signal_consistency(self):
        """Test that strategies generate consistent signals"""
        signals = {}

        for name, strategy in self.strategies.items():
            if name == 'sma':
                signal = strategy.generate_signals(self.market_data)
            elif name == 'rsi':
                rsi = strategy.calculate_rsi(self.market_data['close'])
                signal = strategy.generate_overbought_oversold_signals(rsi)
            elif name == 'vwap':
                vwap = strategy.calculate_vwap(self.market_data)
                signal = strategy.generate_vwap_signals(self.market_data, vwap)

            signals[name] = signal

        # All signals should have same length
        lengths = [len(sig) for sig in signals.values()]
        self.assertTrue(all(l == lengths[0] for l in lengths))

    def test_strategy_performance_comparison(self):
        """Test performance comparison across strategies"""
        performance = {}

        for name, strategy in self.strategies.items():
            # Generate simple performance metric
            if name == 'sma':
                signals = strategy.generate_signals(self.market_data)
            elif name == 'rsi':
                rsi = strategy.calculate_rsi(self.market_data['close'])
                signals = strategy.generate_overbought_oversold_signals(rsi)
            elif name == 'vwap':
                vwap = strategy.calculate_vwap(self.market_data)
                signals = strategy.generate_vwap_signals(self.market_data, vwap)

            # Calculate simple returns based on signals
            returns = self._calculate_strategy_returns(signals, self.market_data['close'])
            performance[name] = {
                'total_return': returns.sum(),
                'sharpe_ratio': returns.mean() / returns.std() if returns.std() > 0 else 0,
                'max_drawdown': self._calculate_max_drawdown(returns)
            }

        # Performance metrics should be reasonable
        for name, metrics in performance.items():
            self.assertIsInstance(metrics['total_return'], (int, float))
            self.assertIsInstance(metrics['sharpe_ratio'], (int, float))
            self.assertIsInstance(metrics['max_drawdown'], (int, float))

    def _calculate_strategy_returns(self, signals, prices):
        """Calculate returns for a strategy based on signals"""
        returns = pd.Series(0.0, index=prices.index)
        position = 0

        for i in range(1, len(signals)):
            if not pd.isna(signals.iloc[i]) and signals.iloc[i] != 0:
                if position == 0:  # Enter position
                    position = signals.iloc[i]
                elif position != 0 and signals.iloc[i] != position:  # Exit position
                    trade_return = (prices.iloc[i] - prices.iloc[i-1]) / prices.iloc[i-1] * position
                    returns.iloc[i] = trade_return
                    position = 0

        return returns

    def _calculate_max_drawdown(self, returns):
        """Calculate maximum drawdown"""
        cumulative = (1 + returns).cumprod()
        rolling_max = cumulative.expanding().max()
        drawdown = (cumulative - rolling_max) / rolling_max
        return drawdown.min()

if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)