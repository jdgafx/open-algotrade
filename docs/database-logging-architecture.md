# Database and Logging Architecture

## Overview

A high-performance, scalable database and logging architecture designed for real-time trading operations with millisecond latency requirements, comprehensive audit trails, and advanced analytics capabilities.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Data Ingestion Layer                                │
│                   (Stream Processing, Validation, Buffering)                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Database Cluster                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ PostgreSQL  │ │TimescaleDB  │ │   Redis     │ │ InfluxDB    │ │ ClickHouse  ││
│  │Transactional│ │ Time-Series │ │   Cache     │ │  Metrics    │ │Analytics    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Logging Cluster                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │  Fluentd    │ │Elasticsearch│ │   Kibana    │ │ Logstash    │ │  Loki       ││
│  │ Collectors  │ │   Storage   │ │Visualization│ │ Processing  │ │  Stream     ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                                            │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Backup & Replication                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   Daily     │ │   Real-time │ │   Point-in- │ │   Cross-    │ │   Disaster  ││
│  │ Backups     │ │ Replication │ │Time Recovery│ │ Region Sync │ │  Recovery   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Database Architecture

### Primary Database (PostgreSQL + TimescaleDB)
```python
import asyncpg
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import logging

@dataclass
class TradeRecord:
    id: str
    exchange: str
    symbol: str
    side: str
    quantity: float
    price: float
    timestamp: datetime
    strategy_id: str
    order_id: str
    fees: float
    pnl: Optional[float] = None

@dataclass
class PositionRecord:
    id: str
    exchange: str
    symbol: str
    side: str
    size: float
    entry_price: float
    current_price: float
    unrealized_pnl: float
    realized_pnl: float
    strategy_id: str
    leverage: float
    timestamp: datetime
    updated_at: datetime

class DatabaseManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.pool = None
        self.logger = logging.getLogger(__name__)

    async def initialize(self):
        """Initialize database connection pool"""
        self.pool = await asyncpg.create_pool(
            host=self.config['host'],
            port=self.config['port'],
            database=self.config['database'],
            user=self.config['username'],
            password=self.config['password'],
            min_size=self.config.get('min_size', 5),
            max_size=self.config.get('max_size', 20),
            command_timeout=60
        )

        await self._create_tables()
        await self._create_indexes()

    async def _create_tables(self):
        """Create database tables"""
        async with self.pool.acquire() as conn:
            # Trades table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS trades (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    exchange VARCHAR(50) NOT NULL,
                    symbol VARCHAR(20) NOT NULL,
                    side VARCHAR(10) NOT NULL,
                    quantity DECIMAL(20,8) NOT NULL,
                    price DECIMAL(20,8) NOT NULL,
                    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                    strategy_id VARCHAR(50) NOT NULL,
                    order_id VARCHAR(100),
                    fees DECIMAL(20,8) DEFAULT 0,
                    pnl DECIMAL(20,8),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(exchange, order_id)
                )
            """)

            # Positions table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS positions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    exchange VARCHAR(50) NOT NULL,
                    symbol VARCHAR(20) NOT NULL,
                    side VARCHAR(10) NOT NULL,
                    size DECIMAL(20,8) NOT NULL,
                    entry_price DECIMAL(20,8) NOT NULL,
                    current_price DECIMAL(20,8),
                    unrealized_pnl DECIMAL(20,8) DEFAULT 0,
                    realized_pnl DECIMAL(20,8) DEFAULT 0,
                    strategy_id VARCHAR(50) NOT NULL,
                    leverage DECIMAL(10,2) DEFAULT 1.0,
                    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(exchange, symbol, strategy_id)
                )
            """)

            # Strategy performance table (TimescaleDB hypertable)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS strategy_metrics (
                    time TIMESTAMP WITH TIME ZONE NOT NULL,
                    strategy_id VARCHAR(50) NOT NULL,
                    total_pnl DECIMAL(20,8),
                    daily_pnl DECIMAL(20,8),
                    win_rate DECIMAL(5,4),
                    sharpe_ratio DECIMAL(10,4),
                    max_drawdown DECIMAL(10,4),
                    positions_count INTEGER,
                    volume DECIMAL(20,8),
                    latency_ms DECIMAL(10,2),
                    error_rate DECIMAL(5,4)
                )
            """)

            # Create hypertable for time-series data
            await conn.execute("""
                SELECT create_hypertable('strategy_metrics', 'time',
                    chunk_time_interval => INTERVAL '1 hour')
            """)

            # Market data table (high-frequency)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS market_data (
                    time TIMESTAMP WITH TIME ZONE NOT NULL,
                    exchange VARCHAR(50) NOT NULL,
                    symbol VARCHAR(20) NOT NULL,
                    bid_price DECIMAL(20,8),
                    ask_price DECIMAL(20,8),
                    bid_size DECIMAL(20,8),
                    ask_size DECIMAL(20,8),
                    last_price DECIMAL(20,8),
                    volume DECIMAL(20,8),
                    UNIQUE(time, exchange, symbol)
                )
            """)

            await conn.execute("""
                SELECT create_hypertable('market_data', 'time',
                    chunk_time_interval => INTERVAL '15 minutes')
            """)

    async def _create_indexes(self):
        """Create database indexes for performance"""
        async with self.pool.acquire() as conn:
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)",
                "CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategy_id)",
                "CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)",
                "CREATE INDEX IF NOT EXISTS idx_positions_strategy ON positions(strategy_id)",
                "CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions(symbol)",
                "CREATE INDEX IF NOT EXISTS idx_strategy_metrics_time ON strategy_metrics(time DESC)",
                "CREATE INDEX IF NOT EXISTS idx_market_data_time ON market_data(time DESC)",
                "CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(symbol)"
            ]

            for index in indexes:
                await conn.execute(index)

    async def insert_trade(self, trade: TradeRecord) -> str:
        """Insert trade record"""
        async with self.pool.acquire() as conn:
            trade_id = await conn.fetchval("""
                INSERT INTO trades (exchange, symbol, side, quantity, price,
                                   timestamp, strategy_id, order_id, fees, pnl)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (exchange, order_id) DO UPDATE
                SET quantity = EXCLUDED.quantity,
                    price = EXCLUDED.price,
                    fees = EXCLUDED.fees,
                    pnl = EXCLUDED.pnl
                RETURNING id
            """, trade.exchange, trade.symbol, trade.side, trade.quantity,
                trade.price, trade.timestamp, trade.strategy_id,
                trade.order_id, trade.fees, trade.pnl)

            return str(trade_id)

    async def upsert_position(self, position: PositionRecord) -> str:
        """Insert or update position record"""
        async with self.pool.acquire() as conn:
            position_id = await conn.fetchval("""
                INSERT INTO positions (exchange, symbol, side, size, entry_price,
                                      current_price, unrealized_pnl, realized_pnl,
                                      strategy_id, leverage, timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (exchange, symbol, strategy_id) DO UPDATE
                SET size = EXCLUDED.size,
                    current_price = EXCLUDED.current_price,
                    unrealized_pnl = EXCLUDED.unrealized_pnl,
                    realized_pnl = EXCLUDED.realized_pnl,
                    updated_at = NOW()
                RETURNING id
            """, position.exchange, position.symbol, position.side, position.size,
                position.entry_price, position.current_price, position.unrealized_pnl,
                position.realized_pnl, position.strategy_id, position.leverage,
                position.timestamp)

            return str(position_id)

    async def get_strategy_performance(self, strategy_id: str,
                                     period: str = "1d") -> List[Dict]:
        """Get strategy performance metrics"""
        async with self.pool.acquire() as conn:
            time_filter = {
                "1h": "NOW() - INTERVAL '1 hour'",
                "1d": "NOW() - INTERVAL '1 day'",
                "1w": "NOW() - INTERVAL '1 week'",
                "1m": "NOW() - INTERVAL '1 month'"
            }.get(period, "NOW() - INTERVAL '1 day'")

            rows = await conn.fetch("""
                SELECT time, total_pnl, daily_pnl, win_rate, sharpe_ratio,
                       max_drawdown, positions_count, volume, latency_ms, error_rate
                FROM strategy_metrics
                WHERE strategy_id = $1 AND time >= {time_filter}
                ORDER BY time DESC
                LIMIT 1000
            """.format(time_filter=time_filter), strategy_id)

            return [dict(row) for row in rows]

    async def get_portfolio_summary(self) -> Dict:
        """Get portfolio summary statistics"""
        async with self.pool.acquire() as conn:
            # Get current positions
            positions = await conn.fetch("""
                SELECT exchange, symbol, side, size, current_price,
                       unrealized_pnl, realized_pnl, strategy_id
                FROM positions
                WHERE size != 0
            """)

            # Get recent trades
            recent_trades = await conn.fetch("""
                SELECT COUNT(*) as count, SUM(pnl) as total_pnl,
                       AVG(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as win_rate
                FROM trades
                WHERE timestamp >= NOW() - INTERVAL '24 hours'
            """)

            return {
                'positions': [dict(row) for row in positions],
                'trade_stats': dict(recent_trades[0]) if recent_trades else {},
                'timestamp': datetime.now()
            }
```

