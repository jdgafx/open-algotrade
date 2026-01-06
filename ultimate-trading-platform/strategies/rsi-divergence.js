/**
 * RSI DIVERGENCE - MOONDEV STYLE
 * Trades momentum reversals using RSI divergence
 *
 * HOW IT WORKS:
 * - Identifies divergences between price and RSI
 * - Bullish divergence: Price makes lower low, RSI makes higher low
 * - Bearish divergence: Price makes higher high, RSI makes lower high
 * - Takes profit at 0.4%
 * - Stop loss at 0.25%
 *
 * PROFIT TARGET: Moderate (0.4% per trade)
 * RISK LEVEL: Medium
 * BEST TIMEFRAMES: 15m, 1h, 4h
 * MIN POSITION: $0.25
 *
 * WHY CHOOSE THIS:
 * - Catches trend reversals early
 * - Works well in ranging markets
 * - Good risk/reward ratio
 * - Clear entry signals
 */

class RSIDivergenceStrategy {
  constructor() {
    this.name = 'RSI Divergence';
    this.description = 'Trades momentum reversals using RSI divergence';
    this.minPositionUsd = 0.25;
    this.author = 'MoonDev Algo #5';
    this.riskLevel = 'Medium';
    this.profitTarget = '0.4% per trade';
    this.timeframes = ['15m', '1h', '4h'];
    this.bestMarket = 'Ranging/Reversal';

    // MOONDEV CONFIG
    this.config = {
      rsiPeriod: 14,               // RSI calculation period
      lookbackPeriod: 5,           // Candles to look for divergence
      takeProfitPercent: 0.4,      // Profit target
      stopLossPercent: 0.25,       // Stop loss
      rsiOverbought: 70,           // RSI overbought level
      rsiOversold: 30,             // RSI oversold level
      timeframe: '1h'              // Analysis timeframe
    };

    this.positions = [];
    this.closedPositions = [];
    this.initialized = false;
  }

