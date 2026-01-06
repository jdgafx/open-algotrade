/**
 * MoonDev Trading Algorithms - JavaScript Implementation
 * Ported from Python algorithms: turtle_trading.py, correlation_trading.py, mean_reversion.py, arbitrage.py, market_maker.py
 * Optimized for browser-based execution with Hyperliquid integration
 */

/**
 * Turtle Trading Strategy - 55-bar breakout system
 */
class TurtleTradingStrategy {
    constructor(config = {}) {
        this.symbol = config.symbol || 'BTC-USD';
        this.timeframe = config.timeframe || '5m';
        this.lookbackPeriod = config.lookbackPeriod || 55;
        this.atrPeriod = config.atrPeriod || 20;
        this.atrMultiplier = config.atrMultiplier || 2.0;
        this.takeProfitPercentage = config.takeProfitPercentage || 0.002; // 0.2%
        this.size = config.size || 100;
        this.leverage = config.leverage || 5;

        this.currentPosition = null;
        this.entryPrice = null;
        this.entryTime = null;
        this.stopLossPrice = null;
        this.takeProfitPrice = null;

        this.priceHistory = [];
        this.atrHistory = [];

        this.totalTrades = 0;
        this.winningTrades = 0;
        this.totalPnL = 0;

        // Professional Settings
        this.tradingHoursOnly = config.tradingHoursOnly !== undefined ? config.tradingHoursOnly : true;
        this.exitFriday = config.exitFriday !== undefined ? config.exitFriday : true;
        this.maxPositionSize = config.maxPositionSize || 1000;
    }

    /**
     * Calculate Average True Range (ATR)
     */
    calculateATR(prices) {
        if (prices.length < 2) return 0;

        const trueRanges = [];

        for (let i = 1; i < prices.length; i++) {
            const high = prices[i].high || prices[i];
            const low = prices[i].low || prices[i];
            const prevClose = prices[i - 1].close || prices[i - 1];

            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );

            trueRanges.push(tr);
        }

        if (trueRanges.length === 0) return 0;

