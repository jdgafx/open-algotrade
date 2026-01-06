/**
 * Mean Reversion Strategy
 * Based on MoonDev's 6_mean_reversion algorithm (75 tickers)
 *
 * Uses Simple Moving Average (SMA) with mean reversion logic
 * Best for: 15m timeframe, ranging markets
 *
 * Profit Target: 0.9% | Risk Level: Medium | Speed: Medium
 */

class MeanReversionStrategy {
  constructor() {
    this.name = 'Mean Reversion';
    this.description = 'SMA-based mean reversion across multiple cryptocurrencies';
    this.author = 'MoonDev';
    this.timeframe = '15m';
    this.minPositionUsd = 0.25;

    // Strategy Configuration (MoonDev's exact parameters)
    this.config = {
      smaPeriod: 20,               // SMA calculation period (20 candles = 5 hours on 15m)
      lookback: 97,                // Lookback period (24 hours on 15m)
      targetPercent: 0.9,          // 0.9% profit target
      maxLossPercent: 0.8,         // 0.8% maximum loss
      leverage: 5,                 // 5x leverage
      positionSize: 30,            // Position size (units)
      deviationThreshold: 0.02     // 2% deviation from SMA for signal
    };

    // Supported trading pairs (subset of MoonDev's 75 tickers for this implementation)
    this.supportedPairs = [
      'BTC-USD', 'ETH-USD', 'ADA-USD', 'DOT-USD', 'MANA-USD',
      'XRP-USD', 'UNI-USD', 'SOL-USD', 'MATIC-USD', 'AVAX-USD',
      'LINK-USD', 'LTC-USD', 'ATOM-USD', 'NEAR-USD', 'FTM-USD'
    ];

    // Metadata for strategy selection
    this.metadata = {
      profitTarget: '0.9%',
      riskLevel: 'Medium',
      speed: 'Medium',
      marketType: 'Ranging',
      bestTimeframes: ['15m', '1h'],
      whyChooseThis: [
        'Proven across 75 different cryptocurrencies',
        'Excellent for ranging/choppy markets',
        'Clear SMA-based entry and exit signals',
        'Good risk-reward ratio (0.9% target vs 0.8% max loss)',
        'Works on multiple timeframes'
      ]
    };
  }

  /**
   * Calculate Simple Moving Average
   * @param {Array} prices - Array of closing prices
   * @param {number} period - SMA period
   * @returns {number} - SMA value
   */
  calculateSMA(prices, period) {
    if (prices.length < period) return null;

    const slice = prices.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Calculate price deviation from SMA
   * @param {number} price - Current price
   * @param {number} sma - SMA value
   * @returns {Object} - Deviation metrics
   */
  calculateDeviation(price, sma) {
    const absoluteDeviation = price - sma;
    const percentDeviation = (absoluteDeviation / sma) * 100;

    return {
      absolute: absoluteDeviation,
      percent: percentDeviation,
      isAboveSMA: price > sma,
      isBelowSMA: price < sma,
      isSignificantlyAbove: percentDeviation > this.config.deviationThreshold * 100,
      isSignificantlyBelow: percentDeviation < -this.config.deviationThreshold * 100
    };
  }

  /**
   * Calculate support and resistance levels
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Support and resistance levels
   */
  calculateSupportResistance(candles) {
    const lookback = Math.min(this.config.lookback, candles.length);
    const recentCandles = candles.slice(-lookback);

    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);

    // Get top 3 highs and lows for support/resistance
    const sortedHighs = [...highs].sort((a, b) => b - a).slice(0, 3);
    const sortedLows = [...lows].sort((a, b) => a - b).slice(0, 3);

    const resistance = sortedHighs[0];
    const support = sortedLows[0];

    const currentPrice = candles[candles.length - 1].close;

    return {
      support,
      resistance,
      currentPrice,
      distanceToSupport: ((currentPrice - support) / support) * 100,
      distanceToResistance: ((resistance - currentPrice) / resistance) * 100,
      isNearSupport: ((currentPrice - support) / support) < 0.015, // Within 1.5%
      isNearResistance: ((resistance - currentPrice) / resistance) < 0.015 // Within 1.5%
    };
  }

