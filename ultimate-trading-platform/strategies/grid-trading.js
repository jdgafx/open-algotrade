/**
 * Grid Trading Strategy
 * Range-bound grid order strategy for sideways markets
 */

class GridTradingStrategy {
  constructor(config = {}) {
    this.name = 'Grid Trading';
    this.minPositionUsd = 0.25; // CRITICAL
    this.config = {
      gridLevels: config.gridLevels || 10,
      gridSpacing: config.gridSpacing || 0.02, // 2% between levels
      rangePeriod: config.rangePeriod || 50,
      rangeDeviation: config.rangeDeviation || 0.1, // 10% range
      orderSize: config.orderSize || 10, // USD per grid level
      takeProfitPercent: config.takeProfitPercent || 0.015, // 1.5%
      stopLossPercent: config.stopLossPercent || 0.05, // 5%
      minProfitThreshold: config.minProfitThreshold || 0.01, // 1%
      riskPerTrade: config.riskPerTrade || 0.01,
      ...config
    };
    this.grid = new Map();
    this.orders = [];
  }

  /**
   * Initialize strategy with market data
   */
  initialize(marketData) {
    this.marketData = marketData;
    this.positions = new Map();
    this.trades = [];
    this.gridLevels = [];
    this.activeOrders = [];
  }

  /**
   * Generate trading signal based on grid levels
   */
  generateSignal(candles, indicators) {
    if (candles.length < this.config.rangePeriod) {
      return { signal: 'HOLD', confidence: 0 };
    }

    const currentPrice = candles[candles.length - 1].close;
    const range = this.calculatePriceRange(candles);
    const gridSpacing = currentPrice * this.config.gridSpacing;

    if (!range) {
      return { signal: 'HOLD', confidence: 0 };
    }

    // Initialize grid if not exists
    if (this.gridLevels.length === 0) {
      this.initializeGrid(range, currentPrice);
      return {
        signal: 'GRID_INIT',
        confidence: 1.0,
        gridLevels: this.gridLevels,
        reason: `Grid initialized with ${this.gridLevels.length} levels`
      };
    }

    // Check for grid level touch
    const nearestLevel = this.findNearestGridLevel(currentPrice);

    if (nearestLevel && Math.abs(currentPrice - nearestLevel.price) < gridSpacing * 0.3) {
      const side = currentPrice < nearestLevel.price ? 'SELL' : 'BUY';
      return {
        signal: side,
        confidence: 0.85,
        gridLevel: nearestLevel,
        currentPrice,
        reason: `Price touched grid level at ${nearestLevel.price.toFixed(2)}`
      };
    }

    // Check for take profit opportunities
    const takeProfitSignal = this.checkTakeProfit(candles);
    if (takeProfitSignal) {
      return takeProfitSignal;
    }

    // Check if price breaks out of range
    if (currentPrice < range.low || currentPrice > range.high) {
      return {
        signal: 'EXIT_GRID',
        confidence: 0.9,
        reason: 'Price broke out of trading range',
        range
      };
    }

    return { signal: 'HOLD', confidence: 0 };
  }

  /**
   * Calculate position size for grid orders
   */
  calculatePositionSize(signal, portfolio) {
    const { orderSize } = this.config;
    const currentPrice = signal.price || 0;
    const availableUsd = portfolio.totalUsd || 1000;

    if (availableUsd < this.minPositionUsd) {
      return { size: 0, amount: 0 };
    }

    // Use fixed order size for grid trading
    const amount = Math.min(orderSize, availableUsd * 0.1); // Max 10% per level
    const size = amount / currentPrice;

    return {
      size,
      amount,
      orderSize: amount
    };
  }

  /**
   * Get entry conditions for the strategy
   */
  getEntryConditions() {
    return {
      long: [
        `Price approaches grid level from above`,
        `Price within established trading range`,
        `Grid levels properly spaced at ${(this.config.gridSpacing * 100).toFixed(1)}% intervals`
      ],
      short: [
        `Price approaches grid level from below`,
        `Price within established trading range`,
        `Grid levels properly spaced at ${(this.config.gridSpacing * 100).toFixed(1)}% intervals`
      ]
    };
  }

  /**
   * Get exit conditions for the strategy
   */
  getExitConditions() {
    return {
      profit: [
        `Take profit at ${(this.config.takeProfitPercent * 100).toFixed(1)}% per trade`,
        `Close all positions on range breakout`
      ],
      loss: [
        `Stop loss at ${(this.config.stopLossPercent * 100).toFixed(1)}% from average price`,
        `Exit grid if range becomes invalid`
      ]
    };
  }

  /**
   * Calculate stop loss price
   */
  calculateStopLoss(entryPrice, side, avgPrice = null) {
    const stopPercent = this.config.stopLossPercent;

    if (side === 'BUY') {
      return avgPrice ? avgPrice * (1 - stopPercent) : entryPrice * (1 - stopPercent);
    } else {
      return avgPrice ? avgPrice * (1 + stopPercent) : entryPrice * (1 + stopPercent);
    }
  }

  /**
   * Calculate take profit price
   */
  calculateTakeProfit(entryPrice, side, gridSpacing = null) {
    const tpPercent = this.config.takeProfitPercent;
    const spacing = gridSpacing || (entryPrice * this.config.gridSpacing);

    if (side === 'BUY') {
      return entryPrice + (spacing * this.config.takeProfitPercent / this.config.gridSpacing);
    } else {
      return entryPrice - (spacing * this.config.takeProfitPercent / this.config.gridSpacing);
    }
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
      sharpeRatio: 0,
      gridTrades: 0
    };

