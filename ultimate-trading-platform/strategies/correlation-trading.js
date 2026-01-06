/**
 * Correlation Trading Strategy
 * Pair trading and correlation-based strategy
 */

class CorrelationTradingStrategy {
  constructor(config = {}) {
    this.name = 'Correlation Trading';
    this.minPositionUsd = 0.25; // CRITICAL
    this.config = {
      correlationPeriod: config.correlationPeriod || 50,
      entryThreshold: config.entryThreshold || 2.0, // Standard deviations
      exitThreshold: config.exitThreshold || 0.5,
      lookbackPeriod: config.lookbackPeriod || 100,
      minCorrelation: config.minCorrelation || 0.7,
      zScorePeriod: config.zScorePeriod || 20,
      hedgeRatioPeriod: config.hedgeRatioPeriod || 50,
      riskPerTrade: config.riskPerTrade || 0.02,
      ...config
    };
    this.pairs = new Map();
    this.positions = new Map();
  }

  /**
   * Initialize strategy with market data
   */
  initialize(marketData) {
    this.marketData = marketData;
    this.positions = new Map();
    this.trades = [];
    this.signals = [];
    this.pairData = new Map();
  }

  /**
   * Generate trading signal based on correlation
   */
  generateSignal(candles, indicators) {
    if (candles.length < this.config.lookbackPeriod) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const primaryPrice = candles[candles.length - 1].close;
    const correlation = indicators.correlation || this.calculateCorrelation(candles);
    const zScore = indicators.zScore || this.calculateZScore(candles);
    const hedgeRatio = indicators.hedgeRatio || this.calculateHedgeRatio(candles);

    if (!correlation || Math.abs(correlation) < this.config.minCorrelation) {
      return { signal: 'HOLD', confidence: 0, reason: 'Correlation too low' };
    }

    // Strong long pair signal: Spread significantly below mean
    if (zScore < -this.config.entryThreshold) {
      return {
        signal: 'LONG_PAIR',
        confidence: 0.9,
        zScore,
        correlation,
        hedgeRatio,
        reason: `Strong pair trade: Spread ${Math.abs(zScore).toFixed(2)} std dev below mean, correlation ${correlation.toFixed(2)}`
      };
    }

    // Strong short pair signal: Spread significantly above mean
    if (zScore > this.config.entryThreshold) {
      return {
        signal: 'SHORT_PAIR',
        confidence: 0.9,
        zScore,
        correlation,
        hedgeRatio,
        reason: `Strong pair trade: Spread ${zScore.toFixed(2)} std dev above mean, correlation ${correlation.toFixed(2)}`
      };
    }

    // Exit signal: Spread reverts to mean
    if (Math.abs(zScore) < this.config.exitThreshold) {
      return {
        signal: 'EXIT_PAIR',
        confidence: 0.8,
        zScore,
        reason: `Spread reverted to mean (Z-score: ${zScore.toFixed(2)})`
      };
    }

    return { signal: 'HOLD', confidence: 0 };
  }

  /**
   * Calculate position size for pairs
   */
  calculatePositionSize(signal, portfolio) {
    const { riskPerTrade, hedgeRatioPeriod } = this.config;
    const availableUsd = portfolio.totalUsd || 1000;

    if (availableUsd < this.minPositionUsd) {
      return { primarySize: 0, secondarySize: 0, amount: 0 };
    }

    const amount = availableUsd * riskPerTrade;
    const hedgeRatio = signal.hedgeRatio || 1;

    // Calculate position sizes based on hedge ratio
    const primaryAmount = amount / 2;
    const secondaryAmount = (amount / 2) * hedgeRatio;

    return {
      primarySize: primaryAmount / (signal.primaryPrice || 1),
      secondarySize: secondaryAmount / (signal.secondaryPrice || 1),
      amount: primaryAmount + secondaryAmount,
      hedgeRatio
    };
  }