        // Calculate ATR
        const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
        return atr;
    }

    /**
     * Check for breakout signals
     */
    checkBreakout(currentPrice) {
        if (this.priceHistory.length < this.lookbackPeriod) {
            return null;
        }

        const recentPrices = this.priceHistory.slice(-this.lookbackPeriod);
        const highs = recentPrices.map(p => p.high || p);
        const lows = recentPrices.map(p => p.low || p);

        const breakoutHigh = Math.max(...highs);
        const breakoutLow = Math.min(...lows);

        const atr = this.calculateATR(this.priceHistory.slice(-this.atrPeriod));
        const stopDistance = atr * this.atrMultiplier;

        if (currentPrice > breakoutHigh) {
            // Long breakout
            return {
                signal: 'buy',
                price: currentPrice,
                stopLoss: currentPrice - stopDistance,
                takeProfit: currentPrice * (1 + this.takeProfitPercentage),
                strength: (currentPrice - breakoutHigh) / breakoutHigh
            };
        } else if (currentPrice < breakoutLow) {
            // Short breakout
            return {
                signal: 'sell',
                price: currentPrice,
                stopLoss: currentPrice + stopDistance,
                takeProfit: currentPrice * (1 - this.takeProfitPercentage),
                strength: (breakoutLow - currentPrice) / breakoutLow
            };
        }

        return null;
    }

    /**
     * Process new price data
     */
    async processPriceData(priceData) {
        this.priceHistory.push(priceData);

        // Keep only necessary history
        if (this.priceHistory.length > this.lookbackPeriod * 2) {
            this.priceHistory.shift();
        }

        const currentPrice = priceData.close || priceData.price || priceData;

        // Time filter check
        if (this.tradingHoursOnly && !this.isTradingTime()) {
            return null;
        }

        // Friday exit check
        if (this.exitFriday && this.isFridayClose()) {
            if (this.currentPosition) await this.exitPosition(currentPrice);
            return null;
        }

        const breakout = this.checkBreakout(currentPrice);
        let result = { signal: 'hold', action: 'hold', confidence: 0 };

        if (breakout && !this.currentPosition) {
            // Enter new position
            result = await this.enterPosition(breakout);
        } else if (this.currentPosition) {
            // Check exit conditions
            result = await this.checkExitConditions(currentPrice) || result;
        }

        return result || breakout;
    }

    /**
     * Enter position based on signal
     */
    async enterPosition(breakout) {
        this.currentPosition = {
            side: breakout.signal,
            entryPrice: breakout.price,
            size: this.size,
            entryTime: Date.now(),
            stopLoss: breakout.stopLoss,
            takeProfit: breakout.takeProfit
        };

        this.entryPrice = breakout.price;
        this.entryTime = Date.now();
        this.stopLossPrice = breakout.stopLoss;
        this.takeProfitPrice = breakout.takeProfit;

        console.log(`🐢 Turtle: Entered ${breakout.signal} position at ${breakout.price}`);

        // Execute actual trade via Hyperliquid
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    this.symbol,
                    breakout.signal,
                    this.size
                );
            }
        } catch (error) {
            console.error(`🐢 Turtle: Trade execution failed: ${error.message}`);
        }
    }

    /**
     * Check and update exit conditions (Trailing Stop & Take Profit)
     */
    async checkExitConditions(currentPrice) {
        if (!this.currentPosition) return;

        // Update trailing stop loss
        const atr = this.calculateATR(this.priceHistory.slice(-this.atrPeriod));
        const stopDistance = atr * this.atrMultiplier;

        if (this.currentPosition.side === 'buy') {
            const newStop = currentPrice - stopDistance;
            if (newStop > this.stopLossPrice) {
                this.stopLossPrice = newStop;
                this.currentPosition.stopLoss = newStop;
            }
        } else if (this.currentPosition.side === 'sell') {
            const newStop = currentPrice + stopDistance;
            if (newStop < this.stopLossPrice) {
                this.stopLossPrice = newStop;
                this.currentPosition.stopLoss = newStop;
            }
        }

        const shouldExit = (
            (this.currentPosition.side === 'buy' && currentPrice <= this.stopLossPrice) ||
            (this.currentPosition.side === 'buy' && currentPrice >= this.takeProfitPrice) ||
            (this.currentPosition.side === 'sell' && currentPrice >= this.stopLossPrice) ||
            (this.currentPosition.side === 'sell' && currentPrice <= this.takeProfitPrice)
        );

        if (shouldExit) {
            await this.exitPosition(currentPrice);
        }
    }

    /**
     * Utility: Check if current time is within trading hours (9:30 AM - 4:00 PM ET)
     */
    isTradingTime() {
        const now = new Date();
        // Convert to ET (assuming server/browser time is UTC or similar)
        const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

        const day = etTime.getDay();
        if (day === 0 || day === 6) return false; // Weekend

        const hours = etTime.getHours();
        const minutes = etTime.getMinutes();
        const currentTimeInMinutes = hours * 60 + minutes;

        const startTime = 9 * 60 + 30; // 9:30 AM
        const endTime = 16 * 60; // 4:00 PM

        return currentTimeInMinutes >= startTime && currentTimeInMinutes < endTime;
    }

    /**
     * Utility: Check if it's Friday close (after 3:45 PM ET)
     */
    isFridayClose() {
        const now = new Date();
        const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

        if (etTime.getDay() !== 5) return false; // Not Friday

        const hours = etTime.getHours();
        const minutes = etTime.getMinutes();
        const currentTimeInMinutes = hours * 60 + minutes;

        const closeTime = 15 * 60 + 45; // 3:45 PM
        return currentTimeInMinutes >= closeTime;
    }

    /**
     * Exit current position
     */
    async exitPosition(exitPrice) {
        if (!this.currentPosition) return;

        const pnl = this.calculatePnL(exitPrice);
        this.totalPnL += pnl;
        this.totalTrades++;

        if (pnl > 0) {
            this.winningTrades++;
        }

        console.log(`🐢 Turtle: Exited position at ${exitPrice}, P&L: ${pnl.toFixed(2)}`);

        // Execute actual trade via Hyperliquid
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                const side = this.currentPosition.side === 'buy' ? 'sell' : 'buy';
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    this.symbol,
                    side,
                    this.currentPosition.size
                );
            }
        } catch (error) {
            console.error(`🐢 Turtle: Exit execution failed: ${error.message}`);
        }

        this.currentPosition = null;
    }

    /**
     * Calculate P&L for position
     */
    calculatePnL(exitPrice) {
        if (!this.currentPosition || !this.entryPrice) return 0;

        const size = this.size;
        const entry = this.entryPrice;
        const exit = exitPrice;

        if (this.currentPosition.side === 'buy') {
            return (exit - entry) * size;
        } else {
            return (entry - exit) * size;
        }
    }

    /**
     * Get strategy performance metrics
     */
    getMetrics() {
        const winRate = this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0;
        const avgWin = this.winningTrades > 0 ? this.totalPnL / this.winningTrades : 0;

        return {
            totalTrades: this.totalTrades,
            winningTrades: this.winningTrades,
            winRate: winRate.toFixed(2),
            totalPnL: this.totalPnL.toFixed(2),
            avgWin: avgWin.toFixed(2),
            currentPosition: this.currentPosition
        };
    }
}

