/**
 * Ultimate Trading Platform - Hyperliquid Integration Service
 * Handles micro-position trading down to $0.25 with advanced risk management
 */

class HyperliquidTradingService {
    constructor() {
        this.baseUrl = 'https://api.hyperliquid.xyz';
        this.isTestnet = true; // Set to false for mainnet
        this.apiKey = null;
        this.secretKey = null;
        this.positionSizes = {
            micro: 0.25,
            standard: 100,
            pro: 1000,
            elite: 10000
        };
    }
    
    /**
     * Initialize Hyperliquid client with Puter.js infrastructure
     */
    async initialize() {
        try {
            // Get user credentials from secure storage
            const credentials = await this.getStoredCredentials();
            this.apiKey = credentials.apiKey;
            this.secretKey = credentials.secretKey;
            
            // Initialize wallet connection
            await this.connectWallet();
            
            return true;
        } catch (error) {
            console.error('Failed to initialize Hyperliquid:', error);
            throw error;
        }
    }
    
    /**
     * Create micro-position order (minimum $0.25)
     */
    async createMicroPosition(symbol, side, amount, price = null) {
        try {
            // Validate minimum position size
            if (amount < this.positionSizes.micro) {
                throw new Error(`Minimum position size is $${this.positionSizes.micro}`);
            }
            
            const orderParams = {
                asset: symbol,
                side: side, // 'buy' or 'sell'
                amount: amount,
                orderType: 'limit',
                price: price,
                reduceOnly: false,
                timeInForce: 'Gtc',
                testnet: this.isTestnet
            };
            
            // Execute order via Hyperliquid API
            const result = await this.executeOrder(orderParams);
            
            // Log to cloud storage via Puter.js
            await this.logTrade({
                symbol,
                side,
                amount,
                price: result.fillPrice || price,
                timestamp: Date.now(),
                orderId: result.orderId,
                status: 'filled',
                strategy: 'micro-trading'
            });
            
            return result;
        } catch (error) {
            console.error('Failed to create micro position:', error);
            throw error;
        }
    }
    
