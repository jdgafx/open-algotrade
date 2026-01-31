"""
Base Strategy Adapter Interface
All MoonDev strategies implement this interface for SaaS integration
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional, Any
import asyncio

from src.utils.hyperliquid_client import HyperliquidClient


@dataclass
class StrategyConfig:
    strategy_id: str
    symbol: str
    size: Decimal
    timeframe: str
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    extra_params: Optional[Dict[str, Any]] = None


class StrategyAdapter(ABC):
    """Base class for all trading strategy adapters"""

    def __init__(self, client: HyperliquidClient, config: StrategyConfig):
        self.client = client
        self.config = config
        self.is_running = False
        self.updates: List[Dict] = []

    @abstractmethod
    async def analyze(self) -> Optional[Dict[str, Any]]:
        """Analyze market conditions and return signal if any"""
        pass

    @abstractmethod
    async def execute_signal(self, signal: Dict[str, Any]):
        """Execute a trading signal"""
        pass

    async def run(self):
        """Main strategy loop"""
        self.is_running = True
        while self.is_running:
            try:
                signal = await self.analyze()
                if signal:
                    await self.execute_signal(signal)
                    self.updates.append(
                        {
                            "type": "trade",
                            "signal": signal,
                            "timestamp": asyncio.get_event_loop().time(),
                        }
                    )
                await asyncio.sleep(self.get_interval())
            except Exception as e:
                self.updates.append(
                    {
                        "type": "error",
                        "error": str(e),
                        "timestamp": asyncio.get_event_loop().time(),
                    }
                )
                await asyncio.sleep(30)

    async def stop(self):
        """Stop the strategy"""
        self.is_running = False

    def get_updates(self) -> List[Dict]:
        """Get and clear pending updates"""
        updates = self.updates.copy()
        self.updates.clear()
        return updates

    @abstractmethod
    def get_interval(self) -> int:
        """Get polling interval in seconds"""
        pass

    async def get_position(self) -> Optional[Dict]:
        """Get current position for symbol"""
        positions = await self.client.get_positions()
        for pos in positions:
            if pos.symbol == self.config.symbol:
                return {
                    "symbol": pos.symbol,
                    "size": float(pos.size),
                    "side": pos.side,
                    "entry_price": float(pos.entry_price),
                    "unrealized_pnl": float(pos.unrealized_pnl),
                }
        return None

    async def place_order(
        self, side: str, size: Decimal, price: Optional[Decimal] = None
    ):
        """Place an order through HyperLiquid"""
        return await self.client.place_order(
            symbol=self.config.symbol,
            side=side,
            size=size,
            order_type="limit" if price else "market",
            price=price,
        )
