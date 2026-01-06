import {
  TurtleTradingStrategy,
  CorrelationTradingStrategy,
  MeanReversionStrategy,
  ArbitrageStrategy,
  MarketMakerStrategy
} from '../services/moondev-algorithms.js';

describe('Trading Algorithms', () => {
  let turtle;

  beforeEach(() => {
    turtle = new TurtleTradingStrategy({
      symbol: 'BTCUSDT',
      timeframe: '1h',
      tradingHoursOnly: false,
      lookbackPeriod: 20
    });
  });

  test('TurtleTradingStrategy should generate signals', async () => {
    const priceData = Array(30).fill(100).map((p, i) => ({
      symbol: 'BTCUSDT',
      close: p + i * 2, // Upward trend
      high: p + i * 2 + 1,
      low: p + i * 2 - 1,
      timestamp: Date.now() - (30 - i) * 3600000
    }));

    // Fill history
    for (let i = 0; i < 29; i++) {
      await turtle.processPriceData(priceData[i]);
    }

    const result = await turtle.processPriceData(priceData[29]);
    expect(result).toBeDefined();
    expect(result.signal).toBeDefined();
    expect(result.action).toBeDefined();
  });

  test('CorrelationTradingStrategy should detect correlation', () => {
    const strategy = new CorrelationTradingStrategy({
      leaderSymbol: 'BTCUSDT',
      followerSymbols: ['ETHUSDT']
    });
    const data = {
      'BTCUSDT': Array(20).fill(100).map((p, i) => p + i),
      'ETHUSDT': Array(20).fill(10).map((p, i) => p + i / 10)
    };
    const signal = strategy.analyzeCorrelation(data);
    expect(signal.correlation).toBeGreaterThan(0.9);
  });
});
