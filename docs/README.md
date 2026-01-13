# Kairos Algo Trading System

🚀 **High-Performance Cryptocurrency Trading with Advanced AI Strategies**

A sophisticated, multi-strategy trading system built for Hyperliquid with millisecond execution capabilities.

## 🎯 Features

### Trading Strategies
- **Market Making**: Advanced bid-ask spread optimization with dynamic positioning
- **Turtle Trading**: Classic 55-bar breakout with ATR-based risk management
- **Correlation Trading**: ETH-leading arbitrage across multiple cryptocurrencies
- **Mean Reversion**: Statistical arbitrage across 20+ digital assets
- **High-Frequency Arbitrage**: Triangular, statistical, and latency arbitrage

### Core Capabilities
- ⚡ **Sub-100ms Execution**: Optimized for high-frequency trading
- 🛡️ **Advanced Risk Management**: Multi-layer protection with kill switches
- 📊 **Real-time Monitoring**: Performance tracking with comprehensive metrics
- 🚨 **Smart Alerts**: Discord notifications for critical events
- 🔧 **Dynamic Position Sizing**: Risk-adjusted allocation algorithms
- 📈 **Performance Analytics**: Sharpe ratio, Sortino ratio, Calmar ratio tracking

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Trading Engine                          │
├─────────────────────────────────────────────────────────────┤
│  Strategy Manager      │    Risk Manager   │   Monitor     │
├─────────────────────────────────────────────────────────────┤
│ Market Maker │ Turtle │ Correlation │ Mean Reversion │ Arb  │
├─────────────────────────────────────────────────────────────┤
│              Hyperliquid API Client                        │
├─────────────────────────────────────────────────────────────┤
│              WebSocket Streaming                             │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Hyperliquid API credentials
- Redis (optional, for caching)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/kairos-algotrade.git
cd kairos-algotrade

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup configuration
cp config.example.json config.json
# Edit config.json with your API credentials
```

### Configuration

Edit `config.json` with your settings:

```json
{
  "hyperliquid_api_key": "your_api_key",
  "hyperliquid_secret_key": "your_secret_key",
  "sandbox_mode": true,
  "max_portfolio_risk": "10000",
  "enable_market_making": true,
  "enable_turtle_trading": true,
  "discord_webhook_url": "your_discord_webhook_url"
}
```

### Running the System

```bash
# Test API connection
python main.py --test-api --sandbox

# Run in sandbox mode (recommended)
python main.py --config config.json --sandbox

# Run in live mode (REAL MONEY)
python main.py --config config.json --live

# Run backtesting
python main.py --backtest
```

## 📊 Trading Strategies

### Market Making
- Multi-level order placement (3 price levels)
- Dynamic spread adjustment based on volatility
- ATR-based position sizing
- Kill switch protection
- Inventory management

### Turtle Trading
- 55-bar breakout signals
- 2x ATR stop losses
- 0.2% take profit targets
- Time-based trading hours (9:30 AM - 4:00 PM ET)
- Friday position exits

### Correlation Trading
- ETH as leader cryptocurrency
- Lag detection across BTC, SOL, ADA, DOT, MATIC, AVAX
- Minimum 70% correlation threshold
- 0.2% stop loss, 0.25% take profit

### Mean Reversion
- 20-period SMA with 2-standard deviation bands
- Statistical arbitrage across 20+ symbols
- Correlation filtering to avoid overexposure
- Volatility-adjusted position sizing

### High-Frequency Arbitrage
- Triangular arbitrage (A→B→C→A)
- Statistical pairs trading
- Latency arbitrage (sub-50ms execution)
- Cross-exchange opportunities

## 🛡️ Risk Management

### Global Controls
- Maximum portfolio risk: $10,000 (configurable)
- Daily loss limits: $2,000 (configurable)
- Maximum drawdown protection: 15%
- Emergency stop systems
- Real-time monitoring

### Position-Level Controls
- ATR-based stop losses
- Time-based exits
- Correlation filtering
- Volatility thresholds
- Maximum position sizes

## 📈 Performance Monitoring

### Metrics Tracked
- Total PnL and daily PnL
- Win rate and trade count
- Sharpe ratio, Sortino ratio, Calmar ratio
- Maximum drawdown tracking
- Execution speed metrics
- Strategy attribution

### Alert System
- Discord webhook notifications
- Email alerts (optional)
- Performance threshold alerts
- Risk management alerts
- System health monitoring

## 🔧 Advanced Features

### High-Frequency Execution
- Async/await architecture for maximum throughput
- WebSocket streaming for real-time data
- Intelligent order routing
- Slippage protection
- Rate limiting

### Performance Optimization
- Memory-efficient data structures
- Caching mechanisms
- Parallel strategy execution
- Garbage collection optimization
- CPU usage monitoring

## 📁 Project Structure

```
kairos-algotrade/
├── src/
│   ├── engine/
│   │   └── trading_engine.py      # Main orchestration
│   ├── strategies/
│   │   ├── market_maker.py        # Market making strategy
│   │   ├── turtle_trading.py      # Turtle trading strategy
│   │   ├── correlation_trading.py # Correlation strategy
│   │   ├── mean_reversion.py      # Mean reversion strategy
│   │   └── arbitrage.py           # Arbitrage strategies
│   ├── utils/
│   │   └── hyperliquid_client.py  # Exchange API client
│   └── monitoring/
│       ├── performance_monitor.py # Performance tracking
│       └── alert_system.py        # Alert management
├── data/
│   ├── performance/               # Performance data
│   ├── trades/                   # Trade history
│   └── market_data/              # Market data cache
├── logs/                         # System logs
├── tests/                        # Unit tests
├── main.py                       # Entry point
├── config.example.json          # Configuration template
└── requirements.txt             # Dependencies
```

## ⚠️ Risk Disclaimer

**This is high-risk trading software. Cryptocurrency trading involves substantial risk of loss and is not suitable for all investors.**

- Always start in sandbox mode
- Never risk more than you can afford to lose
- Monitor positions closely
- Understand each strategy before deploying
- Keep emergency stop mechanisms active

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@kairos-trading.com
- 💬 Discord: [Join our community](https://discord.gg/kairos)
- 📖 Documentation: [Wiki](https://github.com/your-repo/kairos-algotrade/wiki)

---

**⚡ Built by traders, for traders. Trade responsibly.**