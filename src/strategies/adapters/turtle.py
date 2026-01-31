"""
Turtle Trending Strategy Adapter
55-bar breakout with 2x ATR stop loss
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any
import pandas as pd

from src.strategies.adapters.base import StrategyAdapter


class TurtleAdapter(StrategyAdapter):
    """
    Turtle Trending Strategy
    - Enter on 55-bar high/low breakout
    - Exit on 2x ATR stop loss or profit target
    """

    def get_interval(self) -> int:
        return 60

    async def analyze(self) -> Optional[Dict[str, Any]]:
        ohlcv = await self.client.get_ohlcv(
            self.config.symbol, self.config.timeframe, limit=60
        )

        if len(ohlcv) < 55:
            return None

        df = pd.DataFrame(
            ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )

        high_55 = df["high"].tail(55).max()
        low_55 = df["low"].tail(55).min()
        current_price = df["close"].iloc[-1]

        position = await self.get_position()

        if not position:
            if current_price >= high_55:
                return {
                    "action": "buy",
                    "price": current_price,
                    "reason": "55-bar high breakout",
                }
            elif current_price <= low_55:
                return {
                    "action": "sell",
                    "price": current_price,
                    "reason": "55-bar low breakout",
                }
        else:
            entry = position["entry_price"]
            atr = self._calculate_atr(df)

            if position["side"] == "long":
                stop_price = entry - (2 * atr)
                tp_price = entry * (1 + (self.config.take_profit or 0.002))

                if current_price <= stop_price:
                    return {"action": "close", "reason": "ATR stop loss"}
                elif current_price >= tp_price:
                    return {"action": "close", "reason": "Take profit"}
            else:
                stop_price = entry + (2 * atr)
                tp_price = entry * (1 - (self.config.take_profit or 0.002))

                if current_price >= stop_price:
                    return {"action": "close", "reason": "ATR stop loss"}
                elif current_price <= tp_price:
                    return {"action": "close", "reason": "Take profit"}

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

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        high_low = df["high"] - df["low"]
        high_close = abs(df["high"] - df["close"].shift())
        low_close = abs(df["low"] - df["close"].shift())

        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean().iloc[-1]

        return float(atr)
