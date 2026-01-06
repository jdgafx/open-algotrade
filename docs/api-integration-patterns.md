# Exchange API Integration Patterns

## Hyperliquid Integration (Primary Priority)

### API Overview
Hyperliquid is a decentralized derivatives exchange offering:
- Perpetual futures with up to 100x leverage
- Order book and AMM hybrid model
- Cross-margin and isolated margin modes
- REST and WebSocket APIs
- Sub-10ms execution latency

### Authentication
```python
# Hyperliquid API Authentication Pattern
import hashlib
import hmac
import time
from base64 import b64encode

class HyperliquidAuth:
    def __init__(self, api_key: str, secret_key: str):
        self.api_key = api_key
        self.secret_key = secret_key

    def sign_message(self, message: str) -> str:
        timestamp = str(int(time.time() * 1000))
        signature_data = f"{timestamp}{message}"
        signature = hmac.new(
            self.secret_key.encode(),
            signature_data.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{timestamp}:{signature}"
```

### Core API Client
```python
import asyncio
import aiohttp
from typing import Dict, List, Optional

class HyperliquidClient:
    def __init__(self, api_key: str, secret_key: str, testnet: bool = False):
        self.base_url = "https://api.hyperliquid.xyz" if not testnet else "https://testnet-api.hyperliquid.xyz"
        self.ws_url = "wss://api.hyperliquid.xyz/ws" if not testnet else "wss://testnet-api.hyperliquid.xyz/ws"
        self.auth = HyperliquidAuth(api_key, secret_key)
        self.session = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth.api_key}"
        }

        if data:
            signature = self.auth.sign_message(str(data))
            headers["X-Signature"] = signature

        async with self.session.request(method, url, json=data, headers=headers) as response:
            response.raise_for_status()
            return await response.json()
```

### Key Endpoints
```python
class HyperliquidAPI:
    # Market Data
    async def get_ticker(self, symbol: str) -> Dict:
        """Get current ticker information"""
        return await self.make_request("GET", f"/info/ticker?coin={symbol}")

    async def get_orderbook(self, symbol: str, limit: int = 100) -> Dict:
        """Get order book"""
        return await self.make_request("GET", f"/info/orderbook?coin={symbol}&limit={limit}")

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """Get recent trades"""
        return await self.make_request("GET", f"/info/trades?coin={symbol}&limit={limit}")

    async def get_candles(self, symbol: str, interval: str, limit: int = 100) -> List[Dict]:
        """Get OHLCV data"""
        return await self.make_request("GET", f"/info/candles?coin={symbol}&interval={interval}&limit={limit}")

    # Account Data
    async def get_balances(self) -> Dict:
        """Get account balances"""
        return await self.make_request("GET", "/exchange/balance")

    async def get_positions(self) -> List[Dict]:
        """Get open positions"""
        return await self.make_request("GET", "/exchange/positions")

    async def get_orders(self, symbol: str = None) -> List[Dict]:
        """Get open orders"""
        endpoint = "/exchange/orders"
        if symbol:
            endpoint += f"?coin={symbol}"
        return await self.make_request("GET", endpoint)

    # Trading Operations
    async def place_order(self, order: Dict) -> Dict:
        """Place a new order"""
        return await self.make_request("POST", "/exchange/order", order)

    async def cancel_order(self, order_id: str, symbol: str) -> Dict:
        """Cancel an order"""
        return await self.make_request("DELETE", f"/exchange/order?order_id={order_id}&coin={symbol}")

    async def cancel_all_orders(self, symbol: str) -> Dict:
        """Cancel all orders for a symbol"""
        return await self.make_request("DELETE", f"/exchange/orders?coin={symbol}")
```

