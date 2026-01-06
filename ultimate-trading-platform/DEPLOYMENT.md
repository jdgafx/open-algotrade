# Deployment Guide - Ultimate Trading Platform

## Quick Start

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager
- Modern web browser with WebSocket support
- Internet connection for real-time data

### Option 1: Deploy to Puter.js (Recommended)

```bash
# 1. Navigate to project directory
cd ultimate-trading-platform

# 2. Install dependencies
npm install

# 3. Run deployment script
./scripts/deploy.sh

# Your app will be available at:
# https://app.puter.com/[username]/ultimate-trading-platform
```

### Option 2: Manual Deployment

```bash
# 1. Build for production
npm run build

# 2. Deploy to your web server
# Copy contents of dist/ to your web server's document root
```

---

## Detailed Deployment Steps

### 1. Environment Setup

#### Install Puter.js CLI (Cloud Deployment)
```bash
npm install -g puter
```

#### Login to Puter.js
```bash
puter auth login
```

#### Verify Installation
```bash
puter --version
```

### 2. Configuration

#### Copy Configuration Template
```bash
cp config/settings.example.json config/settings.json
```

#### Edit Configuration
```bash
# Edit config/settings.json with your API keys
nano config/settings.json
```

**Required Configuration:**
```json
{
  "hyperliquid": {
    "apiKey": "your_hyperliquid_api_key",
    "secretKey": "your_hyperliquid_secret_key",
    "isTestnet": true
  }
}
```

