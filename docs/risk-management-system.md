# Risk Management and Position Sizing System

## Overview

The Risk Management System is the cornerstone of our trading architecture, providing comprehensive position monitoring, dynamic sizing, and automated protection mechanisms. Built on proven patterns from existing algorithms but enhanced with enterprise-grade safety measures.

## Core Risk Management Architecture

### Risk Manager Component
```python
import asyncio
import numpy as np
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from enum import Enum
import logging
from datetime import datetime, timedelta

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"

@dataclass
class RiskLimits:
    max_portfolio_risk: float = 0.25      # 25% max portfolio drawdown
    max_position_size: float = 0.10       # 10% of portfolio per position
    max_strategy_drawdown: float = 0.15   # 15% max per strategy
    max_leverage: float = 5.0             # 5x maximum leverage
    max_correlation: float = 0.7          # Max correlation between strategies
    min_liquidity: float = 10000          # Minimum liquidity in USD
    max_daily_loss: float = 0.05          # 5% max daily loss
    position_timeout: int = 3600          # 1 hour max position time

@dataclass
class Position:
    symbol: str
    side: OrderSide
    size: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    realized_pnl: float
    leverage: float
    timestamp: datetime
    strategy_id: str
    exchange: str

@dataclass
class RiskMetrics:
    portfolio_value: float
    total_pnl: float
    drawdown: float
    sharpe_ratio: float
    var_95: float  # Value at Risk 95%
    beta: float
    correlation_matrix: Dict[str, float]
    exposure: Dict[str, float]
    risk_level: RiskLevel

class RiskManager:
    def __init__(self, limits: RiskLimits, initial_capital: float):
        self.limits = limits
        self.initial_capital = initial_capital
        self.current_capital = initial_capital
        self.positions = {}
        self.daily_pnl = 0.0
        self.daily_losses = 0.0
        self.logger = logging.getLogger(__name__)

        # Risk tracking
        self.portfolio_history = []
        self.pnl_history = []
        self.correlation_data = {}

    async def evaluate_position_risk(self,
                                   proposed_position: Position,
                                   current_positions: Dict[str, Position]) -> Tuple[bool, str]:
        """Evaluate if a new position meets risk criteria"""

        # 1. Position Size Risk
        position_value = abs(proposed_position.size * proposed_position.entry_price)
        if position_value > self.limits.max_position_size * self.current_capital:
            return False, f"Position size {position_value:.2f} exceeds limit {self.limits.max_position_size * self.current_capital:.2f}"

        # 2. Leverage Risk
        if proposed_position.leverage > self.limits.max_leverage:
            return False, f"Leverage {proposed_position.leverage} exceeds maximum {self.limits.max_leverage}"

        # 3. Portfolio Correlation Risk
        correlation_risk = await self._calculate_correlation_risk(proposed_position, current_positions)
        if correlation_risk > self.limits.max_correlation:
            return False, f"Correlation {correlation_risk:.3f} exceeds limit {self.limits.max_correlation}"

        # 4. Daily Loss Limit
        if self.daily_losses < -self.limits.max_daily_loss * self.current_capital:
            return False, f"Daily losses {self.daily_losses:.2f} exceed limit {self.limits.max_daily_loss * self.current_capital:.2f}"

        # 5. Strategy Drawdown Risk
        strategy_positions = [p for p in current_positions.values() if p.strategy_id == proposed_position.strategy_id]
        strategy_drawdown = await self._calculate_strategy_drawdown(strategy_positions)
        if strategy_drawdown > self.limits.max_strategy_drawdown:
            return False, f"Strategy drawdown {strategy_drawdown:.3f} exceeds limit {self.limits.max_strategy_drawdown}"

        return True, "Position approved"

    async def calculate_position_size(self,
                                    symbol: str,
                                    signal_strength: float,
                                    volatility: float,
                                    account_balance: float,
                                    strategy_id: str) -> float:
        """Dynamic position sizing based on risk parameters"""

        # Base position size (2% of portfolio)
        base_size = 0.02 * account_balance

        # Adjust for signal strength (0.5 to 2.0 multiplier)
        signal_multiplier = 0.5 + (signal_strength * 1.5)

        # Adjust for volatility (inverse relationship)
        volatility_multiplier = 1.0 / (1.0 + volatility)

        # Adjust for recent performance
        performance_multiplier = await self._get_performance_multiplier(strategy_id)

        # Calculate final position size
        position_size = base_size * signal_multiplier * volatility_multiplier * performance_multiplier

        # Apply maximum position size limit
        max_position = self.limits.max_position_size * account_balance
        position_size = min(position_size, max_position)

        return position_size

    async def monitor_positions(self, current_prices: Dict[str, float]) -> List[Dict]:
        """Monitor all positions and generate risk alerts"""
        alerts = []

        for symbol, position in self.positions.items():
            if symbol in current_prices:
                position.current_price = current_prices[symbol]

                # Calculate unrealized PnL
                if position.side == OrderSide.BUY:
                    position.unrealized_pnl = (position.current_price - position.entry_price) * position.size
                else:
                    position.unrealized_pnl = (position.entry_price - position.current_price) * position.size

                # Check position timeout
                position_age = (datetime.now() - position.timestamp).total_seconds()
                if position_age > self.limits.position_timeout:
                    alerts.append({
                        'type': 'position_timeout',
                        'symbol': symbol,
                        'position_age': position_age,
                        'action': 'close_position'
                    })

                # Check for excessive losses
                pnl_percentage = position.unrealized_pnl / (position.size * position.entry_price)
                if pnl_percentage < -0.1:  # 10% loss
                    alerts.append({
                        'type': 'excessive_loss',
                        'symbol': symbol,
                        'loss_percentage': pnl_percentage,
                        'action': 'close_position'
                    })

        # Portfolio-level checks
        portfolio_metrics = await self._calculate_portfolio_metrics()

        if portfolio_metrics.drawdown > self.limits.max_portfolio_risk:
            alerts.append({
                'type': 'portfolio_drawdown',
                'drawdown': portfolio_metrics.drawdown,
                'action': 'reduce_positions'
            })

        if portfolio_metrics.risk_level == RiskLevel.CRITICAL:
            alerts.append({
                'type': 'critical_risk',
                'metrics': portfolio_metrics,
                'action': 'emergency_stop'
            })

        return alerts

    async def _calculate_correlation_risk(self,
                                        proposed_position: Position,
                                        current_positions: Dict[str, Position]) -> float:
        """Calculate correlation risk with existing positions"""

        if not current_positions:
            return 0.0

        max_correlation = 0.0

        for existing_symbol, existing_position in current_positions.items():
            if existing_position.strategy_id == proposed_position.strategy_id:
                # Simple correlation based on recent price movements
                correlation = await self._calculate_price_correlation(
                    proposed_position.symbol,
                    existing_symbol
                )
                max_correlation = max(max_correlation, correlation)

        return max_correlation

    async def _calculate_strategy_drawdown(self, strategy_positions: List[Position]) -> float:
        """Calculate drawdown for a specific strategy"""
        if not strategy_positions:
            return 0.0

        strategy_pnl = sum(p.unrealized_pnl + p.realized_pnl for p in strategy_positions)
        strategy_value = sum(abs(p.size * p.entry_price) for p in strategy_positions)

        if strategy_value == 0:
            return 0.0

        drawdown = abs(strategy_pnl) / strategy_value
        return drawdown

    async def _calculate_portfolio_metrics(self) -> RiskMetrics:
        """Calculate comprehensive portfolio risk metrics"""

        # Calculate total portfolio value
        total_value = self.current_capital
        total_unrealized = sum(p.unrealized_pnl for p in self.positions.values())
        total_realized = sum(p.realized_pnl for p in self.positions.values())

        portfolio_value = total_value + total_unrealized + total_realized
        total_pnl = total_unrealized + total_realized

        # Calculate drawdown
        peak_value = max(self.portfolio_history) if self.portfolio_history else self.initial_capital
        drawdown = (peak_value - portfolio_value) / peak_value

        # Calculate Sharpe ratio (simplified)
        if len(self.pnl_history) > 1:
            returns = np.diff(self.pnl_history)
            sharpe_ratio = np.mean(returns) / np.std(returns) if np.std(returns) > 0 else 0
        else:
            sharpe_ratio = 0

        # Calculate VaR (simplified historical VaR)
        if len(self.pnl_history) > 30:
            var_95 = np.percentile(self.pnl_history[-30:], 5)
        else:
            var_95 = 0

        # Determine risk level
        if drawdown > 0.20:
            risk_level = RiskLevel.CRITICAL
        elif drawdown > 0.15:
            risk_level = RiskLevel.HIGH
        elif drawdown > 0.10:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW

        return RiskMetrics(
            portfolio_value=portfolio_value,
            total_pnl=total_pnl,
            drawdown=drawdown,
            sharpe_ratio=sharpe_ratio,
            var_95=var_95,
            beta=0.0,  # Would need market data
            correlation_matrix={},  # Would need correlation calculation
            exposure={},  # Would need exposure calculation
            risk_level=risk_level
        )
```

