"""
Mean Reversion Strategy Adapter
74-ticker universe oversold bounce strategy
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any, List
import pandas as pd
import numpy as np

from src.strategies.adapters.base import StrategyAdapter


class MeanReversionAdapter(StrategyAdapter):
    """
    Mean Reversion Strategy
    - Monitor z-score of price vs moving average
    - Enter when z-score is extreme (oversold/overbought)
    - Exit when price reverts to mean
    """

    def __init__(self, client, config):
        super().__init__(client, config)
        self.zscore_threshold = (
            config.extra_params.get("zscore_threshold", -2.0)
            if config.extra_params
            else -2.0
        )
        self.lookback = (
            config.extra_params.get("lookback", 50) if config.extra_params else 50
        )
        self.universe = self._get_universe()

    def get_interval(self) -> int:
        return 900  # 15 minutes

    def _get_universe(self) -> List[str]:
        # Simplified universe - in production this would be 74+ assets
        return [
            "BTC",
            "ETH",
            "SOL",
            "AVAX",
            "MATIC",
            "LINK",
            "UNI",
            "AAVE",
            "SNX",
            "COMP",
            "MKR",
            "YFI",
            "CRV",
            "SUSHI",
            "1INCH",
        ]

    async def analyze(self) -> Optional[Dict[str, Any]]:
        ohlcv = await self.client.get_ohlcv(
            self.config.symbol, self.config.timeframe, limit=self.lookback
        )

        if len(ohlcv) < self.lookback:
            return None

        df = pd.DataFrame(
            ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )

        # Calculate indicators
        sma = df["close"].rolling(window=20).mean()
        std = df["close"].rolling(window=20).std()

        current_price = df["close"].iloc[-1]
        current_sma = sma.iloc[-1]
        current_std = std.iloc[-1]

        # Calculate z-score
        z_score = (current_price - current_sma) / current_std if current_std > 0 else 0

        # Calculate RSI
        rsi = self._calculate_rsi(df["close"], 14)
        current_rsi = rsi.iloc[-1]

        position = await self.get_position()

        if not position:
            # Look for oversold conditions
            if z_score < self.zscore_threshold and current_rsi < 30:
                return {
                    "action": "buy",
                    "price": current_price,
                    "reason": f"Mean reversion long - Z: {z_score:.2f}, RSI: {current_rsi:.1f}",
                }
            # Look for overbought conditions
            elif z_score > abs(self.zscore_threshold) and current_rsi > 70:
                return {
                    "action": "sell",
                    "price": current_price,
                    "reason": f"Mean reversion short - Z: {z_score:.2f}, RSI: {current_rsi:.1f}",
                }
        else:
            # Exit when z-score reverts
            if abs(z_score) < 0.5:
                return {
                    "action": "close",
                    "reason": f"Mean reversion exit - Z: {z_score:.2f}",
                }

        return None

    async def execute_signal(self, signal: Dict[str, Any]):
        if signal["action"] == "buy":
            await self.place_order("buy", self.config.size)
        elif signal["action"] == "sell":
            await self.place_order("sell", self.config.size)
        elif signal["action"] == "close":
            position = await self.get_position()
            if position:
                side = "sell" if position["side"] == "long" else "buy"
                await self.place_order(side, Decimal(str(abs(position["size"]))))

    def _calculate_rsi(self, prices: pd.Series, window: int = 14) -> pd.Series:
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
