"""
Consolidation Pop Strategy Adapter
Buy low 1/3 of consolidation range, sell upper 1/3
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any
import pandas as pd

from src.strategies.adapters.base import StrategyAdapter


class ConsolidationAdapter(StrategyAdapter):
    """
    Consolidation Pop Strategy
    - Identify consolidation (low volatility period)
    - Buy in lower 1/3 of range
    - Sell in upper 1/3 of range
    """

    def get_interval(self) -> int:
        return 20

    async def analyze(self) -> Optional[Dict[str, Any]]:
        ohlcv = await self.client.get_ohlcv(
            self.config.symbol, self.config.timeframe, limit=20
        )

        if len(ohlcv) < 10:
            return None

        df = pd.DataFrame(
            ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )

        high = df["high"].max()
        low = df["low"].min()
        current = df["close"].iloc[-1]

        range_size = high - low
        consolidation_pct = (range_size / current) * 100

        if consolidation_pct > 0.7:
            return None

        position = await self.get_position()

        if not position:
            lower_third = low + (range_size / 3)
            upper_third = high - (range_size / 3)

            if current <= lower_third:
                return {
                    "action": "buy",
                    "price": current,
                    "reason": "Lower 1/3 of consolidation",
                    "stop_loss": current * (1 - (self.config.stop_loss or 0.0025)),
                    "take_profit": current * (1 + (self.config.take_profit or 0.003)),
                }
            elif current >= upper_third:
                return {
                    "action": "sell",
                    "price": current,
                    "reason": "Upper 1/3 of consolidation",
                    "stop_loss": current * (1 + (self.config.stop_loss or 0.0025)),
                    "take_profit": current * (1 - (self.config.take_profit or 0.003)),
                }

        return None

    async def execute_signal(self, signal: Dict[str, Any]):
        if signal["action"] == "buy":
            await self.place_order("buy", self.config.size)
        elif signal["action"] == "sell":
            await self.place_order("sell", self.config.size)