## Dynamic Position Sizing Algorithm

### Volatility-Based Sizing
```python
class VolatilityCalculator:
    def __init__(self, lookback_period: int = 20):
        self.lookback_period = lookback_period

    async def calculate_atr(self, prices: List[float]) -> float:
        """Calculate Average True Range for volatility estimation"""
        if len(prices) < self.lookback_period:
            return 0.0

        # Calculate True Ranges
        true_ranges = []
        for i in range(1, len(prices)):
            high_low = abs(prices[i] - prices[i-1])
            true_ranges.append(high_low)

        # Calculate ATR
        atr = np.mean(true_ranges[-self.lookback_period:])
        return atr

    async def calculate_volatility(self, returns: List[float]) -> float:
        """Calculate historical volatility"""
        if len(returns) < 2:
            return 0.0

        volatility = np.std(returns) * np.sqrt(252)  # Annualized
        return volatility

class KellyCriterionSizer:
    def __init__(self, min_size: float = 0.01, max_size: float = 0.05):
        self.min_size = min_size
        self.max_size = max_size

    def calculate_kelly_fraction(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Calculate Kelly Criterion optimal position size"""
        if avg_loss == 0:
            return self.min_size

        win_loss_ratio = avg_win / abs(avg_loss)
        kelly_fraction = (win_rate * win_loss_ratio - (1 - win_rate)) / win_loss_ratio

        # Apply safety factor (half Kelly)
        kelly_fraction *= 0.5

        # Clamp to reasonable bounds
        kelly_fraction = max(self.min_size, min(kelly_fraction, self.max_size))

        return kelly_fraction
```

