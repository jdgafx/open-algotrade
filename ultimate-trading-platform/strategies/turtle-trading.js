/**
 * TURTLE TRADING STRATEGY - MOONDEV STYLE
 * Classic trend-following breakout system
 *
 * HOW IT WORKS:
 * - Enters long when price breaks above 55-period high
 * - Enters short when price breaks below 55-period low
 * - Uses ATR for stop losses (2x ATR)
 * - Takes profit at 0.2% gain
 * - Best for trending markets
 *
 * PROFIT TARGET: Moderate (0.2% per trade)
 * RISK LEVEL: Medium
 * BEST TIMEFRAMES: 5m, 15m, 1h, 4h
 * MIN POSITION: $0.25
 *
 * WHY CHOOSE THIS:
 * - Simple and reliable
 * - Works well in trending markets
 * - Good for consistent small profits
 * - Lower stress than high-frequency strategies
 */

class TurtleTradingStrategy {
  constructor() {
    this.name = 'Turtle Trading';
    this.description = 'Classic trend-following breakout strategy';
    this.minPositionUsd = 0.25;
    this.author = 'MoonDev Algo #1';
    this.riskLevel = 'Medium';
    this.profitTarget = '0.2% per trade';
    this.timeframes = ['5m', '15m', '1h', '4h'];
    this.bestMarket = 'Trending';

    // MOONDEV CONFIG - Easy to modify
    this.config = {
      breakoutPeriod: 55,        // Number of candles to look back for high/low
      timeFrame: '15m',          // Timeframe for analysis
      takeProfitPercent: 0.2,    // Profit target (0.2%)
      stopLossMultiplier: 2.0,   // ATR multiplier for stop loss
      tradingHours: {            // Trading session (EST)
        start: '09:30',
        end: '16:00',
        days: [1, 2, 3, 4, 5]    // Monday to Friday
      }
    };

    this.positions = [];
    this.closedPositions = [];
    this.initialized = false;
  }

