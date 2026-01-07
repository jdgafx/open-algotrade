"""
Backtest Engine
Simulates trading environment using historical data.
Orchestrates the Mock Client and Strategies.
"""

import logging
import asyncio
from typing import Dict, Any, List
from datetime import datetime
from decimal import Decimal
import pandas as pd
import numpy as np

from src.engine.trading_engine import TradingEngine, TradingEngineConfig
from src.testing.mock_client import MockHyperliquidClient
from src.utils.data_loader import DataLoader
from src.strategies.market_maker import EnhancedMarketMaker, MarketMakerConfig
from src.strategies.turtle_trading import EnhancedTurtleTrader, TurtleConfig

logger = logging.getLogger(__name__)


class BacktestEngine:
    """
    Engine for running backtests.
    Runs synchronously through historical data steps.
    """

    def __init__(self, config: TradingEngineConfig, data_loader: DataLoader):
        self.config = config
        self.data_loader = data_loader
        self.mock_client = MockHyperliquidClient(sandbox=True)

        self.strategies: List[Any] = []
        self.results: Dict[str, Any] = {}

    async def setup(self):
        """Initialize strategies with mock client"""
        logger.info("Setting up Backtest Engine")
        await self.mock_client.connect()

        if self.config.enable_market_making:
            mm_config = MarketMakerConfig(
                symbol="ETH",
                base_size=Decimal("0.1"),
                max_position_size=Decimal("1.0"),
                risk_limit=Decimal("5000"),
                spread_percentage=Decimal("0.001"),
                time_limit_minutes=120,
                kill_switch_enabled=True,
            )
            strategy = EnhancedMarketMaker(self.mock_client, mm_config)
            self.strategies.append(strategy)

        if self.config.enable_turtle_trading:
            turtle_config = TurtleConfig(
                symbol="ETH",
                timeframe="1h",
                lookback_period=20,
                atr_period=14,
                atr_multiplier=Decimal("2.0"),
                take_profit_percentage=Decimal("0.02"),
                size=Decimal("0.1"),
                leverage=1,
                trading_hours_only=False,
                exit_friday=False,
                max_position_size=Decimal("1.0"),
            )
            strategy = EnhancedTurtleTrader(self.mock_client, turtle_config)
            self.strategies.append(strategy)

    async def run(self, symbol: str, start_date: str, end_date: str):
        """Execute the backtest simulation"""
        logger.info(f"Starting backtest for {symbol} from {start_date} to {end_date}")

        try:
            try:
                df = self.data_loader.get_ticker_data(symbol, "1h")
            except Exception:
                logger.warning(f"No CSV found for {symbol}, generating synthetic data")
                df = self._generate_synthetic_data(start_date, end_date)

            records = self.data_loader.dataframe_to_iterator(df)

            for i, tick in enumerate(records):
                price = Decimal(str(tick["close"]))
                timestamp = int(tick["timestamp"])

                self.mock_client.update_market_state(symbol, tick)

                for strategy in self.strategies:
                    await strategy.iteration()

                if i % 100 == 0:
                    account = await self.mock_client.get_account_info()
                    val = account["account_value"]
                    logger.info(f"Step {i}: Price={price}, Value={val}")

            account = await self.mock_client.get_account_info()
            logger.info("Backtest Complete")
            logger.info(f"Final Account Value: {account['account_value']}")

            self.results = {
                "final_value": str(account["account_value"]),
                "total_trades": len(self.mock_client.trades_history),
                "history": self.mock_client.trades_history,
            }

            return self.results

        except Exception as e:
            logger.error(f"Backtest failed: {e}")
            raise

    def _generate_synthetic_data(self, start_date: str, end_date: str) -> pd.DataFrame:
        """Generate sine wave price data for testing if no CSV exists"""
        dates = pd.date_range(start=start_date, end=end_date, freq="1h")

        prices = 1000 + 100 * np.sin(np.linspace(0, 4 * np.pi, len(dates)))

        df = pd.DataFrame(
            {
                "timestamp": dates.astype(int) // 10**6,
                "open": prices,
                "high": prices + 5,
                "low": prices - 5,
                "close": prices,
                "volume": 1000,
            }
        )
        return df