## Circuit Breakers and Safety Mechanisms

### Circuit Breaker System
```python
from enum import Enum
import asyncio
from datetime import datetime, timedelta

class CircuitBreakerState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"         # Trading halted
    HALF_OPEN = "half_open" # Limited trading allowed

class CircuitBreaker:
    def __init__(self,
                 loss_threshold: float = 0.10,  # 10% loss triggers
                 profit_target: float = 0.20,   # 20% profit triggers
                 timeout_period: int = 300):     # 5 minutes timeout
        self.loss_threshold = loss_threshold
        self.profit_target = profit_target
        self.timeout_period = timeout_period
        self.state = CircuitBreakerState.CLOSED
        self.trigger_time = None
        self.daily_pnl = 0.0
        self.max_drawdown = 0.0

    async def check_triggers(self, current_pnl: float, max_drawdown: float) -> CircuitBreakerState:
        """Check if circuit breaker should trigger"""

        self.daily_pnl = current_pnl
        self.max_drawdown = max_drawdown

        # Check loss trigger
        if current_pnl <= -self.loss_threshold:
            self.state = CircuitBreakerState.OPEN
            self.trigger_time = datetime.now()
            return self.state

        # Check profit target (optional profit taking)
        if current_pnl >= self.profit_target:
            self.state = CircuitBreakerState.OPEN
            self.trigger_time = datetime.now()
            return self.state

        # Check if we can reopen
        if self.state == CircuitBreakerState.OPEN:
            if datetime.now() - self.trigger_time > timedelta(seconds=self.timeout_period):
                self.state = CircuitBreakerState.HALF_OPEN

        return self.state

    def can_trade(self) -> bool:
        """Check if trading is allowed"""
        return self.state in [CircuitBreakerState.CLOSED, CircuitBreakerState.HALF_OPEN]

    def get_max_position_size(self, normal_size: float) -> float:
        """Get maximum position size based on circuit breaker state"""
        if self.state == CircuitBreakerState.CLOSED:
            return normal_size
        elif self.state == CircuitBreakerState.HALF_OPEN:
            return normal_size * 0.25  # 25% of normal size
        else:
            return 0.0  # No trading allowed

class EmergencyStop:
    def __init__(self, risk_manager: RiskManager):
        self.risk_manager = risk_manager
        self.emergency_conditions = []
        self.is_emergency = False

    async def check_emergency_conditions(self) -> bool:
        """Check for emergency stop conditions"""

        # Check portfolio-level conditions
        metrics = await self.risk_manager._calculate_portfolio_metrics()

        emergency_triggers = [
            metrics.drawdown > 0.30,  # 30% drawdown
            metrics.risk_level == RiskLevel.CRITICAL,
            len(self.risk_manager.positions) > 20,  # Too many positions
            self.risk_manager.daily_losses < -0.15 * self.risk_manager.current_capital  # 15% daily loss
        ]

        # Check system-level conditions
        system_triggers = [
            await self._check_api_health(),  # API connectivity issues
            await self._check_latency(),     # High latency
            await self._check_data_quality() # Bad data
        ]

        if any(emergency_triggers + system_triggers):
            self.is_emergency = True
            return True

        return False

    async def execute_emergency_stop(self):
        """Execute emergency stop procedures"""

        # Cancel all open orders
        await self._cancel_all_orders()

        # Close all positions
        await self._close_all_positions()

        # Send alerts
        await self._send_emergency_alert()

        # Log emergency event
        logging.critical("EMERGENCY STOP EXECUTED")
```