  /**
   * Initialize strategy - MOONDEV STYLE
   */
  async initialize(marketData) {
    try {
      console.log(`[${this.name}] Initializing strategy...`);
      console.log(`[${this.name}] Timeframe: ${this.config.timeFrame}`);
      console.log(`[${this.name}] Min Position: $${this.minPositionUsd}`);
      console.log(`[${this.name}] ✅ Ready to trade!`);

      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.name}] Initialization error:`, error);
      return false;
    }
  }

  /**
   * Calculate ATR (Average True Range) - MOONDEV STYLE
   */
  calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return null;

    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    const sum = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Check if we're in trading hours - MOONDEV STYLE
   */
  isInTradingHours() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 100 + minute;

    const startTime = 930;  // 9:30 AM
    const endTime = 1600;   // 4:00 PM

    // Check if it's a weekday
    if (!this.config.tradingHours.days.includes(day)) {
      return false;
    }

    // Check if within trading hours
    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Get highest high and lowest low - MOONDEV STYLE
   */
  getExtremePrices(candles, period) {
    if (candles.length < period) {
      return { highestHigh: null, lowestLow: null };
    }

    const recentCandles = candles.slice(-period);
    const highestHigh = Math.max(...recentCandles.map(c => c.high));
    const lowestLow = Math.min(...recentCandles.map(c => c.low));

    return { highestHigh, lowestLow };
  }

  /**
   * Calculate position size - MOONDEV STYLE
   */
  calculatePositionSize(accountBalance, entryPrice, atr) {
    // Risk 2% of account per trade
    const riskAmount = accountBalance * 0.02;
    const stopLossDistance = atr * this.config.stopLossMultiplier;

    if (stopLossDistance === 0) return 0;

    const positionSize = riskAmount / stopLossDistance;
    const positionValue = positionSize * entryPrice;

    // Ensure minimum position size
    return Math.max(positionValue, this.minPositionUsd) / entryPrice;
  }

  /**
   * Generate trading signals - MOONDEV STYLE
   */
  generateSignals(candles, marketData) {
    const signals = [];
    const currentPrice = marketData.price;

    if (!this.initialized || candles.length < this.config.breakoutPeriod) {
      return signals;
    }

    // Only trade during specified hours
    if (!this.isInTradingHours()) {
      return signals;
    }

    // Get extremes
    const { highestHigh, lowestLow } = this.getExtremePrices(
      candles,
      this.config.breakoutPeriod
    );

    if (highestHigh === null || lowestLow === null) {
      return signals;
    }

    // Calculate ATR for stop loss
    const atr = this.calculateATR(candles);
    const prevCandle = candles[candles.length - 2];
    const prevPrice = prevCandle ? prevCandle.close : currentPrice;

    // LONG ENTRY: Price breaks above 55-period high
    if (currentPrice > highestHigh && prevPrice <= highestHigh) {
      const stopLoss = currentPrice - (atr * this.config.stopLossMultiplier);
      const takeProfit = currentPrice * (1 + this.config.takeProfitPercent / 100);

      signals.push({
        type: 'BUY',
        price: currentPrice,
        confidence: 0.75,
        reason: `Breakout above ${this.config.breakoutPeriod}-period high: ${highestHigh.toFixed(2)}`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          atr: atr.toFixed(4),
          highestHigh: highestHigh.toFixed(2),
          timeframe: this.config.timeFrame
        }
      });
    }

    // SHORT ENTRY: Price breaks below 55-period low
    else if (currentPrice < lowestLow && prevPrice >= lowestLow) {
      const stopLoss = currentPrice + (atr * this.config.stopLossMultiplier);
      const takeProfit = currentPrice * (1 - this.config.takeProfitPercent / 100);

      signals.push({
        type: 'SELL',
        price: currentPrice,
        confidence: 0.75,
        reason: `Breakdown below ${this.config.breakoutPeriod}-period low: ${lowestLow.toFixed(2)}`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          atr: atr.toFixed(4),
          lowestLow: lowestLow.toFixed(2),
          timeframe: this.config.timeFrame
        }
      });
    }

    // Check exit conditions for existing positions
    this.checkExitConditions(signals, currentPrice);

    return signals;
  }

  /**
   * Check exit conditions - MOONDEV STYLE
   */
  checkExitConditions(signals, currentPrice) {
    this.positions.forEach(position => {
      // Calculate P&L percentage
      const pnlPercent = position.side === 'long'
        ? ((currentPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - currentPrice) / position.entryPrice) * 100;

      // Exit on take profit
      if (pnlPercent >= this.config.takeProfitPercent) {
        signals.push({
          type: position.side === 'long' ? 'SELL' : 'BUY',
          price: currentPrice,
          confidence: 0.9,
          reason: `Take profit hit: ${pnlPercent.toFixed(2)}% gain`,
          positionId: position.id,
          exitType: 'take_profit'
        });
      }

      // Exit on stop loss
      else if (pnlPercent <= -this.config.stopLossMultiplier) {
        signals.push({
          type: position.side === 'long' ? 'SELL' : 'BUY',
          price: currentPrice,
          confidence: 0.9,
          reason: `Stop loss hit: ${pnlPercent.toFixed(2)}% loss`,
          positionId: position.id,
          exitType: 'stop_loss'
        });
      }
    });
  }

  /**
   * Add new position
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
      confidence: signal.confidence,
      strategy: this.name,
      metadata: signal.metadata
    };

    this.positions.push(position);
    console.log(`[${this.name}] Position opened:`, {
      side: position.side,
      price: position.entryPrice,
      size: position.size,
      stopLoss: position.stopLoss?.toFixed(2),
      takeProfit: position.takeProfit?.toFixed(2)
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
    position.pnlPercent = this.calculatePnLPercent(position);

    this.closedPositions.push(position);
    this.positions = this.positions.filter(p => p.id !== positionId);

    console.log(`[${this.name}] Position closed:`, {
      pnl: position.pnl.toFixed(2),
      pnlPercent: position.pnlPercent.toFixed(2) + '%',
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
   * Calculate P&L percentage
   */
  calculatePnLPercent(position) {
    return position.pnl / (position.entryPrice * position.size) * 100;
  }

  /**
   * Get strategy performance - MOONDEV STYLE
   */
  getPerformance() {
    const totalTrades = this.closedPositions.length;
    const winningTrades = this.closedPositions.filter(p => p.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;

    const totalPnL = this.closedPositions.reduce((sum, p) => sum + p.pnl, 0);
    const avgWin = winningTrades > 0
      ? this.closedPositions.filter(p => p.pnl > 0).reduce((sum, p) => sum + p.pnl, 0) / winningTrades
      : 0;
    const avgLoss = losingTrades > 0
      ? this.closedPositions.filter(p => p.pnl < 0).reduce((sum, p) => sum + p.pnl, 0) / losingTrades
      : 0;

    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

    return {
      strategy: this.name,
      author: this.author,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(1) + '%',
      totalPnL: totalPnL.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      openPositions: this.positions.length,
      config: this.config
    };
  }

  /**
   * Get strategy info for UI - MOONDEV STYLE
   */
  getStrategyInfo() {
    return {
      id: 'turtle-trading',
      name: this.name,
      description: this.description,
      author: this.author,
      riskLevel: this.riskLevel,
      profitTarget: this.profitTarget,
      timeframes: this.timeframes,
      bestMarket: this.bestMarket,
      minPosition: `$${this.minPositionUsd}`,
      howItWorks: 'Enters trades when price breaks 55-period highs/lows. Uses ATR for stop losses.',
      whyChoose: 'Simple, reliable, good for trending markets. Lower stress than high-frequency trading.',
      config: this.config
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.positions = [];
    this.closedPositions = [];
    this.initialized = false;
  }
}

export default TurtleTradingStrategy;
