"""
Performance Monitoring System
Real-time tracking of strategy performance, PnL, and key metrics
"""

import asyncio
import logging
from decimal import Decimal
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import json
import aiofiles
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Performance metrics data structure"""
    timestamp: float
    total_pnl: float
    daily_pnl: float
    max_drawdown: float
    win_rate: float
    total_trades: int
    active_positions: int
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    volatility: float

class PerformanceMonitor:
    """
    Advanced performance monitoring system
    Features:
    - Real-time PnL tracking
    - Risk-adjusted returns calculation
    - Performance attribution
    - Trade analysis
    - Historical data storage
    - Performance reporting
    """

    def __init__(self, data_dir: str = "data/performance"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Performance data storage
        self.metrics_history: List[PerformanceMetrics] = []
        self.trade_history: List[Dict] = []
        self.equity_curve: List[Tuple[float, float]] = []  # (timestamp, equity_value)

        # Performance calculations
        self.daily_returns: List[float] = []
        self.peak_equity = 0
        self.current_drawdown = 0
        self.max_drawdown = 0

        logger.info("Performance Monitor initialized")

    async def update_metrics(self, strategy_metrics: Dict[str, Any]):
        """Update performance metrics from all strategies"""
        try:
            current_time = datetime.now().timestamp()

            # Aggregate metrics across all strategies
            total_pnl = 0
            total_trades = 0
            winning_trades = 0
            active_positions = 0

            for strategy_name, metrics in strategy_metrics.items():
                if strategy_name == "engine":
                    continue

                if isinstance(metrics, dict):
                    total_pnl += metrics.get("total_pnl", 0)
                    total_trades += metrics.get("total_trades", 0)
                    winning_trades += metrics.get("winning_trades", 0)
                    active_positions += metrics.get("active_positions", 0)

            # Calculate derived metrics
            win_rate = (winning_trades / max(total_trades, 1)) * 100

            # Update equity curve
            current_equity = 100000 + total_pnl  # Starting with 100k
            self.equity_curve.append((current_time, current_equity))

            # Update peak and drawdown
            if current_equity > self.peak_equity:
                self.peak_equity = current_equity

            self.current_drawdown = (self.peak_equity - current_equity) / self.peak_equity
            if self.current_drawdown > self.max_drawdown:
                self.max_drawdown = self.current_drawdown

            # Calculate risk-adjusted returns
            sharpe_ratio = await self._calculate_sharpe_ratio()
            sortino_ratio = await self._calculate_sortino_ratio()
            calmar_ratio = await self._calculate_calmar_ratio()
            volatility = await self._calculate_volatility()

            # Create metrics object
            metrics = PerformanceMetrics(
                timestamp=current_time,
                total_pnl=total_pnl,
                daily_pnl=strategy_metrics.get("engine", {}).get("daily_pnl", 0),
                max_drawdown=self.max_drawdown,
                win_rate=win_rate,
                total_trades=total_trades,
                active_positions=active_positions,
                sharpe_ratio=sharpe_ratio,
                sortino_ratio=sortino_ratio,
                calmar_ratio=calmar_ratio,
                volatility=volatility
            )

            self.metrics_history.append(metrics)

            # Keep only last 1000 metrics points
            if len(self.metrics_history) > 1000:
                self.metrics_history = self.metrics_history[-1000:]

            # Save to file periodically
            if len(self.metrics_history) % 10 == 0:
                await self._save_metrics()

        except Exception as e:
            logger.error(f"Error updating metrics: {e}")

    async def _calculate_sharpe_ratio(self, risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio"""
        try:
            if len(self.daily_returns) < 30:
                return 0

            avg_return = sum(self.daily_returns[-252:]) / min(len(self.daily_returns), 252)  # Daily average
            return_std = self._calculate_std(self.daily_returns[-252:])

            if return_std == 0:
                return 0

            # Annualized Sharpe ratio
            sharpe = (avg_return * 252 - risk_free_rate) / (return_std * (252 ** 0.5))
            return sharpe

        except Exception as e:
            logger.error(f"Error calculating Sharpe ratio: {e}")
            return 0

    async def _calculate_sortino_ratio(self, risk_free_rate: float = 0.02) -> float:
        """Calculate Sortino ratio (downside deviation)"""
        try:
            if len(self.daily_returns) < 30:
                return 0

            avg_return = sum(self.daily_returns[-252:]) / min(len(self.daily_returns), 252)

            # Calculate downside deviation
            negative_returns = [r for r in self.daily_returns[-252:] if r < 0]
            if not negative_returns:
                return float('inf')

            downside_std = self._calculate_std(negative_returns)

            if downside_std == 0:
                return float('inf')

            # Annualized Sortino ratio
            sortino = (avg_return * 252 - risk_free_rate) / (downside_std * (252 ** 0.5))
            return sortino

        except Exception as e:
            logger.error(f"Error calculating Sortino ratio: {e}")
            return 0

    async def _calculate_calmar_ratio(self) -> float:
        """Calculate Calmar ratio (annual return / max drawdown)"""
        try:
            if self.max_drawdown == 0:
                return 0

            # Calculate annualized return
            if len(self.equity_curve) < 2:
                return 0

            start_equity = self.equity_curve[0][1]
            current_equity = self.equity_curve[-1][1]
            days_elapsed = (self.equity_curve[-1][0] - self.equity_curve[0][0]) / 86400

            if days_elapsed == 0:
                return 0

            annual_return = ((current_equity / start_equity) ** (365 / days_elapsed)) - 1
            calmar = annual_return / self.max_drawdown

            return calmar

        except Exception as e:
            logger.error(f"Error calculating Calmar ratio: {e}")
            return 0

    async def _calculate_volatility(self) -> float:
        """Calculate portfolio volatility"""
        try:
            if len(self.daily_returns) < 30:
                return 0

            return self._calculate_std(self.daily_returns[-252:]) * (252 ** 0.5)  # Annualized

        except Exception as e:
            logger.error(f"Error calculating volatility: {e}")
            return 0

    def _calculate_std(self, values: List[float]) -> float:
        """Calculate standard deviation"""
        if len(values) < 2:
            return 0

        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5

    async def _save_metrics(self):
        """Save metrics to file"""
        try:
            # Save latest metrics
            if self.metrics_history:
                latest_metrics = asdict(self.metrics_history[-1])
                metrics_file = self.data_dir / "latest_metrics.json"

                async with aiofiles.open(metrics_file, 'w') as f:
                    await f.write(json.dumps(latest_metrics, indent=2))

            # Save equity curve
            if self.equity_curve:
                equity_file = self.data_dir / "equity_curve.json"
                equity_data = [
                    {"timestamp": ts, "equity": equity}
                    for ts, equity in self.equity_curve
                ]

                async with aiofiles.open(equity_file, 'w') as f:
                    await f.write(json.dumps(equity_data, indent=2))

        except Exception as e:
            logger.error(f"Error saving metrics: {e}")

    async def add_trade(self, trade_data: Dict[str, Any]):
        """Add trade to history"""
        try:
            trade_data["timestamp"] = datetime.now().timestamp()
            self.trade_history.append(trade_data)

            # Keep only last 1000 trades
            if len(self.trade_history) > 1000:
                self.trade_history = self.trade_history[-1000:]

        except Exception as e:
            logger.error(f"Error adding trade: {e}")

    async def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        try:
            if not self.metrics_history:
                return {}

            latest = self.metrics_history[-1]

            # Calculate additional metrics
            total_return = (latest.total_pnl / 100000) * 100  # Assuming 100k starting capital
            daily_avg_return = sum(self.daily_returns[-30:]) / min(len(self.daily_returns), 30) if self.daily_returns else 0

            return {
                "total_return_pct": total_return,
                "daily_return_pct": latest.daily_pnl,
                "daily_avg_return_pct": daily_avg_return * 100,
                "max_drawdown_pct": latest.max_drawdown * 100,
                "current_drawdown_pct": self.current_drawdown * 100,
                "sharpe_ratio": latest.sharpe_ratio,
                "sortino_ratio": latest.sortino_ratio,
                "calmar_ratio": latest.calmar_ratio,
                "volatility_pct": latest.volatility * 100,
                "win_rate_pct": latest.win_rate,
                "total_trades": latest.total_trades,
                "active_positions": latest.active_positions,
                "peak_equity": self.peak_equity,
                "last_updated": latest.timestamp
            }

        except Exception as e:
            logger.error(f"Error getting performance summary: {e}")
            return {}

    async def get_strategy_performance(self) -> Dict[str, Any]:
        """Get performance breakdown by strategy"""
        try:
            # This would need strategy-specific metrics
            # For now, return basic breakdown
            strategy_performance = {}

            # Load strategy-specific data if available
            for strategy_file in self.data_dir.glob("*_strategy.json"):
                strategy_name = strategy_file.stem.replace("_strategy", "")

                try:
                    async with aiofiles.open(strategy_file, 'r') as f:
                        data = await f.read()
                        strategy_performance[strategy_name] = json.loads(data)
                except:
                    continue

            return strategy_performance

        except Exception as e:
            logger.error(f"Error getting strategy performance: {e}")
            return {}

    async def generate_report(self) -> str:
        """Generate performance report"""
        try:
            summary = await self.get_performance_summary()
            strategy_perf = await self.get_strategy_performance()

            report = f"""
PERFORMANCE REPORT
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

PORTFOLIO PERFORMANCE:
- Total Return: {summary.get('total_return_pct', 0):.2f}%
- Daily Return: {summary.get('daily_return_pct', 0):.2f}%
- Max Drawdown: {summary.get('max_drawdown_pct', 0):.2f}%
- Current Drawdown: {summary.get('current_drawdown_pct', 0):.2f}%

RISK-ADJUSTED RETURNS:
- Sharpe Ratio: {summary.get('sharpe_ratio', 0):.2f}
- Sortino Ratio: {summary.get('sortino_ratio', 0):.2f}
- Calmar Ratio: {summary.get('calmar_ratio', 0):.2f}
- Volatility: {summary.get('volatility_pct', 0):.2f}%

TRADING STATISTICS:
- Total Trades: {summary.get('total_trades', 0)}
- Win Rate: {summary.get('win_rate_pct', 0):.1f}%
- Active Positions: {summary.get('active_positions', 0)}
- Peak Equity: ${summary.get('peak_equity', 0):.2f}

STRATEGY BREAKDOWN:
"""
            for strategy, metrics in strategy_perf.items():
                report += f"\n{strategy.upper()}:\n"
                if isinstance(metrics, dict):
                    for key, value in metrics.items():
                        report += f"  - {key}: {value}\n"

            return report

        except Exception as e:
            logger.error(f"Error generating report: {e}")
            return "Error generating report"