/**
 * Correlation Trading Strategy - ETH leading altcoins
 */
class CorrelationTradingStrategy {
    constructor(config = {}) {
        this.leaderSymbol = config.leaderSymbol || 'ETH-USD';
        this.followerSymbols = config.followerSymbols || ['BTC-USD', 'SOL-USD', 'ADA-USD', 'DOT-USD'];
        this.timeframe = config.timeframe || '5m';
        this.lookbackPeriod = config.lookbackPeriod || 20;
        this.lagThreshold = config.lagThreshold || 0.005; // 0.5%
        this.stopLossPercentage = config.stopLossPercentage || 0.002; // 0.2%
        this.takeProfitPercentage = config.takeProfitPercentage || 0.0025; // 0.25%
        this.size = config.size || 100;
        this.maxPositions = config.maxPositions || 3;

        this.activePositions = new Map();
        this.correlationHistory = new Map();
        this.priceHistory = new Map();
        this.lastEntryTimes = new Map();

        this.totalTrades = 0;
        this.winningTrades = 0;
        this.totalPnL = 0;
    }

    /**
     * Calculate correlation coefficient
     */
    calculateCorrelation(price1, price2) {
        if (price1.length !== price2.length || price1.length < 2) {
            return 0;
        }

        const n = price1.length;
        const sum1 = price1.reduce((a, b) => a + b, 0);
        const sum2 = price2.reduce((a, b) => a + b, 0);
        const sum1Sq = price1.reduce((a, b) => a + b * b, 0);
        const sum2Sq = price2.reduce((a, b) => a + b * b, 0);
        const pSum = price1.reduce((a, b, i) => a + b * price2[i], 0);

        const num = pSum - (sum1 * sum2 / n);
        const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));

        return den === 0 ? 0 : num / den;
    }

    /**
     * Detect lag between leader and follower
     */
    detectLag(leaderPrice, followerPrice) {
        if (!leaderPrice || !followerPrice) return null;

        const leaderChange = (leaderPrice.current - leaderPrice.previous) / leaderPrice.previous;
        const followerChange = (followerPrice.current - followerPrice.previous) / followerPrice.previous;

        const lag = leaderChange - followerChange;

        if (Math.abs(lag) > this.lagThreshold) {
            return {
                direction: lag > 0 ? 'long' : 'short', // Leader moved up, expect follower to follow
                lagPercentage: Math.abs(lag),
                leaderChange: leaderChange,
                followerChange: followerChange
            };
        }

        return null;
    }

    /**
     * Analyze correlation (for tests)
     */
    analyzeCorrelation(data) {
        const leader = data[this.leaderSymbol];
        const follower = data[this.followerSymbols[0]];
        const correlation = this.calculateCorrelation(leader || [], follower || []);
        return {
            correlation,
            action: correlation > 0.8 ? 'buy' : 'hold',
            signal: correlation > 0.8 ? 'buy' : 'hold'
        };
    }

    /**
     * Process market data
     */
    async processMarketData(marketData) {
        const leaderData = marketData[this.leaderSymbol];
        if (!leaderData) return;

        // Update price history
        this.updatePriceHistory(this.leaderSymbol, leaderData);

        // Check each follower symbol
        for (const followerSymbol of this.followerSymbols) {
            const followerData = marketData[followerSymbol];
            if (!followerData) continue;

            this.updatePriceHistory(followerSymbol, followerData);

            // Check correlation
            const correlation = this.checkCorrelation(followerSymbol);
            if (correlation < 0.7) continue; // Minimum correlation threshold

            // Detect lag
            const lagSignal = this.detectLag(leaderData, followerData);
            if (lagSignal && !this.activePositions.has(followerSymbol)) {
                await this.enterPosition(followerSymbol, lagSignal);
            }

            // Check exit conditions
            if (this.activePositions.has(followerSymbol)) {
                await this.checkExitConditions(followerSymbol, followerData);
            }
        }
    }

    /**
     * Update price history
     */
    updatePriceHistory(symbol, priceData) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol);
        history.push({
            price: priceData.price,
            timestamp: Date.now()
        });

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Check correlation between symbols
     */
    checkCorrelation(followerSymbol) {
        const leaderHistory = this.priceHistory.get(this.leaderSymbol);
        const followerHistory = this.priceHistory.get(followerSymbol);

        if (!leaderHistory || !followerHistory || leaderHistory.length < this.lookbackPeriod) {
            return 0;
        }

        const leaderPrices = leaderHistory.slice(-this.lookbackPeriod).map(h => h.price);
        const followerPrices = followerHistory.slice(-this.lookbackPeriod).map(h => h.price);

        return this.calculateCorrelation(leaderPrices, followerPrices);
    }

    /**
     * Enter position
     */
    async enterPosition(symbol, lagSignal) {
        if (this.activePositions.size >= this.maxPositions) {
            return;
        }

        const entryPrice = this.priceHistory.get(symbol).slice(-1)[0].price;

        this.activePositions.set(symbol, {
            side: lagSignal.direction,
            entryPrice: entryPrice,
            size: this.size,
            entryTime: Date.now(),
            stopLoss: entryPrice * (1 - this.stopLossPercentage * (lagSignal.direction === 'long' ? 1 : -1)),
            takeProfit: entryPrice * (1 + this.takeProfitPercentage * (lagSignal.direction === 'long' ? 1 : -1))
        });

        this.totalTrades++;
        this.lastEntryTimes.set(symbol, Date.now());

        console.log(`🔗 Correlation: Entered ${lagSignal.direction} position in ${symbol}`);

        // Execute actual trade
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    symbol,
                    lagSignal.direction === 'long' ? 'buy' : 'sell',
                    this.size
                );
            }
        } catch (error) {
            console.error(`🔗 Correlation: Trade execution failed: ${error.message}`);
        }
    }

    /**
     * Check exit conditions
     */
    async checkExitConditions(symbol, currentData) {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        const currentPrice = currentData.price;
        const shouldExit = (
            (position.side === 'long' && currentPrice <= position.stopLoss) ||
            (position.side === 'long' && currentPrice >= position.takeProfit) ||
            (position.side === 'short' && currentPrice >= position.stopLoss) ||
            (position.side === 'short' && currentPrice <= position.takeProfit)
        );

        if (shouldExit) {
            await this.exitPosition(symbol, currentPrice);
        }
    }

    /**
     * Exit position
     */
    async exitPosition(symbol, exitPrice) {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        const pnl = this.calculatePnL(position, exitPrice);
        this.totalPnL += pnl;

        if (pnl > 0) {
            this.winningTrades++;
        }

        console.log(`🔗 Correlation: Exited ${symbol} position, P&L: ${pnl.toFixed(2)}`);

        // Execute actual trade
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                const side = position.side === 'long' ? 'sell' : 'buy';
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    symbol,
                    side,
                    this.size
                );
            }
        } catch (error) {
            console.error(`🔗 Correlation: Exit execution failed: ${error.message}`);
        }

        this.activePositions.delete(symbol);
    }

    /**
     * Calculate P&L
     */
    calculatePnL(position, exitPrice) {
        const size = position.size;
        const entry = position.entryPrice;
        const exit = exitPrice;

        if (position.side === 'long') {
            return (exit - entry) * size;
        } else {
            return (entry - exit) * size;
        }
    }

    /**
     * Get metrics
     */
    getMetrics() {
        const winRate = this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0;

        return {
            totalTrades: this.totalTrades,
            winningTrades: this.winningTrades,
            winRate: winRate.toFixed(2),
            totalPnL: this.totalPnL.toFixed(2),
            activePositions: this.activePositions.size,
            correlations: this.followerSymbols.map(s => ({
                symbol: s,
                correlation: this.checkCorrelation(s)
            }))
        };
    }
}

