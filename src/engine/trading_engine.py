"""
Main Trading Engine - Orchestrates all trading strategies
Coordinates market making, turtle trading, correlation, and mean reversion strategies
High-performance execution with comprehensive risk management and monitoring
"""

import asyncio
import logging
import json
import time
from decimal import Decimal
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import aiohttp
from pathlib import Path

from ..utils.hyperliquid_client import HyperliquidClient
from ..strategies.market_maker import EnhancedMarketMaker, MarketMakerConfig
from ..strategies.turtle_trading import EnhancedTurtleTrader, TurtleConfig
from ..strategies.correlation_trading import CorrelationTrader, CorrelationConfig
from ..strategies.mean_reversion import MeanReversionTrader, MeanReversionConfig
from ..monitoring.performance_monitor import PerformanceMonitor
from ..monitoring.alert_system import AlertSystem

logger = logging.getLogger(__name__)

@dataclass
class TradingEngineConfig:
    """Main configuration for the trading engine"""
    # API Configuration
    hyperliquid_api_key: str
    hyperliquid_secret_key: str
    sandbox_mode: bool = False

    # Global Risk Management
    max_portfolio_risk: Decimal = Decimal('10000')
    max_total_leverage: int = 10
    daily_loss_limit: Decimal = Decimal('2000')
    emergency_stop_enabled: bool = True

    # Strategy Configuration
    enable_market_making: bool = True
    enable_turtle_trading: bool = True
    enable_correlation: bool = True
    enable_mean_reversion: bool = True

    # Performance Settings
    high_frequency_mode: bool = True
    parallel_execution: bool = True
    monitoring_enabled: bool = True

    # Alert Configuration
    discord_webhook_url: Optional[str] = None
    email_alerts: bool = False
    alert_email_address: Optional[str] = None