  /**
   * Get entry conditions for the strategy
   */
  getEntryConditions() {
    return {
      longPair: [
        `Spread ${this.config.entryThreshold}+ standard deviations below mean`,
        `Correlation above ${this.config.minCorrelation}`,
        `Both assets in similar market conditions`
      ],
      shortPair: [
        `Spread ${this.config.entryThreshold}+ standard deviations above mean`,
        `Correlation above ${this.config.minCorrelation}`,
        `Both assets in similar market conditions`
      ]
    };
  }

  /**
   * Get exit conditions for the strategy
   */
  getExitConditions() {
    return {
      profit: [
        `Spread returns to ${this.config.exitThreshold} standard deviations from mean`,
        `Target: Mean reversion of the spread`
      ],
      loss: [
        `Stop loss at 2.5x the entry deviation`,
        `Exit if correlation breaks down (< 0.5)`
      ]
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(primaryPrice, secondaryPrice, side, zScore = 0, hedgeRatio = 1) {
    const stopDistance = Math.abs(zScore) * 1.5;

    if (side === 'LONG_PAIR') {
      return {
        primary: primaryPrice * (1 - stopDistance * 0.01),
        secondary: secondaryPrice * (1 + stopDistance * 0.01 * hedgeRatio)
      };
    } else {
      return {
        primary: primaryPrice * (1 + stopDistance * 0.01),
        secondary: secondaryPrice * (1 - stopDistance * 0.01 * hedgeRatio)
      };
    }
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(primaryPrice, secondaryPrice, side, hedgeRatio = 1) {
    const targetZScore = 0;

    if (side === 'LONG_PAIR') {
      return {
        primary: primaryPrice,
        secondary: secondaryPrice
      };
    } else {
      return {
        primary: primaryPrice,
        secondary: secondaryPrice
      };
    }
  }

  /**
   * Run backtest on historical data
   */
  backtest(historicalData) {
    const results = {
      trades: [],
      totalReturn: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      avgCorrelation: 0
    };

    let portfolio = { totalUsd: 10000, positions: [] };
    let trades = [];
    let correlations = [];

    for (let i = this.config.lookbackPeriod; i < historicalData.length; i++) {
      const candles = historicalData.slice(0, i + 1);
      const indicators = {
        correlation: this.calculateCorrelation(candles),
        zScore: this.calculateZScore(candles),
        hedgeRatio: this.calculateHedgeRatio(candles)
      };

      if (indicators.correlation) {
        correlations.push(indicators.correlation);
      }

      const signal = this.generateSignal(candles, indicators);

      if (signal.signal === 'LONG_PAIR' && portfolio.positions.length === 0) {
        const currentPrice = candles[candles.length - 1].close;
        portfolio.positions.push({
          side: 'LONG_PAIR',
          primaryPrice: currentPrice,
          secondaryPrice: currentPrice,
          hedgeRatio: indicators.hedgeRatio,
          zScore: indicators.zScore,
          timestamp: candles[candles.length - 1].timestamp
        });
      } else if (signal.signal === 'SHORT_PAIR' && portfolio.positions.length === 0) {
        const currentPrice = candles[candles.length - 1].close;
        portfolio.positions.push({
          side: 'SHORT_PAIR',
          primaryPrice: currentPrice,
          secondaryPrice: currentPrice,
          hedgeRatio: indicators.hedgeRatio,
          zScore: indicators.zScore,
          timestamp: candles[candles.length - 1].timestamp
        });
      } else if (portfolio.positions.length > 0 && signal.signal === 'EXIT_PAIR') {
        const currentPrice = candles[candles.length - 1].close;
        const position = portfolio.positions[0];

        const pnl = this.calculatePairPnL(position, currentPrice, currentPrice);

        trades.push({
          side: position.side,
          entryPrice: position.primaryPrice,
          exitPrice: currentPrice,
          pnl,
          zScore: position.zScore,
          timestamp: position.timestamp
        });

        portfolio.totalUsd += pnl;
        portfolio.positions = [];
      }
    }

    results.trades = trades;
    results.totalReturn = ((portfolio.totalUsd - 10000) / 10000) * 100;
    results.winRate = trades.filter(t => t.pnl > 0).length / trades.length * 100;
    results.avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;

    return results;
  }

  /**
   * Calculate P&L for a pair trade
   */
  calculatePairPnL(position, currentPrimaryPrice, currentSecondaryPrice) {
    const hedgeRatio = position.hedgeRatio || 1;

    if (position.side === 'LONG_PAIR') {
      const primaryPnl = (currentPrimaryPrice - position.primaryPrice) * 100;
      const secondaryPnl = (position.secondaryPrice - currentSecondaryPrice) * hedgeRatio * 100;
      return primaryPnl + secondaryPnl;
    } else {
      const primaryPnl = (position.primaryPrice - currentPrimaryPrice) * 100;
      const secondaryPnl = (currentSecondaryPrice - position.secondaryPrice) * hedgeRatio * 100;
      return primaryPnl + secondaryPnl;
    }
  }

  /**
   * Calculate correlation between two price series
   */
  calculateCorrelation(candles, period = 50) {
    if (candles.length < period) return 0;

    // For pair trading, we use price differences from mean
    const prices = candles.slice(-period).map(c => c.close);
    const returns = [];

    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    // Calculate correlation with itself (for spread analysis)
    for (let i = 0; i < returns.length; i++) {
      const x = returns[i];
      const y = returns[i]; // Same series for auto-correlation
      numerator += (x - meanReturn) * (y - meanReturn);
      sumSqX += Math.pow(x - meanReturn, 2);
      sumSqY += Math.pow(y - meanReturn, 2);
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate Z-Score of price spread
   */
  calculateZScore(candles, period = 20) {
    if (candles.length < period) return 0;

    const spreads = [];
    for (let i = 1; i < candles.length; i++) {
      const price1 = candles[i].close;
      const price2 = candles[i - 1].close;
      spreads.push(price1 - price2);
    }

    const recentSpreads = spreads.slice(-period);
    const mean = recentSpreads.reduce((a, b) => a + b, 0) / recentSpreads.length;

    const squaredDiffs = recentSpreads.map(s => Math.pow(s - mean, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

    const currentSpread = spreads[spreads.length - 1];
    return stdDev === 0 ? 0 : (currentSpread - mean) / stdDev;
  }

  /**
   * Calculate hedge ratio using linear regression
   */
  calculateHedgeRatio(candles, period = 50) {
    if (candles.length < period) return 1;

    const prices = candles.slice(-period).map(c => c.close);
    const returns = prices.map((price, i, arr) => {
      if (i === 0) return 0;
      return (price - arr[i - 1]) / arr[i - 1];
    }).slice(1);

    // Simple hedge ratio calculation
    const sumX = returns.reduce((a, b) => a + b, 0);
    const sumY = sumX; // Same series
    const sumXY = returns.reduce((sum, r, i) => sum + r * r, 0);
    const sumX2 = returns.reduce((sum, r) => sum + r * r, 0);

    const n = returns.length;
    const hedgeRatio = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return Math.abs(hedgeRatio) > 0 ? hedgeRatio : 1;
  }

  /**
   * Get strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      minPositionUsd: this.minPositionUsd,
      correlationPeriod: this.config.correlationPeriod,
      entryThreshold: this.config.entryThreshold,
      exitThreshold: this.config.exitThreshold,
      lookbackPeriod: this.config.lookbackPeriod,
      minCorrelation: this.config.minCorrelation,
      zScorePeriod: this.config.zScorePeriod,
      hedgeRatioPeriod: this.config.hedgeRatioPeriod,
      riskPerTrade: this.config.riskPerTrade
    };
  }

  /**
   * Update strategy parameters
   */
  updateParameters(newParams) {
    this.config = { ...this.config, ...newParams };
    return this.getParameters();
  }
}

export default CorrelationTradingStrategy;