/**
 * Mean Reversion Strategy - Multi-asset statistical arbitrage
 */
class MeanReversionStrategy {
    constructor(config = {}) {
        this.symbols = config.symbols || ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'];
        this.timeframe = config.timeframe || '15m';
        this.smaPeriod = config.smaPeriod || 20;
        this.entryThreshold = config.entryThreshold || 2.0; // 2 standard deviations
        this.exitThreshold = config.exitThreshold || 0.5; // 0.5 standard deviations
        this.maxPositions = config.maxPositions || 10;
        this.sizePerPosition = config.sizePerPosition || 200;
        this.lookbackPeriod = config.lookbackPeriod || 100;

        this.activePositions = new Map();
        this.priceHistory = new Map();
        this.marketStats = new Map();

        this.totalTrades = 0;
        this.winningTrades = 0;
        this.totalPnL = 0;
        this.dailyPnL = 0;
    }

    /**
     * Calculate Simple Moving Average
     */
    calculateSMA(prices, period) {
        if (prices.length < period) return null;

        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    /**
     * Calculate standard deviation
     */
    calculateStdDev(prices, period) {
        if (prices.length < period) return 0;

        const sma = this.calculateSMA(prices, period);
        if (sma === null) return 0;

        const squaredDiffs = prices.slice(-period).map(price => Math.pow(price - sma, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / period;

        return Math.sqrt(avgSquaredDiff);
    }

    /**
     * Calculate Z-Score
     */
    calculateZScore(currentPrice, sma, stdDev) {
        if (!sma || !stdDev || stdDev === 0) return 0;
        return (currentPrice - sma) / stdDev;
    }

    /**
     * Process market data
     */
    async processMarketData(marketData) {
        for (const [symbol, data] of Object.entries(marketData)) {
            if (!this.symbols.includes(symbol)) continue;

            this.updatePriceHistory(symbol, data.price);

            const signal = this.generateSignal(symbol);
            if (signal) {
                if (signal.action === 'enter' && !this.activePositions.has(symbol)) {
                    await this.enterPosition(symbol, signal);
                } else if (signal.action === 'exit' && this.activePositions.has(symbol)) {
                    await this.exitPosition(symbol, data.price);
                }
            }
        }
    }

    /**
     * Update price history
     */
    updatePriceHistory(symbol, price) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol);
        history.push({
            price: price,
            timestamp: Date.now()
        });

        // Keep only necessary history
        if (history.length > this.lookbackPeriod) {
            history.shift();
        }
    }

    /**
     * Generate trading signal
     */
    generateSignal(symbol) {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < this.smaPeriod) return null;

        const prices = history.map(h => h.price);
        const currentPrice = prices[prices.length - 1];
        const sma = this.calculateSMA(prices, this.smaPeriod);
        const stdDev = this.calculateStdDev(prices, this.smaPeriod);
        const zScore = this.calculateZScore(currentPrice, sma, stdDev);

        // Entry signals
        if (zScore <= -this.entryThreshold && !this.activePositions.has(symbol)) {
            // Oversold - buy signal
            return {
                action: 'enter',
                side: 'buy',
                confidence: Math.abs(zScore) / this.entryThreshold,
                zScore: zScore,
                reason: `Oversold (Z-Score: ${zScore.toFixed(2)})`
            };
        } else if (zScore >= this.entryThreshold && !this.activePositions.has(symbol)) {
            // Overbought - sell signal
            return {
                action: 'enter',
                side: 'sell',
                confidence: Math.abs(zScore) / this.entryThreshold,
                zScore: zScore,
                reason: `Overbought (Z-Score: ${zScore.toFixed(2)})`
            };
        }

        // Exit signals
        if (this.activePositions.has(symbol)) {
            const position = this.activePositions.get(symbol);
            const currentZScore = Math.abs(zScore);

            if (currentZScore <= this.exitThreshold) {
                return {
                    action: 'exit',
                    reason: `Mean reversion complete (Z-Score: ${zScore.toFixed(2)})`
                };
            }
        }

        return null;
    }