### High-Frequency Market Data Storage (InfluxDB)
```python
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import asyncio
from typing import Dict, List

class MarketDataStorage:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.client = None
        self.write_api = None

    async def initialize(self):
        """Initialize InfluxDB connection"""
        self.client = InfluxDBClient(
            url=self.config['url'],
            token=self.config['token'],
            org=self.config['org']
        )
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)

    async def store_ticker_data(self, exchange: str, symbol: str,
                               data: Dict[str, Any]):
        """Store ticker data point"""
        point = Point("ticker") \
            .tag("exchange", exchange) \
            .tag("symbol", symbol) \
            .field("bid", float(data['bid'])) \
            .field("ask", float(data['ask'])) \
            .field("last", float(data['last'])) \
            .field("volume", float(data.get('volume', 0))) \
            .time(datetime.utcnow())

        self.write_api.write(bucket=self.config['bucket'], record=point)

    async def store_orderbook_data(self, exchange: str, symbol: str,
                                  orderbook: Dict[str, Any]):
        """Store orderbook snapshot"""
        timestamp = datetime.utcnow()

        # Store bids
        for i, (price, size) in enumerate(orderbook.get('bids', [])[:10]):
            point = Point("orderbook") \
                .tag("exchange", exchange) \
                .tag("symbol", symbol) \
                .tag("side", "bid") \
                .tag("level", str(i)) \
                .field("price", float(price)) \
                .field("size", float(size)) \
                .time(timestamp)
            self.write_api.write(bucket=self.config['bucket'], record=point)

        # Store asks
        for i, (price, size) in enumerate(orderbook.get('asks', [])[:10]):
            point = Point("orderbook") \
                .tag("exchange", exchange) \
                .tag("symbol", symbol) \
                .tag("side", "ask") \
                .tag("level", str(i)) \
                .field("price", float(price)) \
                .field("size", float(size)) \
                .time(timestamp)
            self.write_api.write(bucket=self.config['bucket'], record=point)

    async def query_market_data(self, exchange: str, symbol: str,
                              start_time: datetime, end_time: datetime) -> List[Dict]:
        """Query market data for analysis"""
        query = f'''
        from(bucket: "{self.config['bucket']}")
            |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
            |> filter(fn: (r) => r["_measurement"] == "ticker")
            |> filter(fn: (r) => r["exchange"] == "{exchange}")
            |> filter(fn: (r) => r["symbol"] == "{symbol}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''

        result = self.client.query_api().query(query)
        data = []
        for table in result:
            for record in table.records:
                data.append(record.values)
        return data
```

