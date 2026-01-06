/**
 * Momentum Trading Strategy
 * RSI/MACD momentum-based strategy
 */

class MomentumTradingStrategy {
  constructor(config = {}) {
    this.name = 'Momentum Trading';
    this.minPositionUsd = 0.25; // CRITICAL
    this.config = {
      rsiPeriod: config.rsiPeriod || 14,
      rsiOverbought: config.rsiOverbought || 70,
      rsiOversold: config.rsiOversold || 30,
      macdFast: config.macdFast || 12,
      macdSlow: config.macdSlow || 26,
      macdSignal: config.macdSignal || 9,
      momentumPeriod: config.momentumPeriod || 10,
      volumeMA: config.volumeMA || 20,
      confirmationBars: config.confirmationBars || 2,
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
    this.signals = [];
  }

  /**
   * Generate trading signal based on momentum indicators
   */
  generateSignal(candles, indicators) {
    if (candles.length < this.config.macdSlow) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const currentPrice = candles[candles.length - 1].close;
    const rsi = indicators.rsi || this.calculateRSI(candles, this.config.rsiPeriod);
    const macd = indicators.macd || this.calculateMACD(candles);
    const momentum = indicators.momentum || this.calculateMomentum(candles, this.config.momentumPeriod);
    const volumeMA = indicators.volumeMA || this.calculateVolumeMA(candles, this.config.volumeMA);

    if (!macd || !momentum) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const currentVolume = candles[candles.length - 1].volume || 0;
    const volumeConfirm = currentVolume > volumeMA * 1.2;

    // Strong buy signal: Multiple momentum confirmations
    if (rsi < this.config.rsiOversold &&
        macd.macd > macd.signal &&
        macd.macd > macd.macdPrev &&
        momentum > 0 &&
        volumeConfirm) {

      return {
        signal: 'BUY',
        confidence: 0.95,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Strong buy: RSI oversold (${rsi.toFixed(1)}), MACD bullish crossover, positive momentum, volume surge`
      };
    }

    // Buy signal: RSI oversold with MACD confirmation
    if (rsi < this.config.rsiOversold && macd.macd > macd.signal) {
      return {
        signal: 'BUY',
        confidence: 0.8,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Buy: RSI oversold (${rsi.toFixed(1)}) with MACD bullish`
      };
    }

    // Buy signal: MACD bullish crossover with momentum
    if (macd.macd > macd.signal &&
        macd.macd > macd.macdPrev &&
        momentum > 0) {
      return {
        signal: 'BUY',
        confidence: 0.75,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Buy: MACD bullish crossover with positive momentum`
      };
    }

    // Strong sell signal: Multiple momentum confirmations
    if (rsi > this.config.rsiOverbought &&
        macd.macd < macd.signal &&
        macd.macd < macd.macdPrev &&
        momentum < 0 &&
        volumeConfirm) {

      return {
        signal: 'SELL',
        confidence: 0.95,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Strong sell: RSI overbought (${rsi.toFixed(1)}), MACD bearish crossover, negative momentum, volume surge`
      };
    }

    // Sell signal: RSI overbought with MACD confirmation
    if (rsi > this.config.rsiOverbought && macd.macd < macd.signal) {
      return {
        signal: 'SELL',
        confidence: 0.8,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Sell: RSI overbought (${rsi.toFixed(1)}) with MACD bearish`
      };
    }

    // Sell signal: MACD bearish crossover with momentum
    if (macd.macd < macd.signal &&
        macd.macd < macd.macdPrev &&
        momentum < 0) {
      return {
        signal: 'SELL',
        confidence: 0.75,
        rsi,
        macd,
        momentum,
        volumeConfirm,
        reason: `Sell: MACD bearish crossover with negative momentum`
      };
    }

    // Exit signal: Momentum fades
    if (Math.sign(momentum) !== Math.sign(this.getPreviousMomentum(candles)) &&
        Math.abs(momentum) < 0.5) {
      return {
        signal: 'EXIT',
        confidence: 0.6,
        reason: 'Momentum reversal detected'
      };
    }

    return { signal: 'HOLD', confidence: 0 };
  }

  /**
   * Calculate position size based on momentum strength
   */
  calculatePositionSize(signal, portfolio) {
    const { riskPerTrade } = this.config;
    const currentPrice = signal.price || 0;
    const availableUsd = portfolio.totalUsd || 1000;

    if (availableUsd < this.minPositionUsd) {
      return { size: 0, amount: 0 };
    }

    // Increase size with stronger momentum signals
    const momentumMultiplier = Math.min((signal.confidence || 0.5) * 2, 2);
    const adjustedRisk = riskPerTrade * momentumMultiplier;

    const amount = availableUsd * adjustedRisk;
    const size = amount / currentPrice;

    return {
      size,
      amount,
      momentumMultiplier
    };
  }

  /**
   * Get entry conditions for the strategy
   */
  getEntryConditions() {
    return {
      long: [
        `RSI below ${this.config.rsiOversold} (oversold)`,
        `MACD line above signal line (bullish crossover)`,
        `Positive momentum for ${this.config.momentumPeriod} periods`,
        `Volume above ${this.config.volumeMA}-period average`
      ],
      short: [
        `RSI above ${this.config.rsiOverbought} (overbought)`,
        `MACD line below signal line (bearish crossover)`,
        `Negative momentum for ${this.config.momentumPeriod} periods`,
        `Volume above ${this.config.volumeMA}-period average`
      ]
    };
  }

  /**
   * Get exit conditions for the strategy
   */
  getExitConditions() {
    return {
      profit: [
        `Target: RSI returns to neutral (40-60 range)`,
        `Take profit at 2:1 risk-reward ratio`
      ],
      loss: [
        `Stop loss at 2x ATR from entry`,
        `Exit if MACD crosses back (opposite signal)`
      ]
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(entryPrice, side, atr = null) {
    const atrValue = atr || (entryPrice * 0.02);
    const stopDistance = atrValue * 2;

    return side === 'BUY'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(entryPrice, side, stopLoss) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = risk * 2; // 2:1 risk-reward

    return side === 'BUY'
      ? entryPrice + reward
      : entryPrice - reward;
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

    for (let i = this.config.macdSlow; i < historicalData.length; i++) {
      const candles = historicalData.slice(0, i + 1);
      const indicators = {
        rsi: this.calculateRSI(candles),
        macd: this.calculateMACD(candles),
        momentum: this.calculateMomentum(candles),
        volumeMA: this.calculateVolumeMA(candles)
      };

      const signal = this.generateSignal(candles, indicators);

      if (signal.signal === 'BUY' && !portfolio.position) {
        portfolio.position = {
          side: 'BUY',
          entryPrice: candles[candles.length - 1].close,
          atr: this.calculateATR(candles)
        };
      } else if (signal.signal === 'SELL' && !portfolio.position) {
        portfolio.position = {
          side: 'SELL',
          entryPrice: candles[candles.length - 1].close,
          atr: this.calculateATR(candles)
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
   * Calculate MACD
   */
  calculateMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
    if (candles.length < slow) return null;

    const emaFast = this.calculateEMA(candles, fast);
    const emaSlow = this.calculateEMA(candles, slow);
    const macd = emaFast - emaSlow;

    // Calculate signal line (EMA of MACD)
    const macdSlice = candles.slice(-signalPeriod).map((_, i) => {
      const prevEmaFast = this.calculateEMA(candles.slice(0, -signalPeriod + i + 1), fast);
      const prevEmaSlow = this.calculateEMA(candles.slice(0, -signalPeriod + i + 1), slow);
      return (prevEmaFast || 0) - (prevEmaSlow || 0);
    });

    const signal = macdSlice.reduce((a, b) => a + b, 0) / macdSlice.length;

    return {
      macd,
      signal,
      macdPrev: macdSlice[macdSlice.length - 1] || 0,
      histogram: macd - signal
    };
  }

  /**
   * Calculate EMA
   */
  calculateEMA(candles, period) {
    if (candles.length < period) return null;

    const k = 2 / (period + 1);
    let ema = candles[0].close;

    for (let i = 1; i < candles.length; i++) {
      ema = (candles[i].close * k) + (ema * (1 - k));
    }

    return ema;
  }

  /**
   * Calculate Momentum
   */
  calculateMomentum(candles, period = 10) {
    if (candles.length < period + 1) return 0;

    const current = candles[candles.length - 1].close;
    const previous = candles[candles.length - period - 1].close;

    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate Volume Moving Average
   */
  calculateVolumeMA(candles, period = 20) {
    if (candles.length < period) return 0;

    const slice = candles.slice(-period);
    const totalVolume = slice.reduce((sum, c) => sum + (c.volume || 0), 0);

    return totalVolume / slice.length;
  }

  /**
   * Calculate ATR
   */
  calculateATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;

    const trueRanges = [];
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

    const sum = trueRanges.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  /**
   * Get previous momentum
   */
  getPreviousMomentum(candles, period = 10) {
    if (candles.length < period * 2 + 1) return 0;

    const current = candles[candles.length - 1].close;
    const previous = candles[candles.length - period - 1].close;

    return ((current - previous) / previous) * 100;
  }

  /**
   * Get strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      minPositionUsd: this.minPositionUsd,
      rsiPeriod: this.config.rsiPeriod,
      rsiOverbought: this.config.rsiOverbought,
      rsiOversold: this.config.rsiOversold,
      macdFast: this.config.macdFast,
      macdSlow: this.config.macdSlow,
      macdSignal: this.config.macdSignal,
      momentumPeriod: this.config.momentumPeriod,
      volumeMA: this.config.volumeMA,
      confirmationBars: this.config.confirmationBars,
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

export default MomentumTradingStrategy;
