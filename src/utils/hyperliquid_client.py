"""
Hyperliquid API Client - High-frequency trading interface
Optimized for maximum speed and reliability with Hyperliquid's perpetual futures
"""

import asyncio
import aiohttp
import json
import time
import hmac
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import logging
from decimal import Decimal
import websockets
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class OrderBookEntry:
    price: Decimal
    size: Decimal
    timestamp: int

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
    side: str  # 'long' or 'short'
    entry_price: Decimal
    mark_price: Decimal
    unrealized_pnl: Decimal
    leverage: Decimal
    timestamp: int

class HyperliquidClient:
    """
    Hyperliquid API client optimized for high-frequency trading
    Features:
    - Asynchronous operations for maximum throughput
    - WebSocket streaming for real-time data
    - Automatic rate limiting and retries
    - Order management with kill switches
    - Position monitoring and risk management
    """

    def __init__(self, api_key: str, secret_key: str, sandbox: bool = False):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = "https://api.hyperliquid-testnet.io/info" if sandbox else "https://api.hyperliquid.io/info"
        self.ws_url = "wss://api.hyperliquid-testnet.io/ws" if sandbox else "wss://api.hyperliquid.io/ws"

        self.session: Optional[aiohttp.ClientSession] = None
        self.ws_connection: Optional[websockets.WebSocketServerProtocol] = None

        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 1.0 / 50  # 50 requests per second

        # Cache for performance
        self._market_data_cache: Dict[str, MarketData] = {}
        self._position_cache: List[Position] = []
        self._cache_ttl = 1.0  # 1 second cache TTL

        logger.info(f"Initialized Hyperliquid client (sandbox: {sandbox})")

    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()

    async def connect(self):
        """Initialize HTTP session and WebSocket connection"""
        if not self.session:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5),
                headers={"Content-Type": "application/json"}
            )

        # Connect to WebSocket for real-time data
        try:
            self.ws_connection = await websockets.connect(
                self.ws_url,
                ping_interval=10,
                ping_timeout=5
            )
            logger.info("WebSocket connection established")

            # Subscribe to market data and position updates
            await self._subscribe_to_streams()

        except Exception as e:
            logger.error(f"WebSocket connection failed: {e}")
            self.ws_connection = None

    async def disconnect(self):
        """Close all connections"""
        if self.session:
            await self.session.close()
            self.session = None

        if self.ws_connection:
            await self.ws_connection.close()
            self.ws_connection = None

    def _sign_request(self, payload: Dict[str, Any]) -> str:
        """Sign request payload with HMAC-SHA256"""
        timestamp = int(time.time() * 1000)
        payload_str = json.dumps(payload, separators=(',', ':'))
        message = f"{timestamp}{payload_str}"
        signature = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature

    async def _make_request(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make authenticated HTTP request with rate limiting and retries"""
        # Rate limiting
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < self.min_request_interval:
            await asyncio.sleep(self.min_request_interval - time_since_last)
        self.last_request_time = time.time()

        # Add authentication
        signature = self._sign_request(payload)
        payload["signature"] = signature
        payload["timestamp"] = int(time.time() * 1000)

        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with self.session.post(f"{self.base_url}/{endpoint}", json=payload) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        error_text = await response.text()
                        logger.warning(f"API request failed (attempt {attempt + 1}): {response.status} - {error_text}")

                        if attempt == max_retries - 1:
                            raise Exception(f"API request failed after {max_retries} attempts: {error_text}")

                        await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff

            except asyncio.TimeoutError:
                logger.warning(f"Request timeout (attempt {attempt + 1})")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(0.5 * (attempt + 1))
            except Exception as e:
                logger.error(f"Request error (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(1 * (attempt + 1))

    async def _subscribe_to_streams(self):
        """Subscribe to WebSocket streams for real-time data"""
        if not self.ws_connection:
            return

        try:
            # Subscribe to all market data
            subscribe_msg = {
                "method": "subscribe",
                "streams": ["allTrades", "l2Book", "ticker"]
            }
            await self.ws_connection.send(json.dumps(subscribe_msg))

            # Start background task to handle WebSocket messages
            asyncio.create_task(self._handle_ws_messages())

        except Exception as e:
            logger.error(f"Failed to subscribe to streams: {e}")

    async def _handle_ws_messages(self):
        """Handle incoming WebSocket messages and update cache"""
        try:
            async for message in self.ws_connection:
                data = json.loads(message)
                await self._process_ws_message(data)
        except Exception as e:
            logger.error(f"WebSocket message handling error: {e}")

    async def _process_ws_message(self, data: Dict[str, Any]):
        """Process individual WebSocket message"""
        try:
            if "stream" in data:
                stream_type = data["stream"]
                if stream_type == "l2Book":
                    await self._update_order_book(data)
                elif stream_type == "ticker":
                    await self._update_ticker(data)
                elif stream_type == "trades":
                    await self._process_trades(data)
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")

    async def get_market_data(self, symbol: str) -> MarketData:
        """Get current market data with caching"""
        current_time = time.time()

        # Check cache first
        if symbol in self._market_data_cache:
            cached_data = self._market_data_cache[symbol]
            if current_time - cached_data.timestamp < self._cache_ttl:
                return cached_data

        # Fetch fresh data
        payload = {"coin": symbol}
        response = await self._make_request("meta", payload)

        # Parse response and create MarketData object
        market_data = MarketData(
            symbol=symbol,
            bid=Decimal(str(response.get("bid", 0))),
            ask=Decimal(str(response.get("ask", 0))),
            bid_size=Decimal(str(response.get("bidSz", 0))),
            ask_size=Decimal(str(response.get("askSz", 0))),
            last_price=Decimal(str(response.get("lastPrice", 0))),
            volume_24h=Decimal(str(response.get("volume24h", 0))),
            timestamp=int(time.time() * 1000)
        )

        # Update cache
        self._market_data_cache[symbol] = market_data

        return market_data

    async def get_positions(self) -> List[Position]:
        """Get all open positions"""
        payload = {}
        response = await self._make_request("clearinghouse", payload)

        positions = []
        for pos_data in response.get("assetPositions", []):
            if float(pos_data.get("position", {}).get("szi", 0)) != 0:  # Only non-zero positions
                positions.append(Position(
                    symbol=pos_data.get("coin", ""),
                    size=Decimal(str(pos_data.get("position", {}).get("szi", 0))),
                    side="long" if float(pos_data.get("position", {}).get("szi", 0)) > 0 else "short",
                    entry_price=Decimal(str(pos_data.get("position", {}).get("entryPx", 0))),
                    mark_price=Decimal(str(pos_data.get("position", {}).get("markPx", 0))),
                    unrealized_pnl=Decimal(str(pos_data.get("position", {}).get("unrealizedPnl", 0))),
                    leverage=Decimal(str(pos_data.get("position", {}).get("leverage", {}).get("value", 0))),
                    timestamp=int(time.time() * 1000)
                ))

        self._position_cache = positions
        return positions

    async def place_order(self, symbol: str, side: str, size: Decimal,
                         order_type: str, price: Optional[Decimal] = None,
                         reduce_only: bool = False, time_in_force: str = "GTC") -> Dict[str, Any]:
        """
        Place order with maximum speed and reliability

        Args:
            symbol: Trading symbol (e.g., "ETH")
            side: "buy" or "sell"
            size: Order size in base currency
            order_type: "limit", "market", "stop_limit", etc.
            price: Limit price (required for limit orders)
            reduce_only: Whether to only reduce position size
            time_in_force: "GTC", "IOC", "FOK", "PostOnly"

        Returns:
            Order response from exchange
        """
        order_payload = {
            "destination": "hyperliquid",
            "asset": symbol,
            "side": "Buy" if side.lower() == "buy" else "Sell",
            "reduceOnly": reduce_only,
            "orderType": {
                "limit": {"tif": time_in_force},
                "market": {},
                "stopLimit": {"triggerPercentage": 0.01, "tif": time_in_force}
            }.get(order_type.lower(), {"limit": {"tif": "GTC"}})
        }

        if order_type.lower() != "market" and price:
            order_payload["orderType"]["limit"]["px"] = str(price)

        # Calculate order size
        if order_type.lower() == "market":
            order_payload["orderType"]["market"]["sz"] = str(size)
        else:
            order_payload["orderType"]["limit"]["sz"] = str(size)

        payload = {"orders": [order_payload]}

        logger.info(f"Placing {order_type} order: {side} {size} {symbol} @ {price}")

        response = await self._make_request("exchange", payload)

        if "status" in response and response["status"] == "ok":
            logger.info(f"Order placed successfully: {response.get('response', {}).get('statuses', [])}")
        else:
            logger.error(f"Order placement failed: {response}")

        return response

    async def cancel_order(self, symbol: str, order_id: str) -> Dict[str, Any]:
        """Cancel specific order"""
        payload = {
            "cancels": [{
                "destination": "hyperliquid",
                "asset": symbol,
                "oid": int(order_id)
            }]
        }

        response = await self._make_request("exchange", payload)
        logger.info(f"Cancelled order {order_id} for {symbol}")
        return response

    async def cancel_all_orders(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Cancel all orders, optionally filtered by symbol"""
        if symbol:
            payload = {
                "cancels": [{
                    "destination": "hyperliquid",
                    "asset": symbol,
                    "cancelAll": True
                }]
            }
        else:
            payload = {
                "cancels": [{
                    "destination": "hyperliquid",
                    "cancelAll": True
                }]
            }

        response = await self._make_request("exchange", payload)
        logger.info(f"Cancelled all orders{f' for {symbol}' if symbol else ''}")
        return response

    async def kill_switch(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """
        Emergency kill switch - cancel all orders and close all positions
        This is the ultimate risk management tool
        """
        logger.warning(f"🚨 KILL SWITCH ACTIVATED{f' for {symbol}' if symbol else ' (ALL SYMBOLS)'} 🚨")

        # Cancel all orders first
        await self.cancel_all_orders(symbol)

        # Close all positions
        positions = await self.get_positions()
        close_responses = []

        for position in positions:
            if symbol and position.symbol != symbol:
                continue

            if position.size != 0:
                # Determine opposite side for closing
                close_side = "sell" if position.side == "long" else "buy"

                # Use market order for immediate execution
                close_response = await self.place_order(
                    symbol=position.symbol,
                    side=close_side,
                    size=abs(position.size),
                    order_type="market",
                    reduce_only=True
                )
                close_responses.append(close_response)

        logger.warning("✅ KILL SWITCH EXECUTED - All orders cancelled and positions closed")
        return {"cancelled_orders": True, "closed_positions": close_responses}

    async def get_open_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all open orders, optionally filtered by symbol"""
        payload = {}
        response = await self._make_request("clearinghouse", payload)

        orders = response.get("openOrders", [])

        if symbol:
            orders = [order for order in orders if order.get("coin") == symbol]

        return orders

    async def get_account_info(self) -> Dict[str, Any]:
        """Get account information including balance and margin"""
        payload = {}
        response = await self._make_request("clearinghouse", payload)

        return {
            "margin_summary": response.get("marginSummary", {}),
            "cross_margin_summary": response.get("crossMarginSummary", {}),
            "account_value": Decimal(str(response.get("marginSummary", {}).get("accountValue", 0))),
            "total_notion_pos": Decimal(str(response.get("marginSummary", {}).get("totalNtnPosVal", 0))),
            "available_balance": Decimal(str(response.get("marginSummary", {}).get("cash", 0))),
            "leverage": response.get("marginSummary", {}).get("leverage", {})
        }

    async def get_ohlcv(self, symbol: str, timeframe: str, limit: int = 100) -> List[Tuple[int, Decimal, Decimal, Decimal, Decimal, Decimal]]:
        """
        Get OHLCV data for technical analysis

        Args:
            symbol: Trading symbol
            timeframe: "1m", "5m", "15m", "1h", "4h", "1d"
            limit: Number of candles to fetch

        Returns:
            List of tuples: (timestamp, open, high, low, close, volume)
        """
        payload = {
            "coin": symbol,
            "interval": timeframe,
            "startTime": int((time.time() - limit * self._timeframe_to_seconds(timeframe)) * 1000),
            "endTime": int(time.time() * 1000)
        }

        response = await self._make_request("candle", payload)

        ohlcv_data = []
        for candle in response.get("candles", []):
            ohlcv_data.append((
                candle.get("t", 0),
                Decimal(str(candle.get("o", 0))),
                Decimal(str(candle.get("h", 0))),
                Decimal(str(candle.get("l", 0))),
                Decimal(str(candle.get("c", 0))),
                Decimal(str(candle.get("i", 0)))
            ))

        return ohlcv_data

    def _timeframe_to_seconds(self, timeframe: str) -> int:
        """Convert timeframe string to seconds"""
        mapping = {
            "1m": 60,
            "5m": 300,
            "15m": 900,
            "1h": 3600,
            "4h": 14400,
            "1d": 86400
        }
        return mapping.get(timeframe, 300)

    async def health_check(self) -> bool:
        """Check if API and WebSocket connections are healthy"""
        try:
            # Test API connection
            await self.get_account_info()

            # Test WebSocket connection
            if self.ws_connection:
                await self.ws_connection.ping()

            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False