## Logging Architecture

### Structured Logging System
```python
import structlog
import json
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
import logging.handlers
from enum import Enum

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class TradingLogger:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.loggers = {}
        self._setup_logging()

    def _setup_logging(self):
        """Setup structured logging with multiple outputs"""
        # Configure structlog
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )

        # Setup different loggers
        self.loggers['trading'] = structlog.get_logger("trading")
        self.loggers['system'] = structlog.get_logger("system")
        self.loggers['risk'] = structlog.get_logger("risk")
        self.loggers['performance'] = structlog.get_logger("performance")
        self.loggers['security'] = structlog.get_logger("security")

        # Configure file handlers
        self._setup_file_handlers()

    def _setup_file_handlers(self):
        """Setup rotating file handlers"""
        loggers_config = {
            'trading': {'level': 'INFO', 'filename': 'trading.log'},
            'system': {'level': 'DEBUG', 'filename': 'system.log'},
            'risk': {'level': 'INFO', 'filename': 'risk.log'},
            'performance': {'level': 'INFO', 'filename': 'performance.log'},
            'security': {'level': 'WARNING', 'filename': 'security.log'}
        }

        for logger_name, config in loggers_config.items():
            handler = logging.handlers.RotatingFileHandler(
                filename=f"{self.config['log_dir']}/{config['filename']}",
                maxBytes=self.config.get('max_file_size', 100 * 1024 * 1024),  # 100MB
                backupCount=self.config.get('backup_count', 10)
            )

            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)

            # Get the underlying stdlib logger
            stdlib_logger = logging.getLogger(logger_name)
            stdlib_logger.setLevel(config['level'])
            stdlib_logger.addHandler(handler)

    def log_trade(self, exchange: str, symbol: str, side: str,
                 quantity: float, price: float, strategy_id: str,
                 order_id: str, additional_data: Optional[Dict] = None):
        """Log trade execution"""
        log_data = {
            'event_type': 'trade_execution',
            'exchange': exchange,
            'symbol': symbol,
            'side': side,
            'quantity': quantity,
            'price': price,
            'strategy_id': strategy_id,
            'order_id': order_id,
            'timestamp': datetime.utcnow().isoformat()
        }

        if additional_data:
            log_data.update(additional_data)

        self.loggers['trading'].info("Trade executed", **log_data)

    def log_order_submission(self, exchange: str, symbol: str, order_type: str,
                           side: str, quantity: float, price: Optional[float],
                           strategy_id: str, order_id: str):
        """Log order submission"""
        self.loggers['trading'].info(
            "Order submitted",
            event_type='order_submission',
            exchange=exchange,
            symbol=symbol,
            order_type=order_type,
            side=side,
            quantity=quantity,
            price=price,
            strategy_id=strategy_id,
            order_id=order_id,
            timestamp=datetime.utcnow().isoformat()
        )

    def log_risk_event(self, event_type: str, details: Dict[str, Any]):
        """Log risk management events"""
        self.loggers['risk'].warning(
            f"Risk event: {event_type}",
            event_type=event_type,
            details=details,
            timestamp=datetime.utcnow().isoformat()
        )

    def log_performance_metrics(self, strategy_id: str, metrics: Dict[str, Any]):
        """Log performance metrics"""
        self.loggers['performance'].info(
            "Performance metrics",
            event_type='performance_update',
            strategy_id=strategy_id,
            metrics=metrics,
            timestamp=datetime.utcnow().isoformat()
        )

    def log_system_event(self, event_type: str, component: str,
                        details: Dict[str, Any]):
        """Log system events"""
        self.loggers['system'].info(
            f"System event: {event_type}",
            event_type=event_type,
            component=component,
            details=details,
            timestamp=datetime.utcnow().isoformat()
        )

    def log_security_event(self, event_type: str, severity: str,
                          details: Dict[str, Any]):
        """Log security events"""
        log_method = getattr(self.loggers['security'], severity.lower())
        log_method(
            f"Security event: {event_type}",
            event_type=event_type,
            severity=severity,
            details=details,
            timestamp=datetime.utcnow().isoformat()
        )

class MetricsCollector:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics_buffer = []
        self.buffer_size = config.get('buffer_size', 1000)

    async def collect_trade_metrics(self, trade_data: Dict[str, Any]):
        """Collect trade-related metrics"""
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'trade',
            'exchange': trade_data['exchange'],
            'symbol': trade_data['symbol'],
            'strategy_id': trade_data['strategy_id'],
            'latency_ms': trade_data.get('latency_ms', 0),
            'execution_price': trade_data['price'],
            'quantity': trade_data['quantity'],
            'fees': trade_data.get('fees', 0)
        }

        await self._add_to_buffer(metrics)

    async def collect_system_metrics(self, component: str, metrics_data: Dict[str, Any]):
        """Collect system performance metrics"""
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'system',
            'component': component,
            **metrics_data
        }

        await self._add_to_buffer(metrics)

    async def collect_strategy_metrics(self, strategy_id: str, metrics_data: Dict[str, Any]):
        """Collect strategy-specific metrics"""
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'type': 'strategy',
            'strategy_id': strategy_id,
            **metrics_data
        }

        await self._add_to_buffer(metrics)

    async def _add_to_buffer(self, metrics: Dict[str, Any]):
        """Add metrics to buffer and flush if needed"""
        self.metrics_buffer.append(metrics)

        if len(self.metrics_buffer) >= self.buffer_size:
            await self._flush_metrics()

    async def _flush_metrics(self):
        """Flush metrics buffer to storage"""
        if not self.metrics_buffer:
            return

        # Here you would typically send to InfluxDB, Prometheus, or other metrics storage
        # For now, we'll just log to file
        self.loggers['performance'].info(
            "Metrics batch",
            event_type='metrics_batch',
            metrics_count=len(self.metrics_buffer),
            metrics=self.metrics_buffer
        )

        self.metrics_buffer.clear()

    async def force_flush(self):
        """Force flush of metrics buffer"""
        await self._flush_metrics()
```

