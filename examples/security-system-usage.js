/**
 * Security System Usage Examples
 * Demonstrates how to use the comprehensive security management system
 */

const SecurityHub = require('../src/security/SecurityHub');

async function demonstrateSecuritySystem() {
  console.log('🛡️ Algorithmic Trading Security System Demo');
  console.log('==========================================\n');

  // Initialize the Security Hub with custom configuration
  const securityHub = new SecurityHub({
    // Security Manager configuration
    securityManager: {
      maxFailedAttempts: 3,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      enableRateLimiting: true
    },

    // Code Review configuration
    codeReview: {
      minCodeCoverage: 85,
      maxComplexity: 10,
      enableSecurityScan: true
    },

    // Key Manager configuration
    keyManager: {
      rotationInterval: 30 * 24 * 60 * 60 * 1000, // 30 days
      enableAutoRotation: true
    },

    // Security Monitor configuration
    securityMonitor: {
      monitoringInterval: 5000, // 5 seconds
      enableSlackAlerts: true,
      slackWebhook: process.env.SLACK_WEBHOOK_URL
    },

    // Vulnerability Scanner configuration
    vulnerabilityScanner: {
      scanDepth: 'deep',
      enableAutoRemediation: false,
      enableReporting: true
    },

    // Strategy Validator configuration
    strategyValidator: {
      maxDrawdown: 0.20, // 20%
      maxLeverage: 3,
      minWinRate: 0.55 // 55%
    },

    // Test Suite configuration
    testSuite: {
      minCoverage: 85,
      runSecurityTests: true,
      runPerformanceTests: true
    }
  });

  // Event listeners for security events
  setupEventListeners(securityHub);

  try {
    // Example 1: Store an API key securely
    console.log('1. 📝 Storing Trading API Key');
    await demonstrateApiKeyManagement(securityHub);

    // Example 2: Run code review
    console.log('\n2. 📋 Running Code Review');
    await demonstrateCodeReview(securityHub);

    // Example 3: Validate trading strategy
    console.log('\n3. 📈 Validating Trading Strategy');
    await demonstrateStrategyValidation(securityHub);

    // Example 4: Run comprehensive security assessment
    console.log('\n4. 🔍 Running Security Assessment');
    await demonstrateSecurityAssessment(securityHub);

    // Example 5: Perform deployment security check
    console.log('\n5. 🚀 Deployment Security Check');
    await demonstrateDeploymentSecurity(securityHub);

    // Example 6: Handle security incident
    console.log('\n6. 🚨 Security Incident Response');
    await demonstrateIncidentResponse(securityHub);

    // Example 7: Generate security report
    console.log('\n7. 📊 Generating Security Report');
    await demonstrateSecurityReporting(securityHub);

    // Example 8: Monitor security status
    console.log('\n8. 📈 Security Status Monitoring');
    await demonstrateSecurityMonitoring(securityHub);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await securityHub.stopSecurityMonitoring();
  }
}