    let portfolio = { totalUsd: 10000, positions: [] };
    let trades = [];

    for (let i = this.config.rangePeriod; i < historicalData.length; i++) {
      const candles = historicalData.slice(0, i + 1);
      const signal = this.generateSignal(candles);

      if (signal.signal === 'GRID_INIT') {
        // Initialize grid
        for (const level of this.gridLevels) {
          const positionSize = this.calculatePositionSize({ price: level.price }, portfolio);
          if (positionSize.amount > this.minPositionUsd) {
            const order = {
              type: level.side,
              price: level.price,
              size: positionSize.size,
              timestamp: candles[candles.length - 1].timestamp
            };
            portfolio.positions.push(order);
          }
        }
      } else if (signal.signal === 'BUY' || signal.signal === 'SELL') {
        // Grid order execution
        const currentPrice = candles[candles.length - 1].close;
        const positionSize = this.calculatePositionSize({ price: currentPrice }, portfolio);

        if (positionSize.amount > this.minPositionUsd) {
          const order = {
            type: signal.signal,
            price: currentPrice,
            size: positionSize.size,
            timestamp: currentPrice
          };
          portfolio.positions.push(order);

          // Check for closing opportunities
          const toClose = portfolio.positions.filter(p => p.type !== signal.signal);
          if (toClose.length > 0) {
            for (const pos of toClose) {
              const pnl = this.calculatePnL(pos, currentPrice);
              trades.push({
                side: pos.type,
                entryPrice: pos.price,
                exitPrice: currentPrice,
                pnl,
                timestamp: candles[candles.length - 1].timestamp
              });
              portfolio.totalUsd += pnl;
            }
            portfolio.positions = portfolio.positions.filter(p => p.type === signal.signal);
          }
        }
      } else if (signal.signal === 'EXIT_GRID') {
        // Close all positions on breakout
        const currentPrice = candles[candles.length - 1].close;
        for (const pos of portfolio.positions) {
          const pnl = this.calculatePnL(pos, currentPrice);
          trades.push({
            side: pos.type,
            entryPrice: pos.price,
            exitPrice: currentPrice,
            pnl,
            timestamp: candles[candles.length - 1].timestamp
          });
          portfolio.totalUsd += pnl;
        }
        portfolio.positions = [];
        this.gridLevels = [];
      }
    }

    results.trades = trades;
    results.gridTrades = trades.length;
    results.totalReturn = ((portfolio.totalUsd - 10000) / 10000) * 100;
    results.winRate = trades.filter(t => t.pnl > 0).length / trades.length * 100;

    return results;
  }

  /**
   * Calculate P&L for a trade
   */
  calculatePnL(position, exitPrice) {
    if (position.type === 'BUY') {
      return (exitPrice - position.price) * position.size;
    } else {
      return (position.price - exitPrice) * position.size;
    }
  }

  /**
   * Calculate price range from historical data
   */
  calculatePriceRange(candles, period = 50) {
    if (candles.length < period) return null;

    const slice = candles.slice(-period);
    const highs = slice.map(c => c.high);
    const lows = slice.map(c => c.low);

    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const mid = (high + low) / 2;

    return { high, low, mid, range: high - low };
  }

  /**
   * Initialize grid levels
   */
  initializeGrid(range, currentPrice) {
    this.gridLevels = [];
    const gridSize = Math.min(this.config.gridLevels, Math.floor(range.range / (range.range * this.config.gridSpacing)));
    const levelSpacing = range.range / gridSize;

    for (let i = 0; i < gridSize; i++) {
      const level = range.low + (i * levelSpacing);
      const side = i % 2 === 0 ? 'SELL' : 'BUY';

      this.gridLevels.push({
        price: level,
        side,
        active: true,
        filled: false
      });
    }
  }

  /**
   * Find nearest grid level to current price
   */
  findNearestGridLevel(currentPrice) {
    if (this.gridLevels.length === 0) return null;

    let nearest = this.gridLevels[0];
    let minDistance = Math.abs(currentPrice - nearest.price);

    for (const level of this.gridLevels) {
      const distance = Math.abs(currentPrice - level.price);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }

    return nearest;
  }

  /**
   * Check for take profit opportunities
   */
  checkTakeProfit(candles) {
    const currentPrice = candles[candles.length - 1].close;

    for (const position of this.orders) {
      const profit = Math.abs(currentPrice - position.price) / position.price;

      if (profit >= this.config.minProfitThreshold) {
        return {
          signal: 'EXIT',
          confidence: 0.8,
          reason: `Take profit at ${(profit * 100).toFixed(2)}%`,
          position
        };
      }
    }

    return null;
  }

  /**
   * Get strategy parameters
   */
  getParameters() {
    return {
      name: this.name,
      minPositionUsd: this.minPositionUsd,
      gridLevels: this.config.gridLevels,
      gridSpacing: this.config.gridSpacing,
      rangePeriod: this.config.rangePeriod,
      rangeDeviation: this.config.rangeDeviation,
      orderSize: this.config.orderSize,
      takeProfitPercent: this.config.takeProfitPercent,
      stopLossPercent: this.config.stopLossPercent,
      minProfitThreshold: this.config.minProfitThreshold,
      riskPerTrade: this.config.riskPerTrade
    };
  }

  /**
   * Update strategy parameters
   */
  updateParameters(newParams) {
    this.config = { ...this.config, ...newParams };
    this.gridLevels = []; // Reset grid on parameter update
    return this.getParameters();
  }
}

export default GridTradingStrategy;
