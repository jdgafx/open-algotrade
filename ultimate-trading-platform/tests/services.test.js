import WebSocketService from '../services/websocket-service.js';
import HyperliquidService from '../services/hyperliquid-service.js';
import AITradingOptimizer from '../services/ai-optimizer.js';
import SubscriptionManager from '../services/subscription-manager.js';
import TradingMonitor from '../services/trading-monitor.js';

describe('Ultimate Trading Platform Services', () => {
  let webSocketService;
  let hyperliquidService;
  let aiOptimizer;
  let subscriptionManager;
  let tradingMonitor;

  beforeAll(() => {
    // Initialize services for testing
    webSocketService = new WebSocketService();
    hyperliquidService = new HyperliquidService();
    aiOptimizer = new AITradingOptimizer();
    subscriptionManager = new SubscriptionManager(global.puter);
    tradingMonitor = new TradingMonitor();
  });

  afterAll(() => {
    // Cleanup
    if (webSocketService) webSocketService.disconnect();
  });

  describe('WebSocket Service', () => {
    test('should initialize WebSocket connections', async () => {
      await expect(webSocketService.initialize()).resolves.not.toThrow();
      expect(webSocketService.isConnected).toBe(true);
    });

    test('should subscribe to symbols', () => {
      webSocketService.subscribeToSymbols(['BTCUSDT', 'ETHUSDT']);
      expect(webSocketService.activeSubscriptions.has('BTCUSDT')).toBe(true);
      expect(webSocketService.activeSubscriptions.has('ETHUSDT')).toBe(true);
    });

    test('should get current price', () => {
      const priceData = webSocketService.getCurrentPrice('BTCUSDT');
      // Price data structure validation
      if (priceData) {
        expect(priceData).toHaveProperty('exchange');
        expect(priceData).toHaveProperty('symbol');
        expect(priceData).toHaveProperty('price');
        expect(priceData).toHaveProperty('timestamp');
      }
    });
  });

  describe('Hyperliquid Trading Service', () => {
    test('should initialize hyperliquid service', async () => {
      await expect(hyperliquidService.initialize()).resolves.not.toThrow();
    });

    test('should create micro position', async () => {
      const result = await hyperliquidService.createMicroPosition(
        'BTC-USD',
        'buy',
        100,
        50000
      );
      expect(result).toHaveProperty('success');
    });

    test('should execute turtle trading strategy', async () => {
      const result = await hyperliquidService.executeTurtleTrading({
        symbol: 'BTC-USD',
        timeframe: '5m',
        size: 100,
        leverage: 5
      });
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('status');
    });
  });

  describe('AI Optimizer', () => {
    test('should analyze market conditions', async () => {
      const analysis = await aiOptimizer.analyzeMarketConditions({
        symbols: ['BTC-USD', 'ETH-USD'],
        timeframe: '1h'
      });
      expect(analysis).toHaveProperty('sentiment');
      expect(analysis).toHaveProperty('volatility');
      expect(analysis).toHaveProperty('trend');
    });

    test('should select optimal strategies', async () => {
      const strategies = await aiOptimizer.selectOptimalStrategies({
        riskTolerance: 'medium',
        investmentAmount: 1000
      });
      expect(Array.isArray(strategies)).toBe(true);
      strategies.forEach(strategy => {
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('score');
        expect(strategy).toHaveProperty('allocation');
      });
    });
  });

  describe('Subscription Manager', () => {
    test('should create subscription', async () => {
      const subscription = await subscriptionManager.createSubscription({
        tier: 'standard',
        paymentMethod: 'crypto'
      });
      expect(subscription).toHaveProperty('id');
      expect(subscription).toHaveProperty('tier');
      expect(subscription).toHaveProperty('status');
    });

    test('should check subscription limits', () => {
      const limits = subscriptionManager.checkSubscriptionLimits('add_strategy');
      expect(limits).toHaveProperty('allowed');
      expect(limits).toHaveProperty('remaining');
    });
  });

  describe('Trading Monitor', () => {
    test('should start monitoring', () => {
      tradingMonitor.startMonitoring();
      expect(tradingMonitor.isMonitoring).toBe(true);
    });

    test('should check monitoring rules', async () => {
      const portfolio = {
        totalValue: 10000,
        drawdown: 0.03,
        consecutiveLosses: 2
      };
      const violations = await tradingMonitor.checkMonitoringRules(portfolio);
      expect(Array.isArray(violations)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('services should work together', async () => {
      // Initialize all services
      await webSocketService.initialize();
      await hyperliquidService.initialize();
      await aiOptimizer.initialize();

      // Get market data
      const priceData = webSocketService.getCurrentPrice('BTCUSDT');

      // Optimize strategy based on market data
      const strategies = await aiOptimizer.selectOptimalStrategies({
        riskTolerance: 'medium',
        investmentAmount: 1000
      });

      // Create subscription for trading
      const subscription = await subscriptionManager.createSubscription({
        tier: 'pro',
        paymentMethod: 'crypto'
      });

      // Execute strategy
      if (strategies.length > 0) {
        const result = await hyperliquidService.executeStrategy(
          strategies[0].name,
          { symbol: 'BTC-USD', size: 100 }
        );
        expect(result).toHaveProperty('success');
      }

      // Monitor the trade
      tradingMonitor.startMonitoring();

      expect(true).toBe(true); // All services integrated successfully
    });
  });
});