    /**
     * Enter position
     */
    async enterPosition(symbol, signal) {
        if (this.activePositions.size >= this.maxPositions) return;

        const currentPrice = this.priceHistory.get(symbol).slice(-1)[0].price;

        this.activePositions.set(symbol, {
            side: signal.side,
            entryPrice: currentPrice,
            size: this.sizePerPosition,
            entryTime: Date.now(),
            confidence: signal.confidence,
            zScore: signal.zScore
        });

        this.totalTrades++;

        console.log(`📊 Mean Reversion: Entered ${signal.side} position in ${symbol} - ${signal.reason}`);

        // Execute actual trade
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    symbol,
                    signal.side,
                    this.sizePerPosition
                );
            }
        } catch (error) {
            console.error(`📊 Mean Reversion: Trade execution failed: ${error.message}`);
        }
    }

    /**
     * Exit position
     */
    async exitPosition(symbol, exitPrice) {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        const pnl = this.calculatePnL(position, exitPrice);
        this.totalPnL += pnl;
        this.dailyPnL += pnl;

        if (pnl > 0) {
            this.winningTrades++;
        }

        console.log(`📊 Mean Reversion: Exited ${symbol} position, P&L: ${pnl.toFixed(2)}`);

        // Execute actual trade
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                const side = position.side === 'buy' ? 'sell' : 'buy';
                await window.ultimateTrading.services.hyperliquid.placeMarketOrder(
                    symbol,
                    side,
                    this.sizePerPosition
                );
            }
        } catch (error) {
            console.error(`📊 Mean Reversion: Exit execution failed: ${error.message}`);
        }

        this.activePositions.delete(symbol);
    }

    /**
     * Calculate P&L
     */
    calculatePnL(position, exitPrice) {
        const size = position.size;
        const entry = position.entryPrice;
        const exit = exitPrice;

        if (position.side === 'buy') {
            return (exit - entry) * size;
        } else {
            return (entry - exit) * size;
        }
    }

    /**
     * Get metrics
     */
    getMetrics() {
        const winRate = this.totalTrades > 0 ? (this.winningTrades / this.totalTrades) * 100 : 0;

        return {
            totalTrades: this.totalTrades,
            winningTrades: this.winningTrades,
            winRate: winRate.toFixed(2),
            totalPnL: this.totalPnL.toFixed(2),
            dailyPnL: this.dailyPnL.toFixed(2),
            activePositions: this.activePositions.size,
            maxPositions: this.maxPositions
        };
    }
}

