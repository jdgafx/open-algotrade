"""
Market Maker Strategy Adapter
Order book microstructure spread capture
"""

import asyncio
from decimal import Decimal
from typing import Dict, Optional, Any

from src.strategies.adapters.base import StrategyAdapter


class MarketMakerAdapter(StrategyAdapter):
    """
    Market Maker Strategy
    - Place bid/ask around mid price
    - Capture spread on each round-trip
    - Dynamic position sizing
    """

    def __init__(self, client, config):
        super().__init__(client, config)
        self.spread_target = (
            config.extra_params.get("spread_target", 0.1)
            if config.extra_params
            else 0.1
        )
        self.max_position = (
            config.extra_params.get("max_position", 1000)
            if config.extra_params
            else 1000
        )
        self.current_position = 0.0

    def get_interval(self) -> int:
        return 30  # 30 seconds

    async def analyze(self) -> Optional[Dict[str, Any]]:
        market_data = await self.client.get_market_data(self.config.symbol)

        bid = market_data.bid
        ask = market_data.ask
        mid = (bid + ask) / 2
        spread_pct = ((ask - bid) / mid) * 100

        # Only trade if spread is attractive
        if spread_pct < self.spread_target:
            return None

        position = await self.get_position()
        position_size = abs(position["size"]) if position else 0

        # Don't exceed max position
        if position_size >= self.max_position:
            return None

        # Place orders at improved prices
        our_bid = mid * (1 - self.spread_target / 200)
        our_ask = mid * (1 + self.spread_target / 200)

        # Simple market making: alternate buy/sell based on position
        if not position or position["size"] == 0:
            return {
                "action": "buy",
                "price": our_bid,
                "reason": f"Market maker entry - Spread: {spread_pct:.2f}%",
            }
        elif position["side"] == "long" and position["size"] > 0:
            return {
                "action": "sell",
                "price": our_ask,
                "reason": f"Market maker exit - Spread: {spread_pct:.2f}%",
            }
        elif position["side"] == "short" and position["size"] < 0:
            return {
                "action": "buy",
                "price": our_bid,
                "reason": f"Market maker exit - Spread: {spread_pct:.2f}%",
            }

        return None

    async def execute_signal(self, signal: Dict[str, Any]):
        size = min(self.config.size, Decimal(str(self.max_position / 10)))

        if signal["action"] == "buy":
            await self.place_order("buy", size, Decimal(str(signal["price"])))
        elif signal["action"] == "sell":
            await self.place_order("sell", size, Decimal(str(signal["price"])))
