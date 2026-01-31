"""
Arbitrage Strategy Adapter
Cross-exchange and triangular arbitrage with sub-100ms execution
"""

import asyncio
import time
from decimal import Decimal
from typing import Dict, Optional, Any, List, Tuple
import pandas as pd
import numpy as np

from src.strategies.adapters.base import StrategyAdapter


class ArbitrageAdapter(StrategyAdapter):
    """
    High-Frequency Arbitrage Strategy
    - Triangular arbitrage (A -> B -> C -> A)
    - Statistical arbitrage (pairs trading)
    - Cross-exchange price discrepancies
    - Sub-100ms execution target
    """

    def __init__(self, client, config):
        super().__init__(client, config)
        self.min_profit = (
            config.extra_params.get("min_profit_pct", 0.1)
            if config.extra_params
            else 0.1
        )
        self.max_slippage = (
            config.extra_params.get("max_slippage", 0.05)
            if config.extra_params
            else 0.05
        )
        self.base_size = (
            config.extra_params.get("base_size", 1000) if config.extra_params else 1000
        )

        # Arbitrage pairs
        self.triangular_pairs = [
            ("ETH", "BTC", "USDC"),
            ("SOL", "ETH", "USDC"),
        ]
        self.statistical_pairs = [
            ("ETH", "BTC"),
            ("SOL", "ETH"),
        ]

        # Price cache for speed
        self.price_cache: Dict[str, float] = {}
        self.correlation_cache: Dict[Tuple[str, str], float] = {}

    def get_interval(self) -> int:
        return 1  # 1 second for HFT

    async def analyze(self) -> Optional[Dict[str, Any]]:
        start_time = time.time()

        # Update price cache
        await self._update_price_cache()

        # Check triangular arbitrage
        for base, intermediate, quote in self.triangular_pairs:
            signal = self._check_triangular_arbitrage(base, intermediate, quote)
            if signal:
                signal["execution_time_ms"] = (time.time() - start_time) * 1000
                return signal

        # Check statistical arbitrage
        for asset1, asset2 in self.statistical_pairs:
            signal = await self._check_statistical_arbitrage(asset1, asset2)
            if signal:
                signal["execution_time_ms"] = (time.time() - start_time) * 1000
                return signal

        return None

    async def _update_price_cache(self):
        """Update prices quickly from cache or fetch new"""
        symbols = ["ETH", "BTC", "SOL", "USDC", "AVAX", "MATIC"]
        for symbol in symbols:
            try:
                price = await self.client.get_price(symbol)
                if price:
                    self.price_cache[symbol] = float(price)
            except:
                pass

    def _check_triangular_arbitrage(
        self, base: str, intermediate: str, quote: str
    ) -> Optional[Dict]:
        """Check for triangular arbitrage: base -> intermediate -> quote -> base"""
        if (
            base not in self.price_cache
            or intermediate not in self.price_cache
            or quote not in self.price_cache
        ):
            return None

        # Get prices
        price_base_int = self.price_cache[base] / self.price_cache[intermediate]
        price_int_quote = self.price_cache[intermediate] / self.price_cache[quote]
        price_quote_base = self.price_cache[quote] / self.price_cache[base]

        # Calculate loop rate
        triangular_rate = price_base_int * price_int_quote * price_quote_base
        profit_pct = (triangular_rate - 1.0) * 100

        if profit_pct > self.min_profit:
            return {
                "action": "buy",
                "symbol": f"{base}-{intermediate}-{quote}",
                "price": self.price_cache[base],
                "reason": f"Triangular arbitrage: {profit_pct:.3f}% profit",
                "profit_pct": profit_pct,
                "type": "triangular",
            }

        return None

    async def _check_statistical_arbitrage(
        self, asset1: str, asset2: str
    ) -> Optional[Dict]:
        """Check for statistical arbitrage based on price ratio deviation"""
        if asset1 not in self.price_cache or asset2 not in self.price_cache:
            return None

        # Get historical ratio from cache or calculate
        pair_key = (asset1, asset2)
        if pair_key not in self.correlation_cache:
            # Default ratio calculation
            self.correlation_cache[pair_key] = (
                self.price_cache[asset1] / self.price_cache[asset2]
            )

        expected_ratio = self.correlation_cache[pair_key]
        current_ratio = self.price_cache[asset1] / self.price_cache[asset2]

        # Calculate z-score
        deviation = abs(current_ratio - expected_ratio) / expected_ratio * 100

        if deviation > self.min_profit * 2:  # Higher threshold for statistical
            # Determine which asset is over/under valued
            if current_ratio > expected_ratio:
                action = "sell"
                symbol = asset1
            else:
                action = "buy"
                symbol = asset1

            return {
                "action": action,
                "symbol": symbol,
                "price": self.price_cache[asset1],
                "reason": f"Statistical arb: {deviation:.3f}% deviation",
                "profit_pct": deviation,
                "type": "statistical",
            }

        return None

    async def execute_signal(self, signal: Dict[str, Any]):
        """Execute arbitrage quickly"""
        execution_start = time.time()

        try:
            if signal.get("type") == "triangular":
                # Execute triangular arbitrage
                await self._execute_triangular(signal)
            else:
                # Standard execution
                size = Decimal(str(self.config.size))
                if signal["action"] == "buy":
                    await self.place_order("buy", size)
                elif signal["action"] == "sell":
                    await self.place_order("sell", size)

            execution_time = (time.time() - execution_start) * 1000
            self.updates.append(
                {
                    "type": "arbitrage_executed",
                    "signal": signal,
                    "execution_time_ms": execution_time,
                    "timestamp": time.time(),
                }
            )

        except Exception as e:
            self.updates.append(
                {
                    "type": "error",
                    "error": str(e),
                    "signal": signal,
                    "timestamp": time.time(),
                }
            )

    async def _execute_triangular(self, signal: Dict):
        """Execute triangular arbitrage steps"""
        symbols = signal["symbol"].split("-")
        if len(symbols) != 3:
            return

        # This would execute the three trades in sequence
        # For now, just log it
        print(
            f"⚡ Executing triangular: {symbols[0]} -> {symbols[1]} -> {symbols[2]} -> {symbols[0]}"
        )
