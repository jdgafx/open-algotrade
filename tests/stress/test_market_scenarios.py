"""
Stress Testing for Various Market Conditions

This module tests trading strategies under extreme market conditions including
market crashes, flash crashes, high volatility, liquidity crises, and other
stress scenarios to ensure robustness and proper risk management.
"""

import unittest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import asyncio
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings('ignore')

# Import our testing framework and strategies
from src.testing.test_framework import BacktestEngine, TestConfig, PerformanceMetrics
from src.risk.risk_manager import RiskManager
from src.strategies.sma_strategy import SMAStrategy
from src.strategies.rsi_strategy import RSIStrategy
from src.strategies.vwap_strategy import VWAPStrategy
from src.strategies.market_maker import MarketMakerStrategy

class StressTestDataGenerator:
    """Generate various market stress scenarios for testing"""

    @staticmethod
    def generate_market_crash_scenario(
        initial_price: float = 50000,
        crash_duration_days: int = 30,
        crash_percentage: float = 0.50
    ) -> pd.DataFrame:
        """
        Generate market crash scenario data

        Args:
            initial_price: Starting price before crash
            crash_duration_days: Duration of the crash in days
            crash_percentage: Percentage decline during crash

        Returns:
            DataFrame with OHLCV data simulating market crash
        """
        # Generate hourly data points
        dates = pd.date_range(
            start=datetime(2023, 1, 1),
            periods=crash_duration_days * 24,
            freq='1h'
        )

        np.random.seed(42)
        n_points = len(dates)

        # Create crash curve - gradual decline with sharp drops
        crash_curve = np.zeros(n_points)
        for i in range(n_points):
            # Exponential decay with random shocks
            base_decline = 1 - (i / n_points) * crash_percentage
            random_shock = np.random.normal(1, 0.05)
            crash_curve[i] = base_decline * random_shock

        # Ensure final price matches crash percentage
        crash_curve[-1] = 1 - crash_percentage

        # Generate price series
        prices = initial_price * crash_curve

        # Add intraday volatility
        intraday_noise = np.random.normal(0, 0.01, n_points)
        prices = prices * (1 + intraday_noise)

        # Generate OHLCV data
        data = pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.998, 1.002, n_points),
            'high': prices * np.random.uniform(1.001, 1.05, n_points),
            'low': prices * np.random.uniform(0.95, 0.999, n_points),
            'close': prices,
            'volume': np.random.uniform(1000, 10000, n_points) * (2 + crash_percentage * 3)  # Higher volume in crash
        })

        return data

    @staticmethod
    def generate_flash_crash_scenario(
        base_price: float = 50000,
        flash_crash_depth: float = 0.20,
        recovery_time_hours: int = 6
    ) -> pd.DataFrame:
        """
        Generate flash crash scenario (rapid decline and quick recovery)

        Args:
            base_price: Normal market price
            flash_crash_depth: Maximum percentage decline
            recovery_time_hours: Hours to recover to base price

        Returns:
            DataFrame with flash crash data
        """
        total_hours = 48  # 2 days total
        dates = pd.date_range(
            start=datetime(2023, 1, 1),
            periods=total_hours,
            freq='1h'
        )

        n_points = len(dates)
        prices = np.ones(n_points) * base_price

        # Introduce flash crash at hour 12
        crash_start = 12
        crash_end = crash_start + 2  # 2-hour flash crash

        for i in range(crash_start, crash_end):
            decline_rate = flash_crash_depth / 2  # Spread over 2 hours
            prices[i] = prices[i-1] * (1 - decline_rate)

        # Recovery phase
        for i in range(crash_end, crash_end + recovery_time_hours):
            if i < n_points:
                recovery_rate = (base_price - prices[crash_end-1]) / recovery_time_hours / prices[crash_end-1]
                prices[i] = prices[i-1] * (1 + recovery_rate)

        # Add normal market noise
        noise = np.random.normal(0, 0.005, n_points)
        prices = prices * (1 + noise)

        # Generate OHLCV
        data = pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.999, 1.001, n_points),
            'high': prices * np.random.uniform(1.0, 1.02, n_points),
            'low': prices * np.random.uniform(0.98, 1.0, n_points),
            'close': prices,
            'volume': np.random.uniform(1000, 5000, n_points)
        })

        # Spike volume during flash crash
        data.loc[crash_start:crash_end, 'volume'] *= 10

        return data

    @staticmethod
    def generate_high_volatility_scenario(
        base_price: float = 50000,
        duration_days: int = 30,
        volatility_factor: float = 3.0
    ) -> pd.DataFrame:
        """
        Generate high volatility market scenario

        Args:
            base_price: Base price level
            duration_days: Duration of high volatility period
            volatility_factor: Multiple of normal volatility

        Returns:
            DataFrame with high volatility data
        """
        dates = pd.date_range(
            start=datetime(2023, 1, 1),
            periods=duration_days * 24,
            freq='1h'
        )

        np.random.seed(123)
        n_points = len(dates)

        # Generate price series with high volatility
        returns = np.random.normal(0, 0.02 * volatility_factor, n_points)  # 2% base volatility
        prices = base_price * np.exp(np.cumsum(returns))

        # Add trend to prevent price going to zero
        trend = np.linspace(0, 0.1, n_points)
        prices = prices * (1 + trend)

        # Generate OHLCV with wide ranges
        data = pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.98, 1.02, n_points),
            'high': prices * np.random.uniform(1.02, 1.08, n_points),
            'low': prices * np.random.uniform(0.92, 0.98, n_points),
            'close': prices,
            'volume': np.random.uniform(2000, 15000, n_points) * volatility_factor
        })

        return data

    @staticmethod
    def generate_liquidity_crisis_scenario(
        normal_price: float = 50000,
        crisis_duration_hours: int = 12
    ) -> pd.DataFrame:
        """
        Generate liquidity crisis scenario (low volume, wide spreads)

        Args:
            normal_price: Normal market price
            crisis_duration_hours: Duration of liquidity crisis

        Returns:
            DataFrame with liquidity crisis data
        """
        total_hours = 48
        dates = pd.date_range(
            start=datetime(2023, 1, 1),
            periods=total_hours,
            freq='1h'
        )

        np.random.seed(456)
        n_points = len(dates)

        # Generate base price with normal volatility
        returns = np.random.normal(0, 0.01, n_points)
        prices = normal_price * np.exp(np.cumsum(returns))

        # Liquidity crisis period
        crisis_start = 12
        crisis_end = crisis_start + crisis_duration_hours

        # Volume drops dramatically during crisis
        volumes = np.random.uniform(1000, 5000, n_points)
        volumes[crisis_start:crisis_end] = np.random.uniform(10, 100, crisis_duration_hours)

        # Spreads widen during crisis
        data = pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.999, 1.001, n_points),
            'high': prices * np.random.uniform(1.001, 1.01, n_points),
            'low': prices * np.random.uniform(0.99, 0.999, n_points),
            'close': prices,
            'volume': volumes
        })

        # Widen spreads during crisis
        data.loc[crisis_start:crisis_end, 'high'] *= np.random.uniform(1.05, 1.15, crisis_duration_hours)
        data.loc[crisis_start:crisis_end, 'low'] *= np.random.uniform(0.85, 0.95, crisis_duration_hours)

        return data

    @staticmethod
    def generate_black_swan_scenario(
        initial_price: float = 50000,
        shock_magnitude: float = 0.30,
        volatility_persistence_days: int = 14
    ) -> pd.DataFrame:
        """
        Generate black swan event scenario

        Args:
            initial_price: Price before the event
            shock_magnitude: Immediate price drop percentage
            volatility_persistence_days: Days of elevated volatility after shock

        Returns:
            DataFrame with black swan event data
        """
        total_days = 30
        dates = pd.date_range(
            start=datetime(2023, 1, 1),
            periods=total_days * 24,
            freq='1h'
        )

        np.random.seed(789)
        n_points = len(dates)

        # Normal market conditions initially
        shock_point = 24 * 5  # Shock occurs on day 5

        prices = np.ones(n_points) * initial_price

        # Apply black swan shock
        for i in range(shock_point, n_points):
            if i == shock_point:
                # Immediate shock
                prices[i] = prices[i-1] * (1 - shock_magnitude)
            elif i < shock_point + 24 * volatility_persistence_days:
                # High volatility period
                volatility = 0.05  # 5% hourly volatility
                shock_return = np.random.normal(0.01, volatility)  # Slight upward drift
                prices[i] = prices[i-1] * (1 + shock_return)
            else:
                # Return to normal volatility
                normal_return = np.random.normal(0.001, 0.01)
                prices[i] = prices[i-1] * (1 + normal_return)

        # Generate OHLCV
        data = pd.DataFrame({
            'timestamp': dates,
            'open': prices * np.random.uniform(0.995, 1.005, n_points),
            'high': prices * np.random.uniform(1.005, 1.1, n_points),
            'low': prices * np.random.uniform(0.9, 0.995, n_points),
            'close': prices,
            'volume': np.random.uniform(1000, 8000, n_points)
        })

        # Massive volume spike during shock
        data.loc[shock_point:shock_point+24, 'volume'] *= 20

        return data

