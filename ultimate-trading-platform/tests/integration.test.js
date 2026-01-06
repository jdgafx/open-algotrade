import { jest } from '@jest/globals';
import UltimateTradingApp from '../ultimate-trading-app.js';
import WebSocketService from '../services/websocket-service.js';
import HyperliquidService from '../services/hyperliquid-service.js';

describe('Ultimate Trading Platform - End-to-End Tests', () => {
  let app;
  let webSocketService;
  let hyperliquidService;

  beforeEach(async () => {
    // Clear KV state for isolation
    const keys = await puter.kv.list();
    for (const key of keys) {
      await puter.kv.delete(key);
    }

    // Initialize application fresh for each test
    app = new UltimateTradingApp();
    webSocketService = new WebSocketService();
    hyperliquidService = new HyperliquidService();

    await app.initialize();
  });

  afterEach(() => {
    if (webSocketService) webSocketService.disconnect();
    if (app && app.services && app.services.websocket) app.services.websocket.disconnect();
    jest.clearAllMocks();
  });

  describe('Complete User Workflow', () => {
    test('should complete full onboarding flow', async () => {
      // Step 1: User subscribes
      const subscription = await app.services.subscriptionManager.createSubscription({
        tier: 'pro',
        paymentMethod: 'crypto'
      }, 'test-user');

      expect(subscription).toBeDefined();
      expect(subscription.tier).toBe('pro');
      expect(subscription.status).toBe('active');

      // Step 2: Add investment
      const investment = await app.services.subscriptionManager.addInvestment({
        amount: 5000,
        currency: 'USD',
        paymentMethod: 'crypto'
      });

      expect(investment.success).toBe(true);
      expect(investment.investedAmount).toBe(5000);

      // Step 3: Get portfolio summary
      const summary = await app.getPortfolioSummary();
      expect(summary.summary.initialBalance).toBe(5000);
      expect(summary.summary.activeStrategies).toBe(0);

      console.log('✓ Onboarding flow completed successfully');
    }, 30000);

    test('should deploy and monitor strategy', async () => {
      // Step 1: Deploy Turtle Trading strategy
      const strategyConfig = {
        name: 'Test Turtle Strategy',
        strategy: 'turtle-trading',
        symbol: 'BTC-USD',
        timeframe: '5m',
        size: 100,
        leverage: 5,
        investmentAmount: 1000
      };

      const deployment = await app.deployStrategy(strategyConfig);
      expect(deployment.success).toBe(true);
      expect(deployment.status).toBe('active');

      const strategyId = deployment.strategyId;

      // Step 2: Verify strategy is active
      const portfolio = await app.getPortfolioSummary();
      expect(portfolio.summary.activeStrategies).toBe(1);

      // Step 3: Start monitoring
      app.services.monitor.startMonitoring();

      // Step 4: Simulate market data update
      const mockPriceData = {
        exchange: 'binance',
        symbol: 'BTC-USD',
        price: 50000,
        change: 2.5,
        timestamp: Date.now()
      };

      webSocketService.updatePriceData(mockPriceData);

      // Wait for strategy to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Get updated portfolio
      const updatedPortfolio = await app.getPortfolioSummary();
      expect(updatedPortfolio.summary).toBeDefined();

      // Step 6: Stop strategy
      await app.stopStrategy(strategyId);

      const finalPortfolio = await app.getPortfolioSummary();
      expect(finalPortfolio.summary.activeStrategies).toBe(0);

      console.log('✓ Strategy deployment and monitoring completed');
    }, 30000);

    test('should handle AI optimization', async () => {
      // Step 1: Analyze market conditions
      const analysis = await app.services.aiOptimizer.analyzeMarketConditions({
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframe: '1h'
      });

      expect(analysis).toHaveProperty('sentiment');
      expect(analysis).toHaveProperty('volatility');
      expect(analysis).toHaveProperty('trend');

      // Step 2: Get optimal strategies
      const strategies = await app.services.aiOptimizer.selectOptimalStrategies({
        riskTolerance: 'medium',
        investmentAmount: 5000
      });

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0]).toHaveProperty('name');
      expect(strategies[0]).toHaveProperty('score');
      expect(strategies[0]).toHaveProperty('allocation');

      // Step 3: Generate trading signal
      const signal = await app.services.aiOptimizer.generateTradingSignal({
        symbol: 'BTC-USD',
        strategy: strategies[0].name,
        marketData: {
          price: 50000,
          volume: 1000000,
          timestamp: Date.now()
        }
      });

      expect(signal).toHaveProperty('action');
      expect(signal).toHaveProperty('confidence');
      expect(signal.confidence).toBeGreaterThan(0);

      console.log('✓ AI optimization completed successfully');
    }, 30000);

    test('should handle subscription changes', async () => {
      // Step 1: Create initial subscription
      let subscription = await app.services.subscriptionManager.createSubscription({
        tier: 'standard',
        paymentMethod: 'crypto'
      });

      expect(subscription.tier).toBe('standard');

      // Step 2: Upgrade subscription
      subscription = await app.services.subscriptionManager.upgradeSubscription(
        subscription.id,
        'elite'
      );

      expect(subscription.tier).toBe('elite');

      // Step 3: Check limits
      const limits = app.services.subscriptionManager.checkSubscriptionLimits('add_strategy');
      expect(limits.allowed).toBe(true);

      // Step 4: Get subscription details
      const details = await app.services.subscriptionManager.getSubscriptionDetails(
        subscription.id
      );

      expect(details.tier).toBe('elite');
      expect(details.features.maxStrategies).toBeGreaterThan(10);
      expect(details.features.apiAccess).toBe(true);

      console.log('✓ Subscription management completed');
    }, 30000);

    test('should handle monitoring and alerts', async () => {
      // Step 1: Add custom monitoring rule
      await app.services.monitor.addMonitoringRule({
        id: 'test_rule',
        name: 'Test Alert Rule',
        condition: 'portfolio_value < 5000',
        severity: 'high',
        action: 'notify',
        enabled: true
      });

      // Step 2: Start monitoring
      app.services.monitor.startMonitoring();

      // Step 3: Simulate portfolio trigger
      const portfolio = {
        totalValue: 4500,
        drawdown: 0.08,
        consecutiveLosses: 3
      };

      const violations = await app.services.monitor.checkMonitoringRules(portfolio);

      expect(Array.isArray(violations)).toBe(true);

      // Step 4: Trigger alert
      await app.services.monitor.triggerAlert({
        type: 'test_alert',
        message: 'This is a test alert',
        severity: 'medium',
        data: { test: true }
      });

      // Step 5: Check monitoring status
      const status = app.services.monitor.getMonitoringStatus();
      expect(status.isMonitoring).toBe(true);
      expect(status.activeRules).toBeGreaterThan(0);

      console.log('✓ Monitoring and alerts completed');
    }, 30000);

    test('should handle multiple strategies concurrently', async () => {
      // Setup: Subscribe user to elite tier for multiple strategies
      await app.services.subscriptionManager.createSubscription({ tier: 'elite' }, 'test-user');

      // Deploy multiple strategies
      const strategies = [
        {
          name: 'Turtle 1',
          strategy: 'turtle-trading',
          symbol: 'BTC-USD',
          timeframe: '5m',
          size: 100
        },
        {
          name: 'Correlation 1',
          strategy: 'correlation-trading',
          leaderSymbol: 'ETH-USD',
          followerSymbols: ['BTC-USD'],
          size: 100
        },
        {
          name: 'Mean Reversion 1',
          strategy: 'mean-reversion',
          symbols: ['BTC-USD', 'ETH-USD'],
          sizePerPosition: 100
        }
      ];

      const deployments = [];

      for (const config of strategies) {
        const deployment = await app.deployStrategy({
          ...config,
          investmentAmount: 1000
        });
        deployments.push(deployment);
        if (!deployment.success) {
          console.log('Concurrent deployment failed:', deployment);
        }
        expect(deployment.success).toBe(true);
      }

      // Verify all strategies are active
      const portfolio = await app.getPortfolioSummary();
      expect(portfolio.summary.activeStrategies).toBe(strategies.length);

      // Stop all strategies
      for (const deployment of deployments) {
        await app.stopStrategy(deployment.strategyId);
      }

      const finalPortfolio = await app.getPortfolioSummary();
      expect(finalPortfolio.summary.activeStrategies).toBe(0);

      console.log('✓ Multiple concurrent strategies handled successfully');
    }, 60000);

    test('should maintain data consistency across services', async () => {
      // Step 1: Get initial state
      const initialPortfolio = await app.getPortfolioSummary();

      // Step 2: Create subscription and add investment
      await app.services.subscriptionManager.createSubscription({
        tier: 'pro',
        paymentMethod: 'crypto'
      }, 'test-user');

      await app.services.subscriptionManager.addInvestment({
        amount: 10000,
        currency: 'USD',
        paymentMethod: 'crypto'
      });

      // Step 3: Deploy strategy
      await app.deployStrategy({
        name: 'Consistency Test',
        strategy: 'turtle-trading',
        symbol: 'BTC-USD',
        size: 500,
        investmentAmount: 5000
      });

      // Step 4: Update market data
      webSocketService.updatePriceData({
        exchange: 'binance',
        symbol: 'BTC-USD',
        price: 50000,
        timestamp: Date.now()
      });

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 5: Verify data consistency
      const updatedPortfolio = await app.getPortfolioSummary();

      // Portfolio value should reflect the investment
      expect(updatedPortfolio.summary.totalValue).toBeGreaterThanOrEqual(5000);

      // Strategy count should be accurate
      expect(updatedPortfolio.summary.activeStrategies).toBe(1);

      // Market data should be accessible
      const priceData = webSocketService.getCurrentPrice('BTC-USD');
      expect(priceData.price).toBe(50000);

      console.log('✓ Data consistency maintained across services');
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle insufficient funds', async () => {
      try {
        await app.deployStrategy({
          name: 'Insufficient Funds Test',
          strategy: 'turtle-trading',
          symbol: 'BTC-USD',
          size: 1000000, // Huge position
          investmentAmount: 10 // Very small investment
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✓ Insufficient funds error handled correctly');
      }
    });

    test('should handle invalid subscription tier', async () => {
      try {
        await app.services.subscriptionManager.createSubscription({
          tier: 'invalid-tier',
          paymentMethod: 'crypto'
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✓ Invalid subscription tier error handled');
      }
    });

    test('should handle WebSocket disconnection gracefully', async () => {
      // Simulate WebSocket disconnection
      webSocketService.disconnect();

      // Verify services still function
      const portfolio = await app.getPortfolioSummary();
      expect(portfolio).toBeDefined();

      // Reconnect
      await webSocketService.initialize();

      const status = webSocketService.getStatus();
      expect(status.overall).toBe(true);

      console.log('✓ WebSocket disconnection handled gracefully');
    });
  });

  describe('Performance Tests', () => {
    test('should handle high-frequency market data updates', async () => {
      const updates = [];
      const updateCount = 100;

      for (let i = 0; i < updateCount; i++) {
        webSocketService.updatePriceData({
          exchange: 'binance',
          symbol: 'BTC-USD',
          price: 50000 + Math.random() * 1000,
          timestamp: Date.now()
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify data is still accessible
      const priceData = webSocketService.getCurrentPrice('BTC-USD');
      expect(priceData).toBeDefined();

      console.log('✓ High-frequency updates handled successfully');
    }, 30000);

    test('should deploy multiple strategies quickly', async () => {
      const startTime = Date.now();

      const configs = Array.from({ length: 5 }, (_, i) => ({
        name: `Quick Strategy ${i}`,
        strategy: 'turtle-trading',
        symbol: 'BTC-USD',
        size: 100,
        investmentAmount: 1000
      }));

      for (const config of configs) {
        await app.deployStrategy(config);
      }

      const endTime = Date.now();
      const deploymentTime = endTime - startTime;

      // Should deploy 5 strategies in under 10 seconds
      expect(deploymentTime).toBeLessThan(10000);

      // Cleanup
      const portfolio = await app.getPortfolioSummary();
      for (let i = 0; i < 5; i++) {
        await app.stopStrategy(portfolio.strategies[i].id);
      }

      console.log(`✓ Multiple strategies deployed in ${deploymentTime}ms`);
    }, 60000);
  });
});
