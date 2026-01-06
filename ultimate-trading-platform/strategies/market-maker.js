/**
 * Market Maker Strategy
 * Based on MoonDev's 5_market_maker algorithm
 *
 * Places orders at percentages from local highs/lows
 * Best for: 5m-15m timeframes, volatile markets
 *
 * Profit Target: 0.4% | Risk Level: Medium-High | Speed: Fast
 */

class MarketMakerStrategy {
  constructor() {
    this.name = 'Market Maker';
    this.description = 'Positions orders at local highs/lows with tight profit targets';
    this.author = 'MoonDev';
    this.timeframe = '5m';
    this.minPositionUsd = 0.25;

    // Strategy Configuration (MoonDev's exact parameters)
    this.config = {
      numBars: 180,                // Look back period (15 hours on 5m)
      percentileFromLH: 0.35,      // 0.35% from local high/low
      exitPercent: 0.4,            // 0.4% take profit
      stopLossPercent: 0.1,        // 0.1% stop loss
      timeLimitSeconds: 120,       // 2 minute time limit
      maxRiskUsd: 1100,            // Maximum risk in USD
      quartile: 0.33,              // Quartile for position sizing
      maxLocalHigh: 1250           // Maximum local high threshold
    };

    // Metadata for strategy selection
    this.metadata = {
      profitTarget: '0.4%',
      riskLevel: 'Medium-High',
      speed: 'Fast',
      marketType: 'Volatile',
      bestTimeframes: ['5m', '15m'],
      whyChooseThis: [
        'Excellent for volatile, ranging markets',
        'Tight profit targets (0.4%) for quick wins',
        'Built-in risk management with kill switch',
        'High frequency trading with fast exits',
        'Perfect for market making opportunities'
      ]
    };
  }

  /**
   * Calculate local high and low
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Local high/low with positions
   */
  calculateLocalHighsLows(candles) {
    const lookback = this.config.numBars;
    const recentCandles = candles.slice(-lookback);

    let localHigh = Math.max(...recentCandles.map(c => c.high));
    let localLow = Math.min(...recentCandles.map(c => c.low));

    // Find positions of local high/low
    const highIndex = recentCandles.findIndex(c => c.high === localHigh);
    const lowIndex = recentCandles.findIndex(c => c.low === localLow);

    // Calculate percentile position (how far from extremes)
    const highPercentile = (candles.length - highIndex) / candles.length;
    const lowPercentile = (candles.length - lowIndex) / candles.length;

    return {
      localHigh,
      localLow,
      highIndex,
      lowIndex,
      highPercentile,
      lowPercentile,
      isNearHigh: highPercentile > this.config.quartile,
      isNearLow: lowPercentile > this.config.quartile
    };
  }

  /**
   * Calculate order placement prices
   * @param {number} localHigh - Local high price
   * @param {number} localLow - Local low price
   * @param {number} currentPrice - Current market price
   * @returns {Object} - Order prices for buy/sell
   */
  calculateOrderPrices(localHigh, localLow, currentPrice) {
    const { percentileFromLH, exitPercent } = this.config;

    // Calculate buy order (below current price, near local low)
    const buyPrice = currentPrice * (1 - percentileFromLH / 100);
    const buyTarget = buyPrice * (1 + exitPercent / 100);
    const buyStopLoss = buyPrice * (1 - this.config.stopLossPercent / 100);

    // Calculate sell order (above current price, near local high)
    const sellPrice = currentPrice * (1 + percentileFromLH / 100);
    const sellTarget = sellPrice * (1 - exitPercent / 100);
    const sellStopLoss = sellPrice * (1 + this.config.stopLossPercent / 100);

    return {
      buy: {
        entry: buyPrice,
        target: buyTarget,
        stopLoss: buyStopLoss,
        riskReward: (buyTarget - buyPrice) / (buyPrice - buyStopLoss)
      },
      sell: {
        entry: sellPrice,
        target: sellTarget,
        stopLoss: sellStopLoss,
        riskReward: (sellPrice - sellTarget) / (sellStopLoss - sellPrice)
      }
    };
  }

