/**
 * Deployment Configuration for Ultimate Trading Platform
 * Supports Puter.js cloud deployment and manual deployment
 */

module.exports = {
  // Puter.js Configuration
  puter: {
    appName: 'Ultimate Trading Platform',
    appPath: '.',
    subdomain: 'ultimate-trading-platform',
    description: 'Professional algorithmic trading platform with AI-powered strategies',
    category: 'finance',
    tags: ['trading', 'cryptocurrency', 'ai', 'defi'],
    homepage: 'index.html',
    // Environment variables to set in Puter.js
    environment: {
      HYPERLIQUID_API_KEY: process.env.HYPERLIQUID_API_KEY || '',
      HYPERLIQUID_SECRET_KEY: process.env.HYPERLIQUID_SECRET_KEY || '',
      HYPERLIQUID_TESTNET: process.env.HYPERLIQUID_TESTNET || 'true',
      AI_MODEL: process.env.AI_MODEL || 'gpt-5-nano'
    },
    // Build commands
    build: {
      commands: [
        'npm run build',
        'echo "Build completed successfully"'
      ]
    },
    // Post-deployment health check
    healthCheck: {
      endpoint: '/',
      timeout: 30000
    }
  },

  // Manual Deployment Configuration
  manual: {
    server: {
      type: 'nginx',
      port: 3000,
      ssl: true,
      gzip: true,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      }
    },
    cdn: {
      enabled: true,
      provider: 'cloudflare',
      cacheTtl: 86400
    }
  },

  // Environment-specific settings
  environments: {
    development: {
      debug: true,
      websocketEndpoint: 'wss://testnet-api.hyperliquid.xyz/ws',
      apiEndpoint: 'https://testnet-api.hyperliquid.xyz/info',
      logLevel: 'debug'
    },
    staging: {
      debug: false,
      websocketEndpoint: 'wss://staging-api.hyperliquid.xyz/ws',
      apiEndpoint: 'https://staging-api.hyperliquid.xyz/info',
      logLevel: 'info'
    },
    production: {
      debug: false,
      websocketEndpoint: 'wss://api.hyperliquid.xyz/ws',
      apiEndpoint: 'https://api.hyperliquid.xyz/info',
      logLevel: 'warn'
    }
  },

  // Feature flags
  features: {
    enableAIOptimization: true,
    enableBacktesting: true,
    enablePaperTrading: true,
    enablePushNotifications: true,
    enableOfflineMode: true,
    enableMultiExchange: true
  },

  // Performance targets
  performance: {
    targetLoadTime: 2000, // ms
    targetFirstPaint: 1000, // ms
    targetTimeToInteractive: 3000, // ms
    maxBundleSize: 1024 * 1024, // 1MB
    maxCacheSize: 50 * 1024 * 1024 // 50MB
  }
};