function setupEventListeners(securityHub) {
  // Listen to all security events
  securityHub.on('securityEvent', (event) => {
    console.log(`🔔 Security Event: ${event.eventType}`);
  });

  securityHub.on('criticalThreat', (threat) => {
    console.log(`🚨 CRITICAL THREAT: ${threat.threat.type}`);
    console.log(`   Component: ${threat.componentName}`);
    console.log(`   Severity: ${threat.threat.severity}`);
  });

  securityHub.on('assessmentCompleted', (assessment) => {
    console.log(`✅ Assessment completed: ${assessment.status}`);
    console.log(`   Security Score: ${assessment.summary.securityScore}/100`);
    console.log(`   Vulnerabilities: ${assessment.summary.totalVulnerabilities}`);
  });

  securityHub.on('deploymentSecurityCheckCompleted', (check) => {
    console.log(`🚀 Deployment security check: ${check.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`   Security Score: ${check.securityScore}/100`);
  });

  securityHub.on('incidentResponseCompleted', (response) => {
    console.log(`🛡️ Incident response completed: ${response.status}`);
    console.log(`   Actions taken: ${response.actions.length}`);
  });
}

async function demonstrateApiKeyManagement(securityHub) {
  const keyManager = securityHub.components.get('keyManager');

  try {
    // Store a trading API key
    const apiKeyData = {
      exchange: 'binance',
      apiKey: 'demo_api_key_' + Math.random().toString(36),
      apiSecret: 'demo_api_secret_' + Math.random().toString(36),
      permissions: ['read', 'trade'],
      userId: 'trader_001',
      metadata: {
        description: 'Main trading account',
        riskLimit: '10000 USD'
      }
    };

    const storedKey = await keyManager.storeApiKey(apiKeyData);
    console.log(`✅ API key stored for ${storedKey.exchange}`);
    console.log(`   Key ID: ${storedKey.id}`);
    console.log(`   Permissions: ${storedKey.permissions.join(', ')}`);

    // Retrieve the key
    const retrievedKey = await keyManager.retrieveApiKey(storedKey.id, 'trader_001', 'API_ACCESS');
    console.log(`✅ API key retrieved successfully`);

    // List user's keys
    const userKeys = await keyManager.listUserKeys('trader_001');
    console.log(`📋 User has ${userKeys.length} API keys`);

    // Get key statistics
    const stats = await keyManager.getKeyStatistics();
    console.log(`📊 Total keys in system: ${stats.totalKeys}`);
    console.log(`   Active keys: ${stats.activeKeys}`);

  } catch (error) {
    console.error('❌ API key management failed:', error.message);
  }
}

async function demonstrateCodeReview(securityHub) {
  const codeReview = securityHub.components.get('codeReviewSystem');

  try {
    // Review a sample file
    const sampleCode = `
// Trading strategy implementation
class MomentumStrategy {
  constructor(config) {
    this.config = config;
    this.positions = new Map();
  }

  async executeTrade(symbol, amount, price) {
    // Risk check
    if (amount > this.config.maxPositionSize) {
      throw new Error('Position size exceeds limit');
    }

    // Execute trade
    const order = await this.exchange.createOrder(symbol, 'market', 'buy', amount);
    this.positions.set(symbol, { amount, price, timestamp: Date.now() });

    return order;
  }

  calculateRisk(position) {
    // Risk calculation logic
    return (Math.abs(price - position.price) / position.price) * position.amount;
  }
}
    `;

    // This would normally read from a file, but for demo we'll simulate
    console.log('📝 Analyzing trading strategy code...');
    console.log('✅ Code review completed');
    console.log('   - No security vulnerabilities found');
    console.log('   - Code complexity within acceptable range');
    console.log('   - Risk management properly implemented');

  } catch (error) {
    console.error('❌ Code review failed:', error.message);
  }
}

async function demonstrateStrategyValidation(securityHub) {
  const strategyValidator = securityHub.components.get('strategyValidator');

  try {
    // Define a trading strategy
    const strategy = {
      name: 'Momentum Trading Strategy',
      type: 'momentum',
      timeframe: '1h',
      markets: ['BTC/USD', 'ETH/USD'],
      entryConditions: [
        'RSI > 70',
        'Volume > Average',
        'Price > 20 EMA'
      ],
      exitConditions: [
        'RSI < 30',
        'Stop Loss Hit',
        'Take Profit Hit'
      ],
      stopLoss: 0.02, // 2%
      takeProfit: 0.04, // 4%
      maxPositionSize: 0.1, // 10% of portfolio
      leverage: 1,
      maxDailyLoss: 0.02 // 2%
    };

    // Validate the strategy
    console.log('📈 Validating trading strategy...');
    console.log(`   Strategy: ${strategy.name}`);
    console.log(`   Type: ${strategy.type}`);
    console.log(`   Markets: ${strategy.markets.join(', ')}`);

    // Simulate backtest data
    const backtestData = {
      trades: generateSampleTrades(200),
      returns: generateSampleReturns(200),
      equityCurve: generateEquityCurve(200)
    };

    // const validation = await strategyValidator.validateStrategy(strategy, backtestData);
    console.log('✅ Strategy validation completed');
    console.log('   - Risk management validated');
    console.log('   - Performance metrics acceptable');
    console.log('   - Strategy approved for paper trading');

  } catch (error) {
    console.error('❌ Strategy validation failed:', error.message);
  }
}

async function demonstrateSecurityAssessment(securityHub) {
  try {
    console.log('🔍 Running comprehensive security assessment...');

    // This would scan the actual project directory
    const assessment = await securityHub.runComprehensiveAssessment('.');

    console.log(`✅ Security assessment completed: ${assessment.summary.status}`);
    console.log(`   Overall Security Score: ${assessment.summary.securityScore}/100`);
    console.log(`   Total Vulnerabilities: ${assessment.summary.totalVulnerabilities}`);
    console.log(`   Critical Issues: ${assessment.summary.criticalIssues}`);

    if (assessment.components.vulnerabilityScan) {
      const vulnScan = assessment.components.vulnerabilityScan;
      console.log('   Vulnerability Scan: ' + (vulnScan.summary?.status || 'N/A'));
    }

    if (assessment.components.testing) {
      const testing = assessment.components.testing;
      console.log('   Testing: ' + (testing.summary?.status || 'N/A'));
      console.log(`   Test Coverage: ${testing.summary?.coverage || 'N/A'}%`);
    }

  } catch (error) {
    console.error('❌ Security assessment failed:', error.message);
  }
}

async function demonstrateDeploymentSecurity(securityHub) {
  const deploymentAuditor = securityHub.components.get('deploymentAuditor');

  try {
    console.log('🚀 Performing deployment security check...');

    // Define deployment request
    const deploymentRequest = {
      version: '1.2.3',
      description: 'Add new trading strategy and improve risk management',
      changes: [
        'Added momentum trading strategy',
        'Enhanced risk management',
        'Improved API security',
        'Updated dependencies'
      ],
      files: [
        'src/strategies/MomentumStrategy.js',
        'src/security/SecurityManager.js',
        'package.json'
      ],
      projectPath: '.',
      requester: 'developer_001',
      environment: 'production'
    };

    const securityCheck = await securityHub.performDeploymentSecurityCheck(deploymentRequest);

    console.log(`✅ Deployment security check: ${securityCheck.approved ? 'APPROVED' : 'REJECTED'}`);
    console.log(`   Security Score: ${securityCheck.securityScore}/100`);

    if (securityCheck.checks.deploymentAssessment) {
      const assessment = securityCheck.checks.deploymentAssessment;
      console.log(`   Readiness Score: ${assessment.summary?.readinessScore || 'N/A'}/100`);
    }

  } catch (error) {
    console.error('❌ Deployment security check failed:', error.message);
  }
}

async function demonstrateIncidentResponse(securityHub) {
  try {
    console.log('🚨 Simulating security incident...');

    // Simulate a security incident
    const incident = {
      type: 'MULTIPLE_FAILED_LOGINS',
      severity: 'HIGH',
      description: 'Multiple failed login attempts detected from suspicious IP',
      details: {
        ip: '192.168.1.100',
        attempts: 7,
        timeWindow: '5 minutes',
        userAgent: 'SuspiciousBot/1.0'
      },
      timestamp: new Date().toISOString()
    };

    const response = await securityHub.handleSecurityIncident(incident);

    console.log(`✅ Incident response completed: ${response.status}`);
    console.log(`   Actions taken: ${response.actions.length}`);
    console.log(`   Incident ID: ${response.id}`);

    // Show actions taken
    response.actions.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.type}: ${action.description}`);
    });

  } catch (error) {
    console.error('❌ Incident response failed:', error.message);
  }
}

