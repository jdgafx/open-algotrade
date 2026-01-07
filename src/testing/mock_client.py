"""
Mock Hyperliquid Client for Backtesting
Simulates exchange behavior including order execution, PnL tracking, and position management.
"""

import logging
from decimal import Decimal
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import json

from src.utils.hyperliquid_client import (
    HyperliquidClient,
    Position,
    MarketData,
    OrderBookEntry,
)

logger = logging.getLogger(__name__)


class MockHyperliquidClient:
    """
    Mock client that simulates Hyperliquid exchange behavior.
    Does NOT make network requests.
    """

    def __init__(
        self, api_key: str = "test", secret_key: str = "test", sandbox: bool = True
    ):
        self.api_key = api_key
        self.secret_key = secret_key
        self.sandbox = sandbox

        self.account_value = Decimal("100000")
        self.cash = Decimal("100000")
        self.positions: Dict[str, Position] = {}
        self.open_orders: List[Dict[str, Any]] = []

        self.current_prices: Dict[str, Decimal] = {}
        self.current_time: int = 0

        self.trades_history: List[Dict[str, Any]] = []
        self.price_history: Dict[str, List[tuple]] = {}

    async def connect(self):
        logger.info("Mock Client Connected")

    async def disconnect(self):
        logger.info("Mock Client Disconnected")

    def update_market_state(self, symbol: str, candle: Dict[str, Any]):
        price = Decimal(str(candle["close"]))
        timestamp = int(candle["timestamp"])

        self.current_prices[symbol] = price
        self.current_time = timestamp

        if symbol not in self.price_history:
            self.price_history[symbol] = []

        self.price_history[symbol].append(
            (
                timestamp,
                Decimal(str(candle["open"])),
                Decimal(str(candle["high"])),
                Decimal(str(candle["low"])),
                Decimal(str(candle["close"])),
                Decimal(str(candle["volume"])),
            )
        )

        self._update_positions_pnl()

    async def get_ohlcv(
        self, symbol: str, timeframe: str, limit: int = 100
    ) -> List[Tuple[int, Decimal, Decimal, Decimal, Decimal, Decimal]]:
        if symbol not in self.price_history:
            return []

        return self.price_history[symbol][-limit:]

    def _update_positions_pnl(self):
        total_unrealized_pnl = Decimal("0")

        for symbol, pos in self.positions.items():
            current_price = self.current_prices.get(symbol)
            if not current_price:
                continue

            pos.mark_price = current_price

            if pos.side == "long":
                pos.unrealized_pnl = (current_price - pos.entry_price) * pos.size
            else:
                pos.unrealized_pnl = (pos.entry_price - current_price) * pos.size

            total_unrealized_pnl += pos.unrealized_pnl

        self.account_value = self.cash + total_unrealized_pnl

    async def get_account_info(self) -> Dict[str, Any]:
        total_notional = sum(
            self.current_prices.get(p.symbol, Decimal("0")) * p.size
            for p in self.positions.values()
        )

        return {
            "margin_summary": {
                "accountValue": str(self.account_value),
                "totalNtnPosVal": str(total_notional),
                "cash": str(self.cash),
            },
            "cross_margin_summary": {},
            "account_value": self.account_value,
            "total_notion_pos": total_notional,
            "available_balance": self.cash,
            "leverage": {"value": 0},
        }

    async def get_positions(self) -> List[Position]:
        return list(self.positions.values())

    async def get_market_data(self, symbol: str) -> MarketData:
        price = self.current_prices.get(symbol, Decimal("0"))
        return MarketData(
            symbol=symbol,
            bid=price,
            ask=price,
            bid_size=Decimal("1000"),
            ask_size=Decimal("1000"),
            last_price=price,
            volume_24h=Decimal("1000000"),
            timestamp=self.current_time,
        )

    async def place_order(
        self,
        symbol: str,
        side: str,
        size: Decimal,
        order_type: str,
        price: Optional[Decimal] = None,
        reduce_only: bool = False,
        time_in_force: str = "GTC",
    ) -> Dict[str, Any]:
        current_price = self.current_prices.get(symbol)
        if not current_price:
            return {"status": "error", "response": "No price data for symbol"}

        execute_price = price if price else current_price

        should_execute = False
        if order_type.lower() == "market":
            should_execute = True
            execute_price = current_price
        elif order_type.lower() == "limit":
            if side.lower() == "buy" and current_price <= execute_price:
                should_execute = True
            elif side.lower() == "sell" and current_price >= execute_price:
                should_execute = True
            else:
                self.open_orders.append(
                    {
                        "symbol": symbol,
                        "side": side,
                        "size": size,
                        "price": execute_price,
                        "type": "limit",
                    }
                )
                return {
                    "status": "ok",
                    "response": {"statuses": [{"status": "open", "oid": 123}]},
                }

        if should_execute:
            self._execute_trade(symbol, side, size, execute_price)
            return {
                "status": "ok",
                "response": {"statuses": [{"status": "filled", "oid": 123}]},
            }

        return {"status": "ok", "response": "Order received"}

    def _execute_trade(self, symbol: str, side: str, size: Decimal, price: Decimal):
        cost = size * price
        fee = cost * Decimal("0.00025")

        self.cash -= fee

        current_pos = self.positions.get(symbol)

        if not current_pos:
            new_pos = Position(
                symbol=symbol,
                size=size,
                side="long" if side.lower() == "buy" else "short",
                entry_price=price,
                mark_price=price,
                unrealized_pnl=Decimal("0"),
                leverage=Decimal("1"),
                timestamp=self.current_time,
            )
            self.positions[symbol] = new_pos

        else:
            if (current_pos.side == "long" and side.lower() == "buy") or (
                current_pos.side == "short" and side.lower() == "sell"
            ):
                total_size = current_pos.size + size
                avg_entry = (
                    (current_pos.entry_price * current_pos.size) + (price * size)
                ) / total_size
                current_pos.size = total_size
                current_pos.entry_price = avg_entry
            else:
                closing_size = min(current_pos.size, size)
                pnl = 0
                if current_pos.side == "long":
                    pnl = (price - current_pos.entry_price) * closing_size
                else:
                    pnl = (current_pos.entry_price - price) * closing_size

                self.cash += pnl
                current_pos.size -= closing_size

                if current_pos.size == 0:
                    del self.positions[symbol]

        self.trades_history.append(
            {
                "symbol": symbol,
                "side": side,
                "size": str(size),
                "price": str(price),
                "timestamp": self.current_time,
            }
        )
        logger.info(f"MOCK EXECUTION: {side} {size} {symbol} @ {price}")

    async def cancel_all_orders(self, symbol: Optional[str] = None):
        self.open_orders = []
        return {"status": "ok"}

    async def kill_switch(self, symbol: Optional[str] = None):
        await self.cancel_all_orders(symbol)
        self.positions = {}
        return {"status": "ok"}