## Risk Monitoring Dashboard

### Real-time Risk Metrics
```python
class RiskMonitor:
    def __init__(self, risk_manager: RiskManager):
        self.risk_manager = risk_manager
        self.metrics_history = []
        self.alert_thresholds = {
            'drawdown': 0.15,
            'position_count': 15,
            'daily_loss': 0.08,
            'correlation': 0.8
        }

    async def generate_risk_report(self) -> Dict:
        """Generate comprehensive risk report"""

        metrics = await self.risk_manager._calculate_portfolio_metrics()

        report = {
            'timestamp': datetime.now().isoformat(),
            'portfolio_metrics': {
                'total_value': metrics.portfolio_value,
                'total_pnl': metrics.total_pnl,
                'drawdown': metrics.drawdown,
                'sharpe_ratio': metrics.sharpe_ratio,
                'var_95': metrics.var_95,
                'risk_level': metrics.risk_level.value
            },
            'position_metrics': {
                'total_positions': len(self.risk_manager.positions),
                'long_positions': sum(1 for p in self.risk_manager.positions.values() if p.side == OrderSide.BUY),
                'short_positions': sum(1 for p in self.risk_manager.positions.values() if p.side == OrderSide.SELL),
                'total_exposure': sum(abs(p.size * p.current_price) for p in self.risk_manager.positions.values())
            },
            'strategy_metrics': await self._analyze_strategy_performance(),
            'alerts': await self._generate_alerts(metrics),
            'recommendations': await self._generate_recommendations(metrics)
        }

        return report

    async def _analyze_strategy_performance(self) -> Dict:
        """Analyze performance by strategy"""

        strategy_stats = {}

        for position in self.risk_manager.positions.values():
            if position.strategy_id not in strategy_stats:
                strategy_stats[position.strategy_id] = {
                    'positions': 0,
                    'total_pnl': 0.0,
                    'win_rate': 0.0,
                    'avg_hold_time': 0.0
                }

            stats = strategy_stats[position.strategy_id]
            stats['positions'] += 1
            stats['total_pnl'] += position.unrealized_pnl + position.realized_pnl

        return strategy_stats

    async def _generate_alerts(self, metrics: RiskMetrics) -> List[Dict]:
        """Generate risk alerts based on current metrics"""

        alerts = []

        # Drawdown alerts
        if metrics.drawdown > self.alert_thresholds['drawdown']:
            alerts.append({
                'level': 'high',
                'type': 'drawdown',
                'message': f"Drawdown of {metrics.drawdown:.2%} exceeds threshold",
                'value': metrics.drawdown
            })

        # Position count alerts
        position_count = len(self.risk_manager.positions)
        if position_count > self.alert_thresholds['position_count']:
            alerts.append({
                'level': 'medium',
                'type': 'position_count',
                'message': f"Position count ({position_count}) exceeds threshold",
                'value': position_count
            })

        # Daily loss alerts
        daily_loss_pct = abs(self.risk_manager.daily_losses) / self.risk_manager.current_capital
        if daily_loss_pct > self.alert_thresholds['daily_loss']:
            alerts.append({
                'level': 'high',
                'type': 'daily_loss',
                'message': f"Daily loss of {daily_loss_pct:.2%} exceeds threshold",
                'value': daily_loss_pct
            })

        return alerts
```

This risk management system provides comprehensive protection through dynamic position sizing, real-time monitoring, and automated safety mechanisms while allowing for profitable trading operations within defined risk parameters.