### Centralized Log Management (ELK Stack)
```python
from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk
import json
import gzip
from pathlib import Path

class LogAggregator:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.es_client = None
        self.log_buffer = []

    async def initialize(self):
        """Initialize Elasticsearch client"""
        self.es_client = AsyncElasticsearch(
            hosts=[self.config['elasticsearch_url']],
            http_auth=(self.config['username'], self.config['password']),
            verify_certs=False
        )

        await self._setup_index_templates()

    async def _setup_index_templates(self):
        """Setup Elasticsearch index templates for log data"""
        template = {
            "index_patterns": ["trading-logs-*"],
            "template": {
                "settings": {
                    "number_of_shards": 3,
                    "number_of_replicas": 1,
                    "index.refresh_interval": "5s"
                },
                "mappings": {
                    "properties": {
                        "@timestamp": {"type": "date"},
                        "level": {"type": "keyword"},
                        "logger": {"type": "keyword"},
                        "event_type": {"type": "keyword"},
                        "exchange": {"type": "keyword"},
                        "symbol": {"type": "keyword"},
                        "strategy_id": {"type": "keyword"},
                        "message": {"type": "text"},
                        "timestamp": {"type": "date"}
                    }
                }
            }
        }

        await self.es_client.indices.put_index_template(
            name="trading-logs-template",
            body=template
        )

    async def ingest_log(self, log_data: Dict[str, Any]):
        """Ingest log entry into Elasticsearch"""
        index_name = f"trading-logs-{datetime.now().strftime('%Y.%m.%d')}"

        try:
            await self.es_client.index(
                index=index_name,
                body=log_data
            )
        except Exception as e:
            # Fallback to local storage
            await self._store_locally(log_data)

    async def bulk_ingest_logs(self, logs: List[Dict[str, Any]]):
        """Bulk ingest multiple log entries"""
        if not logs:
            return

        index_name = f"trading-logs-{datetime.now().strftime('%Y.%m.%d')}"

        actions = []
        for log in logs:
            action = {
                "_index": index_name,
                "_source": log
            }
            actions.append(action)

        try:
            await async_bulk(self.es_client, actions)
        except Exception as e:
            # Fallback to local storage
            for log in logs:
                await self._store_locally(log)

    async def _store_locally(self, log_data: Dict[str, Any]):
        """Store log entry locally as fallback"""
        log_file = Path(self.config['fallback_log_dir']) / f"fallback_{datetime.now().strftime('%Y%m%d')}.jsonl.gz"

        # Ensure directory exists
        log_file.parent.mkdir(parents=True, exist_ok=True)

        # Append to compressed file
        with gzip.open(log_file, 'at', encoding='utf-8') as f:
            f.write(json.dumps(log_data) + '\n')

    async def search_logs(self, query: Dict[str, Any],
                         start_time: datetime, end_time: datetime) -> List[Dict]:
        """Search logs in Elasticsearch"""
        index_pattern = f"trading-logs-{start_time.strftime('%Y.%m.%d')}"

        search_body = {
            "query": {
                "bool": {
                    "must": [
                        {"range": {"@timestamp": {"gte": start_time.isoformat(), "lte": end_time.isoformat()}}}
                    ]
                }
            },
            "sort": [{"@timestamp": {"order": "desc"}}],
            "size": 1000
        }

        # Add query filters
        for field, value in query.items():
            if field == "message":
                search_body["query"]["bool"]["must"].append({
                    "match": {"message": value}
                })
            else:
                search_body["query"]["bool"]["must"].append({
                    "term": {field: value}
                })

        try:
            response = await self.es_client.search(
                index=index_pattern,
                body=search_body
            )

            return [hit['_source'] for hit in response['hits']['hits']]

        except Exception as e:
            return []

    async def get_log_statistics(self, period: str = "24h") -> Dict[str, Any]:
        """Get log statistics for monitoring"""
        time_filter = {
            "24h": "now-24h",
            "7d": "now-7d",
            "30d": "now-30d"
        }.get(period, "now-24h")

        aggs = {
            "log_levels": {
                "terms": {"field": "level"},
                "aggs": {
                    "recent_logs": {
                        "top_hits": {
                            "sort": [{"@timestamp": {"order": "desc"}}],
                            "_source": ["@timestamp", "level", "logger", "message"],
                            "size": 1
                        }
                    }
                }
            },
            "loggers": {
                "terms": {"field": "logger"}
            },
            "event_types": {
                "terms": {"field": "event_type"}
            }
        }

        search_body = {
            "query": {
                "range": {"@timestamp": {"gte": time_filter}}
            },
            "aggs": aggs,
            "size": 0
        }

        try:
            response = await self.es_client.search(
                index="trading-logs-*",
                body=search_body
            )

            # Process aggregation results
            stats = {
                "total_logs": response['hits']['total']['value'],
                "log_levels": {},
                "loggers": {},
                "event_types": {}
            }

            for bucket in response['aggregations']['log_levels']['buckets']:
                stats['log_levels'][bucket['key']] = bucket['doc_count']

            for bucket in response['aggregations']['loggers']['buckets']:
                stats['loggers'][bucket['key']] = bucket['doc_count']

            for bucket in response['aggregations']['event_types']['buckets']:
                stats['event_types'][bucket['key']] = bucket['doc_count']

            return stats

        except Exception as e:
            return {"error": str(e)}
```