### WebSocket Integration
```python
import asyncio
import json
import websockets
from typing import Callable, Dict, Any

class HyperliquidWebSocket:
    def __init__(self, api_key: str, secret_key: str, testnet: bool = False):
        self.ws_url = "wss://api.hyperliquid.xyz/ws" if not testnet else "wss://testnet-api.hyperliquid.xyz/ws"
        self.auth = HyperliquidAuth(api_key, secret_key)
        self.ws = None
        self.subscriptions = {}

    async def connect(self):
        """Establish WebSocket connection"""
        self.ws = await websockets.connect(self.ws_url)

        # Authenticate
        auth_message = {
            "method": "subscribe",
            "subscription": {
                "type": "authentication"
            },
            "signature": self.auth.sign_message("authentication")
        }
        await self.ws.send(json.dumps(auth_message))

        # Start message handler
        asyncio.create_task(self._handle_messages())

    async def subscribe_ticker(self, symbol: str, callback: Callable):
        """Subscribe to ticker updates"""
        subscription = {
            "method": "subscribe",
            "subscription": {
                "type": "ticker",
                "coin": symbol
            }
        }
        await self.ws.send(json.dumps(subscription))
        self.subscriptions[f"ticker_{symbol}"] = callback

    async def subscribe_orderbook(self, symbol: str, callback: Callable):
        """Subscribe to order book updates"""
        subscription = {
            "method": "subscribe",
            "subscription": {
                "type": "allTrades",
                "coin": symbol
            }
        }
        await self.ws.send(json.dumps(subscription))
        self.subscriptions[f"orderbook_{symbol}"] = callback

    async def subscribe_user_trades(self, callback: Callable):
        """Subscribe to user trade updates"""
        subscription = {
            "method": "subscribe",
            "subscription": {
                "type": "userTrades"
            }
        }
        await self.ws.send(json.dumps(subscription))
        self.subscriptions["user_trades"] = callback

    async def _handle_messages(self):
        """Handle incoming WebSocket messages"""
        async for message in self.ws:
            data = json.loads(message)
            if "subscription" in data:
                sub_type = data["subscription"]["type"]
                symbol = data["subscription"].get("coin", "")
                key = f"{sub_type}_{symbol}" if symbol else sub_type

                if key in self.subscriptions:
                    await self.subscriptions[key](data)
```

## Multi-Exchange Coordination

### Exchange Factory Pattern
```python
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any

class ExchangeType(Enum):
    HYPERLIQUID = "hyperliquid"
    PHEMEX = "phemex"
    BINANCE = "binance"
    BYBIT = "bybit"
    DYDX = "dydx"

class ExchangeInterface(ABC):
    @abstractmethod
    async def get_ticker(self, symbol: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def get_orderbook(self, symbol: str, limit: int = 100) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def place_order(self, order: Dict[str, Any]) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def get_positions(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_balances(self) -> Dict[str, Any]:
        pass

class ExchangeFactory:
    _exchanges = {}

    @classmethod
    def register_exchange(cls, exchange_type: ExchangeType, exchange_class):
        cls._exchanges[exchange_type] = exchange_class

    @classmethod
    def create_exchange(cls, exchange_type: ExchangeType, config: Dict[str, Any]) -> ExchangeInterface:
        if exchange_type not in cls._exchanges:
            raise ValueError(f"Exchange {exchange_type} not registered")

        return cls._exchanges[exchange_type](**config)

# Register exchanges
ExchangeFactory.register_exchange(ExchangeType.HYPERLIQUID, HyperliquidClient)
ExchangeFactory.register_exchange(ExchangeType.PHEMEX, PhemexClient)  # Implement based on existing code
```

