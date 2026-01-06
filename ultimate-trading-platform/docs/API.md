# Ultimate Trading Platform API Reference

## Table of Contents
- [Main Application](#main-application)
- [WebSocket Service](#websocket-service)
- [Hyperliquid Trading Service](#hyperliquid-trading-service)
- [AI Optimizer](#ai-optimizer)
- [Subscription Manager](#subscription-manager)
- [Trading Monitor](#trading-monitor)
- [MoonDev Algorithms](#moondev-algorithms)

---

## Main Application

### UltimateTradingApp

Main application class that orchestrates all platform services.

#### Methods

##### `initialize()`
Initializes all platform services and connects to external APIs.

```javascript
const app = new UltimateTradingApp();
await app.initialize();
```

**Returns:** `Promise<void>`

---

##### `deployStrategy(config)`
Deploys a new trading strategy.

```javascript
const config = {
  name: 'My Turtle Strategy',
  strategy: 'turtle-trading',
  symbol: 'BTC-USD',
  timeframe: '5m',
  size: 100,
  leverage: 5,
  investmentAmount: 1000
};

const result = await app.deployStrategy(config);
console.log(result);
// {
//   success: true,
//   strategyId: 'strat_123',
//   status: 'active',
//   deployedAt: 1704067200000
// }
```

**Parameters:**
- `config` (Object): Strategy configuration
  - `name` (string): Strategy name
  - `strategy` (string): Strategy type ('turtle-trading', 'correlation-trading', etc.)
  - `symbol` (string): Trading symbol
  - `timeframe` (string): Data timeframe
  - `size` (number): Position size
  - `leverage` (number): Leverage multiplier
  - `investmentAmount` (number): Total investment

**Returns:** `Promise<Object>`

---

##### `getPortfolioSummary()`
Gets comprehensive portfolio summary.

```javascript
const summary = await app.getPortfolioSummary();
console.log(summary);
// {
//   summary: {
//     totalValue: 15000,
//     totalPnL: 2500,
//     totalPnLPercent: 20.0,
//     activeStrategies: 3,
//     subscription: 'pro'
//   },
//   performance: {
//     sharpeRatio: 1.85,
//     winRate: 72.5,
//     maxDrawdown: -5.2,
//     totalTrades: 145,
//     profitableTrades: 105
//   }
// }
```

**Returns:** `Promise<Object>`

---

##### `stopStrategy(strategyId)`
Stops an active trading strategy.

```javascript
await app.stopStrategy('strat_123');
```

**Parameters:**
- `strategyId` (string): Strategy identifier

**Returns:** `Promise<void>`

---

## WebSocket Service

### WebSocketService

Real-time market data via WebSocket connections.

#### Methods

##### `initialize()`
Initializes WebSocket connections to all exchanges.

```javascript
await webSocketService.initialize();
```

**Returns:** `Promise<void>`

---

##### `subscribeToSymbols(symbols)`
Subscribes to price updates for symbols.

```javascript
webSocketService.subscribeToSymbols(['BTCUSDT', 'ETHUSDT']);
```

**Parameters:**
- `symbols` (Array<string>): List of trading symbols

**Returns:** `void`

---

##### `getCurrentPrice(symbol)`
Gets the latest price for a symbol.

```javascript
const price = webSocketService.getCurrentPrice('BTCUSDT');
console.log(price);
// {
//   exchange: 'binance',
//   symbol: 'BTCUSDT',
//   price: 50000,
//   change: 2.5,
//   changePercent: 2.5,
//   volume: 1234.56,
//   timestamp: 1704067200000,
//   bid: 49990,
//   ask: 50010
// }
```

**Parameters:**
- `symbol` (string): Trading symbol

**Returns:** `Object|null`

---

##### `getPriceHistory(symbol, limit)`
Gets historical price data.

```javascript
const history = webSocketService.getPriceHistory('BTCUSDT', 100);
```

**Parameters:**
- `symbol` (string): Trading symbol
- `limit` (number): Number of data points (default: 100)

**Returns:** `Array<Object>`

---

##### `on(event, callback)`
Adds event listener.

```javascript
webSocketService.on('priceUpdate', (data) => {
  console.log('Price update:', data);
});

webSocketService.on('connect', () => {
  console.log('WebSocket connected');
});
```

**Parameters:**
- `event` (string): Event name ('connect', 'disconnect', 'priceUpdate', 'error')
- `callback` (function): Event handler

**Returns:** `void`

---

##### `getStatus()`
Gets connection status.

```javascript
const status = webSocketService.getStatus();
console.log(status);
// {
//   overall: true,
//   connections: {
//     binance: { connected: true, readyState: 1 },
//     coinbase: { connected: true, readyState: 1 },
//     hyperliquid: { connected: true, readyState: 1 }
//   },
//   subscriptions: ['BTCUSDT', 'ETHUSDT'],
//   timestamp: 1704067200000
// }
```

**Returns:** `Object`

---

##### `disconnect()`
Closes all WebSocket connections.

```javascript
webSocketService.disconnect();
```

**Returns:** `void`

---

## Hyperliquid Trading Service

### HyperliquidTradingService

DEX integration for executing trades.

#### Methods

##### `initialize()`
Initializes Hyperliquid API connection.

```javascript
await hyperliquidService.initialize();
```

**Returns:** `Promise<void>`

---

##### `createMicroPosition(symbol, side, size, price)`
Creates a micro-position trade.

```javascript
const result = await hyperliquidService.createMicroPosition(
  'BTC-USD',
  'buy',
  100,
  50000
);
console.log(result);
// {
//   success: true,
//   orderId: 'order_123',
//   filledSize: 100,
//   fillPrice: 50000,
//   timestamp: 1704067200000
// }
```

**Parameters:**
- `symbol` (string): Trading symbol
- `side` (string): 'buy' or 'sell'
- `size` (number): Position size (min $0.25)
- `price` (number): Entry price

**Returns:** `Promise<Object>`

---

##### `executeTurtleTrading(config)`
Executes Turtle Trading strategy.

```javascript
const result = await hyperliquidService.executeTurtleTrading({
  symbol: 'BTC-USD',
  timeframe: '5m',
  lookbackPeriod: 55,
  atrMultiplier: 2.0,
  size: 100,
  leverage: 5
});
console.log(result);
// {
//   success: true,
//   strategy: 'turtle-trading',
//   status: 'active',
//   entrySignal: 'buy',
//   confidence: 0.85,
//   stopLoss: 49500,
//   takeProfit: 51000
// }
```

**Parameters:**
- `config` (Object): Strategy configuration

**Returns:** `Promise<Object>`

---

##### `executeArbitrage(config)`
Executes Arbitrage strategy.

```javascript
const result = await hyperliquidService.executeArbitrage({
  minProfitThreshold: 0.001,
  maxSlippage: 0.0005,
  executionSpeedMs: 100,
  baseSize: 1000,
  maxConcurrentArbitrages: 3
});
console.log(result);
// {
//   success: true,
//   strategy: 'arbitrage',
//   status: 'active',
//   opportunities: [
//     {
//       symbol: 'BTC-USD',
//       buyExchange: 'binance',
//       sellExchange: 'coinbase',
//       profitPercentage: 0.15
//     }
//   ]
// }
```

**Parameters:**
- `config` (Object): Strategy configuration

**Returns:** `Promise<Object>`

---

##### `createGridStrategy(config)`
Creates Grid Trading strategy.

```javascript
const result = await hyperliquidService.createGridStrategy({
  symbol: 'BTC-USD',
  currentPrice: 50000,
  gridLevels: 10,
  gridSpacing: 0.02,
  amount: 100
});
console.log(result);
// {
//   success: true,
//   strategy: 'grid-trading',
//   gridOrders: [
//     { level: 1, price: 49000, side: 'buy', size: 100 },
//     { level: 2, price: 49200, side: 'buy', size: 100 },
//     ...
//   ]
// }
```

**Parameters:**
- `config` (Object): Grid configuration

**Returns:** `Promise<Object>`

---

##### `getAccountInfo()`
Gets account information.

```javascript
const account = await hyperliquidService.getAccountInfo();
console.log(account);
// {
//   balance: 10000,
//   equity: 10250,
//   marginUsed: 500,
//   availableMargin: 9750,
//   leverage: 5,
//   positions: [
//     {
//       symbol: 'BTC-USD',
//       size: 100,
//       entryPrice: 50000,
//       unrealizedPnL: 250
//     }
//   ]
// }
```

**Returns:** `Promise<Object>`

---

## AI Optimizer

### AITradingOptimizer

AI-powered strategy optimization.

#### Methods

##### `initialize()`
Initializes AI models.

```javascript
await aiOptimizer.initialize();
```

**Returns:** `Promise<void>`

---

##### `analyzeMarketConditions(params)`
Analyzes current market conditions.

```javascript
const analysis = await aiOptimizer.analyzeMarketConditions({
  symbols: ['BTC-USD', 'ETH-USD'],
  timeframe: '1h'
});
console.log(analysis);
// {
//   sentiment: 'bullish',
//   volatility: 'medium',
//   trend: 'uptrend',
//   volume: 'high',
//   confidence: 0.85
// }
```

**Parameters:**
- `params` (Object): Analysis parameters
  - `symbols` (Array<string>): Symbols to analyze
  - `timeframe` (string): Analysis timeframe

**Returns:** `Promise<Object>`

---

##### `selectOptimalStrategies(params)`
Selects optimal trading strategies.

```javascript
const strategies = await aiOptimizer.selectOptimalStrategies({
  riskTolerance: 'medium',
  investmentAmount: 10000,
  timeframe: '1h'
});
console.log(strategies);
// [
//   {
//     name: 'turtle-trading',
//     score: 0.95,
//     allocation: 0.4,
//     expectedReturn: 0.15,
//     risk: 'medium'
//   },
//   {
//     name: 'mean-reversion',
//     score: 0.87,
//     allocation: 0.35,
//     expectedReturn: 0.12,
//     risk: 'low-medium'
//   }
// ]
```

**Parameters:**
- `params` (Object): Selection criteria
  - `riskTolerance` (string): 'low', 'medium', 'high'
  - `investmentAmount` (number): Available capital
  - `timeframe` (string): Strategy timeframe

**Returns:** `Promise<Array<Object>>`

---

##### `generateTradingSignal(params)`
Generates AI-powered trading signals.

```javascript
const signal = await aiOptimizer.generateTradingSignal({
  symbol: 'BTC-USD',
  strategy: 'turtle-trading',
  marketData: { /* price data */ }
});
console.log(signal);
// {
//   action: 'buy',
//   confidence: 0.92,
//   entryPrice: 50000,
//   stopLoss: 49500,
//   takeProfit: 51000,
//   reasoning: 'Strong breakout pattern with high volume'
// }
```

**Parameters:**
- `params` (Object): Signal parameters
  - `symbol` (string): Trading symbol
  - `strategy` (string): Strategy type
  - `marketData` (Object): Current market data

**Returns:** `Promise<Object>`

---

##### `backtestStrategy(strategy, params)`
Backtests a trading strategy.

```javascript
const results = await aiOptimizer.backtestStrategy(
  'turtle-trading',
  {
    symbol: 'BTC-USD',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10000
  }
);
console.log(results);
// {
//   totalReturn: 15.5,
//   sharpeRatio: 1.92,
//   maxDrawdown: -8.2,
//   winRate: 68.5,
//   totalTrades: 145,
//   profitableTrades: 99,
//   profitFactor: 1.85,
//   averageWin: 250,
//   averageLoss: -150
// }
```

**Parameters:**
- `strategy` (string): Strategy name
- `params` (Object): Backtest parameters

**Returns:** `Promise<Object>`

---

## Subscription Manager

### SubscriptionManager

Manages user subscriptions and billing.

#### Methods

##### `createSubscription(params)`
Creates a new subscription.

```javascript
const subscription = await subscriptionManager.createSubscription({
  tier: 'pro',
  paymentMethod: 'crypto',
  billingCycle: 'monthly'
});
console.log(subscription);
// {
//   id: 'sub_123',
//   tier: 'pro',
//   status: 'active',
//   monthlyFee: 99,
//   features: {
//     aiOptimization: true,
//     backtesting: true,
//     customStrategies: true,
//     apiAccess: true
//   }
// }
```

**Parameters:**
- `params` (Object): Subscription parameters
  - `tier` (string): 'micro', 'standard', 'pro', 'elite'
  - `paymentMethod` (string): Payment method
  - `billingCycle` (string): Billing frequency

**Returns:** `Promise<Object>`

---

##### `upgradeSubscription(subscriptionId, newTier)`
Upgrades subscription tier.

```javascript
await subscriptionManager.upgradeSubscription('sub_123', 'elite');
```

**Parameters:**
- `subscriptionId` (string): Subscription identifier
- `newTier` (string): New tier name

**Returns:** `Promise<Object>`

---

##### `addInvestment(params)`
Adds investment to portfolio.

```javascript
const result = await subscriptionManager.addInvestment({
  amount: 1000,
  currency: 'USD',
  paymentMethod: 'crypto'
});
console.log(result);
// {
//   success: true,
//   newBalance: 11000,
//   investedAmount: 1000,
//   availableToInvest: 11000
// }
```

**Parameters:**
- `params` (Object): Investment parameters
  - `amount` (number): Investment amount
  - `currency` (string): Currency type
  - `paymentMethod` (string): Payment method

**Returns:** `Promise<Object>`

---

##### `checkSubscriptionLimits(action)`
Checks if action is allowed for current subscription.

```javascript
const limits = subscriptionManager.checkSubscriptionLimits('add_strategy');
console.log(limits);
// {
//   allowed: true,
//   remaining: 4,
//   limit: 6
// }
```

**Parameters:**
- `action` (string): Action to check

**Returns:** `Object`

---

##### `getSubscriptionDetails(subscriptionId)`
Gets detailed subscription information.

```javascript
const details = await subscriptionManager.getSubscriptionDetails('sub_123');
console.log(details);
// {
//   id: 'sub_123',
//   tier: 'pro',
//   status: 'active',
//   startDate: 1704067200000,
//   endDate: 1706659200000,
//   monthlyFee: 99,
//   nextBilling: 1706659200000,
//   features: {
//     aiOptimization: true,
//     backtesting: true,
//     customStrategies: true,
//     apiAccess: true,
//     maxStrategies: 6,
//     maxInvestment: 10000
//   }
// }
```

**Parameters:**
- `subscriptionId` (string): Subscription identifier

**Returns:** `Promise<Object>`

---

## Trading Monitor

### TradingMonitor

Real-time risk monitoring and alerting.

#### Methods

##### `startMonitoring()`
Starts portfolio monitoring.

```javascript
tradingMonitor.startMonitoring();
```

**Returns:** `void`

---

##### `stopMonitoring()`
Stops portfolio monitoring.

```javascript
tradingMonitor.stopMonitoring();
```

**Returns:** `void`

---

##### `checkMonitoringRules(portfolio)`
Checks portfolio against monitoring rules.

```javascript
const violations = await tradingMonitor.checkMonitoringRules({
  totalValue: 10000,
  drawdown: 0.06,
  consecutiveLosses: 3,
  dailyPnL: -200
});
console.log(violations);
// [
//   {
//     ruleId: 'drawdown_alert',
//     severity: 'high',
//     message: 'Portfolio drawdown exceeds 5%',
//     currentValue: 0.06
//   }
// ]
```

**Parameters:**
- `portfolio` (Object): Portfolio metrics
  - `totalValue` (number): Total portfolio value
  - `drawdown` (number): Current drawdown percentage
  - `consecutiveLosses` (number): Number of consecutive losses
  - `dailyPnL` (number): Daily P&L

**Returns:** `Promise<Array<Object>>`

---

##### `addMonitoringRule(rule)`
Adds custom monitoring rule.

```javascript
await tradingMonitor.addMonitoringRule({
  id: 'daily_loss_limit',
  name: 'Daily Loss Limit',
  condition: 'daily_pnl < -500',
  severity: 'high',
  action: 'close_all_positions',
  enabled: true
});
```

**Parameters:**
- `rule` (Object): Monitoring rule
  - `id` (string): Rule identifier
  - `name` (string): Rule name
  - `condition` (string): Condition to check
  - `severity` (string): 'low', 'medium', 'high'
  - `action` (string): Action to take
  - `enabled` (boolean): Rule status

**Returns:** `Promise<void>`

---

##### `triggerAlert(alert)`
Triggers an alert.

```javascript
await tradingMonitor.triggerAlert({
  type: 'profit_target',
  message: 'Daily profit target reached!',
  severity: 'low',
  data: { profit: 500 }
});
```

**Parameters:**
- `alert` (Object): Alert information
  - `type` (string): Alert type
  - `message` (string): Alert message
  - `severity` (string): Alert severity
  - `data` (Object): Additional data

**Returns:** `Promise<void>`

---

##### `getMonitoringStatus()`
Gets current monitoring status.

```javascript
const status = tradingMonitor.getMonitoringStatus();
console.log(status);
// {
//   isMonitoring: true,
//   activeRules: 7,
//   totalAlerts: 12,
//   lastCheck: 1704067200000
// }
```

**Returns:** `Object`

---

## MoonDev Algorithms

### TurtleTradingStrategy

Classic 55-bar breakout system.

#### Methods

##### `generateSignal(marketData)`
Generates trading signals based on breakout patterns.

```javascript
const signal = await turtleStrategy.generateSignal({
  high: [100, 101, 102, 105, 107],
  low: [98, 99, 100, 101, 103],
  close: [100, 101, 102, 105, 107]
});
console.log(signal);
// {
//   action: 'buy',
//   confidence: 0.85,
//   reason: '55-period breakout',
//   stopLoss: 49500,
//   takeProfit: 51000
// }
```

**Parameters:**
- `marketData` (Object): OHLCV data

**Returns:** `Promise<Object>`

---

##### `calculatePositionSize(atr, accountBalance, riskPercentage)`
Calculates optimal position size.

```javascript
const size = turtleStrategy.calculatePositionSize(2.5, 10000, 0.02);
console.log(size); // 80
```

**Parameters:**
- `atr` (number): Average True Range
- `accountBalance` (number): Account balance
- `riskPercentage` (number): Risk per trade

**Returns:** `number`

---

### CorrelationTradingStrategy

ETH-leading lag detection strategy.

#### Methods

##### `detectCorrelationOpportunity(leaderSymbol, followerSymbol, leaderData, followerData)`
Detects correlation opportunities.

```javascript
const opportunity = await correlationStrategy.detectCorrelationOpportunity(
  'ETH-USD',
  'BTC-USD',
  { price: 100, change: 0.05 },
  { price: 99.5, change: 0.01 }
);
console.log(opportunity);
// {
//   action: 'buy',
//   symbol: 'BTC-USD',
//   leaderSymbol: 'ETH-USD',
//   lagPercentage: 0.8,
//   confidence: 0.78
// }
```

**Parameters:**
- `leaderSymbol` (string): Leading asset
- `followerSymbol` (string): Following asset
- `leaderData` (Object): Leader market data
- `followerData` (Object): Follower market data

**Returns:** `Promise<Object>`

---

### MeanReversionStrategy

Multi-asset statistical arbitrage.

#### Methods

##### `calculateZScore(prices, currentPrice)`
Calculates z-score for mean reversion.

```javascript
const zScore = meanReversionStrategy.calculateZScore(
  [100, 101, 99, 102, 98, 100, 101, 99],
  110
);
console.log(zScore); // 2.5
```

**Parameters:**
- `prices` (Array<number>): Historical prices
- `currentPrice` (number): Current price

**Returns:** `number`

---

##### `generateSignal(priceData)`
Generates mean reversion signals.

```javascript
const signal = await meanReversionStrategy.generateSignal({
  prices: [100, 101, 99, 102, 98, 100, 101, 99, 95, 93],
  currentPrice: 93
});
console.log(signal);
// {
//   action: 'buy',
//   confidence: 0.88,
//   zScore: -2.1,
//   targetPrice: 99.5
// }
```

**Parameters:**
- `priceData` (Object): Price information

**Returns:** `Promise<Object>`

---

### ArbitrageStrategy

Cross-exchange price inefficiency detection.

#### Methods

##### `detectArbitrageOpportunity(price1, price2)`
Detects arbitrage opportunities.

```javascript
const opportunity = await arbitrageStrategy.detectArbitrageOpportunity(
  50000,
  50050
);
console.log(opportunity);
// {
//   profitPercentage: 0.1,
//   buyExchange: 'exchange1',
//   sellExchange: 'exchange2',
//   profit: 50,
//   confidence: 0.95
// }
```

**Parameters:**
- `price1` (number): Exchange 1 price
- `price2` (number): Exchange 2 price

**Returns:** `Promise<Object>`

---

##### `calculateProfit(buyPrice, sellPrice, amount)`
Calculates arbitrage profit.

```javascript
const profit = arbitrageStrategy.calculateProfit(50000, 50050, 1000);
console.log(profit); // 50
```

**Parameters:**
- `buyPrice` (number): Buy price
- `sellPrice` (number): Sell price
- `amount` (number): Trade amount

**Returns:** `number`

---

### MarketMakerStrategy

Liquidity provision with spread capture.

#### Methods

##### `calculateBidAsk(currentPrice, spreadPercentage)`
Calculates bid and ask prices.

```javascript
const { bid, ask } = marketMakerStrategy.calculateBidAsk(50000, 0.01);
console.log(bid, ask); // 49500, 50500
```

**Parameters:**
- `currentPrice` (number): Current market price
- `spreadPercentage` (number): Desired spread

**Returns:** `Object`

---

##### `shouldReduceInventory(currentInventory, maxInventory, isLong)`
Determines if inventory should be reduced.

```javascript
const shouldReduce = marketMakerStrategy.shouldReduceInventory(5, 10, true);
console.log(shouldReduce); // false
```

**Parameters:**
- `currentInventory` (number): Current inventory
- `maxInventory` (number): Maximum inventory
- `isLong` (boolean): Is long position

**Returns:** `boolean`

---

## Events

### Global Events

The platform dispatches several custom events for UI updates.

#### `marketDataUpdate`
Dispatched when new market data is received.

```javascript
window.addEventListener('marketDataUpdate', (event) => {
  const { symbol, data } = event.detail;
  console.log(`${symbol}: $${data.price}`);
});
```

#### `portfolioUpdate`
Dispatched when portfolio changes.

```javascript
window.addEventListener('portfolioUpdate', (event) => {
  const portfolio = event.detail;
  updatePortfolioUI(portfolio);
});
```

#### `tradeExecuted`
Dispatched when a trade is executed.

```javascript
window.addEventListener('tradeExecuted', (event) => {
  const trade = event.detail;
  showTradeNotification(trade);
});
```

#### `alertTriggered`
Dispatched when an alert is triggered.

```javascript
window.addEventListener('alertTriggered', (event) => {
  const alert = event.detail;
  showAlert(alert);
});
```

---

## Error Handling

All async methods may throw errors. Always use try-catch blocks:

```javascript
try {
  const result = await app.deployStrategy(config);
  console.log('Strategy deployed:', result);
} catch (error) {
  console.error('Deployment failed:', error);
  // Handle error appropriately
}
```

Common error types:
- `NetworkError`: Connection issues
- `AuthenticationError`: Invalid API credentials
- `ValidationError`: Invalid parameters
- `InsufficientFundsError`: Not enough balance
- `SubscriptionError`: Subscription limit reached

---

## Rate Limiting

API calls are rate-limited:
- Standard tier: 100 requests/minute
- Pro tier: 500 requests/minute
- Elite tier: 1000 requests/minute

Exceeded limits will return HTTP 429 (Too Many Requests).

---

## Pagination

List endpoints support pagination:

```javascript
const page1 = await app.getTrades({ limit: 50, offset: 0 });
const page2 = await app.getTrades({ limit: 50, offset: 50 });
```

---

## WebSocket Events

### Connection Events
- `connect`: Successfully connected
- `disconnect`: Connection lost
- `error`: Connection error

### Data Events
- `priceUpdate`: New price data
- `orderBookUpdate`: Order book changes
- `tradeUpdate`: Trade executed

### Trading Events
- `strategyStarted`: Strategy activated
- `strategyStopped`: Strategy stopped
- `positionOpened`: New position
- `positionClosed`: Position closed

---

*For more examples and advanced usage, see the [Examples Directory](../examples/)*