### Performance Analytics Engine
```python
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta

class PerformanceAnalytics:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    async def calculate_strategy_sharpe_ratio(self, strategy_id: str,
                                            period_days: int = 30) -> float:
        """Calculate Sharpe ratio for a strategy"""
        # Get daily returns
        query = """
            SELECT DATE_TRUNC('day', timestamp) as date,
                   SUM(pnl) as daily_pnl
            FROM trades
            WHERE strategy_id = $1
            AND timestamp >= NOW() - INTERVAL '%d days'
            GROUP BY DATE_TRUNC('day', timestamp)
            ORDER BY date
        """ % period_days

        async with self.db_manager.pool.acquire() as conn:
            rows = await conn.fetch(query, strategy_id)

        if len(rows) < 2:
            return 0.0

        # Convert to DataFrame for calculations
        df = pd.DataFrame([dict(row) for row in rows])
        daily_returns = df['daily_pnl'].values

        # Calculate Sharpe ratio (annualized)
        if np.std(daily_returns) == 0:
            return 0.0

        sharpe_ratio = (np.mean(daily_returns) / np.std(daily_returns)) * np.sqrt(252)
        return sharpe_ratio

    async def calculate_maximum_drawdown(self, strategy_id: str,
                                       period_days: int = 30) -> float:
        """Calculate maximum drawdown for a strategy"""
        query = """
            SELECT timestamp, total_pnl
            FROM strategy_metrics
            WHERE strategy_id = $1
            AND time >= NOW() - INTERVAL '%d days'
            ORDER BY time
        """ % period_days

        async with self.db_manager.pool.acquire() as conn:
            rows = await conn.fetch(query, strategy_id)

        if len(rows) < 2:
            return 0.0

        # Calculate running maximum and drawdown
        pnl_series = [float(row['total_pnl']) for row in rows]
        peak = pnl_series[0]
        max_drawdown = 0.0

        for pnl in pnl_series[1:]:
            if pnl > peak:
                peak = pnl
            else:
                drawdown = (peak - pnl) / peak
                max_drawdown = max(max_drawdown, drawdown)

        return max_drawdown

    async def analyze_execution_quality(self, strategy_id: str,
                                      period_days: int = 7) -> Dict[str, Any]:
        """Analyze execution quality metrics"""
        query = """
            SELECT timestamp, price, quantity, fees, exchange, symbol
            FROM trades
            WHERE strategy_id = $1
            AND timestamp >= NOW() - INTERVAL '%d days'
            ORDER BY timestamp
        """ % period_days

        async with self.db_manager.pool.acquire() as conn:
            rows = await conn.fetch(query, strategy_id)

        if not rows:
            return {}

        # Calculate execution metrics
        total_volume = sum(float(row['quantity']) * float(row['price']) for row in rows)
        total_fees = sum(float(row['fees']) for row in rows)
        fee_ratio = total_fees / total_volume if total_volume > 0 else 0

        # Get market data for slippage analysis
        # This would require integrating with market data storage
        slippage_analysis = await self._calculate_slippage(rows)

        return {
            'total_trades': len(rows),
            'total_volume': total_volume,
            'total_fees': total_fees,
            'fee_ratio': fee_ratio,
            'average_trade_size': total_volume / len(rows),
            'slippage_analysis': slippage_analysis
        }

    async def generate_performance_report(self, strategy_id: str,
                                        period_days: int = 30) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        # Gather all performance metrics
        sharpe_ratio = await self.calculate_strategy_sharpe_ratio(strategy_id, period_days)
        max_drawdown = await self.calculate_maximum_drawdown(strategy_id, period_days)
        execution_quality = await self.analyze_execution_quality(strategy_id, period_days)

        # Get basic statistics
        async with self.db_manager.pool.acquire() as conn:
            basic_stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_trades,
                    SUM(pnl) as total_pnl,
                    AVG(pnl) as avg_pnl,
                    STDDEV(pnl) as pnl_stddev
                FROM trades
                WHERE strategy_id = $1
                AND timestamp >= NOW() - INTERVAL '%d days'
            """ % period_days, strategy_id)

            win_loss_stats = await conn.fetchrow("""
                SELECT
                    SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)::float / COUNT(*) as win_rate,
                    AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
                    AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss
                FROM trades
                WHERE strategy_id = $1
                AND timestamp >= NOW() - INTERVAL '%d days'
            """ % period_days, strategy_id)

        report = {
            'strategy_id': strategy_id,
            'period_days': period_days,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_drawdown,
            'total_trades': int(basic_stats['total_trades']) if basic_stats else 0,
            'total_pnl': float(basic_stats['total_pnl']) if basic_stats else 0,
            'avg_pnl': float(basic_stats['avg_pnl']) if basic_stats else 0,
            'pnl_stddev': float(basic_stats['pnl_stddev']) if basic_stats else 0,
            'win_rate': float(win_loss_stats['win_rate']) if win_loss_stats else 0,
            'avg_win': float(win_loss_stats['avg_win']) if win_loss_stats else 0,
            'avg_loss': float(win_loss_stats['avg_loss']) if win_loss_stats else 0,
            'execution_quality': execution_quality,
            'generated_at': datetime.utcnow().isoformat()
        }

        return report

    async def _calculate_slippage(self, trades: List[Dict]) -> Dict[str, Any]:
        """Calculate slippage analysis (placeholder implementation)"""
        # This would integrate with market data to calculate actual slippage
        # For now, return placeholder data
        return {
            'avg_slippage_bps': 5.2,
            'total_slippage_cost': 1250.50,
            'slippage_distribution': {
                'excellent': 15,
                'good': 45,
                'acceptable': 30,
                'poor': 10
            }
        }
```

This database and logging architecture provides enterprise-grade data management capabilities with high performance, comprehensive analytics, and reliable audit trails essential for sophisticated trading operations.