  /**
   * Initialize strategy
   */
  async initialize(marketData) {
    try {
      console.log(`[${this.name}] Initializing...`);
      console.log(`[${this.name}] RSI Period: ${this.config.rsiPeriod}`);
      console.log(`[${this.name}] ✅ Ready to catch divergences!`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.name}] Initialization error:`, error);
      return false;
    }
  }

  /**
   * Calculate RSI
   */
  calculateRSI(candles, period = 14) {
    if (candles.length < period + 1) return null;

    const changes = [];
    for (let i = 1; i < candles.length; i++) {
      changes.push(candles[i].close - candles[i - 1].close);
    }

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Find RSI divergences
   */
  findDivergences(candles) {
    if (candles.length < this.config.lookbackPeriod * 2) {
      return { bullish: false, bearish: false };
    }

    // Get price extremes
    const recentCandles = candles.slice(-this.config.lookbackPeriod * 2);
    const prices = recentCandles.map(c => c.close);
    const rsiValues = [];

    for (let i = this.config.rsiPeriod; i < recentCandles.length; i++) {
      const subset = recentCandles.slice(i - this.config.rsiPeriod, i);
      const rsi = this.calculateRSI(subset, this.config.rsiPeriod);
      if (rsi !== null) rsiValues.push(rsi);
    }

    if (rsiValues.length < 2) return { bullish: false, bearish: false };

    // Check for bullish divergence (price lower low, RSI higher low)
    const recentPriceLow = Math.min(...prices.slice(-this.config.lookbackPeriod));
    const previousPriceLow = Math.min(...prices.slice(0, -this.config.lookbackPeriod));

    const recentRSILow = Math.min(...rsiValues.slice(-this.config.lookbackPeriod));
    const previousRSILow = Math.min(...rsiValues.slice(0, -this.config.lookbackPeriod));

    const bullishDivergence = recentPriceLow < previousPriceLow && recentRSILow > previousRSILow;

    // Check for bearish divergence (price higher high, RSI lower high)
    const recentPriceHigh = Math.max(...prices.slice(-this.config.lookbackPeriod));
    const previousPriceHigh = Math.max(...prices.slice(0, -this.config.lookbackPeriod));

    const recentRSIHigh = Math.max(...rsiValues.slice(-this.config.lookbackPeriod));
    const previousRSIHigh = Math.max(...rsiValues.slice(0, -this.config.lookbackPeriod));

    const bearishDivergence = recentPriceHigh > previousPriceHigh && recentRSIHigh < previousRSIHigh;

    return {
      bullish: bullishDivergence,
      bearish: bearishDivergence,
      currentRSI: rsiValues[rsiValues.length - 1]
    };
  }

  /**
   * Generate signals - MOONDEV STYLE
   */
  generateSignals(candles, marketData) {
    const signals = [];
    const currentPrice = marketData.price;

    if (!this.initialized || candles.length < this.config.rsiPeriod + 10) {
      return signals;
    }

    const currentRSI = this.calculateRSI(candles, this.config.rsiPeriod);
    if (currentRSI === null) return signals;

    const divergences = this.findDivergences(candles);

    // BULLISH DIVERGENCE + Oversold RSI
    if (divergences.bullish && currentRSI < this.config.rsiOversold) {
      const stopLoss = currentPrice * (1 - this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 + this.config.takeProfitPercent / 100);

      signals.push({
        type: 'BUY',
        price: currentPrice,
        confidence: 0.8,
        reason: `Bullish divergence detected. RSI: ${currentRSI.toFixed(2)} (oversold)`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          rsi: currentRSI.toFixed(2),
          divergence: 'bullish'
        }
      });
    }

    // BEARISH DIVERGENCE + Overbought RSI
    else if (divergences.bearish && currentRSI > this.config.rsiOverbought) {
      const stopLoss = currentPrice * (1 + this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 - this.config.takeProfitPercent / 100);

      signals.push({
        type: 'SELL',
        price: currentPrice,
        confidence: 0.8,
        reason: `Bearish divergence detected. RSI: ${currentRSI.toFixed(2)} (overbought)`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          rsi: currentRSI.toFixed(2),
          divergence: 'bearish'
        }
      });
    }

    // Check exits
    this.checkExitConditions(signals, currentPrice);

    return signals;
  }

  /**
   * Check exit conditions
   */
  checkExitConditions(signals, currentPrice) {
    this.positions.forEach(position => {
      const pnlPercent = position.side === 'long'
        ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

      if (pnlPercent >= this.config.takeProfitPercent) {
        signals.push({
          type: position.side === 'long' ? 'SELL' : 'BUY',
          price: currentPrice,
          confidence: 0.9,
          reason: `Take profit: ${pnlPercent.toFixed(2)}% gain`,
          positionId: position.id,
          exitType: 'take_profit'
        });
      } else if (pnlPercent <= -this.config.stopLossPercent) {
        signals.push({
          type: position.side === 'long' ? 'SELL' : 'BUY',
          price: currentPrice,
          confidence: 0.9,
          reason: `Stop loss: ${pnlPercent.toFixed(2)}% loss`,
          positionId: position.id,
          exitType: 'stop_loss'
        });
      }
    });
  }

  /**
   * Add position
   */
  addPosition(signal, marketData) {
    const position = {
      id: signal.positionId || (Date.now() + Math.random()),
      symbol: marketData.symbol,
      side: signal.type === 'BUY' ? 'long' : 'short',
      entryPrice: signal.price,
      size: signal.size || 0,
      timestamp: Date.now(),
      status: 'open',
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      strategy: this.name
    };

    this.positions.push(position);
    console.log(`[${this.name}] Position opened:`, {
      side: position.side,
      price: position.entryPrice
    });

    return position;
  }

  /**
   * Close position
   */
  closePosition(positionId, exitPrice, reason) {
    const position = this.positions.find(p => p.id === positionId);
    if (!position) return null;

    position.exitPrice = exitPrice;
    position.exitTimestamp = Date.now();
    position.status = 'closed';
    position.closeReason = reason;
    position.pnl = this.calculatePnL(position);

    this.closedPositions.push(position);
    this.positions = this.positions.filter(p => p.id !== positionId);

    console.log(`[${this.name}] Position closed:`, {
      pnl: position.pnl.toFixed(2),
      reason: reason
    });

    return position;
  }

  /**
   * Calculate P&L
   */
  calculatePnL(position) {
    if (position.side === 'long') {
      return (position.exitPrice - position.entryPrice) * position.size;
    } else {
      return (position.entryPrice - position.exitPrice) * position.size;
    }
  }

  /**
   * Get performance
   */
  getPerformance() {
    const totalTrades = this.closedPositions.length;
    const winningTrades = this.closedPositions.filter(p => p.pnl > 0).length;
    const totalPnL = this.closedPositions.reduce((sum, p) => sum + p.pnl, 0);

    return {
      strategy: this.name,
      author: this.author,
      totalTrades,
      winningTrades,
      winRate: totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) + '%' : '0%',
      totalPnL: totalPnL.toFixed(2),
      openPositions: this.positions.length
    };
  }

  /**
   * Get strategy info
   */
  getStrategyInfo() {
    return {
      id: 'rsi-divergence',
      name: this.name,
      description: this.description,
      author: this.author,
      riskLevel: this.riskLevel,
      profitTarget: this.profitTarget,
      timeframes: this.timeframes,
     .bestMarket,
      minPosition: `$${this.minPositionUsd}`,
      howItWorks bestMarket: this: 'Detects divergences between price and RSI for early reversal signals.',
      whyChoose: 'Catches trend reversals. Works well in ranging markets.',
      config: this.config
    };
  }

  /**
   * Clean up
   */
  destroy() {
    this.positions = [];
    this.closedPositions = [];
    this.initialized = false;
  }
}

export default RSIDivergenceStrategy;