/**
 * Arbitrage Strategy - High-frequency price inefficiency detection
 */
class ArbitrageStrategy {
    constructor(config = {}) {
        this.minProfitThreshold = config.minProfitThreshold || 0.001; // 0.1%
        this.maxSlippage = config.maxSlippage || 0.0005; // 0.05%
        this.executionSpeedMs = config.executionSpeedMs || 100;
        this.maxConcurrentArbitrages = config.maxConcurrentArbitrages || 3;
        this.baseSize = config.baseSize || 1000;
        this.opportunityTtlSeconds = config.opportunityTtlSeconds || 5;

        this.activeArbitrages = new Map();
        this.opportunities = new Map();

        this.totalArbitrages = 0;
        this.successfulArbitrages = 0;
        this.totalProfit = 0;
    }

    /**
     * Scan for arbitrage opportunities
     */
    async scanOpportunities(marketData) {
        const symbols = Object.keys(marketData);
        const opportunities = [];

        // Check cross-exchange arbitrage
        for (let i = 0; i < symbols.length; i++) {
            for (let j = i + 1; j < symbols.length; j++) {
                const symbol1 = symbols[i];
                const symbol2 = symbols[j];

                const opportunity = this.checkCrossExchangeArbitrage(
                    marketData[symbol1],
                    marketData[symbol2]
                );

                if (opportunity) {
                    opportunities.push(opportunity);
                }
            }
        }

        return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    }

    /**
     * Check cross-exchange arbitrage
     */
    checkCrossExchangeArbitrage(data1, data2) {
        if (!data1.price || !data2.price) return null;

        const price1 = data1.price;
        const price2 = data2.price;

        // Calculate price difference
        const diff = Math.abs(price1 - price2);
        const avgPrice = (price1 + price2) / 2;
        const profitPercentage = diff / avgPrice;

        if (profitPercentage > this.minProfitThreshold) {
            return {
                type: 'cross-exchange',
                symbol: data1.symbol,
                exchange1: data1.exchange,
                exchange2: data2.exchange,
                price1: price1,
                price2: price2,
                profitPercentage: profitPercentage,
                confidence: Math.min(profitPercentage / (this.minProfitThreshold * 2), 1),
                timestamp: Date.now(),
                expiration: Date.now() + (this.opportunityTtlSeconds * 1000)
            };
        }

        return null;
    }

    /**
     * Execute arbitrage opportunity
     */
    async executeArbitrage(opportunity) {
        if (this.activeArbitrages.size >= this.maxConcurrentArbitrages) {
            console.log('⚡ Max concurrent arbitrages reached');
            return false;
        }

        const arbitrageId = this.generateArbitrageId();

        this.activeArbitrages.set(arbitrageId, {
            ...opportunity,
            id: arbitrageId,
            startTime: Date.now(),
            status: 'executing'
        });

        try {
            // Check if opportunity is still valid
            if (Date.now() > opportunity.expiration) {
                throw new Error('Opportunity expired');
            }

            // Execute the arbitrage
            const result = await this.performArbitrage(opportunity);

            this.activeArbitrages.delete(arbitrageId);

            if (result.success) {
                this.successfulArbitrages++;
                this.totalProfit += result.profit;
                console.log(`⚡ Arbitrage successful: ${result.profit.toFixed(2)}`);
            } else {
                console.log('⚡ Arbitrage failed:', result.error);
            }

            return result.success;

        } catch (error) {
            this.activeArbitrages.delete(arbitrageId);
            console.error('⚡ Arbitrage execution failed:', error);
            return false;
        }
    }