    /**
     * Execute arbitrage strategy across multiple assets
     */
    async executeArbitrage(strategy) {
        const results = [];
        
        for (const pair of strategy.pairs) {
            try {
                const priceDiff = await this.getPriceDifference(pair);
                
                if (Math.abs(priceDiff) > strategy.threshold) {
                    const position = await this.createMicroPosition(
                        pair.asset,
                        priceDiff > 0 ? 'buy' : 'sell',
                        strategy.amount
                    );
                    
                    results.push({
                        pair: pair.asset,
                        action: priceDiff > 0 ? 'buy' : 'sell',
                        amount: strategy.amount,
                        price: position.fillPrice,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.error(`Arbitrage execution failed for ${pair.asset}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Mean reversion strategy execution
     */
    async executeMeanReversion(symbol, entryPrice, currentPrice, strategy) {
        try {
            const deviation = (currentPrice - entryPrice) / entryPrice;
            
            // Determine entry/exit conditions
            if (deviation <= -strategy.threshold) {
                // Oversold - buy signal
                return await this.createMicroPosition(symbol, 'buy', strategy.amount);
            } else if (deviation >= strategy.threshold) {
                // Overbought - sell signal
                return await this.createMicroPosition(symbol, 'sell', strategy.amount);
            }
            
            return null; // No action required
        } catch (error) {
            console.error('Mean reversion execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Turtle Trading strategy - breakout detection
     */
    async executeTurtleTrading(symbol, priceHistory, strategy) {
        try {
            const currentPrice = priceHistory[priceHistory.length - 1];
            const lookback = strategy.lookback || 20;
            
            // Calculate breakout levels
            const highs = priceHistory.slice(-lookback).map(p => p.high);
            const lows = priceHistory.slice(-lookback).map(p => p.low);
            
            const breakoutHigh = Math.max(...highs);
            const breakoutLow = Math.min(...lows);
            
            // Entry signals
            if (currentPrice > breakoutHigh) {
                // Breakout upwards - long position
                return await this.createMicroPosition(symbol, 'buy', strategy.amount);
            } else if (currentPrice < breakoutLow) {
                // Breakout downwards - short position
                return await this.createMicroPosition(symbol, 'sell', strategy.amount);
            }
            
            return null;
        } catch (error) {
            console.error('Turtle trading execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Market making strategy - provide liquidity
     */
    async executeMarketMaking(symbol, currentPrice, strategy) {
        try {
            const spread = strategy.spread || 0.01; // 1%
            const bidPrice = currentPrice * (1 - spread / 2);
            const askPrice = currentPrice * (1 + spread / 2);
            
            const results = [];
            
            // Place bid order
            const bidOrder = await this.createMicroPosition(symbol, 'buy', strategy.amount, bidPrice);
            results.push(bidOrder);
            
            // Place ask order
            const askOrder = await this.createMicroPosition(symbol, 'sell', strategy.amount, askPrice);
            results.push(askOrder);
            
            return results;
        } catch (error) {
            console.error('Market making execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Grid trading strategy - automated position management
     */
    async executeGridTrading(symbol, currentPrice, strategy) {
        try {
            const gridLevels = strategy.gridLevels || 10;
            const gridSpacing = strategy.gridSpacing || 0.02; // 2%
            const positions = [];
            
            for (let i = 0; i < gridLevels; i++) {
                const price = currentPrice * (1 - gridSpacing * i);
                const position = await this.createMicroPosition(symbol, 'buy', strategy.amount, price);
                positions.push(position);
            }
            
            return positions;
        } catch (error) {
            console.error('Grid trading execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Risk management and position sizing
     */
    calculatePositionSize(accountBalance, riskPercentage, stopLoss) {
        const maxRisk = accountBalance * (riskPercentage / 100);
        const positionSize = maxRisk / (stopLoss / 100);
        
        // Ensure minimum position size
        return Math.max(positionSize, this.positionSizes.micro);
    }
    
    /**
     * Portfolio rebalancing
     */
    async rebalancePortfolio(targetAllocation, currentPositions) {
        try {
            const totalValue = Object.values(currentPositions).reduce((sum, pos) => sum + pos.value, 0);
            const rebalancingOrders = [];
            
            for (const [symbol, target] of Object.entries(targetAllocation)) {
                const current = currentPositions[symbol] || { value: 0 };
                const targetValue = totalValue * target;
                
                if (Math.abs(targetValue - current.value) > totalValue * 0.01) { // 1% threshold
                    const diff = targetValue - current.value;
                    const side = diff > 0 ? 'buy' : 'sell';
                    
                    const order = await this.createMicroPosition(symbol, side, Math.abs(diff));
                    rebalancingOrders.push(order);
                }
            }
            
            return rebalancingOrders;
        } catch (error) {
            console.error('Portfolio rebalancing failed:', error);
            throw error;
        }
    }
    
    /**
     * Execute order via Hyperliquid API
     */
    async executeOrder(orderParams) {
        const endpoint = `${this.baseUrl}/v1/exchange/order`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(orderParams)
        });
        
        if (!response.ok) {
            throw new Error(`Order execution failed: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    /**
     * Get real-time market data
     */
    async getMarketData(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/market/${symbol}`);
            const data = await response.json();
            
            return {
                symbol: symbol,
                price: data.price,
                volume: data.volume,
                change24h: data.change24h,
                high24h: data.high24h,
                low24h: data.low24h
            };
        } catch (error) {
            console.error('Failed to fetch market data:', error);
            throw error;
        }
    }
    
    /**
     * Get price difference for arbitrage
     */
    async getPriceDifference(pair) {
        try {
            const price1 = await this.getMarketData(pair.exchange1);
            const price2 = await this.getMarketData(pair.exchange2);
            
            return ((price2.price - price1.price) / price1.price) * 100;
        } catch (error) {
            console.error('Failed to calculate price difference:', error);
            throw error;
        }
    }
    
    /**
     * Store trading logs in cloud via Puter.js
     */
    async logTrade(tradeData) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                ...tradeData
            };
            
            await puter.kv.incr('trades_logged');
            await puter.fs.append('trades.log', JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to log trade:', error);
        }
    }
    
    /**
     * Connect wallet via Puter.js
     */
    async connectWallet() {
        try {
            if (!await puter.auth.isSignedIn()) {
                await puter.auth.signIn();
            }
            
            const user = await puter.auth.getUser();
            await puter.print(`🔗 Connected to Hyperliquid as ${user.username}`);
            
            return user;
        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }
    
    /**
     * Get stored credentials securely
     */
    async getStoredCredentials() {
        try {
            const user = await puter.auth.getUser();
            const credentials = await puter.kv.get(`hl_credentials_${user.id}`);
            
            if (!credentials) {
                throw new Error('Hyperliquid credentials not found. Please configure your API keys.');
            }
            
            return credentials;
        } catch (error) {
            console.error('Failed to get stored credentials:', error);
            throw error;
        }
    }
    
    /**
     * Monitor positions and manage exits
     */
    async monitorPositions(strategies) {
        try {
            for (const strategy of strategies) {
                const position = await this.getPosition(strategy.symbol);
                
                if (position) {
                    // Check stop loss
                    if (position.unrealized_pnl < -strategy.stopLoss) {
                        await this.closePosition(position.id);
                        await this.logTrade({
                            symbol: strategy.symbol,
                            reason: 'stop_loss',
                            pnl: position.unrealized_pnl,
                            timestamp: Date.now()
                        });
                    }
                    
                    // Check take profit
                    if (position.unrealized_pnl > strategy.takeProfit) {
                        await this.closePosition(position.id);
                        await this.logTrade({
                            symbol: strategy.symbol,
                            reason: 'take_profit',
                            pnl: position.unrealized_pnl,
                            timestamp: Date.now()
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Position monitoring failed:', error);
        }
    }
    
    /**
     * Close position
     */
    async closePosition(positionId) {
        try {
            const endpoint = `${this.baseUrl}/v1/exchange/close`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({ positionId })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Failed to close position:', error);
            throw error;
        }
    }
    
    /**
     * Get current position
     */
    async getPosition(symbol) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/positions/${symbol}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get position:', error);
            return null;
        }
    }
    
    /**
     * Calculate portfolio metrics
     */
    calculatePortfolioMetrics(positions) {
        const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
        const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealized_pnl, 0);
        const totalInvested = positions.reduce((sum, pos) => sum + pos.invested, 0);
        
        return {
            totalValue,
            totalPnL,
            totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
            winRate: this.calculateWinRate(positions),
            sharpeRatio: this.calculateSharpeRatio(positions)
        };
    }
    
    /**
     * Calculate win rate
     */
    calculateWinRate(positions) {
        const profitable = positions.filter(pos => pos.unrealized_pnl > 0).length;
        return positions.length > 0 ? (profitable / positions.length) * 100 : 0;
    }
    
    /**
     * Calculate Sharpe ratio
     */
    calculateSharpeRatio(positions) {
        if (positions.length === 0) return 0;
        
        const returns = positions.map(pos => (pos.unrealized_pnl / pos.invested) * 100);
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        return stdDev > 0 ? avgReturn / stdDev : 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HyperliquidTradingService;
}