/**
 * Nadarya Watson Strategy
 * Based on MoonDev's 4_nadarya_watson_algo
 *
 * Uses Gaussian-weighted Nadarya indicator + Stochastic RSI
 * Best for: 1h timeframe, trending markets
 *
 * Profit Target: 0.35% | Risk Level: Medium | Speed: Medium
 */

class NadaryaWatsonStrategy {
  constructor() {
    this.name = 'Nadarya Watson';
    this.description = 'Advanced trend detection using Gaussian-weighted averaging + Stochastic RSI';
    this.author = 'MoonDev';
    this.timeframe = '1h';
    this.minPositionUsd = 0.25;

    // Strategy Configuration (MoonDev's exact parameters)
    this.config = {
      bandwidth: 8,              // Nadarya bandwidth parameter
      rsiWindow: 14,             // RSI calculation window
      rsiOversold: 10,           // Oversold threshold
      rsiOverbought: 90,         // Overbought threshold
      stochOversoldHits: 2,      // Times oversold before exit
      stochOverboughtHits: 2,    // Times overbought before exit
      takeProfitPercent: 0.35,   // 0.35% profit target
      stopLossPercent: 0.25,     // 0.25% stop loss
      lookback: 50               // Candles to analyze
    };

    // Metadata for strategy selection
    this.metadata = {
      profitTarget: '0.35%',
      riskLevel: 'Medium',
      speed: 'Medium',
      marketType: 'Trending',
      bestTimeframes: ['1h', '4h'],
      whyChooseThis: [
        'Advanced trend detection using mathematical smoothing',
        'Combines momentum (Nadarya) with momentum oscillator (Stoch RSI)',
        'Proven on 1h timeframes with 300%+ backtests',
        'Good for catching trend reversals early'
      ]
    };
  }

  /**
   * Calculate Nadarya indicator (Gaussian-weighted average)
   * @param {Array} prices - Array of closing prices
   * @returns {Object} - Nadarya values and signals
   */
  calculateNadarya(prices) {
    const bandwidth = this.config.bandwidth;
    const nadaryaValues = [];

    // Calculate Gaussian-weighted average for each point
    for (let i = 0; i < prices.length; i++) {
      let tsum = 0;
      let sumw = 0;

      for (let j = 0; j < prices.length; j++) {
        const weight = Math.exp(-(Math.pow(i - j, 2) / (2 * bandwidth * bandwidth)));
        tsum += prices[j] * weight;
        sumw += weight;
      }

      nadaryaValues.push(tsum / sumw);
    }

    // Calculate buy/sell signals
    const buySignals = [];
    const sellSignals = [];

    for (let i = 1; i < nadaryaValues.length; i++) {
      const current = nadaryaValues[i];
      const previous = nadaryaValues[i - 1];

      // Buy signal: Nadarya turns up
      if (current > previous && (i === 1 || nadaryaValues[i - 2] <= previous)) {
        buySignals.push(i);
      }

      // Sell signal: Nadarya turns down
      if (current < previous && (i === 1 || nadaryaValues[i - 2] >= previous)) {
        sellSignals.push(i);
      }
    }

    return {
      values: nadaryaValues,
      buySignals,
      sellSignals,
      currentBuySignal: buySignals.length > 0 && buySignals[buySignals.length - 1] === prices.length - 1,
      currentSellSignal: sellSignals.length > 0 && sellSignals[buySignals.length - 1] === prices.length - 1
    };
  }

