/**
 * CONSOLIDATION POP STRATEGY - MOONDEV STYLE
 * Trades the breakout from consolidation ranges
 *
 * HOW IT WORKS:
 * - Identifies consolidation (sideways price movement)
 * - Buys lows of consolidation expecting a "pop" through resistance
 * - Takes profit at 0.3%
 * - Stop loss at 0.25%
 * - Opposite logic for shorts
 *
 * PROFIT TARGET: Quick (0.3% per trade)
 * RISK LEVEL: Low-Medium
 * BEST TIMEFRAMES: 1m, 3m, 5m, 15m
 * MIN POSITION: $0.25
 *
 * WHY CHOOSE THIS:
 * - Quick profits in choppy markets
 * - Lower risk than trend following
 * - Good for ranging markets
 * - Fast execution
 */

class ConsolidationPopStrategy {
  constructor() {
    this.name = 'Consolidation Pop';
    this.description = 'Trades breakouts from consolidation ranges';
    this.minPositionUsd = 0.25;
    this.author = 'MoonDev Algo #3';
    this.riskLevel = 'Low-Medium';
    this.profitTarget = '0.3% per trade';
    this.timeframes = ['1m', '3m', '5m', '15m'];
    this.bestMarket = 'Ranging/Choppy';

    // MOONDEV CONFIG
    this.config = {
      consolidationPeriod: 10,      // Candles to check for consolidation
      timeframe: '5m',              // Analysis timeframe
      takeProfitPercent: 0.3,       // Profit target
      stopLossPercent: 0.25,        // Stop loss percentage
      consolidationThreshold: 0.7,  // % of price for consolidation detection
      buyZone: 'lower_third',       // Where to buy in consolidation
      sellZone: 'upper_third'       // Where to sell in consolidation
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
      console.log(`[${this.name}] Consolidation detection: ${this.config.consolidationPeriod} candles`);
      console.log(`[${this.name}] ✅ Ready to find consolidations!`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.name}] Initialization error:`, error);
      return false;
    }
  }

  /**
   * Calculate True Range
   */
  calculateTR(high, low, prevClose) {
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    return Math.max(tr1, tr2, tr3);
  }

  /**
   * Detect consolidation - MOONDEV STYLE
   */
  detectConsolidation(candles) {
    if (candles.length < this.config.consolidationPeriod + 1) {
      return { isConsolidating: false };
    }

    const recentCandles = candles.slice(-this.config.consolidationPeriod);
    const currentPrice = candles[candles.length - 1].close;

    // Calculate average true range
    let totalTR = 0;
    for (let i = 1; i < recentCandles.length; i++) {
      const tr = this.calculateTR(
        recentCandles[i].high,
        recentCandles[i].low,
        recentCandles[i - 1].close
      );
      totalTR += tr;
    }
    const avgTR = totalTR / (recentCandles.length - 1);

    // Calculate consolidation percentage
    const consolidationPercent = (avgTR / currentPrice) * 100;

    // Get consolidation range
    const high = Math.max(...recentCandles.map(c => c.high));
    const low = Math.min(...recentCandles.map(c => c.low));
    const range = high - low;

    return {
      isConsolidating: consolidationPercent < this.config.consolidationThreshold,
      consolidationPercent,
      range,
      high,
      low,
      avgTR,
      currentPrice
    };
  }

  /**
   * Get consolidation zones
   */
  getConsolidationZones(range, high, low) {
    const third = range / 3;

    return {
      lowerThird: {
        high: low + third,
        low: low
      },
      middleThird: {
        high: low + (third * 2),
        low: low + third
      },
      upperThird: {
        high: high,
        low: high - third
      }
    };
  }

  /**
   * Generate signals - MOONDEV STYLE
   */
  generateSignals(candles, marketData) {
    const signals = [];
    const currentPrice = marketData.price;

    if (!this.initialized || candles.length < this.config.consolidationPeriod) {
      return signals;
    }

    // Detect consolidation
    const consolidation = this.detectConsolidation(candles);

    if (!consolidation.isConsolidating) {
      return signals;
    }

    // Get zones
    const zones = this.getConsolidationZones(
      consolidation.range,
      consolidation.high,
      consolidation.low
    );

    // LONG ENTRY: Price in lower third of consolidation
    if (currentPrice >= zones.lowerThird.low && currentPrice <= zones.lowerThird.high) {
      const stopLoss = currentPrice * (1 - this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 + this.config.takeProfitPercent / 100);

      signals.push({
        type: 'BUY',
        price: currentPrice,
        confidence: 0.7,
        reason: `Buying consolidation low. Range: ${consolidation.low.toFixed(2)} - ${consolidation.high.toFixed(2)}`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          consolidationPercent: consolidation.consolidationPercent.toFixed(2),
          range: consolidation.range.toFixed(2),
          zone: 'lower_third'
        }
      });
    }

    // SHORT ENTRY: Price in upper third of consolidation
    else if (currentPrice >= zones.upperThird.low && currentPrice <= zones.upperThird.high) {
      const stopLoss = currentPrice * (1 + this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 - this.config.takeProfitPercent / 100);

      signals.push({
        type: 'SELL',
        price: currentPrice,
        confidence: 0.7,
        reason: `Selling consolidation high. Range: ${consolidation.low.toFixed(2)} - ${consolidation.high.toFixed(2)}`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          consolidationPercent: consolidation.consolidationPercent.toFixed(2),
          range: consolidation.range.toFixed(2),
          zone: 'upper_third'
        }
      });
    }

    // Check exits for existing positions
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

      // Exit on take profit
      if (pnlPercent >= this.config.takeProfitPercent) {
        signals.push({
          type: position.side === 'long' ? 'SELL' : 'BUY',
          price: currentPrice,
          confidence: 0.9,
          reason: `Take profit: ${pnlPercent.toFixed(2)}% gain`,
          positionId: position.id,
          exitType: 'take_profit'
        });
      }

      // Exit on stop loss
      else if (pnlPercent <= -this.config.stopLossPercent) {
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
      price: position.entryPrice,
      zone: signal.metadata?.zone
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
      id: 'consolidation-pop',
      name: this.name,
      description: this.description,
      author: this.author,
      riskLevel: this.riskLevel,
      profitTarget: this.profitTarget,
      timeframes: this.timeframes,
      bestMarket: this.bestMarket,
      minPosition: `$${this.minPositionUsd}`,
      howItWorks: 'Identifies consolidation ranges and trades breakouts from support/resistance.',
      whyChoose: 'Quick profits in ranging markets. Lower risk than trend following.',
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

export default ConsolidationPopStrategy;