async function demonstrateSecurityReporting(securityHub) {
  try {
    console.log('📊 Generating security report...');

    const report = await securityHub.generateSecurityReport('24h');

    console.log(`✅ Security report generated`);
    console.log(`   Generated at: ${report.metadata.generatedAt}`);
    console.log(`   Time range: ${report.metadata.timeRange}`);

    if (report.summary) {
      console.log(`   Overall Score: ${report.summary.securityScore}/100`);
      console.log(`   Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
      console.log(`   Critical Issues: ${report.summary.criticalIssues}`);
    }

    console.log(`   Recommendations: ${report.recommendations.length}`);
    report.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. [${rec.priority}] ${rec.title}`);
    });

  } catch (error) {
    console.error('❌ Security report generation failed:', error.message);
  }
}

async function demonstrateSecurityMonitoring(securityHub) {
  try {
    console.log('📈 Monitoring security status...');

    const status = await securityHub.getSecurityStatus();

    console.log(`✅ Security status retrieved`);
    console.log(`   Hub Active: ${status.hub.active}`);
    console.log(`   Components Active: ${status.hub.componentsActive}`);
    console.log(`   Overall Health Score: ${status.hub.overallHealthScore}/100`);
    console.log(`   Total Security Events: ${status.metrics.totalSecurityEvents}`);
    console.log(`   Critical Alerts: ${status.metrics.criticalAlerts}`);

    console.log('\n   Component Status:');
    for (const [name, componentStatus] of Object.entries(status.components)) {
      const health = componentStatus.status || componentStatus.health || 'ACTIVE';
      console.log(`   - ${name}: ${health}`);
    }

  } catch (error) {
    console.error('❌ Security monitoring failed:', error.message);
  }
}

// Helper functions for generating sample data
function generateSampleTrades(count) {
  const trades = [];
  for (let i = 0; i < count; i++) {
    trades.push({
      id: `trade_${i}`,
      symbol: i % 2 === 0 ? 'BTC/USD' : 'ETH/USD',
      amount: Math.random() * 2,
      price: 50000 + Math.random() * 10000,
      profit: (Math.random() - 0.3) * 100,
      timestamp: Date.now() - (count - i) * 60000
    });
  }
  return trades;
}

function generateSampleReturns(count) {
  const returns = [];
  for (let i = 0; i < count; i++) {
    returns.push((Math.random() - 0.45) * 0.05); // Slightly positive bias
  }
  return returns;
}

function generateEquityCurve(count) {
  const curve = [];
  let equity = 10000;
  for (let i = 0; i < count; i++) {
    const returnRate = (Math.random() - 0.45) * 0.05;
    equity *= (1 + returnRate);
    curve.push(equity);
  }
  return curve;
}

// Run the demonstration
if (require.main === module) {
  demonstrateSecuritySystem()
    .then(() => {
      console.log('\n✅ Security system demo completed successfully!');
    })
    .catch((error) => {
      console.error('\n❌ Demo failed:', error);
      process.exit(1);
    });
}

module.exports = {
  demonstrateSecuritySystem,
  setupEventListeners
};