**Get Hyperliquid API Keys:**
1. Visit [Hyperliquid](https://hyperliquid.xyz)
2. Create account or login
3. Navigate to API settings
4. Generate new API key and secret
5. Enable trading permissions
6. Copy keys to configuration

### 3. Build Project

#### Install Dependencies
```bash
npm install
```

#### Run Linting
```bash
npm run lint
```

#### Run Tests
```bash
npm test
```

#### Build for Production
```bash
npm run build
```

This creates optimized files in `dist/` directory.

### 4. Deploy

#### Deploy to Puter.js
```bash
# Simple deployment
./scripts/deploy.sh

# With options
./scripts/deploy.sh --target puter

# Skip tests
./scripts/deploy.sh --skip-tests
```

#### Manual Deployment
```bash
# Build project
npm run build

# Copy dist/ contents to your web server
scp -r dist/* user@your-server:/var/www/html/

# Or use rsync
rsync -avz dist/ user@your-server:/var/www/html/
```

### 5. Verify Deployment

#### Check Application Loads
```bash
# In browser, navigate to your deployed URL
# You should see the Ultimate Trading Platform dashboard
```

#### Verify WebSocket Connections
1. Open browser DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Look for WebSocket connections to:
   - `wss://stream.binance.com:9443/ws/`
   - `wss://ws-feed.exchange.coinbase.com`
   - `wss://api.hyperliquid.xyz/ws`

#### Check Console for Errors
1. Open DevTools Console
2. Look for errors (red text)
3. Should see success messages like:
   - "✅ WebSocket service initialized"
   - "🚀 Ultimate Trading Platform ready"

---

## Deployment Configurations

### Development
```bash
npm run dev
```
- Runs local development server
- Hot reloading enabled
- Detailed logging
- Testnet mode

### Staging
```bash
npm run build
npm run start
```
- Production build
- Optimized assets
- Connected to testnet

### Production
```bash
./scripts/deploy.sh
```
- Full cloud deployment
- Production API endpoints
- Optimized performance

---

## Deployment Options

### Puter.js (Cloud - Recommended)

**Benefits:**
- Zero-cost hosting
- Automatic HTTPS
- Global CDN
- Easy deployment
- Built-in monitoring

**Requirements:**
- Puter.js account (free)
- Internet connection
- No server management needed

**Steps:**
```bash
./scripts/deploy.sh
```

### Manual Server Deployment

**Benefits:**
- Full control
- Custom domain
- Your own infrastructure

**Requirements:**
- Web server (Nginx, Apache, etc.)
- HTTPS certificate
- Node.js runtime (optional)

**Web Server Configuration:**

#### Nginx
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;

    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### Apache
```apache
<VirtualHost *:443>
    ServerName your-domain.com
    DocumentRoot /var/www/html

    SSLEngine on
    SSLCertificateFile /path/to/certificate.pem
    SSLCertificateKeyFile /path/to/private-key.pem

    <Directory /var/www/html>
        Options -Indexes
        AllowOverride All
        Require all granted
    </Directory>

    # WebSocket proxy
    ProxyPass /ws ws://localhost:3000/
    ProxyPassReverse /ws ws://localhost:3000/
</VirtualHost>
```

---

## Environment Variables

### Puter.js Deployment
Set environment variables in Puter.js dashboard or via CLI:

```bash
puter env set HYPERLIQUID_API_KEY your_key
puter env set HYPERLIQUID_SECRET_KEY your_secret
puter env set HYPERLIQUID_TESTNET true
```

### Manual Deployment
Create `.env` file:
```bash
HYPERLIQUID_API_KEY=your_key
HYPERLIQUID_SECRET_KEY=your_secret
HYPERLIQUID_TESTNET=true
AI_MODEL=gpt-5-nano
```

Or set via shell:
```bash
export HYPERLIQUID_API_KEY=your_key
export HYPERLIQUID_SECRET_KEY=your_secret
```

---

## Troubleshooting

### Build Errors

**"Cannot find module"**
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**"ESLint errors"**
```bash
# Solution: Auto-fix common issues
npm run lint -- --fix
```

**"Jest tests failing"**
```bash
# Check test output
npm test -- --verbose

# Skip tests (not recommended for production)
npm run build -- --skip-tests
```

### Deployment Errors

**"Puter.js authentication failed"**
```bash
# Solution: Re-login
puter auth logout
puter auth login
```

**"API key invalid"**
```bash
# Verify API keys in config/settings.json
# Ensure testnet/production matches your account
```

**"WebSocket connection failed"**
```bash
# Check firewall settings
# Ensure port 443 (HTTPS) is open
# Verify WebSocket URLs in config
```

### Runtime Errors

**"Service worker not updating"**
```javascript
// Clear browser cache
// Or use DevTools > Application > Storage > Clear storage
```

**"Real-time data not updating"**
```javascript
// Check WebSocket connections in DevTools Network tab
// Refresh page to reconnect
```

**"Strategy not executing trades"**
```javascript
// Verify subscription tier allows trading
// Check account balance
// Review strategy parameters
```

---

## Post-Deployment

### 1. Initial Setup

#### Create Account
1. Visit deployed application
2. Click "Sign Up"
3. Complete registration
4. Verify email (if required)

#### Select Subscription Tier
| Tier | Min Investment | Max Investment | Monthly Fee |
|------|---------------|----------------|-------------|
| Micro | $0.25 | $10 | $0 |
| Standard | $100 | $1,000 | $29 |
| Pro | $1,000 | $10,000 | $99 |
| Elite | $10,000 | $100,000 | $299 |

#### Configure API Keys
1. Go to Settings
2. Click "Exchange Integration"
3. Enter Hyperliquid API credentials
4. Test connection
5. Save settings

### 2. Deploy First Strategy

#### Turtle Trading (Recommended for Beginners)
```javascript
{
  name: "My First Strategy",
  strategy: "turtle-trading",
  symbol: "BTC-USD",
  timeframe: "5m",
  size: 100,
  leverage: 5
}
```

#### Deploy Strategy
1. Go to Strategies section
2. Click "Deploy New Strategy"
3. Select strategy type
4. Configure parameters
5. Set investment amount
6. Click "Deploy"

### 3. Monitor Performance

#### Dashboard Overview
- Real-time P&L
- Active strategies
- Portfolio value
- Performance metrics

#### Alerts
- Configure alert preferences
- Set notification channels
- Test alert system

---

## Performance Optimization

### Production Build

#### Minification
```bash
# JavaScript minification
uglifyjs ultimate-trading-app.js -o ultimate-trading-app.min.js

# CSS minification
cleancss -o assets/styles.min.css assets/styles.css
```

#### Compression
Enable gzip on your web server:
```nginx
# Nginx
gzip on;
gzip_types text/css application/javascript application/json;
```

#### Caching
```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### CDN Setup

#### Cloudflare (Free)
1. Sign up for Cloudflare
2. Add your domain
3. Update nameservers
4. Enable CDN

#### Configuration
```javascript
// In config/deployment.config.js
cdn: {
  enabled: true,
  provider: 'cloudflare',
  cacheTtl: 86400
}
```

---

## Security Considerations

### HTTPS Required
- All production deployments must use HTTPS
- WebSocket connections require WSS (WebSocket Secure)
- API calls must use HTTPS

### API Keys
- Store API keys securely
- Never commit keys to version control
- Use environment variables
- Rotate keys regularly

### Permissions
- Limit API key permissions
- Enable only necessary features
- Monitor API usage

### Firewall
- Restrict server access
- Allow only necessary ports (80, 443)
- Use fail2ban for intrusion prevention

---

## Monitoring

### Application Monitoring

#### Built-in Monitoring
```javascript
// Access monitoring dashboard
// URL: /index.html#monitoring
```

#### Key Metrics
- Active connections
- Request rate
- Error rate
- Response time

### Uptime Monitoring

#### Pingdom (Free Tier Available)
```bash
# Monitor your deployment URL
# Set up alerts for downtime
```

#### UptimeRobot (Free)
```bash
# Monitor HTTPS endpoint
# Get notified of issues
```

---

## Backup and Recovery

### Configuration Backup
```bash
# Backup config files
tar -czf backup-$(date +%Y%m%d).tar.gz config/
```

### Data Backup
```javascript
// Export portfolio data
const data = await app.getPortfolioSummary();
localStorage.setItem('backup', JSON.stringify(data));
```

### Recovery
```bash
# Restore from backup
tar -xzf backup-20240101.tar.gz
```

---

## Scaling

### Horizontal Scaling
- Load balancer setup
- Multiple server instances
- Session management

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Cache frequently accessed data

### Performance Targets
- Page load: < 2 seconds
- WebSocket latency: < 100ms
- Uptime: 99.9%
- Throughput: 1000+ requests/minute

---

## Support

### Documentation
- [API Reference](./API.md)
- [README.md](./README.md)
- [Examples](./examples/)

### Community
- Discord: [Join our server]
- GitHub Issues: [Report bugs]
- Email: support@tradingplatform.com

### Professional Support
- Priority support for Elite tier
- Custom deployment assistance
- Integration help

---

## Changelog

### Version 1.0.0
- Initial release
- 6 trading strategies
- WebSocket real-time data
- AI optimization
- PWA capabilities
- 4 subscription tiers
- Hyperliquid DEX integration

---

**Built with ❤️ by the Ultimate Trading Platform Team**

For more information, visit: https://tradingplatform.com