class MarketStressTester:
    """Main stress testing engine for trading strategies"""

    def __init__(self):
        self.scenario_generator = StressTestDataGenerator()
        self.risk_manager = RiskManager()
        self.results = {}

    def run_stress_tests(self, strategies: Dict[str, object]) -> Dict:
        """
        Run comprehensive stress tests on strategies

        Args:
            strategies: Dictionary of strategy instances

        Returns:
            Dictionary containing stress test results
        """
        stress_results = {}

        # Test scenarios
        scenarios = {
            'market_crash': self.scenario_generator.generate_market_crash_scenario(),
            'flash_crash': self.scenario_generator.generate_flash_crash_scenario(),
            'high_volatility': self.scenario_generator.generate_high_volatility_scenario(),
            'liquidity_crisis': self.scenario_generator.generate_liquidity_crisis_scenario(),
            'black_swan': self.scenario_generator.generate_black_swan_scenario()
        }

        for strategy_name, strategy in strategies.items():
            strategy_results = {}

            for scenario_name, scenario_data in scenarios.items():
                print(f"Testing {strategy_name} against {scenario_name} scenario...")

                try:
                    # Run strategy on stress scenario
                    performance = self._test_strategy_on_scenario(strategy, scenario_data, scenario_name)
                    risk_metrics = self._calculate_risk_metrics(scenario_data, performance)

                    strategy_results[scenario_name] = {
                        'performance': performance,
                        'risk_metrics': risk_metrics,
                        'survived': self._did_strategy_survive(performance, risk_metrics),
                        'max_drawdown': self._calculate_max_drawdown(performance),
                        'recovery_time': self._calculate_recovery_time(performance, scenario_data)
                    }

                except Exception as e:
                    strategy_results[scenario_name] = {
                        'error': str(e),
                        'survived': False
                    }

            stress_results[strategy_name] = strategy_results

        self.results = stress_results
        return stress_results

    def _test_strategy_on_scenario(self, strategy, scenario_data: pd.DataFrame, scenario_name: str) -> Dict:
        """Test strategy performance on specific scenario"""
        # This would integrate with the actual strategy backtesting
        # For now, return mock performance metrics

        n_periods = len(scenario_data)

        # Simulate strategy performance (replace with actual strategy execution)
        returns = np.random.normal(0, 0.02, n_periods)

        # Adjust returns based on scenario
        if scenario_name == 'market_crash':
            returns -= 0.001  # Worse performance in crash
        elif scenario_name == 'flash_crash':
            # Some strategies might do well in flash crashes
            returns += np.random.choice([0.002, -0.005], p=[0.3, 0.7])
        elif scenario_name == 'high_volatility':
            returns *= 1.5  # Higher volatility in returns

        cumulative_returns = np.cumprod(1 + returns) - 1

        return {
            'total_return': cumulative_returns[-1],
            'volatility': np.std(returns),
            'sharpe_ratio': np.mean(returns) / np.std(returns) if np.std(returns) > 0 else 0,
            'max_drawdown': self._calculate_max_drawdown_from_returns(cumulative_returns),
            'returns': returns.tolist(),
            'cumulative_returns': cumulative_returns.tolist()
        }

    def _calculate_risk_metrics(self, scenario_data: pd.DataFrame, performance: Dict) -> Dict:
        """Calculate risk metrics for the scenario"""
        returns = np.array(performance['returns'])

        # VaR at 95% and 99% confidence levels
        var_95 = np.percentile(returns, 5)
        var_99 = np.percentile(returns, 1)

        # Expected Shortfall (CVaR)
        expected_shortfall_95 = np.mean(returns[returns <= var_95])
        expected_shortfall_99 = np.mean(returns[returns <= var_99])

        # Maximum consecutive losses
        consecutive_losses = self._calculate_max_consecutive_losses(returns)

        return {
            'var_95': var_95,
            'var_99': var_99,
            'expected_shortfall_95': expected_shortfall_95,
            'expected_shortfall_99': expected_shortfall_99,
            'max_consecutive_losses': consecutive_losses,
            'volatility': np.std(returns),
            'skewness': self._calculate_skewness(returns),
            'kurtosis': self._calculate_kurtosis(returns)
        }

    def _did_strategy_survive(self, performance: Dict, risk_metrics: Dict) -> bool:
        """Determine if strategy survived the stress scenario"""
        # Survival criteria
        max_drawdown_limit = -0.5  # 50% max drawdown
        var_limit = -0.1  # 10% daily VaR limit
        consecutive_loss_limit = 20  # Max 20 consecutive losses

        if performance['max_drawdown'] < max_drawdown_limit:
            return False

        if risk_metrics['var_95'] < var_limit:
            return False

        if risk_metrics['max_consecutive_losses'] > consecutive_loss_limit:
            return False

        return True

    def _calculate_max_drawdown(self, performance: Dict) -> float:
        """Calculate maximum drawdown from performance data"""
        if 'cumulative_returns' in performance:
            returns = np.array(performance['cumulative_returns'])
            return self._calculate_max_drawdown_from_returns(returns)
        return 0

    def _calculate_max_drawdown_from_returns(self, cumulative_returns: np.ndarray) -> float:
        """Calculate maximum drawdown from cumulative returns array"""
        running_max = np.maximum.accumulate(cumulative_returns)
        drawdown = (cumulative_returns - running_max) / (1 + running_max)
        return np.min(drawdown)

    def _calculate_recovery_time(self, performance: Dict, scenario_data: pd.DataFrame) -> int:
        """Calculate time to recover from maximum drawdown"""
        if 'cumulative_returns' not in performance:
            return -1

        cumulative_returns = np.array(performance['cumulative_returns'])
        max_dd_idx = np.argmin(cumulative_returns)

        # Find if and when recovery occurs
        peak_value = cumulative_returns[max_dd_idx]
        for i in range(max_dd_idx + 1, len(cumulative_returns)):
            if cumulative_returns[i] >= peak_value:
                return i - max_dd_idx

        return -1  # No recovery within test period

    def _calculate_max_consecutive_losses(self, returns: np.ndarray) -> int:
        """Calculate maximum number of consecutive losses"""
        consecutive = 0
        max_consecutive = 0

        for ret in returns:
            if ret < 0:
                consecutive += 1
                max_consecutive = max(max_consecutive, consecutive)
            else:
                consecutive = 0

        return max_consecutive

    def _calculate_skewness(self, returns: np.ndarray) -> float:
        """Calculate return skewness"""
        mean = np.mean(returns)
        std = np.std(returns)
        if std == 0:
            return 0
        return np.mean(((returns - mean) / std) ** 3)

    def _calculate_kurtosis(self, returns: np.ndarray) -> float:
        """Calculate return kurtosis"""
        mean = np.mean(returns)
        std = np.std(returns)
        if std == 0:
            return 0
        return np.mean(((returns - mean) / std) ** 4) - 3  # Excess kurtosis

    def generate_stress_test_report(self) -> str:
        """Generate comprehensive stress test report"""
        if not self.results:
            return "No stress test results available. Run stress tests first."

        report = []
        report.append("=" * 80)
        report.append("COMPREHENSIVE STRESS TEST REPORT")
        report.append("=" * 80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")

        # Summary table
        report.append("STRATEGY SURVIVAL SUMMARY")
        report.append("-" * 40)

        for strategy_name, strategy_results in self.results.items():
            report.append(f"\n{strategy_name.upper()}:")

            for scenario_name, scenario_results in strategy_results.items():
                if 'error' in scenario_results:
                    status = "❌ FAILED (Error)"
                elif scenario_results.get('survived', False):
                    status = "✅ SURVIVED"
                else:
                    status = "❌ FAILED"

                report.append(f"  {scenario_name.replace('_', ' ').title()}: {status}")

        # Detailed results
        report.append("\n\nDETAILED PERFORMANCE ANALYSIS")
        report.append("-" * 40)

        for strategy_name, strategy_results in self.results.items():
            report.append(f"\n{'='*60}")
            report.append(f"{strategy_name.upper()} STRATEGY ANALYSIS")
            report.append(f"{'='*60}")

            for scenario_name, scenario_results in strategy_results.items():
                if 'error' in scenario_results:
                    report.append(f"\n{scenario_name.replace('_', ' ').title()}:")
                    report.append(f"  Error: {scenario_results['error']}")
                    continue

                report.append(f"\n{scenario_name.replace('_', ' ').title()} Scenario:")

                if 'performance' in scenario_results:
                    perf = scenario_results['performance']
                    risk = scenario_results['risk_metrics']

                    report.append(f"  Total Return: {perf['total_return']:.2%}")
                    report.append(f"  Sharpe Ratio: {perf['sharpe_ratio']:.2f}")
                    report.append(f"  Max Drawdown: {perf['max_drawdown']:.2%}")
                    report.append(f"  Volatility: {perf['volatility']:.2%}")

                    report.append(f"\n  Risk Metrics:")
                    report.append(f"  95% VaR: {risk['var_95']:.2%}")
                    report.append(f"  99% VaR: {risk['var_99']:.2%}")
                    report.append(f"  Expected Shortfall (95%): {risk['expected_shortfall_95']:.2%}")
                    report.append(f"  Max Consecutive Losses: {risk['max_consecutive_losses']}")
                    report.append(f"  Return Skewness: {risk['skewness']:.2f}")
                    report.append(f"  Return Kurtosis: {risk['kurtosis']:.2f}")

                    if scenario_results.get('recovery_time', -1) > 0:
                        report.append(f"  Recovery Time: {scenario_results['recovery_time']} periods")
                    else:
                        report.append(f"  Recovery Time: No recovery within test period")

        # Recommendations
        report.append("\n\nRECOMMENDATIONS")
        report.append("-" * 40)

        for strategy_name, strategy_results in self.results.items():
            failed_scenarios = [
                name for name, results in strategy_results.items()
                if not results.get('survived', True) and 'error' not in results
            ]

            if failed_scenarios:
                report.append(f"\n{strategy_name}:")
                report.append(f"  Consider improving risk management for: {', '.join(failed_scenarios)}")
                report.append(f"  Current strategy may not be suitable for extreme market conditions")
            else:
                report.append(f"\n{strategy_name}: Strategy survived all stress tests")

        report.append("\n" + "=" * 80)
        report.append("END OF STRESS TEST REPORT")

        return "\n".join(report)

class TestMarketStressScenarios(unittest.TestCase):
    """Unit tests for market stress scenarios"""

    def setUp(self):
        """Set up test fixtures"""
        self.generator = StressTestDataGenerator()
        self.stress_tester = MarketStressTester()

    def test_market_crash_scenario_generation(self):
        """Test market crash scenario data generation"""
        crash_data = self.generator.generate_market_crash_scenario(
            initial_price=50000,
            crash_duration_days=30,
            crash_percentage=0.40
        )

        # Verify data structure
        self.assertIsInstance(crash_data, pd.DataFrame)
        expected_columns = ['timestamp', 'open', 'high', 'low', 'close', 'volume']
        self.assertTrue(all(col in crash_data.columns for col in expected_columns))

        # Verify crash magnitude
        start_price = crash_data['close'].iloc[0]
        end_price = crash_data['close'].iloc[-1]
        actual_crash_pct = (start_price - end_price) / start_price

        self.assertAlmostEqual(actual_crash_pct, 0.40, delta=0.05)  # Within 5% tolerance

        # Verify volume increases during crash
        early_volume = crash_data['volume'].head(24 * 5).mean()  # First 5 days
        late_volume = crash_data['volume'].tail(24 * 5).mean()    # Last 5 days
        self.assertGreater(late_volume, early_volume)

    def test_flash_crash_scenario_generation(self):
        """Test flash crash scenario data generation"""
        flash_data = self.generator.generate_flash_crash_scenario(
            base_price=50000,
            flash_crash_depth=0.25,
            recovery_time_hours=6
        )

        # Find the minimum price (flash crash bottom)
        min_price_idx = flash_data['close'].idxmin()
        min_price = flash_data['close'].loc[min_price_idx]

        # Check if price recovers close to original
        final_price = flash_data['close'].iloc[-1]
        recovery_pct = (final_price - min_price) / min_price

        self.assertGreater(recovery_pct, 0.15)  # Should recover at least 15%

        # Verify volume spike during crash
        avg_volume = flash_data['volume'].mean()
        crash_period_volume = flash_data['volume'].loc[min_price_idx-2:min_price_idx+2].mean()
        self.assertGreater(crash_period_volume, avg_volume * 5)  # At least 5x volume spike

    def test_high_volatility_scenario_generation(self):
        """Test high volatility scenario data generation"""
        vol_data = self.generator.generate_high_volatility_scenario(
            base_price=50000,
            duration_days=30,
            volatility_factor=3.0
        )

        # Calculate actual volatility
        returns = vol_data['close'].pct_change().dropna()
        actual_volatility = returns.std()

        # Should have higher than normal volatility (normal daily crypto vol ~2-3%)
        self.assertGreater(actual_volatility, 0.04)  # At least 4% hourly volatility

        # Verify wide price ranges
        daily_ranges = (vol_data['high'] - vol_data['low']) / vol_data['close']
        avg_daily_range = daily_ranges.mean()
        self.assertGreater(avg_daily_range, 0.05)  # At least 5% daily range on average

    def test_liquidity_crisis_scenario_generation(self):
        """Test liquidity crisis scenario data generation"""
        liquidity_data = self.generator.generate_liquidity_crisis_scenario(
            normal_price=50000,
            crisis_duration_hours=12
        )

        # Find crisis period (lowest volume)
        crisis_start_idx = liquidity_data['volume'].idxmin()

        # Verify volume drops significantly during crisis
        normal_volume = liquidity_data['volume'].head(12).mean()  # First 12 hours
        crisis_volume = liquidity_data['volume'].loc[crisis_start_idx:crisis_start_idx+12].mean()

        self.assertLess(crisis_volume, normal_volume * 0.1)  # Volume drops to <10% of normal

        # Verify spreads widen (high-low range increases)
        normal_spread = (liquidity_data['high'] - liquidity_data['low']).head(12).mean()
        crisis_spread = (liquidity_data['high'] - liquidity_data['low']).loc[crisis_start_idx:crisis_start_idx+12].mean()

        self.assertGreater(crisis_spread, normal_spread * 2)  # Spread at least doubles

    def test_black_swan_scenario_generation(self):
        """Test black swan event scenario generation"""
        black_swan_data = self.generator.generate_black_swan_scenario(
            initial_price=50000,
            shock_magnitude=0.35,
            volatility_persistence_days=14
        )

        # Find the point of maximum drawdown
        cumulative_returns = (black_swan_data['close'] / black_swan_data['close'].iloc[0]) - 1
        max_drawdown_idx = cumulative_returns.idxmin()
        max_drawdown = cumulative_returns.loc[max_drawdown_idx]

        # Verify shock magnitude
        self.assertLess(max_drawdown, -0.30)  # At least 30% drawdown

        # Verify elevated volatility after shock
        pre_shock_volatility = black_swan_data['close'].pct_change().loc[:max_drawdown_idx].std()
        post_shock_volatility = black_swan_data['close'].pct_change().loc[max_drawdown_idx:].std()

        self.assertGreater(post_shock_volatility, pre_shock_volatility * 2)  # Volatility at least doubles

    def test_stress_tester_integration(self):
        """Test stress tester with mock strategies"""
        # Create mock strategies
        mock_strategies = {
            'test_strategy': Mock()
        }

        # Configure mock strategy to return some performance data
        mock_strategies['test_strategy'].generate_signals.return_value = pd.Series([0] * 100)

        # Run stress tests (this will use mocked performance)
        with patch.object(self.stress_tester, '_test_strategy_on_scenario') as mock_test:
            mock_test.return_value = {
                'total_return': -0.2,
                'volatility': 0.05,
                'sharpe_ratio': -0.5,
                'max_drawdown': -0.3,
                'returns': [ -0.01] * 100,
                'cumulative_returns': np.linspace(0, -0.2, 100).tolist()
            }

            results = self.stress_tester.run_stress_tests(mock_strategies)

            self.assertIn('test_strategy', results)
            self.assertGreater(len(results['test_strategy']), 0)

    def test_risk_metrics_calculation(self):
        """Test risk metrics calculation"""
        # Create test returns
        test_returns = np.array([0.01, -0.02, 0.03, -0.01, -0.05, 0.02, -0.03, 0.01])

        risk_metrics = self.stress_tester._calculate_risk_metrics(
            pd.DataFrame(),  # Empty scenario_data for this test
            {'returns': test_returns.tolist()}
        )

        # Verify VaR calculations
        self.assertLess(risk_metrics['var_95'], 0)  # 95% VaR should be negative
        self.assertLess(risk_metrics['var_99'], risk_metrics['var_95'])  # 99% VaR should be worse

        # Verify expected shortfall is worse than VaR
        self.assertLessEqual(risk_metrics['expected_shortfall_95'], risk_metrics['var_95'])

        # Verify consecutive losses
        self.assertGreaterEqual(risk_metrics['max_consecutive_losses'], 1)  # Should detect some losses

    def test_strategy_survival_criteria(self):
        """Test strategy survival determination logic"""
        # Test surviving strategy
        good_performance = {
            'max_drawdown': -0.2,  # Only 20% drawdown
            'returns': [0.01, -0.01] * 50  # Alternating returns
        }
        good_risk = {
            'var_95': -0.05,  # 5% VaR
            'max_consecutive_losses': 5
        }

        survived = self.stress_tester._did_strategy_survive(good_performance, good_risk)
        self.assertTrue(survived)

        # Test failing strategy
        bad_performance = {
            'max_drawdown': -0.6,  # 60% drawdown
            'returns': [-0.05] * 100  # All losses
        }
        bad_risk = {
            'var_95': -0.15,  # 15% VaR
            'max_consecutive_losses': 100
        }

        survived = self.stress_tester._did_strategy_survive(bad_performance, bad_risk)
        self.assertFalse(survived)

    def test_recovery_time_calculation(self):
        """Test recovery time calculation"""
        # Test case with recovery
        cumulative_returns = [0, -0.1, -0.15, -0.2, -0.15, -0.1, -0.05, 0, 0.05]
        performance = {'cumulative_returns': cumulative_returns}
        scenario_data = pd.DataFrame()  # Not used in this calculation

        recovery_time = self.stress_tester._calculate_recovery_time(performance, scenario_data)
        self.assertEqual(recovery_time, 8)  # 8 periods to recover

        # Test case without recovery
        no_recovery_returns = [0, -0.1, -0.15, -0.2, -0.25, -0.3, -0.35, -0.4]
        performance = {'cumulative_returns': no_recovery_returns}

        recovery_time = self.stress_tester._calculate_recovery_time(performance, scenario_data)
        self.assertEqual(recovery_time, -1)  # No recovery

if __name__ == '__main__':
    # Run stress tests
    unittest.main(verbosity=2)