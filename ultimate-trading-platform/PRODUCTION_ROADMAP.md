# Production Roadmap: Ultimate Trading Platform

This roadmap outlines the path to a production-grade, high-performance trading system. It bridges the gap from the current Node.js/React prototype to a robust, containerized, and monitored algorithmic trading engine.

## 1. Infrastructure Architecture

We will move from a local runtime to a containerized microservices architecture managed by Docker Compose for development/single-node deployment.

### Components
1.  **Trading Engine (App)**: Node.js/TypeScript service running the core logic.
2.  **Database**: TimescaleDB (PostgreSQL extension) for time-series tick data and relational user/order data.
3.  **Message Queue**: Redis for event-driven communication (ticks, orders, fills) and job queues.
4.  **Risk Guard**: A separate sidecar/service acting as the "Circuit Breaker".
5.  **Frontend**: React app (served via Nginx or separate container).

### `docker-compose.yml` Specification
```yaml
version: '3.8'
services:
  # Core Trading Logic
  trading-engine:
    build: ./backend
    environment:
      - DB_HOST=timescaledb
      - REDIS_HOST=redis
      - RISK_SERVICE_URL=http://risk-guard:3000
    depends_on:
      - timescaledb
      - redis
      - risk-guard
    networks:
      - trading-net

  # Circuit Breaker / Risk Management (Independent Process)
  risk-guard:
    build: ./risk-guard
    environment:
      - REDIS_HOST=redis
      - MAX_DAILY_LOSS=500
      - MAX_POSITION_SIZE=1.5
    networks:
      - trading-net

  # Time-Series Database
  timescaledb:
    image: timescale/timescaledb:latest-pg14
    volumes:
      - timescale_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=secure_password
    networks:
      - trading-net

  # Message Broker
  redis:
    image: redis:alpine
    command: redis-server --appendonly yes
    networks:
      - trading-net

networks:
  trading-net:
    driver: bridge

volumes:
  timescale_data:
```

---

## 2. Safety: Circuit Breaker Module (Risk Guard)

The **Risk Guard** is a critical, independent process that sits logically *between* the Strategy and the Exchange execution. It must be decoupled from the main trading loop to prevent a runaway algo from draining the account.

### Responsibilities
-   **Pre-Trade Checks**: Intercepts every order request *before* it goes to the exchange API.
-   **Post-Trade Analysis**: Listens to fill streams to update real-time PnL and exposure.
-   **Kill Switch**: Automatically halts trading if thresholds are breached.

### Key Thresholds (Configurable)
1.  **Max Daily Loss**: e.g., -$500 USD (Hard Stop).
2.  **Max Drawdown**: % drop from high water mark.
3.  **Max Position Size**: Cap on exposure per symbol.
4.  **Order Velocity**: Limit number of orders per minute (prevent spamming).

### Implementation Logic (Pseudocode)
```typescript
class CircuitBreaker {
  async validateOrder(order: Order): Promise<boolean> {
    const currentExposure = await this.redis.get('current_exposure');
    const dailyPnL = await this.redis.get('daily_pnl');

    if (dailyPnL < MAX_DAILY_LOSS) {
      throw new Error('CIRCUIT BREAKER: Max daily loss exceeded.');
    }

    if (order.size + currentExposure > MAX_POSITION_LIMIT) {
      throw new Error('CIRCUIT BREAKER: Position limit exceeded.');
    }

    if (this.isKillSwitchActive()) {
      throw new Error('CIRCUIT BREAKER: Kill switch is ACTIVE.');
    }

    return true; // Safe to execute
  }
}
```

---

## 3. Data: Tick-Level Storage Schema

We will use **TimescaleDB** to store high-frequency market data. This allows for efficient querying of time-series data for backtesting and analysis.

### Schema Definition (SQL)

#### 1. Hypertable: `market_ticks`
Stores raw tick data (price updates).

```sql
CREATE TABLE market_ticks (
    time        TIMESTAMPTZ       NOT NULL,
    symbol      TEXT              NOT NULL,
    price       DOUBLE PRECISION  NOT NULL,
    volume      DOUBLE PRECISION  NOT NULL,
    source      TEXT              NOT NULL, -- e.g., 'binance', 'coinbase'
    side        TEXT              -- 'buy' or 'sell' (for trades)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('market_ticks', 'time');

-- Indexes for fast retrieval by symbol and time
CREATE INDEX idx_market_ticks_symbol_time ON market_ticks (symbol, time DESC);
```

#### 2. Standard Table: `trade_executions`
Stores our own trade history (persistent system of record).

```sql
CREATE TABLE trade_executions (
    id              UUID PRIMARY KEY,
    strategy_id     TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    side            TEXT NOT NULL, -- 'BUY', 'SELL'
    order_type      TEXT NOT NULL, -- 'MARKET', 'LIMIT'
    price           DOUBLE PRECISION NOT NULL,
    quantity        DOUBLE PRECISION NOT NULL,
    commission      DOUBLE PRECISION,
    executed_at     TIMESTAMPTZ DEFAULT NOW(),
    risk_check_pass BOOLEAN DEFAULT TRUE
);
```

---

## 4. Deployment: CI/CD Pipeline

We will use **GitHub Actions** to enforce quality and automate deployment.

### Workflow File: `.github/workflows/deploy.yml`

```yaml
name: Production Build & Deploy

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    
    services:
      # Spin up test DB
      timescaledb:
        image: timescale/timescaledb:latest-pg14
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:alpine
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js 18
      uses: actions/setup-node@v3
      with:
        node-version: 18
        cache: 'npm'

    - name: Install Dependencies
      run: npm ci

    - name: Run Linter
      run: npm run lint

    - name: Run Tests
      run: npm test
      env:
        DB_HOST: localhost
        REDIS_HOST: localhost

    - name: Build Docker Image
      if: github.event_name == 'push'
      run: |
        docker build -t my-registry/trading-engine:${{ github.sha }} .
        # docker push my-registry/trading-engine:${{ github.sha }}

  deploy:
    needs: test-and-build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USERNAME }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/trading-platform
            git pull origin main
            docker-compose up -d --build
```

---

## Next Steps (Execution Plan)

1.  **Phase 1 (Infra)**: Set up the local `docker-compose` environment and verify connectivity between App, Redis, and TimescaleDB.
2.  **Phase 2 (Data)**: Implement the database migrations for `market_ticks` and `trade_executions`. Connect the tick collector.
3.  **Phase 3 (Safety)**: Extract risk logic into the standalone `risk-guard` service.
4.  **Phase 4 (Pipeline)**: Configure the GitHub Actions workflow and test the build process.