class TradingEngine:
    """
    Main trading engine that orchestrates multiple trading strategies
    Features:
    - Multi-strategy coordination
    - Advanced risk management
    - Real-time performance monitoring
    - Emergency stop mechanisms
    - Automatic position sizing
    - Comprehensive logging and alerts
    """

    def __init__(self, config: TradingEngineConfig):
        self.config = config
        self.client: Optional[HyperliquidClient] = None
        self.performance_monitor: Optional[PerformanceMonitor] = None
        self.alert_system: Optional[AlertSystem] = None

        # Strategy instances
        self.market_maker: Optional[EnhancedMarketMaker] = None
        self.turtle_trader: Optional[EnhancedTurtleTrader] = None
        self.correlation_trader: Optional[CorrelationTrader] = None
        self.mean_reversion_trader: Optional[MeanReversionTrader] = None

        # Engine state
        self.is_running = False
        self.emergency_stop_triggered = False
        self.start_time: Optional[datetime] = None
        self.daily_pnl = Decimal('0')
        self.last_daily_reset = datetime.now().date()

        # Performance tracking
        self.total_trades = 0
        self.total_pnl = Decimal('0')
        self.max_drawdown = Decimal('0')
        self.peak_balance = Decimal('0')

        logger.info("Trading Engine initialized")

    async def start(self):
        """Start the trading engine"""
        logger.info("🚀 Starting Trading Engine")

        try:
            # Initialize client
            self.client = HyperliquidClient(
                api_key=self.config.hyperliquid_api_key,
                secret_key=self.config.hyperliquid_secret_key,
                sandbox=self.config.sandbox_mode
            )
            await self.client.connect()

            # Initialize monitoring and alert systems
            if self.config.monitoring_enabled:
                self.performance_monitor = PerformanceMonitor()
                self.alert_system = AlertSystem(
                    discord_webhook_url=self.config.discord_webhook_url,
                    email_enabled=self.config.email_alerts,
                    email_address=self.config.alert_email_address
                )

            # Initialize strategies
            await self._initialize_strategies()

            # Start monitoring task
            if self.config.monitoring_enabled:
                asyncio.create_task(self._monitoring_loop())

            # Start strategy execution tasks
            strategy_tasks = []
            if self.config.enable_market_making:
                strategy_tasks.append(asyncio.create_task(self._run_market_maker()))
            if self.config.enable_turtle_trading:
                strategy_tasks.append(asyncio.create_task(self._run_turtle_trader()))
            if self.config.enable_correlation:
                strategy_tasks.append(asyncio.create_task(self._run_correlation_trader()))
            if self.config.enable_mean_reversion:
                strategy_tasks.append(asyncio.create_task(self._run_mean_reversion_trader()))

            # Start main engine loop
            self.is_running = True
            self.start_time = datetime.now()

            await self._main_engine_loop()

        except Exception as e:
            logger.error(f"Error starting trading engine: {e}")
            await self.emergency_stop()

    async def _initialize_strategies(self):
        """Initialize all trading strategies"""
        logger.info("Initializing trading strategies...")

        # Market Making Strategy
        if self.config.enable_market_making:
            mm_config = MarketMakerConfig(
                symbol="ETH",
                base_size=Decimal('1000'),
                max_position_size=Decimal('10000'),
                risk_limit=Decimal('5000'),
                spread_percentage=Decimal('0.001'),
                time_limit_minutes=120,
                kill_switch_enabled=True
            )
            self.market_maker = EnhancedMarketMaker(self.client, mm_config)

        # Turtle Trading Strategy
        if self.config.enable_turtle_trading:
            turtle_config = TurtleConfig(
                symbol="ETH",
                timeframe="5m",
                lookback_period=55,
                atr_period=20,
                atr_multiplier=Decimal('2.0'),
                take_profit_percentage=Decimal('0.002'),
                size=Decimal('500'),
                leverage=5,
                trading_hours_only=True,
                exit_friday=True,
                max_position_size=Decimal('2000')
            )
            self.turtle_trader = EnhancedTurtleTrader(self.client, turtle_config)

        # Correlation Trading Strategy
        if self.config.enable_correlation:
            correlation_config = CorrelationConfig(
                leader_symbol="ETH",
                follower_symbols=["BTC", "SOL", "ADA", "DOT", "MATIC", "AVAX"],
                timeframe="5m",
                lookback_period=20,
                lag_threshold_percentage=Decimal('0.5'),
                stop_loss_percentage=Decimal('0.002'),
                take_profit_percentage=Decimal('0.0025'),
                size=Decimal('1'),
                max_positions=3,
                min_correlation=Decimal('0.7'),
                entry_cooldown_minutes=30
            )
            self.correlation_trader = CorrelationTrader(self.client, correlation_config)

        # Mean Reversion Strategy
        if self.config.enable_mean_reversion:
            # Get available symbols from exchange
            markets = await self.client.get_account_info()
            popular_symbols = ["BTC", "ETH", "SOL", "ADA", "DOT", "MATIC", "AVAX", "LINK", "UNI", "AAVE"]

            mr_config = MeanReversionConfig(
                symbols=popular_symbols,
                timeframe="15m",
                sma_period=20,
                entry_threshold_deviation=2.0,
                exit_threshold_deviation=0.5,
                max_positions=10,
                size_per_position=Decimal('200'),
                lookback_period=100,
                min_volume_threshold=1000000,
                volatility_threshold=0.05,
                correlation_threshold=0.7
            )
            self.mean_reversion_trader = MeanReversionTrader(self.client, mr_config)

        logger.info("✅ All strategies initialized")

    async def _run_market_maker(self):
        """Run market making strategy"""
        try:
            logger.info("Starting Market Maker strategy")
            await self.market_maker.start()
        except Exception as e:
            logger.error(f"Error in Market Maker: {e}")

    async def _run_turtle_trader(self):
        """Run turtle trading strategy"""
        try:
            logger.info("Starting Turtle Trader strategy")
            await self.turtle_trader.start()
        except Exception as e:
            logger.error(f"Error in Turtle Trader: {e}")

    async def _run_correlation_trader(self):
        """Run correlation trading strategy"""
        try:
            logger.info("Starting Correlation Trader strategy")
            await self.correlation_trader.start()
        except Exception as e:
            logger.error(f"Error in Correlation Trader: {e}")

    async def _run_mean_reversion_trader(self):
        """Run mean reversion strategy"""
        try:
            logger.info("Starting Mean Reversion Trader strategy")
            await self.mean_reversion_trader.start()
        except Exception as e:
            logger.error(f"Error in Mean Reversion Trader: {e}")

    async def _main_engine_loop(self):
        """Main engine coordination loop"""
        logger.info("Starting main engine coordination loop")

        while self.is_running and not self.emergency_stop_triggered:
            try:
                # Reset daily PnL if new day
                if datetime.now().date() > self.last_daily_reset:
                    self.daily_pnl = Decimal('0')
                    self.last_daily_reset = datetime.now().date()
                    logger.info("Daily PnL reset")

                # Perform global risk management checks
                await self._global_risk_management()

                # Update portfolio statistics
                await self._update_portfolio_stats()

                # Small delay
                await asyncio.sleep(10)

            except Exception as e:
                logger.error(f"Error in main engine loop: {e}")
                await asyncio.sleep(30)

    async def _global_risk_management(self):
        """Perform global risk management checks"""
        try:
            # Get account information
            account_info = await self.client.get_account_info()
            total_value = account_info.get("account_value", Decimal('0'))
            total_position_value = account_info.get("total_notion_pos", Decimal('0'))
            available_balance = account_info.get("available_balance", Decimal('0'))

            # Check daily loss limit
            if self.daily_pnl <= -self.config.daily_loss_limit:
                logger.error(f"🚨 DAILY LOSS LIMIT REACHED: {self.daily_pnl}")
                await self.emergency_stop()
                return

            # Check portfolio risk limit
            if total_position_value > self.config.max_portfolio_risk:
                logger.error(f"🚨 PORTFOLIO RISK LIMIT EXCEEDED: {total_position_value} > {self.config.max_portfolio_risk}")
                await self.emergency_stop()
                return

            # Check available balance
            if available_balance < total_value * Decimal('0.1'):  # Less than 10% available
                logger.warning(f"⚠️ Low available balance: {available_balance} ({available_balance/total_value*100:.1f}%)")

            # Update peak balance and drawdown
            if total_value > self.peak_balance:
                self.peak_balance = total_value

            current_drawdown = (self.peak_balance - total_value) / self.peak_balance
            if current_drawdown > self.max_drawdown:
                self.max_drawdown = Decimal(str(current_drawdown))

            # Check if drawdown exceeds 15%
            if current_drawdown > 0.15:
                logger.error(f"🚨 MAX DRAWDOWN EXCEEDED: {current_drawdown:.1%}")
                if self.config.emergency_stop_enabled:
                    await self.emergency_stop()

        except Exception as e:
            logger.error(f"Error in global risk management: {e}")

    async def _update_portfolio_stats(self):
        """Update portfolio statistics"""
        try:
            positions = await self.client.get_positions()

            # Calculate total PnL
            total_unrealized_pnl = sum(pos.unrealized_pnl for pos in positions if abs(pos.size) > 0)

            # Update daily PnL (this would need real-time PnL tracking)
            # For now, use unrealized PnL as approximation
            self.total_pnl = total_unrealized_pnl

            # Log portfolio status
            logger.debug(f"Portfolio: {len(positions)} positions, Total PnL: {self.total_pnl}")

            # Send alerts if significant PnL movements
            if self.alert_system and abs(self.total_pnl) > Decimal('1000'):
                await self.alert_system.send_pnl_alert(self.total_pnl)

        except Exception as e:
            logger.error(f"Error updating portfolio stats: {e}")

    async def _monitoring_loop(self):
        """Monitoring and alerting loop"""
        logger.info("Starting monitoring loop")

        while self.is_running:
            try:
                # Collect performance metrics from all strategies
                metrics = await self._collect_all_metrics()

                # Update performance monitor
                if self.performance_monitor:
                    await self.performance_monitor.update_metrics(metrics)

                # Check for alerts
                if self.alert_system:
                    await self._check_alert_conditions(metrics)

                # Log periodic status
                await self._log_status()

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)

    async def _collect_all_metrics(self) -> Dict[str, Any]:
        """Collect performance metrics from all strategies"""
        try:
            metrics = {
                "engine": {
                    "is_running": self.is_running,
                    "uptime_seconds": (datetime.now() - self.start_time).total_seconds() if self.start_time else 0,
                    "total_trades": self.total_trades,
                    "total_pnl": float(self.total_pnl),
                    "daily_pnl": float(self.daily_pnl),
                    "max_drawdown": float(self.max_drawdown),
                    "peak_balance": float(self.peak_balance)
                }
            }

            # Collect strategy-specific metrics
            if self.market_maker:
                metrics["market_maker"] = self.market_maker.get_performance_stats()

            if self.turtle_trader:
                metrics["turtle_trader"] = self.turtle_trader.get_performance_stats()

            if self.correlation_trader:
                metrics["correlation_trader"] = self.correlation_trader.get_performance_stats()

            if self.mean_reversion_trader:
                metrics["mean_reversion_trader"] = self.mean_reversion_trader.get_performance_stats()

            return metrics

        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return {}

    async def _check_alert_conditions(self, metrics: Dict[str, Any]):
        """Check for alert conditions"""
        try:
            engine_metrics = metrics.get("engine", {})

            # Check for large drawdown
            if engine_metrics.get("max_drawdown", 0) > 0.1:  # 10% drawdown
                await self.alert_system.send_alert(
                    "High Drawdown Warning",
                    f"Current drawdown: {engine_metrics['max_drawdown']:.1%}",
                    level="warning"
                )

            # Check for large losses
            if engine_metrics.get("daily_pnl", 0) < -1000:
                await self.alert_system.send_alert(
                    "Large Daily Loss",
                    f"Daily PnL: ${engine_metrics['daily_pnl']:.2f}",
                    level="critical"
                )

            # Check for system health
            if not await self.client.health_check():
                await self.alert_system.send_alert(
                    "System Health Alert",
                    "API client health check failed",
                    level="critical"
                )

        except Exception as e:
            logger.error(f"Error checking alert conditions: {e}")

    async def _log_status(self):
        """Log periodic status"""
        try:
            uptime = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
            positions = await self.client.get_positions()
            active_positions = [pos for pos in positions if abs(pos.size) > 0]

            logger.info(
                f"📊 Engine Status | "
                f"Uptime: {uptime/3600:.1f}h | "
                f"Positions: {len(active_positions)} | "
                f"Total PnL: ${self.total_pnl:.2f} | "
                f"Daily PnL: ${self.daily_pnl:.2f} | "
                f"Max Drawdown: {self.max_drawdown:.1%}"
            )

        except Exception as e:
            logger.error(f"Error logging status: {e}")

    async def emergency_stop(self):
        """Emergency stop - shut down all trading and close positions"""
        logger.error("🚨 EMERGENCY STOP ACTIVATED - Shutting down all trading")

        self.emergency_stop_triggered = True
        self.is_running = False

        try:
            # Send emergency alert
            if self.alert_system:
                await self.alert_system.send_alert(
                    "EMERGENCY STOP ACTIVATED",
                    "Trading engine has been shut down due to emergency conditions",
                    level="critical"
                )

            # Cancel all orders and close positions
            if self.client:
                await self.client.kill_switch()

        except Exception as e:
            logger.error(f"Error during emergency stop: {e}")

    async def stop(self):
        """Graceful stop"""
        logger.info("Gracefully stopping trading engine")
        self.is_running = False

        # Send stop alert
        if self.alert_system:
            await self.alert_system.send_alert(
                "Trading Engine Stopped",
                "Trading engine has been gracefully stopped",
                level="info"
            )

    async def get_status(self) -> Dict[str, Any]:
        """Get current engine status"""
        try:
            positions = await self.client.get_positions() if self.client else []
            active_positions = [pos for pos in positions if abs(pos.size) > 0]

            return {
                "is_running": self.is_running,
                "emergency_stop_triggered": self.emergency_stop_triggered,
                "uptime_seconds": (datetime.now() - self.start_time).total_seconds() if self.start_time else 0,
                "total_trades": self.total_trades,
                "total_pnl": float(self.total_pnl),
                "daily_pnl": float(self.daily_pnl),
                "max_drawdown": float(self.max_drawdown),
                "peak_balance": float(self.peak_balance),
                "active_positions": len(active_positions),
                "strategies": {
                    "market_maker": self.market_maker is not None,
                    "turtle_trader": self.turtle_trader is not None,
                    "correlation_trader": self.correlation_trader is not None,
                    "mean_reversion_trader": self.mean_reversion_trader is not None
                }
            }
        except Exception as e:
            logger.error(f"Error getting status: {e}")
            return {"error": str(e)}

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.stop()
        if self.client:
            await self.client.disconnect()