    /**
     * Perform the actual arbitrage
     */
    async performArbitrage(opportunity) {
        // Simulate execution time
        await this.sleep(Math.random() * this.executionSpeedMs);

        // Simulate slippage
        const slippage = Math.random() * this.maxSlippage;
        const effectiveProfit = opportunity.profitPercentage - slippage;

        if (effectiveProfit < this.minProfitThreshold) {
            return {
                success: false,
                error: 'Profit below threshold after slippage'
            };
        }

        const profit = this.baseSize * effectiveProfit;

        return {
            success: true,
            profit: profit,
            executedAt: Date.now(),
            details: opportunity
        };
    }

    /**
     * Get active arbitrages
     */
    getActiveArbitrages() {
        return Array.from(this.activeArbitrages.values());
    }

    /**
     * Get opportunities
     */
    getOpportunities() {
        return Array.from(this.opportunities.values())
            .filter(opp => opp.expiration > Date.now())
            .sort((a, b) => b.profitPercentage - a.profitPercentage);
    }

    /**
     * Generate arbitrage ID
     */
    generateArbitrageId() {
        return 'arb_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get metrics
     */
    getMetrics() {
        const successRate = this.totalArbitrages > 0 ?
            (this.successfulArbitrages / this.totalArbitrages) * 100 : 0;

        const avgProfit = this.successfulArbitrages > 0 ?
            this.totalProfit / this.successfulArbitrages : 0;

        return {
            totalArbitrages: this.totalArbitrages,
            successfulArbitrages: this.successfulArbitrages,
            successRate: successRate.toFixed(2),
            totalProfit: this.totalProfit.toFixed(2),
            avgProfit: avgProfit.toFixed(2),
            activeArbitrages: this.activeArbitrages.size,
            maxConcurrent: this.maxConcurrentArbitrages
        };
    }
}

/**
 * Market Making Strategy - Provide liquidity and capture spreads
 */
class MarketMakerStrategy {
    constructor(config = {}) {
        this.symbols = config.symbols || ['BTC-USD', 'ETH-USD', 'SOL-USD'];
        this.spreadPercentage = config.spreadPercentage || 0.01; // 1%
        this.orderSize = config.orderSize || 500;
        this.refreshRate = config.refreshRate || 5000; // 5 seconds
        this.maxInventory = config.maxInventory || 10;

        this.activeOrders = new Map();
        this.inventory = new Map();
        this.priceHistory = new Map();

        this.totalTrades = 0;
        this.profitFromSpreads = 0;
        this.inventoryValue = 0;
    }

    /**
     * Start market making
     */
    async start() {
        console.log('📈 Market Maker: Starting...');

        for (const symbol of this.symbols) {
            await this.initializeSymbol(symbol);
            await this.placeOrders(symbol);
        }

        // Set up continuous order refresh
        this.refreshInterval = setInterval(() => {
            this.refreshOrders();
        }, this.refreshRate);
    }

    /**
     * Initialize symbol
     */
    async initializeSymbol(symbol) {
        this.inventory.set(symbol, 0);
        this.priceHistory.set(symbol, []);
        this.activeOrders.set(symbol, { buy: null, sell: null });
    }

    /**
     * Calculate optimal bid and ask prices
     */
    calculatePrices(currentPrice) {
        const spread = this.spreadPercentage / 2;
        const bidPrice = currentPrice * (1 - spread);
        const askPrice = currentPrice * (1 + spread);

        return { bid: bidPrice, ask: askPrice };
    }

    /**
     * Place buy and sell orders
     */
    async placeOrders(symbol) {
        const currentPrice = this.getCurrentPrice(symbol);
        if (!currentPrice) return;

        const { bid, ask } = this.calculatePrices(currentPrice);

        // Cancel existing orders
        await this.cancelExistingOrders(symbol);

        // Place new orders
        const buyOrder = await this.placeOrder(symbol, 'buy', bid, this.orderSize);
        const sellOrder = await this.placeOrder(symbol, 'sell', ask, this.orderSize);

        this.activeOrders.set(symbol, { buy: buyOrder, sell: sellOrder });

        console.log(`📈 Market Maker: Placed orders for ${symbol} - Bid: ${bid.toFixed(2)}, Ask: ${ask.toFixed(2)}`);
    }