  /**
   * Analyze market structure
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Market structure analysis
   */
  analyzeMarketStructure(candles) {
    if (candles.length < this.config.lookback) {
      return { suitable: false, reason: 'Insufficient data' };
    }

    const closes = candles.map(c => c.close);
    const sma = this.calculateSMA(closes, this.config.smaPeriod);
    const deviation = this.calculateDeviation(closes[closes.length - 1], sma);
    const supportResistance = this.calculateSupportResistance(candles);

    // Calculate recent price momentum
    const momentum = this.calculateMomentum(closes);

    // Check if market is ranging (good for mean reversion)
    const priceRange = Math.max(...closes.slice(-20)) - Math.min(...closes.slice(-20));
    const avgPrice = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const rangePercent = (priceRange / avgPrice) * 100;

    const isRanging = rangePercent < 5; // Less than 5% range = ranging market

    // Check if oversold/overbought relative to SMA
    const isOversold = deviation.isSignificantlyBelow;
    const isOverbought = deviation.isSignificantlyAbove;

    return {
      suitable: isRanging || isOversold || isOverbought,
      sma,
      deviation,
      supportResistance,
      momentum,
      isRanging,
      isOversold,
      isOverbought,
      rangePercent,
      reason: !isRanging && !isOversold && !isOverbought ?
              'Market trending strongly, mean reversion unlikely' : 'Market conditions favorable'
    };
  }

  /**
   * Calculate price momentum
   * @private
   */
  calculateMomentum(prices) {
    if (prices.length < 10) return 0;

    const recent = prices.slice(-10);
    const older = prices.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    return ((recentAvg - olderAvg) / olderAvg) * 100;
  }

  /**
   * Generate trading signals
   * @param {Array} candles - Array of OHLCV candles
   * @param {string} symbol - Trading pair symbol
   * @returns {Object} - Trading signals and analysis
   */
  generateSignal(candles, symbol = 'BTC-USD') {
    if (candles.length < this.config.lookback) {
      return { signal: 'HOLD', reason: 'Insufficient data for analysis' };
    }

    if (!this.supportedPairs.includes(symbol)) {
      return {
        signal: 'HOLD',
        reason: `${symbol} not in supported pairs list`,
        confidence: 0.3
      };
    }

    const analysis = this.analyzeMarketStructure(candles);

    if (!analysis.suitable) {
      return {
        signal: 'HOLD',
        reason: analysis.reason,
        confidence: 0.3
      };
    }

    const { deviation, supportResistance, isRanging, isOversold, isOverbought } = analysis;

    let signal = 'HOLD';
    let reason = '';
    let confidence = 0.5;

    // Mean reversion signals
    if (isOversold || (deviation.isBelowSMA && supportResistance.isNearSupport)) {
      signal = 'BUY';
      reason = `Price oversold relative to SMA (${deviation.percent.toFixed(2)}%). ` +
               `Near support level at $${supportResistance.support.toFixed(2)}`;
      confidence = 0.8;
    } else if (isOverbought || (deviation.isAboveSMA && supportResistance.isNearResistance)) {
      signal = 'SELL';
      reason = `Price overbought relative to SMA (${deviation.percent.toFixed(2)}%). ` +
               `Near resistance level at $${supportResistance.resistance.toFixed(2)}`;
      confidence = 0.8;
    } else if (isRanging && deviation.isBelowSMA) {
      signal = 'BUY';
      reason = `Ranging market with price below SMA. Mean reversion expected`;
      confidence = 0.65;
    } else if (isRanging && deviation.isAboveSMA) {
      signal = 'SELL';
      reason = `Ranging market with price above SMA. Mean reversion expected`;
      confidence = 0.65;
    } else {
      reason = `Price at ${deviation.percent.toFixed(2)}% from SMA. No clear signal`;
      confidence = 0.4;
    }

    return {
      signal,
      reason,
      confidence,
      analysis: {
        sma: analysis.sma,
        deviation: analysis.deviation,
        supportResistance,
        momentum: analysis.momentum
      }
    };
  }