  /**
   * Calculate Stochastic RSI
   * @param {Array} prices - Array of closing prices
   * @returns {Object} - Stochastic RSI values
   */
  calculateStochRSI(prices) {
    const period = this.config.rsiWindow;
    const rsiValues = [];

    // Calculate RSI
    for (let i = period; i < prices.length; i++) {
      let gains = 0;
      let losses = 0;

      for (let j = i - period + 1; j <= i; j++) {
        const change = prices[j] - prices[j - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }

      const rs = gains / (losses || 1);
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }

    // Calculate Stochastic RSI
    const stochRSIValues = [];
    const stochPeriod = Math.min(period, rsiValues.length);

    for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
      const window = rsiValues.slice(i - stochPeriod + 1, i + 1);
      const min = Math.min(...window);
      const max = Math.max(...window);

      const stochRSI = (rsiValues[i] - min) / ((max - min) || 1) * 100;
      stochRSIValues.push(stochRSI);
    }

    // Check for oversold/overbought conditions
    const currentStochRSI = stochRSIValues[stochRSIValues.length - 1];
    const oversoldCount = stochRSIValues.slice(-this.config.rsiWindow)
      .filter(v => v <= this.config.rsiOversold).length;
    const overboughtCount = stochRSIValues.slice(-this.config.rsiWindow)
      .filter(v => v >= this.config.rsiOverbought).length;

    return {
      values: stochRSIValues,
      current: currentStochRSI,
      isOversold: currentStochRSI <= this.config.rsiOversold,
      isOverbought: currentStochRSI >= this.config.rsiOverbought,
      oversoldHits: oversoldCount,
      overboughtHits: overboughtCount
    };
  }

  /**
   * Generate trading signal
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Trading signal
   */
  generateSignal(candles) {
    if (candles.length < this.config.lookback) {
      return { signal: 'HOLD', reason: 'Insufficient data' };
    }

    const closes = candles.map(c => c.close);
    const nadarya = this.calculateNadarya(closes);
    const stochRSI = this.calculateStochRSI(closes);

    // Determine signals
    const nadaryaBuy = nadarya.currentBuySignal;
    const nadaryaSell = nadarya.currentSellSignal;
    const stochOversold = stochRSI.isOversold;
    const stochOverbought = stochRSI.isOverbought;
    const stochOversoldTwice = stochRSI.oversoldHits >= this.config.stochOversoldHits;
    const stochOverboughtTwice = stochRSI.overboughtHits >= this.config.stochOverboughtHits;

    // Entry signals
    if (nadaryaBuy || stochOversold) {
      return {
        signal: 'BUY',
        reason: `Nadarya Buy: ${nadaryaBuy}, Stoch RSI Oversold: ${stochOversold}`,
        confidence: this.calculateConfidence(nadarya, stochRSI, 'BUY')
      };
    }

    if (nadaryaSell || stochOverbought) {
      return {
        signal: 'SELL',
        reason: `Nadarya Sell: ${nadaryaSell}, Stoch RSI Overbought: ${stochOverbought}`,
        confidence: this.calculateConfidence(nadarya, stochRSI, 'SELL')
      };
    }

    // Exit signals (if in position)
    if (stochOversoldTwice) {
      return {
        signal: 'EXIT_LONG',
        reason: `Stochastic RSI oversold ${this.config.stochOversoldHits} times`,
        confidence: 0.8
      };
    }

    if (stochOverboughtTwice) {
      return {
        signal: 'EXIT_SHORT',
        reason: `Stochastic RSI overbought ${this.config.stochOverboughtHits} times`,
        confidence: 0.8
      };
    }

    return { signal: 'HOLD', reason: 'No clear signal' };
  }

  /**
   * Calculate signal confidence
   * @private
   */
  calculateConfidence(nadarya, stochRSI, signalType) {
    let confidence = 0.5;

    if (signalType === 'BUY') {
      if (nadarya.currentBuySignal) confidence += 0.3;
      if (stochRSI.isOversold) confidence += 0.2;
    } else {
      if (nadarya.currentSellSignal) confidence += 0.3;
      if (stochRSI.isOverbought) confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate position size based on account balance and risk
   * @param {number} accountBalance - Available balance in USD
   * @returns {number} - Position size in USD
   */
  calculatePositionSize(accountBalance) {
    const minSize = this.minPositionUsd;
    const riskPercent = 0.02; // 2% risk per trade
    const calculatedSize = accountBalance * riskPercent;

    return Math.max(minSize, Math.min(calculatedSize, accountBalance * 0.1));
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
      minPositionUsd: this.minPositionUsd
    };
  }
}

// Export as ES6 module
export default NadaryaWatsonStrategy;