    /**
     * Place individual order
     */
    async placeOrder(symbol, side, price, size) {
        const order = {
            id: this.generateOrderId(),
            symbol: symbol,
            side: side,
            price: price,
            size: size,
            timestamp: Date.now(),
            status: 'pending'
        };

        // Execute actual order via Hyperliquid
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                const hlResult = await window.ultimateTrading.services.hyperliquid.placeLimitOrder(
                    symbol,
                    side,
                    price,
                    size
                );
                order.hyperliquidOrderId = hlResult.orderId;
                order.status = hlResult.success ? 'active' : 'failed';
            }
        } catch (error) {
            console.error(`📈 Market Maker: Order placement failed: ${error.message}`);
            order.status = 'failed';
        }

        return order;
    }

    /**
     * Cancel existing orders
     */
    async cancelExistingOrders(symbol) {
        const orders = this.activeOrders.get(symbol);
        try {
            if (window.ultimateTrading && window.ultimateTrading.services && window.ultimateTrading.services.hyperliquid) {
                if (orders && orders.buy && orders.buy.hyperliquidOrderId) {
                    await window.ultimateTrading.services.hyperliquid.cancelOrder(orders.buy.hyperliquidOrderId);
                }
                if (orders && orders.sell && orders.sell.hyperliquidOrderId) {
                    await window.ultimateTrading.services.hyperliquid.cancelOrder(orders.sell.hyperliquidOrderId);
                }
            }
        } catch (error) {
            console.error(`📈 Market Maker: Order cancellation failed: ${error.message}`);
        }
    }

    /**
     * Refresh all orders
     */
    async refreshOrders() {
        for (const symbol of this.symbols) {
            await this.placeOrders(symbol);
        }
    }

    /**
     * Handle trade execution
     */
    async handleTrade(trade) {
        const symbol = trade.symbol;
        const side = trade.side;
        const size = trade.size;
        const price = trade.price;

        // Update inventory
        const currentInventory = this.inventory.get(symbol) || 0;
        const newInventory = side === 'buy' ?
            currentInventory + size :
            currentInventory - size;

        // Check inventory limits
        if (Math.abs(newInventory) > this.maxInventory) {
            console.log(`📈 Market Maker: Inventory limit reached for ${symbol}`);
            return;
        }

        this.inventory.set(symbol, newInventory);

        // Calculate profit from spread
        if (side === 'sell') {
            const spreadProfit = price * this.spreadPercentage * size / 2;
            this.profitFromSpreads += spreadProfit;
        }

        this.totalTrades++;

        console.log(`📈 Market Maker: Trade executed - ${symbol} ${side} ${size} @ ${price}`);
    }

    /**
     * Get current price for symbol
     */
    getCurrentPrice(symbol) {
        const history = this.priceHistory.get(symbol);
        if (history && history.length > 0) {
            return history[history.length - 1].price;
        }
        return null;
    }

    /**
     * Update price data
     */
    updatePriceData(symbol, price) {
        if (!this.priceHistory.has(symbol)) {
            this.priceHistory.set(symbol, []);
        }

        const history = this.priceHistory.get(symbol);
        history.push({
            price: price,
            timestamp: Date.now()
        });

        // Keep only last 100 entries
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Generate order ID
     */
    generateOrderId() {
        return 'mm_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Stop market making
     */
    stop() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Cancel all orders
        for (const symbol of this.symbols) {
            this.cancelExistingOrders(symbol);
        }

        console.log('📈 Market Maker: Stopped');
    }

    /**
     * Get metrics
     */
    getMetrics() {
        let totalInventory = 0;
        for (const [symbol, inventory] of this.inventory.entries()) {
            totalInventory += Math.abs(inventory);
        }

        return {
            totalTrades: this.totalTrades,
            profitFromSpreads: this.profitFromSpreads.toFixed(2),
            totalInventory: totalInventory,
            maxInventory: this.maxInventory,
            spreadPercentage: (this.spreadPercentage * 100).toFixed(2),
            activeOrders: this.symbols.length * 2 // Buy and sell for each symbol
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.MoonDevAlgorithms = {
        TurtleTradingStrategy,
        CorrelationTradingStrategy,
        MeanReversionStrategy,
        ArbitrageStrategy,
        MarketMakerStrategy
    };
}

console.log('🚀 MoonDev Trading Algorithms loaded successfully');

export {
    TurtleTradingStrategy,
    CorrelationTradingStrategy,
    MeanReversionStrategy,
    ArbitrageStrategy,
    MarketMakerStrategy
};

export default {
    TurtleTradingStrategy,
    CorrelationTradingStrategy,
    MeanReversionStrategy,
    ArbitrageStrategy,
    MarketMakerStrategy
};
