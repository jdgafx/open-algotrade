"""
Nadarya-Watson Strategy Adapter
Stoch RSI + Nadarya signals for high-probability entries
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any
import pandas as pd
import numpy as np

from src.strategies.adapters.base import StrategyAdapter


class NadaryaAdapter(StrategyAdapter):
    """
    Nadarya-Watson Strategy
    - Stoch RSI for oversold/overbought
    - Nadarya indicator for trend confirmation
    - Combined signals for high-probability entries
    """

    def get_interval(self) -> int:
        return 60

    async def analyze(self) -> Optional[Dict[str, Any]]:
        ohlcv = await self.client.get_ohlcv(
            self.config.symbol, self.config.timeframe, limit=100
        )

        if len(ohlcv) < 50:
            return None

        df = pd.DataFrame(
            ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )

        # Calculate Stoch RSI
        rsi_window = (
            self.config.extra_params.get("rsi_window", 14)
            if self.config.extra_params
            else 14
        )
        oversold = (
            self.config.extra_params.get("oversold", 10)
            if self.config.extra_params
            else 10
        )
        overbought = (
            self.config.extra_params.get("overbought", 90)
            if self.config.extra_params
            else 90
        )

        stoch_rsi = self._calculate_stoch_rsi(df["close"], rsi_window)
        df["stoch_rsi"] = stoch_rsi

        # Calculate Nadarya indicator
        nadarya_buy, nadarya_sell = self._calculate_nadarya(df)

        current_price = df["close"].iloc[-1]
        current_rsi = df["stoch_rsi"].iloc[-1]

        position = await self.get_position()

        if not position:
            # Look for entry signals
            if nadarya_buy or current_rsi < oversold:
                return {
                    "action": "buy",
                    "price": current_price,
                    "reason": f"Nadarya buy signal (RSI: {current_rsi:.1f})",
                }
            elif nadarya_sell or current_rsi > overbought:
                return {
                    "action": "sell",
                    "price": current_price,
                    "reason": f"Nadarya sell signal (RSI: {current_rsi:.1f})",
                }
        else:
            # Look for exit signals
            exit_threshold = 2  # Require 2 consecutive signals

            if position["side"] == "long":
                if nadarya_sell or self._is_overbought(
                    df["stoch_rsi"], exit_threshold, overbought
                ):
                    return {
                        "action": "close",
                        "reason": f"Exit long - Overbought (RSI: {current_rsi:.1f})",
                    }
            else:
                if nadarya_buy or self._is_oversold(
                    df["stoch_rsi"], exit_threshold, oversold
                ):
                    return {
                        "action": "close",
                        "reason": f"Exit short - Oversold (RSI: {current_rsi:.1f})",
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

    def _calculate_stoch_rsi(self, prices: pd.Series, window: int = 14) -> pd.Series:
        # Calculate RSI
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))

        # Calculate Stochastic RSI
        min_rsi = rsi.rolling(window=window).min()
        max_rsi = rsi.rolling(window=window).max()
        stoch_rsi = (rsi - min_rsi) / (max_rsi - min_rsi) * 100

        return stoch_rsi.fillna(50)

    def _calculate_nadarya(self, df: pd.DataFrame) -> tuple:
        # Simplified Nadarya indicator
        # Using Hull Moving Average as proxy
        period = 20

        wma_half = df["close"].rolling(window=period // 2).mean()
        wma_full = df["close"].rolling(window=period).mean()

        raw_hma = 2 * wma_half - wma_full
        hma = raw_hma.rolling(window=int(np.sqrt(period))).mean()

        current = df["close"].iloc[-1]
        hma_current = hma.iloc[-1]
        hma_prev = hma.iloc[-2]

        buy_signal = current > hma_current and df["close"].iloc[-2] <= hma_prev
        sell_signal = current < hma_current and df["close"].iloc[-2] >= hma_prev

        return buy_signal, sell_signal

    def _is_overbought(
        self, stoch_rsi: pd.Series, times: int, threshold: float
    ) -> bool:
        recent = stoch_rsi.tail(times)
        return all(r > threshold for r in recent if pd.notna(r))

    def _is_oversold(self, stoch_rsi: pd.Series, times: int, threshold: float) -> bool:
        recent = stoch_rsi.tail(times)
        return all(r < threshold for r in recent if pd.notna(r))