  /**
   * Check if market conditions are suitable
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Market condition assessment
   */
  assessMarketConditions(candles) {
    if (candles.length < this.config.numBars) {
      return { suitable: false, reason: 'Insufficient data' };
    }

    const { localHigh, localLow } = this.calculateLocalHighsLows(candles);
    const currentPrice = candles[candles.length - 1].close;
    const range = ((localHigh - localLow) / localLow) * 100;

    // Check if range is adequate
    const adequateRange = range > 0.5; // At least 0.5% range

    // Check if not at extremes (leaving room for movement)
    const distanceFromHigh = ((localHigh - currentPrice) / localHigh) * 100;
    const distanceFromLow = ((currentPrice - localLow) / localLow) * 100;

    const hasRoomToMove = distanceFromHigh > 0.2 && distanceFromLow > 0.2;

    // Check volatility (average true range or recent price movement)
    const atr = this.calculateATR(candles.slice(-14));
    const isVolatile = atr > (currentPrice * 0.003); // 0.3% ATR threshold

    return {
      suitable: adequateRange && hasRoomToMove && isVolatile,
      range,
      distanceFromHigh,
      distanceFromLow,
      atr,
      isVolatile,
      reason: !adequateRange ? 'Range too small' :
              !hasRoomToMove ? 'Too close to extremes' :
              !isVolatile ? 'Insufficient volatility' : 'Market conditions favorable'
    };
  }

  /**
   * Calculate Average True Range
   * @private
   */
  calculateATR(candles) {
    if (candles.length < 2) return 0;

    let trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }

  /**
   * Generate trading signals
   * @param {Array} candles - Array of OHLCV candles
   * @returns {Object} - Trading signals and recommendations
   */
  generateSignal(candles) {
    if (candles.length < this.config.numBars) {
      return { signal: 'HOLD', reason: 'Insufficient data for analysis' };
    }

    const currentPrice = candles[candles.length - 1].close;
    const marketAssessment = this.assessMarketConditions(candles);

    if (!marketAssessment.suitable) {
      return {
        signal: 'HOLD',
        reason: `Market not suitable: ${marketAssessment.reason}`,
        confidence: 0.3
      };
    }

    const { localHigh, localLow } = this.calculateLocalHighsLows(candles);
    const orderPrices = this.calculateOrderPrices(localHigh, localLow, currentPrice);

    // Determine position to take based on current price relative to local range
    const positionInRange = (currentPrice - localLow) / (localHigh - localLow);

    let signal = 'HOLD';
    let reason = '';
    let confidence = 0.5;

    if (positionInRange < 0.33) {
      // Near local low - good for buy
      signal = 'BUY';
      reason = `Price near local low (${positionInRange.toFixed(2)} in range). ` +
               `Order at ${(this.config.percentileFromLH)}% below current`;
      confidence = 0.75;
    } else if (positionInRange > 0.67) {
      // Near local high - good for sell
      signal = 'SELL';
      reason = `Price near local high (${positionInRange.toFixed(2)} in range). ` +
               `Order at ${(this.config.percentileFromLH)}% above current`;
      confidence = 0.75;
    } else {
      // Middle range - wait for price to move toward extremes
      reason = `Price in middle of range (${positionInRange.toFixed(2)}). ` +
               `Waiting for movement toward extremes`;
      confidence = 0.4;
    }

    return {
      signal,
      reason,
      confidence,
      currentPrice,
      localHigh,
      localLow,
      orderPrices,
      marketAssessment
    };
  }

  /**
   * Calculate position size with risk management
   * @param {number} accountBalance - Available balance in USD
   * @param {number} entryPrice - Planned entry price
   * @returns {Object} - Position size and risk metrics
   */
  calculatePositionSize(accountBalance, entryPrice) {
    const minSize = this.minPositionUsd;
    const maxSize = Math.min(accountBalance * 0.05, 100); // Max 5% of balance or $100

    // Base position size (conservative for market making)
    const baseSize = Math.min(maxSize, 25); // Default $25 positions

    // Adjust based on account balance
    const calculatedSize = Math.min(baseSize, accountBalance * 0.02);

    return {
      size: Math.max(minSize, calculatedSize),
      percentOfBalance: (Math.max(minSize, calculatedSize) / accountBalance) * 100,
      maxRiskUsd: this.config.maxRiskUsd,
      isWithinRiskLimits: calculatedSize <= this.config.maxRiskUsd
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
      minPositionUsd: this.minPositionUsd
    };
  }
}

// Export as ES6 module
export default MarketMakerStrategy;
