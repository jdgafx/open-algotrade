# $25 Hyperliquid Trading Bot

## 🎯 Overview
A **real-money trading bot** designed for **$25 starting capital** on Hyperliquid exchange.

**⚠️ WARNING**: This bot trades with REAL money. Start with minimum amounts only.

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Activate virtual environment
source trading_env/bin/activate

# Install dependencies (already done)
pip install requests pandas eth_account hyperliquid
```

### 2. API Configuration
```bash
# Run setup wizard
python3 setup_real_trading.py
```
This will:
- Guide you through Hyperliquid API setup
- Create your `config_keys.py` file
- Test your API connection
- Run safety checks

### 3. Test First (Paper Trading)
```bash
# Test without real money
python3 micro_trader.py
```

### 4. Go Live (REAL MONEY)
```bash
# ⚠️ REAL MONEY TRADING - ONLY AFTER TESTING
python3 live_micro_trader.py
```

## 📊 Trading Strategy

### Current Strategy: Simple Momentum
- **Buy WIF** when price < $0.50
- **Short WIF** when price > $0.80
- **Stop Loss**: 5% loss
- **Take Profit**: 10% gain
- **Position Size**: $5 per trade
- **Leverage**: 10x (conservative)

### Risk Management
- **Max Daily Loss**: $2.50 (10% of capital)
- **Max Daily Trades**: 10
- **Max Open Positions**: 1
- **Emergency Stop**: Automatic
- **Real-time Alerts**: Discord notifications

## 💰 Capital Management

For $25 starting capital:
- **Effective Buying Power**: $250 (10x leverage)
- **Position Size**: $5 per trade (20% of capital)
- **Max Risk**: $2.50 per day
- **Expected Returns**: 10-20% monthly (if profitable)

## 🛡️ Safety Features

### Automatic Protections
- ✅ Daily loss limits
- ✅ Position size limits
- ✅ Stop loss orders
- ✅ Emergency stop functions
- ✅ Discord alerts for all trades
- ✅ Maximum trade count limits

### Manual Safeguards
- ⏹️ Ctrl+C to stop trading immediately
- 📊 Real-time monitoring
- 📱 Discord notifications
- 💾 Complete trade logging

## 📋 Requirements

### Hyperliquid Account
1. Go to [hyperliquid.xyz](https://hyperliquid.xyz)
2. Create account or login
3. Go to Account > API
4. Generate API keys
5. Fund account with at least $25

### Technical Requirements
- Python 3.7+
- Stable internet connection
- Linux/macOS/Windows

## 🔧 Configuration

Edit `config_keys.py` (created by setup wizard):

```python
# Your API keys
HYPERLIQUID_PRIVATE_KEY = "your_private_key_here"
HYPERLIQUID_ADDRESS = "your_wallet_address_here"

# Trading parameters
TRADING_CONFIG = {
    "capital": 25.0,           # Starting capital
    "leverage": 10,            # Leverage multiplier
    "position_size_dollars": 5, # Amount per trade
    "stop_loss_pct": 0.05,     # 5% stop loss
    "take_profit_pct": 0.10,   # 10% take profit
}
```

## 📱 Discord Alerts

Set up Discord webhook for real-time alerts:
1. Create Discord server
2. Go to Server Settings > Integrations > Webhooks
3. Create webhook and copy URL
4. Add to config during setup

## ⚠️ IMPORTANT WARNINGS

### Financial Risks
- **You can lose your entire $25**
- **Leverage magnifies both gains AND losses**
- **Crypto markets are extremely volatile**
- **Past performance doesn't guarantee future results**

### Technical Risks
- **API failures can cause losses**
- **Internet disconnections**
- **Exchange downtime**
- **Software bugs**

### Recommendations
- ✅ **Start with $25 maximum**
- ✅ **Monitor bot constantly initially**
- ✅ **Set conservative stop losses**
- ✅ **Test thoroughly with paper trading**
- ✅ **Never trade money you can't afford to lose**
- ✅ **Keep API keys secure and private**

## 📊 Performance Tracking

The bot tracks:
- Daily P&L
- Win/loss ratio
- Number of trades
- Average holding time
- Maximum drawdown

## 🆘 Troubleshooting

### Common Issues
1. **API Connection Failed**
   - Check internet connection
   - Verify API keys in config
   - Ensure account is funded

2. **Order Rejected**
   - Insufficient balance
   - Position size too large
   - Market volatility

3. **Bot Stops Unexpectedly**
   - Daily loss limit reached
   - Emergency stop triggered
   - API rate limits

### Emergency Procedures
- **Stop Trading**: Press Ctrl+C
- **Close Positions**: Use Hyperliquid web interface
- **Contact Support**: Hyperliquid support team

## 📞 Support

- **Hyperliquid Documentation**: [docs.hyperliquid.xyz](https://docs.hyperliquid.xyz)
- **Issue Reporting**: Create GitHub issue
- **Discord Community**: Join trading communities

---

## ⚡ READY TO START?

1. **Run Setup**: `python3 setup_real_trading.py`
2. **Test First**: `python3 micro_trader.py`
3. **Go Live**: `python3 live_micro_trader.py`

**Remember: Start small, stay safe, and never trade more than you can afford to lose!** 🎯