  /**
   * Calculate position size with leverage
   * @param {number} accountBalance - Available balance in USD
   * @param {string} symbol - Trading pair symbol
   * @returns {Object} - Position size and risk metrics
   */
  calculatePositionSize(accountBalance, symbol = 'BTC-USD') {
    const minSize = this.minPositionUsd;
    const { leverage, positionSize } = this.config;

    // Base position size
    let calculatedSize = positionSize;

    // Adjust based on account balance (don't exceed 10% of balance)
    const maxSize = accountBalance * 0.1;
    calculatedSize = Math.min(calculatedSize, maxSize);

    // Ensure minimum position size
    calculatedSize = Math.max(minSize, calculatedSize);

    return {
      size: calculatedSize,
      leveragedSize: calculatedSize * leverage,
      leverage,
      percentOfBalance: (calculatedSize / accountBalance) * 100,
      maxLossUsd: calculatedSize * (this.config.maxLossPercent / 100),
      targetProfitUsd: calculatedSize * (this.config.targetPercent / 100)
    };
  }

  /**
   * Get strategy information
   */
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      author: this.author,
      timeframe: this.timeframe,
      metadata: this.metadata,
      minPositionUsd: this.minPositionUsd,
      supportedPairs: this.supportedPairs
    };
  }
}

// Export as ES6 module
export default MeanReversionStrategy;

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
      sharpeRatio: 0
    };

    let portfolio = { totalUsd: 10000, position: null };
    let trades = [];

    for (let i = this.config.lookbackPeriod; i < historicalData.length; i++) {
      const candles = historicalData.slice(0, i + 1);
      const indicators = {
        sma: this.calculateSMA(candles, this.config.smaPeriod),
        stdDev: this.calculateStdDev(candles, this.config.smaPeriod),
        rsi: this.calculateRSI(candles)
      };

      const signal = this.generateSignal(candles, indicators);

      if (signal.signal === 'BUY' && !portfolio.position) {
        portfolio.position = {
          side: 'BUY',
          entryPrice: candles[candles.length - 1].close,
          sma: indicators.sma
        };
      } else if (signal.signal === 'SELL' && !portfolio.position) {
        portfolio.position = {
          side: 'SELL',
          entryPrice: candles[candles.length - 1].close,
          sma: indicators.sma
        };
      } else if (portfolio.position && signal.signal === 'EXIT') {
        const exitPrice = candles[candles.length - 1].close;
        const pnl = this.calculatePnL(portfolio.position, exitPrice);

        trades.push({
          side: portfolio.position.side,
          entryPrice: portfolio.position.entryPrice,
          exitPrice,
          pnl,
          timestamp: candles[candles.length - 1].timestamp
        });

        portfolio.totalUsd += pnl;
        portfolio.position = null;
      }
    }

    results.trades = trades;
    results.totalReturn = ((portfolio.totalUsd - 10000) / 10000) * 100;
    results.winRate = trades.filter(t => t.pnl > 0).length / trades.length * 100;

    return results;
  }

  /**
   * Calculate P&L for a trade
   */
  calculatePnL(position, exitPrice) {
    if (position.side === 'BUY') {
      return (exitPrice - position.entryPrice) * 100;
    } else {
      return (position.entryPrice - exitPrice) * 100;
    }
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(candles, period = 20) {
    if (candles.length < period) return null;

    const slice = candles.slice(-period);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);

    return sum / period;
  }

  /**
   * Calculate Standard Deviation
   */
  calculateStdDev(candles, period = 20) {
    if (candles.length < period) return 0;

    const slice = candles.slice(-period);
    const sma = this.calculateSMA(candles, period);

    const squaredDiffs = slice.map(c => Math.pow(c.close - sma, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;

    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate RSI
   */
  calculateRSI(candles, period = 14) {
    if (candles.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < candles.length; i++) {
      const change = candles[i].close - candles[i - 1].close;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate Z-Score
   */
  calculateZScore(price, sma, stdDev) {
    if (!sma || !stdDev || stdDev === 0) return 0;
    return (price - sma) / stdDev;
  }

  /**
   * Get strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      minPositionUsd: this.minPositionUsd,
      smaPeriod: this.config.smaPeriod,
      stdDevPeriod: this.config.stdDevPeriod,
      entryThreshold: this.config.entryThreshold,
      exitThreshold: this.config.exitThreshold,
      rsiPeriod: this.config.rsiPeriod,
      rsiOversold: this.config.rsiOversold,
      rsiOverbought: this.config.rsiOverbought,
      lookbackPeriod: this.config.lookbackPeriod,
      zScoreThreshold: this.config.zScoreThreshold,
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

export default MeanReversionStrategy;
