"""
Correlation Arbitrage Strategy Adapter
Cross-asset correlation statistical arbitrage
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any, List
import pandas as pd
import numpy as np

from src.strategies.adapters.base import StrategyAdapter


class CorrelationAdapter(StrategyAdapter):
    """
    Correlation Arbitrage Strategy
    - Monitor correlation between assets
    - Trade when correlation breaks down
    - Statistical arbitrage based on mean reversion
    """

    def __init__(self, client, config):
        super().__init__(client, config)
        self.correlation_pairs = self._get_correlation_pairs()
        self.lookback = (
            config.extra_params.get("lookback", 100) if config.extra_params else 100
        )
        self.threshold = (
            config.extra_params.get("correlation_threshold", 0.8)
            if config.extra_params
            else 0.8
        )

    def get_interval(self) -> int:
        return 300  # 5 minutes

    def _get_correlation_pairs(self) -> List[str]:
        # Common correlated pairs in crypto
        base = self.config.symbol
        pairs = {
            "BTC": ["ETH", "SOL", "AVAX"],
            "ETH": ["BTC", "SOL", "MATIC"],
            "SOL": ["BTC", "ETH", "AVAX"],
        }

        # Extract base asset from symbol (e.g., 'BTC' from 'BTC-USD')
        base_asset = base.split("-")[0] if "-" in base else base[:3]
        return pairs.get(base_asset, ["BTC", "ETH"])

    async def analyze(self) -> Optional[Dict[str, Any]]:
        # Get main symbol data
        main_ohlcv = await self.client.get_ohlcv(
            self.config.symbol, self.config.timeframe, limit=self.lookback
        )

        if len(main_ohlcv) < self.lookback:
            return None

        main_df = pd.DataFrame(
            main_ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        main_returns = main_df["close"].pct_change().dropna()

        # Get correlation pairs data
        correlations = []
        z_scores = []

        for pair in self.correlation_pairs[:2]:  # Limit to 2 pairs for performance
            try:
                pair_ohlcv = await self.client.get_ohlcv(
                    pair, self.config.timeframe, limit=self.lookback
                )

                if len(pair_ohlcv) < self.lookback:
                    continue

                pair_df = pd.DataFrame(
                    pair_ohlcv,
                    columns=["timestamp", "open", "high", "low", "close", "volume"],
                )
                pair_returns = pair_df["close"].pct_change().dropna()

                # Calculate correlation
                correlation = main_returns.corr(pair_returns)
                correlations.append(correlation)

                # Calculate z-score of price spread
                spread = main_df["close"] / pair_df["close"]
                z_score = (spread.iloc[-1] - spread.mean()) / spread.std()
                z_scores.append(z_score)

            except Exception:
                continue

        if not correlations or not z_scores:
            return None

        avg_correlation = np.mean(correlations)
        avg_z_score = np.mean(z_scores)

        current_price = main_df["close"].iloc[-1]
        position = await self.get_position()

        if not position:
            # Look for entry when correlation is strong but z-score is extreme
            if avg_correlation > self.threshold:
                if avg_z_score < -2.0:
                    return {
                        "action": "buy",
                        "price": current_price,
                        "reason": f"Correlation: {avg_correlation:.2f}, Z-Score: {avg_z_score:.2f}",
                    }
                elif avg_z_score > 2.0:
                    return {
                        "action": "sell",
                        "price": current_price,
                        "reason": f"Correlation: {avg_correlation:.2f}, Z-Score: {avg_z_score:.2f}",
                    }
        else:
            # Exit when z-score reverts to mean
            if abs(avg_z_score) < 0.5:
                return {
                    "action": "close",
                    "reason": f"Mean reversion - Z-Score: {avg_z_score:.2f}",
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
