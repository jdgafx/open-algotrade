/**
 * Bollinger Bands Strategy
 * Volatility bands mean reversion strategy
 */

class BollingerBandsStrategy {
  constructor(config = {}) {
    this.name = 'Bollinger Bands';
    this.minPositionUsd = 0.25; // CRITICAL
    this.config = {
      period: config.period || 20,
      stdDev: config.stdDev || 2.0,
      meanReversionThreshold: config.meanReversionThreshold || 0.8, // 0-1 scale
      rsiPeriod: config.rsiPeriod || 14,
      rsiOverbought: config.rsiOverbought || 70,
      rsiOversold: config.rsiOversold || 30,
      riskPerTrade: config.riskPerTrade || 0.02,
      ...config
    };
  }

  /**
   * Initialize strategy with market data
   */
  initialize(marketData) {
    this.marketData = marketData;
    this.positions = new Map();
    this.trades = [];
    this.bbands = [];
  }

  /**
   * Generate trading signal based on Bollinger Bands
   */
  generateSignal(candles, indicators) {
    if (candles.length < this.config.period) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const bb = indicators.bollingerBands || this.calculateBollingerBands(candles);
    const rsi = indicators.rsi || this.calculateRSI(candles);

    if (!bb) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const currentPrice = candles[candles.length - 1].close;
    const { upper, middle, lower } = bb;
    const bandWidth = (upper - lower) / middle;
    const pricePosition = (currentPrice - lower) / (upper - lower); // 0 = lower band, 1 = upper band

    // Strong buy signal: Price below lower band and RSI oversold
    if (currentPrice <= lower && rsi <= this.config.rsiOversold) {
      return {
        signal: 'BUY',
        confidence: 0.9,
        bbPosition: pricePosition,
        rsi,
        reason: `Price below lower band (${lower.toFixed(2)}) and RSI oversold (${rsi.toFixed(2)})`
      };
    }

    // Buy signal: Price below lower band
    if (currentPrice <= lower) {
      return {
        signal: 'BUY',
        confidence: 0.75,
        bbPosition: pricePosition,
        rsi,
        reason: `Price below lower band at ${lower.toFixed(2)}`
      };
    }

    // Strong sell signal: Price above upper band and RSI overbought
    if (currentPrice >= upper && rsi >= this.config.rsiOverbought) {
      return {
        signal: 'SELL',
        confidence: 0.9,
        bbPosition: pricePosition,
        rsi,
        reason: `Price above upper band (${upper.toFixed(2)}) and RSI overbought (${rsi.toFixed(2)})`
      };
    }

    // Sell signal: Price above upper band
    if (currentPrice >= upper) {
      return {
        signal: 'SELL',
        confidence: 0.75,
        bbPosition: pricePosition,
        rsi,
        reason: `Price above upper band at ${upper.toFixed(2)}`
      };
    }

    // Mean reversion entry: Price in lower 20% of bands
    if (pricePosition < this.config.meanReversionThreshold && rsi < 50) {
      return {
        signal: 'BUY',
        confidence: 0.6,
        bbPosition: pricePosition,
        rsi,
        reason: `Mean reversion opportunity in lower bands`
      };
    }

    // Mean reversion entry: Price in upper 80% of bands
    if (pricePosition > (1 - this.config.meanReversionThreshold) && rsi > 50) {
      return {
        signal: 'SELL',
        confidence: 0.6,
        bbPosition: pricePosition,
        rsi,
        reason: `Mean reversion opportunity in upper bands`
      };
    }

    // Exit signals: Price returns to middle band
    if (Math.abs(pricePosition - 0.5) < 0.1) {
      return {
        signal: 'EXIT',
        confidence: 0.7,
        reason: `Price returned to middle band (mean reversion complete)`
      };
    }

    return { signal: 'HOLD', confidence: 0 };
  }

  /**
   * Calculate position size based on volatility
   */
  calculatePositionSize(signal, portfolio) {
    const { riskPerTrade } = this.config;
    const currentPrice = signal.price || 0;
    const availableUsd = portfolio.totalUsd || 1000;

    if (availableUsd < this.minPositionUsd) {
      return { size: 0, amount: 0 };
    }

    // Smaller positions in high volatility environments
    const volatilityFactor = signal.bandWidth || 0.02;
    const adjustedRisk = riskPerTrade * (1 - Math.min(volatilityFactor * 5, 0.5));

    const amount = availableUsd * adjustedRisk;
    const size = amount / currentPrice;

    return {
      size,
      amount,
      volatilityFactor
    };
  }

  /**
   * Get entry conditions for the strategy
   */
  getEntryConditions() {
    return {
      long: [
        `Price touches or breaks below lower Bollinger Band`,
        `RSI below ${this.config.rsiOversold} for stronger signal`,
        `Band width should be expanding (volatility increasing)`
      ],
      short: [
        `Price touches or breaks above upper Bollinger Band`,
        `RSI above ${this.config.rsiOverbought} for stronger signal`,
        `Band width should be expanding (volatility increasing)`
      ]
    };
  }

  /**
   * Get exit conditions for the strategy
   */
  getExitConditions() {
    return {
      profit: [
        `Price returns to middle Bollinger Band (20-period SMA)`,
        `Target: ${this.config.period}-period moving average`
      ],
      loss: [
        `Stop loss: 2x the band width from entry`,
        `Exit if price breaks opposite band`
      ]
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(entryPrice, side, bb = null) {
    if (!bb) return entryPrice * (side === 'BUY' ? 0.97 : 1.03);

    const bandWidth = bb.upper - bb.lower;
    const stopDistance = bandWidth * 0.5;

    return side === 'BUY'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(entryPrice, side, bb = null) {
    if (!bb) return entryPrice * (side === 'BUY' ? 1.03 : 0.97);

    const target = bb.middle;

    return side === 'BUY'
      ? target
      : target;
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
      sharpeRatio: 0
    };

    let portfolio = { totalUsd: 10000, position: null };
    let trades = [];

    for (let i = this.config.period; i < historicalData.length; i++) {
      const candles = historicalData.slice(0, i + 1);
      const indicators = {
        bollingerBands: this.calculateBollingerBands(candles),
        rsi: this.calculateRSI(candles)
      };

      const signal = this.generateSignal(candles, indicators);

      if (signal.signal === 'BUY' && !portfolio.position) {
        portfolio.position = {
          side: 'BUY',
          entryPrice: candles[candles.length - 1].close,
          bb: indicators.bollingerBands
        };
      } else if (signal.signal === 'SELL' && !portfolio.position) {
        portfolio.position = {
          side: 'SELL',
          entryPrice: candles[candles.length - 1].close,
          bb: indicators.bollingerBands
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
      return (exitPrice - position.entryPrice) * 100; // Assume 100 units
    } else {
      return (position.entryPrice - exitPrice) * 100;
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(candles, period = 20, stdDev = 2) {
    if (candles.length < period) return null;

    const closes = candles.slice(-period).map(c => c.close);
    const sma = closes.reduce((a, b) => a + b, 0) / period;

    const squaredDiffs = closes.map(close => Math.pow(close - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
      bandWidth: (standardDeviation * stdDev) / sma
    };
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
   * Get strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      minPositionUsd: this.minPositionUsd,
      period: this.config.period,
      stdDev: this.config.stdDev,
      meanReversionThreshold: this.config.meanReversionThreshold,
      rsiPeriod: this.config.rsiPeriod,
      rsiOverbought: this.config.rsiOverbought,
      rsiOversold: this.config.rsiOversold,
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

export default BollingerBandsStrategy;
