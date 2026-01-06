/**
 * BOLLINGER SQUEEZE - MOONDEV STYLE
 * Trades volatility expansion after consolidation
 *
 * HOW IT WORKS:
 * - Identifies periods of low volatility (Bollinger Band squeeze)
 * - Enters trades when volatility expands (bands widen)
 * - Takes profit at 0.5% (higher reward)
 * - Stop loss at 0.3%
 * - Works on all timeframes
 *
 * PROFIT TARGET: High (0.5% per trade)
 * RISK LEVEL: Medium-High
 * BEST TIMEFRAMES: 5m, 15m, 1h, 4h
 * MIN POSITION: $0.25
 *
 * WHY CHOOSE THIS:
 * - Catches big moves early
 * - High reward-to-risk ratio
 * - Works in trending markets
 * - Good for volatile periods
 */

class BollingerSqueezeStrategy {
  constructor() {
    this.name = 'Bollinger Squeeze';
    this.description = 'Trades volatility expansion after consolidation';
    this.minPositionUsd = 0.25;
    this.author = 'MoonDev Algo #4';
    this.riskLevel = 'Medium-High';
    this.profitTarget = '0.5% per trade';
    this.timeframes = ['5m', '15m', '1h', '4h'];
    this.bestMarket = 'Trending/Volatile';

    // MOONDEV CONFIG
    this.config = {
      period: 20,                    // Bollinger period
      stdDev: 2,                     // Standard deviations
      takeProfitPercent: 0.5,        // Profit target
      stopLossPercent: 0.3,          // Stop loss
      squeezeThreshold: 0.15,        // % below normal volatility
      timeframe: '15m'               // Analysis timeframe
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
      console.log(`[${this.name}] Bollinger Period: ${this.config.period}`);
      console.log(`[${this.name}] ✅ Ready to catch volatility explosions!`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[${this.name}] Initialization error:`, error);
      return false;
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(candles, period, stdDev) {
    if (candles.length < period) return null;

    const closes = candles.slice(-period).map(c => c.close);
    const sma = closes.reduce((a, b) => a + b, 0) / period;

    // Calculate standard deviation
    const variance = closes.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upperBand = sma + (standardDeviation * stdDev);
    const lowerBand = sma - (standardDeviation * stdDev);
    const bandWidth = ((upperBand - lowerBand) / sma) * 100;

    return {
      sma,
      upperBand,
      lowerBand,
      bandWidth,
      currentPrice: candles[candles.length - 1].close
    };
  }

  /**
   * Detect squeeze condition
   */
  detectSqueeze(bollingerData, historicalBandWidths) {
    if (!bollingerData || historicalBandWidths.length < 10) {
      return { isSqueeze: false };
    }

    const avgBandWidth = historicalBandWidths.reduce((a, b) => a + b, 0) / historicalBandWidths.length;
    const isSqueeze = bollingerData.bandWidth < (avgBandWidth * (1 - this.config.squeezeThreshold / 100));

    return {
      isSqueeze,
      currentBandWidth: bollingerData.bandWidth,
      avgBandWidth,
      squeezePercent: ((avgBandWidth - bollingerData.bandWidth) / avgBandWidth) * 100
    };
  }

  /**
   * Generate signals - MOONDEV STYLE
   */
  generateSignals(candles, marketData) {
    const signals = [];
    const currentPrice = marketData.price;

    if (!this.initialized || candles.length < this.config.period + 10) {
      return signals;
    }

    // Calculate Bollinger Bands
    const bollingerData = this.calculateBollingerBands(
      candles,
      this.config.period,
      this.config.stdDev
    );

    if (!bollingerData) return signals;

    // Calculate historical band widths
    const historicalBandWidths = [];
    for (let i = this.config.period; i < candles.length; i++) {
      const subset = candles.slice(i - this.config.period, i);
      const bb = this.calculateBollingerBands(subset, this.config.period, this.config.stdDev);
      if (bb) {
        historicalBandWidths.push(((bb.upperBand - bb.lowerBand) / bb.sma) * 100);
      }
    }

    // Detect squeeze
    const squeeze = detectSqueeze(bollingerData, historicalBandWidths);

    // BULLISH BREAKOUT: Price breaks above upper band after squeeze
    if (currentPrice > bollingerData.upperBand) {
      const stopLoss = currentPrice * (1 - this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 + this.config.takeProfitPercent / 100);

      signals.push({
        type: 'BUY',
        price: currentPrice,
        confidence: squeeze.isSqueeze ? 0.85 : 0.65,
        reason: `Bollinger breakout ${squeeze.isSqueeze ? '(after squeeze)' : ''}. BB Width: ${bollingerData.bandWidth.toFixed(2)}%`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          upperBand: bollingerData.upperBand.toFixed(2),
          sma: bollingerData.sma.toFixed(2),
          bandWidth: bollingerData.bandWidth.toFixed(2),
          squeezePercent: squeeze.squeezePercent?.toFixed(2)
        }
      });
    }

    // BEARISH BREAKOUT: Price breaks below lower band after squeeze
    else if (currentPrice < bollingerData.lowerBand) {
      const stopLoss = currentPrice * (1 + this.config.stopLossPercent / 100);
      const takeProfit = currentPrice * (1 - this.config.takeProfitPercent / 100);

      signals.push({
        type: 'SELL',
        price: currentPrice,
        confidence: squeeze.isSqueeze ? 0.85 : 0.65,
        reason: `Bollinger breakdown ${squeeze.isSqueeze ? '(after squeeze)' : ''}. BB Width: ${bollingerData.bandWidth.toFixed(2)}%`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        strategy: this.name,
        metadata: {
          lowerBand: bollingerData.lowerBand.toFixed(2),
          sma: bollingerData.sma.toFixed(2),
          bandWidth: bollingerData.bandWidth.toFixed(2),
          squeezePercent: squeeze.squeezePercent?.toFixed(2)
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
      id: 'bollinger-squeeze',
      name: this.name,
      description: this.description,
      author: this.author,
      riskLevel: this.riskLevel,
      profitTarget: this.profitTarget,
      timeframes: this.timeframes,
      bestMarket: this.bestMarket,
      minPosition: `$${this.minPositionUsd}`,
      howItWorks: 'Detects low volatility periods, trades volatility expansion for big moves.',
      whyChoose: 'High reward potential. Catches explosive moves early.',
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

export default BollingerSqueezeStrategy;
