"""
Hyperliquid API Client - High-frequency trading interface
Optimized for maximum speed and reliability using the official SDK.
Wraps the official hyperliquid-python-sdk to maintain async compatibility.
"""

import asyncio
import logging
import json
import time
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from eth_account import Account
from hyperliquid.info import Info
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants

logger = logging.getLogger(__name__)


@dataclass
class MarketData:
    symbol: str
    bid: Decimal
    ask: Decimal
    bid_size: Decimal
    ask_size: Decimal
    last_price: Decimal
    volume_24h: Decimal
    timestamp: int


@dataclass
class Position:
    symbol: str
    size: Decimal
    side: str
    entry_price: Decimal
    mark_price: Decimal
    unrealized_pnl: Decimal
    leverage: Decimal
    timestamp: int


class HyperliquidClient:
    """
    Hyperliquid API client wrapping the official SDK.
    Handles EIP-712 signing and proper connection management.
    """

    def __init__(self, wallet_address: str, private_key: str, sandbox: bool = False):
        self.wallet_address = wallet_address
        self.private_key = private_key
        self.sandbox = sandbox

        self.base_url = (
            constants.TESTNET_API_URL if sandbox else constants.MAINNET_API_URL
        )
        self.info = Info(self.base_url, skip_ws=True)

        self.account = Account.from_key(private_key)
        self.exchange = Exchange(
            self.account, self.base_url, account_address=wallet_address
        )

        logger.info(
            f"Initialized Hyperliquid client (Address: {wallet_address}, Sandbox: {sandbox})"
        )

    async def connect(self):
        """
        Verify connection.
        The SDK handles connections internally, so we just test validity.
        """
        try:
            logger.info("Connecting to Hyperliquid...")
            await asyncio.to_thread(self.info.meta)
            logger.info("✅ Connection established")
        except Exception as e:
            logger.error(f"Failed to connect: {e}")
            raise

    async def disconnect(self):
        """Cleanup resources"""
        pass

    async def get_market_data(self, symbol: str) -> MarketData:
        """Get current market data using SDK"""
        try:
            meta = await asyncio.to_thread(self.info.meta)
            user_state = await asyncio.to_thread(
                self.info.user_state, self.wallet_address
            )

            universe = meta["universe"]
            coin_index = next(
                (i for i, coin in enumerate(universe) if coin["name"] == symbol), None
            )

            if coin_index is None:
                raise ValueError(f"Symbol {symbol} not found in universe")

            l2_snapshot = await asyncio.to_thread(self.info.l2_snapshot, symbol)

            bid = (
                Decimal(str(l2_snapshot["levels"][0][0]["px"]))
                if l2_snapshot["levels"][0]
                else Decimal("0")
            )
            ask = (
                Decimal(str(l2_snapshot["levels"][1][0]["px"]))
                if l2_snapshot["levels"][1]
                else Decimal("0")
            )
            bid_sz = (
                Decimal(str(l2_snapshot["levels"][0][0]["sz"]))
                if l2_snapshot["levels"][0]
                else Decimal("0")
            )
            ask_sz = (
                Decimal(str(l2_snapshot["levels"][1][0]["sz"]))
                if l2_snapshot["levels"][1]
                else Decimal("0")
            )

            return MarketData(
                symbol=symbol,
                bid=bid,
                ask=ask,
                bid_size=bid_sz,
                ask_size=ask_sz,
                last_price=(bid + ask) / 2,
                volume_24h=Decimal("0"),
                timestamp=int(l2_snapshot["time"]),
            )

        except Exception as e:
            logger.error(f"Error getting market data: {e}")
            raise

    async def get_positions(self) -> List[Position]:
        """Get all open positions"""
        try:
            user_state = await asyncio.to_thread(
                self.info.user_state, self.wallet_address
            )
            positions = []

            for p in user_state["assetPositions"]:
                pos = p["position"]

                size = Decimal(str(pos["szi"]))
                if size == 0:
                    continue

                positions.append(
                    Position(
                        symbol=pos.get("coin", "UNKNOWN"),
                        size=size,
                        side="long" if size > 0 else "short",
                        entry_price=Decimal(str(pos["entryPx"])),
                        mark_price=Decimal(str(pos.get("markPx", 0))),
                        unrealized_pnl=Decimal(str(pos["unrealizedPnl"])),
                        leverage=Decimal(str(pos["leverage"]["value"])),
                        timestamp=int(time.time() * 1000),
                    )
                )
            return positions

        except Exception as e:
            logger.error(f"Error getting positions: {e}")
            return []

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
        """
        Place order using official SDK exchange.order()
        """
        try:
            is_buy = side.lower() == "buy"

            price_float = float(price) if price else None
            size_float = float(size)

            order_result = await asyncio.to_thread(
                self.exchange.order,
                symbol,
                is_buy,
                size_float,
                price_float,
                {"limit": {"tif": time_in_force}}
                if order_type == "limit"
                else {"market": {}},
                reduce_only=reduce_only,
            )

            logger.info(f"Order placed: {order_result}")
            return order_result

        except Exception as e:
            logger.error(f"Order placement failed: {e}")
            return {"status": "error", "error": str(e)}

    async def cancel_all_orders(self, symbol: Optional[str] = None):
        """Cancel all orders"""
        try:
            open_orders = await asyncio.to_thread(
                self.info.open_orders, self.wallet_address
            )

            cancel_requests = []
            for o in open_orders:
                if symbol and o["coin"] != symbol:
                    continue
                cancel_requests.append({"coin": o["coin"], "oid": o["oid"]})

            if cancel_requests:
                result = await asyncio.to_thread(self.exchange.cancel, cancel_requests)
                logger.info(f"Cancelled {len(cancel_requests)} orders")
                return result
            return {"status": "ok", "message": "No orders to cancel"}

        except Exception as e:
            logger.error(f"Cancel all failed: {e}")
            return {"status": "error", "error": str(e)}

    async def get_account_info(self) -> Dict[str, Any]:
        """Get account info (margin, balance)"""
        try:
            user_state = await asyncio.to_thread(
                self.info.user_state, self.wallet_address
            )
            margin_summary = user_state["marginSummary"]

            return {
                "account_value": Decimal(str(margin_summary["accountValue"])),
                "total_notion_pos": Decimal(str(margin_summary["totalNtnPosVal"])),
                "available_balance": Decimal(str(user_state["withdrawable"])),
                "margin_summary": margin_summary,
            }
        except Exception as e:
            logger.error(f"Error getting account info: {e}")
            raise

    async def get_ohlcv(
        self, symbol: str, timeframe: str, limit: int = 100
    ) -> List[Tuple]:
        """Get candles"""
        try:
            candles = await asyncio.to_thread(
                self.info.candles_snapshot,
                symbol,
                timeframe,
                int(time.time() * 1000) - (limit * 60000),
                int(time.time() * 1000),
            )

            ohlcv = []
            for c in candles:
                ohlcv.append(
                    (
                        c["t"],
                        Decimal(c["o"]),
                        Decimal(c["h"]),
                        Decimal(c["l"]),
                        Decimal(c["c"]),
                        Decimal(c["v"]),
                    )
                )
            return ohlcv

        except Exception as e:
            logger.error(f"Error getting OHLCV: {e}")
            return []

    async def kill_switch(self, symbol: Optional[str] = None):
        """Emergency kill switch"""
        await self.cancel_all_orders(symbol)
        return {"status": "kill_switch_activated"}

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()
