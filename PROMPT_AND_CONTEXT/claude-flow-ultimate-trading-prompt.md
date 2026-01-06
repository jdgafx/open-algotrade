# Claude Flow Ultimate Trading Platform Prompt

## EXECUTE: Build Ultimate Algorithmic Trading SaaS

**Mission**: Create the most accessible algorithmic trading platform ever built, supporting micro-positions down to $0.25, powered entirely by Puter.js infrastructure (zero server costs).

## CORE ARCHITECTURE

### Primary Infrastructure: Puter.js ONLY
- **AI Integration**: `puter.ai.chat()` with 500+ models (GPT-5 nano, Claude, Gemini) for strategy optimization
- **Storage**: `puter.fs.read/write()` for trade history, strategy configs  
- **Database**: `puter.kv.set/get()` for user profiles, portfolio data, subscriptions
- **Authentication**: `puter.auth.signIn()` for seamless user management
- **Serverless**: `puter.workers.create()` for backend trading operations
- **Business Model**: User-pays model (devs pay $0, users pay their usage)

### DEX Integration: Hyperliquid
- REST API + WebSocket for real-time trading
- Perpetual and spot trading
- **CRITICAL**: Support micro-positions down to $0.25
- Testnet + mainnet support

## DESIGN REQUIREMENT
**Reference**: https://dribbble.com/shots/21883708-AI-Powered-Crypto-Trading-Strategy-Bot-UI-UX-Portfolio-Dashboard
- Glassmorphic dark theme
- Professional trading terminal aesthetic  
- Real-time charts and portfolio tracking
- Mobile-responsive
- Clean, data-focused interface

## MANDATORY FILE STRUCTURE
```
ultimate-trading-platform/
├── index.html (Main dashboard - glassmorphic design)
├── services/
│   ├── hyperliquid-service.js (DEX integration)
│   ├── ai-optimizer.js (Puter.js AI integration)  
│   ├── subscription-manager.js (User subscription management)
│   └── trading-monitor.js (Real-time updates)
├── styles/trading-theme.css (Dribbble-inspired)
└── assets/icons/ (Trading SVGs)
```

## CORE FEATURES TO IMPLEMENT

### 1. Micro-Position Trading ($0.25 Minimum)
```javascript
// Validation in hyperliquid-service.js
if (amount < 0.25) {
    throw new Error('Minimum position is $0.25');
}
```

### 2. Puter.js AI Strategy Optimization
```javascript
// ai-optimizer.js implementation
const optimization = await puter.ai.chat(
    `Optimize this trading strategy: ${strategyCode}`,
    { model: "gpt-5-nano", max_tokens: 2000 }
);
```

### 3. Subscription Tiers
- **Starter**: $9.99/month - 5 strategies, $1K max positions
- **Pro**: $49.99/month - 25 strategies, $10K max positions  
- **Elite**: $199.99/month - Unlimited strategies, $100K max positions
- **Whale**: Custom pricing - Everything unlimited

### 4. Trading Algorithms
Implement these core strategies:
- Turtle Trading
- Bollinger Bands
- VWAP Strategy
- Correlation Trading
- Mean Reversion
- Grid Trading
- Momentum Trading

## PUTER.JS INTEGRATION PATTERNS

### User Management
```javascript
// Initialize user in KV store
await puter.kv.set(`user_${user.id}_profile`, {
    email: user.email,
    subscriptionTier: 'starter',
    joined: new Date().toISOString()
});
```

### Portfolio Storage
```javascript
// Store portfolio data
await puter.kv.set(`user_${user.id}_portfolio`, {
    totalValue: portfolioValue,
    positions: positionsArray,
    pnl: dailyPnL
});
```

### Strategy Storage
```javascript
// Save strategy configurations
await puter.fs.write(`strategies/${userId}/${strategyName}.json`, strategyConfig);
```

### AI Analysis
```javascript
// Market analysis with AI
const analysis = await puter.ai.chat(
    `Analyze current market conditions for ${symbol}`,
    { model: "claude" }
);
```

## IMPLEMENTATION PHASES

### Phase 1: Foundation (IMMEDIATE)
1. Create index.html with Dribbble-inspired design
2. Implement Puter.js authentication flow
3. Build hyperliquid-service.js with $0.25 minimum
4. Create basic portfolio tracking

### Phase 2: Core Trading (NEXT)
1. Add 5 core trading strategies
2. Implement ai-optimizer.js with Puter.js AI
3. Build subscription-manager.js with tiers
4. Create trading-monitor.js for real-time updates

### Phase 3: Advanced Features (FINAL)
1. Complete all trading algorithms
2. Advanced AI optimization
3. Mobile responsiveness
4. Performance analytics

## TECHNICAL REQUIREMENTS

### Performance
- Real-time WebSocket connections
- <100ms order execution
- 99.9% uptime (Puter.js infrastructure)
- Progressive Web App (PWA)

### Security
- Client-side private key management
- Position size validation
- Risk management alerts
- Stop-loss automation

### User Experience
- One-click strategy deployment
- Real-time P&L tracking
- Intuitive risk controls
- Mobile-first design

## SUCCESS METRICS
✅ Support $0.25 minimum positions
✅ Zero infrastructure costs (user-pays model)
✅ 500+ AI models via Puter.js
✅ Professional trading terminal feel
✅ Accessible to non-technical users
✅ Scalable to 1M+ users

## EXECUTE INSTRUCTIONS FOR CLAUDE FLOW

1. **Start with index.html**: Create the main dashboard with glassmorphic design matching the Dribbble reference
2. **Implement Puter.js integration**: Add authentication, KV storage, and AI capabilities
3. **Build hyperliquid-service.js**: Focus on $0.25 minimum position support
4. **Create ai-optimizer.js**: Leverage Puter.js AI for strategy optimization
5. **Add subscription tiers**: Implement the pricing model in subscription-manager.js
6. **Create trading-monitor.js**: Real-time portfolio and P&L tracking
7. **Test on Hyperliquid testnet**: Verify $0.25 minimum works
8. **Deploy via Puter.js hosting**: Use `puter.hosting.create()` for zero-server deployment

## CRITICAL SUCCESS FACTORS
- **Use ONLY Puter.js for infrastructure** (no custom servers)
- **Prioritize $0.25 minimum positions** (market differentiator)
- **Leverage user-pays model** (zero developer costs)
- **Match Dribbble design aesthetic** (professional appearance)
- **Make it beginner-friendly** (democratize trading)

**FINAL GOAL**: The most accessible algorithmic trading platform ever created, powered by free Puter.js infrastructure, supporting micro-trades down to a quarter.