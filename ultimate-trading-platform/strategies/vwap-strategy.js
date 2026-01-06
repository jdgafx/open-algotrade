/**
 * VWAP (Volume Weighted Average Price) Strategy
 * Mean reversion and momentum strategy based on volume-weighted price
 */

class VwapStrategy {
  constructor(config = {}) {
    this.name = 'VWAP';
    this.minPositionUsd = 0.25; // CRITICAL
    this.config = {
      period: config.period || 20, // VWAP calculation period
      deviationThreshold: config.deviationThreshold || 0.02, // 2% deviation threshold
      volumeThreshold: config.volumeThreshold || 1.5, // 1.5x average volume
      meanReversionThreshold: config.meanReversionThreshold || 0.015, // 1.5%
      rsiPeriod: config.rsiPeriod || 14,
      rsiOversold: config.rsiOversold || 30,
      rsiOverbought: config.rsiOverbought || 70,
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
    this.vwap = null;
  }

  /**
   * Generate trading signal based on VWAP
   */
  generateSignal(candles, indicators) {
    if (candles.length < this.config.period) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const vwap = indicators.vwap || this.calculateVWAP(candles);
    const currentPrice = candles[candles.length - 1].close;
    const currentVolume = candles[candles.length - 1].volume || 0;
    const avgVolume = this.calculateAverageVolume(candles);
    const rsi = indicators.rsi || this.calculateRSI(candles);

    if (!vwap) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const deviation = (currentPrice - vwap) / vwap; // Positive = above VWAP
    const deviationPercent = Math.abs(deviation) * 100;
    const volumeRatio = currentVolume / avgVolume;

    // Strong buy signal: Price significantly below VWAP with high volume and RSI oversold
    if (deviation < -this.config.deviationThreshold &&
        volumeRatio > this.config.volumeThreshold &&
        rsi < this.config.rsiOversold) {
      return {
        signal: 'BUY',
        confidence: 0.9,
        deviation,
        deviationPercent,
        volumeRatio,
        vwap,
        reason: `Strong buy: ${deviationPercent.toFixed(2)}% below VWAP, volume ${volumeRatio.toFixed(2)}x avg, RSI ${rsi.toFixed(2)}`
      };
    }

    // Buy signal: Price below VWAP with decent volume
    if (deviation < -this.config.deviationThreshold && volumeRatio > 1.2) {
      return {
        signal: 'BUY',
        confidence: 0.75,
        deviation,
        deviationPercent,
        volumeRatio,
        vwap,
        reason: `Buy: ${deviationPercent.toFixed(2)}% below VWAP with volume confirmation`
      };
    }

    // Strong sell signal: Price significantly above VWAP with high volume and RSI overbought
    if (deviation > this.config.deviationThreshold &&
        volumeRatio > this.config.volumeThreshold &&
        rsi > this.config.rsiOverbought) {
      return {
        signal: 'SELL',
        confidence: 0.9,
        deviation,
        deviationPercent,
        volumeRatio,
        vwap,
        reason: `Strong sell: ${deviationPercent.toFixed(2)}% above VWAP, volume ${volumeRatio.toFixed(2)}x avg, RSI ${rsi.toFixed(2)}`
      };
    }

    // Sell signal: Price above VWAP with decent volume
    if (deviation > this.config.deviationThreshold && volumeRatio > 1.2) {
      return {
        signal: 'SELL',
        confidence: 0.75,
        deviation,
        deviationPercent,
        volumeRatio,
        vwap,
        reason: `Sell: ${deviationPercent.toFixed(2)}% above VWAP with volume confirmation`
      };
    }

    // Momentum continuation: Price above VWAP with strong volume (trend following)
    if (deviation > 0.01 && volumeRatio > this.config.volumeThreshold * 1.5) {
      return {
        signal: 'BUY',
        confidence: 0.65,
        deviation,
        volumeRatio,
        vwap,
        reason: `Momentum continuation above VWAP with strong volume`
      };
    }

    // Momentum continuation: Price below VWAP with strong volume (trend following)
    if (deviation < -0.01 && volumeRatio > this.config.volumeThreshold * 1.5) {
      return {
        signal: 'SELL',
        confidence: 0.65,
        deviation,
        volumeRatio,
        vwap,
        reason: `Momentum continuation below VWAP with strong volume`
      };
    }

    // Exit signal: Price returns to VWAP
    if (Math.abs(deviation) < this.config.meanReversionThreshold) {
      return {
        signal: 'EXIT',
        confidence: 0.7,
        reason: `Price returned to VWAP (mean reversion)`
      };
    }

    return { signal: 'HOLD', confidence: 0 };
  }

  /**
   * Calculate position size based on volume and deviation
   */
  calculatePositionSize(signal, portfolio) {
    const { riskPerTrade } = this.config;
    const currentPrice = signal.price || 0;
    const availableUsd = portfolio.totalUsd || 1000;

    if (availableUsd < this.minPositionUsd) {
      return { size: 0, amount: 0 };
    }

    // Increase size with stronger signals and higher volume
    const volumeMultiplier = Math.min(signal.volumeRatio || 1, 2);
    const deviationMultiplier = Math.min(Math.abs(signal.deviation || 0) * 10, 1.5);

    const adjustedRisk = riskPerTrade * volumeMultiplier * deviationMultiplier;
    const amount = availableUsd * adjustedRisk;
    const size = amount / currentPrice;

    return {
      size,
      amount,
      volumeMultiplier,
      deviationMultiplier
    };
  }

  /**
   * Get entry conditions for the strategy
   */
  getEntryConditions() {
    return {
      long: [
        `Price ${this.config.deviationThreshold * 100}% below VWAP`,
        `Volume above ${this.config.volumeThreshold}x average`,
        `RSI below ${this.config.rsiOversold} for strong signal`
      ],
      short: [
        `Price ${this.config.deviationThreshold * 100}% above VWAP`,
        `Volume above ${this.config.volumeThreshold}x average`,
        `RSI above ${this.config.rsiOverbought} for strong signal`
      ]
    };
  }

  /**
   * Get exit conditions for the strategy
   */
  getExitConditions() {
    return {
      profit: [
        `Price returns to VWAP (mean reversion target)`,
        `Stop profit at ${this.config.meanReversionThreshold * 100}% from VWAP`
      ],
      loss: [
        `Stop loss at 1.5x the deviation from VWAP`,
        `Exit if volume drops significantly`
      ]
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(entryPrice, side, vwap = null, deviation = 0) {
    if (!vwap) return entryPrice * (side === 'BUY' ? 0.97 : 1.03);

    const stopDistance = Math.abs(vwap - entryPrice) * 1.5;

    return side === 'BUY'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(entryPrice, side, vwap = null) {
    if (!vwap) return entryPrice * (side === 'BUY' ? 1.02 : 0.98);

    const targetDistance = Math.abs(vwap - entryPrice) * 0.8;

    return side === 'BUY'
      ? vwap + (vwap - entryPrice > 0 ? targetDistance * 0.3 : targetDistance)
      : vwap - (entryPrice - vwap > 0 ? targetDistance * 0.3 : targetDistance);
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
        vwap: this.calculateVWAP(candles),
        rsi: this.calculateRSI(candles)
      };

      const signal = this.generateSignal(candles, indicators);

      if (signal.signal === 'BUY' && !portfolio.position) {
        portfolio.position = {
          side: 'BUY',
          entryPrice: candles[candles.length - 1].close,
          vwap: indicators.vwap
        };
      } else if (signal.signal === 'SELL' && !portfolio.position) {
        portfolio.position = {
          side: 'SELL',
          entryPrice: candles[candles.length - 1].close,
          vwap: indicators.vwap
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
   * Calculate VWAP (Volume Weighted Average Price)
   */
  calculateVWAP(candles, period = 20) {
    if (candles.length < period) return null;

    const slice = candles.slice(-period);
    let totalVolumePrice = 0;
    let totalVolume = 0;

    for (const candle of slice) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      totalVolumePrice += typicalPrice * candle.volume;
      totalVolume += candle.volume;
    }

    return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
  }

  /**
   * Calculate average volume
   */
  calculateAverageVolume(candles, period = 20) {
    if (candles.length < period) return 0;

    const slice = candles.slice(-period);
    const totalVolume = slice.reduce((sum, c) => sum + (c.volume || 0), 0);

    return totalVolume / slice.length;
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
      deviationThreshold: this.config.deviationThreshold,
      volumeThreshold: this.config.volumeThreshold,
      meanReversionThreshold: this.config.meanReversionThreshold,
      rsiPeriod: this.config.rsiPeriod,
      rsiOversold: this.config.rsiOversold,
      rsiOverbought: this.config.rsiOverbought,
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

export default VwapStrategy;