### Arbitrage Coordination
```python
class ArbitrageCoordinator:
    def __init__(self, exchanges: Dict[str, ExchangeInterface]):
        self.exchanges = exchanges
        self.active_arbitrages = {}

    async def detect_arbitrage_opportunity(self, symbol: str) -> Dict[str, Any]:
        """Detect arbitrage opportunities across exchanges"""
        tickers = {}

        # Get tickers from all exchanges
        for exchange_name, exchange in self.exchanges.items():
            try:
                ticker = await exchange.get_ticker(symbol)
                tickers[exchange_name] = {
                    'bid': float(ticker['bid']),
                    'ask': float(ticker['ask']),
                    'volume': float(ticker.get('volume', 0))
                }
            except Exception as e:
                print(f"Error getting ticker from {exchange_name}: {e}")

        # Find arbitrage opportunities
        opportunities = []
        exchanges_list = list(tickers.keys())

        for i in range(len(exchanges_list)):
            for j in range(len(exchanges_list)):
                if i == j:
                    continue

                exchange_buy = exchanges_list[i]
                exchange_sell = exchanges_list[j]

                buy_price = tickers[exchange_buy]['ask']
                sell_price = tickers[exchange_sell]['bid']

                # Calculate potential profit
                spread = (sell_price - buy_price) / buy_price

                # Account for trading fees (typically 0.1% each side)
                fees = 0.002  # 0.1% buy + 0.1% sell
                net_profit = spread - fees

                if net_profit > 0.001:  # Minimum 0.1% profit
                    opportunities.append({
                        'buy_exchange': exchange_buy,
                        'sell_exchange': exchange_sell,
                        'buy_price': buy_price,
                        'sell_price': sell_price,
                        'spread': spread,
                        'net_profit': net_profit,
                        'volume': min(tickers[exchange_buy]['volume'], tickers[exchange_sell]['volume'])
                    })

        # Sort by profit and return best opportunity
        if opportunities:
            return max(opportunities, key=lambda x: x['net_profit'])

        return None

    async def execute_arbitrage(self, opportunity: Dict[str, Any], symbol: str, size: float):
        """Execute arbitrage trade"""
        buy_exchange = self.exchanges[opportunity['buy_exchange']]
        sell_exchange = self.exchanges[opportunity['sell_exchange']]

        try:
            # Place buy order
            buy_order = await buy_exchange.place_order({
                'symbol': symbol,
                'side': 'buy',
                'type': 'limit',
                'price': opportunity['buy_price'],
                'size': size
            })

            # Place sell order
            sell_order = await sell_exchange.place_order({
                'symbol': symbol,
                'side': 'sell',
                'type': 'limit',
                'price': opportunity['sell_price'],
                'size': size
            })

            return {
                'buy_order': buy_order,
                'sell_order': sell_order,
                'status': 'executed'
            }

        except Exception as e:
            # Cleanup on failure
            try:
                await buy_exchange.cancel_all_orders(symbol)
                await sell_exchange.cancel_all_orders(symbol)
            except:
                pass

            return {
                'status': 'failed',
                'error': str(e)
            }
```

## Rate Limiting Management

### Centralized Rate Limiter
```python
import asyncio
import time
from collections import deque
from typing import Dict, Tuple

class RateLimiter:
    def __init__(self):
        self.limits = {}  # {exchange: {endpoint: deque}}
        self.locks = {}   # {exchange: asyncio.Lock}

    def add_limit(self, exchange: str, endpoint: str, requests: int, window: int):
        """Add rate limit for exchange endpoint"""
        key = f"{exchange}:{endpoint}"
        self.limits[key] = {
            'requests': requests,
            'window': window,
            'requests_made': deque()
        }
        self.locks[exchange] = asyncio.Lock()

    async def acquire(self, exchange: str, endpoint: str) -> bool:
        """Acquire permission to make request"""
        key = f"{exchange}:{endpoint}"

        if key not in self.limits:
            return True  # No limit set

        async with self.locks[exchange]:
            limit = self.limits[key]
            now = time.time()

            # Clean old requests
            while limit['requests_made'] and limit['requests_made'][0] < now - limit['window']:
                limit['requests_made'].popleft()

            # Check if we can make request
            if len(limit['requests_made']) < limit['requests']:
                limit['requests_made'].append(now)
                return True

            return False

    async def wait_for_slot(self, exchange: str, endpoint: str):
        """Wait until we can make a request"""
        while not await self.acquire(exchange, endpoint):
            await asyncio.sleep(0.1)

# Initialize rate limits
rate_limiter = RateLimiter()
rate_limiter.add_limit("hyperliquid", "default", 100, 60)  # 100 requests per minute
rate_limiter.add_limit("phemex", "default", 50, 60)       # 50 requests per minute
rate_limiter.add_limit("binance", "default", 1200, 60)    # 1200 requests per minute
```

## Error Handling and Resilience

### Circuit Breaker Pattern
```python
import asyncio
from enum import Enum
from typing import Callable, Any

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60, expected_exception=Exception):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED

    async def __call__(self, func: Callable, *args, **kwargs) -> Any:
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
            else:
                raise Exception("Circuit breaker is OPEN")

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result

        except self.expected_exception as e:
            self._on_failure()
            raise e

    def _should_attempt_reset(self) -> bool:
        return time.time() - self.last_failure_time > self.timeout

    def _on_success(self):
        self.failure_count = 0
        self.state = CircuitState.CLOSED

    def _on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN

# Usage
hyperliquid_circuit = CircuitBreaker(failure_threshold=3, timeout=60)

async def safe_api_call(exchange_client, method_name: str, *args, **kwargs):
    """Make API call with circuit breaker protection"""
    method = getattr(exchange_client, method_name)
    return await hyperliquid_circuit(method, *args, **kwargs)
```

This integration pattern provides robust exchange connectivity with built-in resilience, rate limiting, and multi-exchange coordination capabilities essential for high-frequency trading operations.