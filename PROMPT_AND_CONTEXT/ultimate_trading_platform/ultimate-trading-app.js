/**
 * Ultimate Trading Platform - Main Application
 * Integrates all services and provides the complete trading ecosystem
 */

class UltimateTradingApp {
    constructor() {
        this.services = {};
        this.isInitialized = false;
        this.currentUser = null;
        this.appConfig = {
            name: 'Ultimate Algorithmic Trading Platform',
            version: '1.0.0',
            debug: false
        };
        
        // Initialize service instances
        this.services.hyperliquid = new (require('./services/hyperliquid-service.js'))();
        this.services.aiOptimizer = new (require('./services/ai-optimizer.js'))();
        this.services.subscriptionManager = new (require('./services/subscription-manager.js'))();
        this.services.monitor = new (require('./services/trading-monitor.js'))();
    }
    
    /**
     * Initialize the complete trading platform
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                console.log('Platform already initialized');
                return;
            }
            
            console.log('🚀 Initializing Ultimate Trading Platform...');
            showLoading();
            
            // Initialize all services in order
            await this.initializeServices();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Initialize UI components
            await this.initializeUI();
            
            // Start background services
            await this.startBackgroundServices();
            
            this.isInitialized = true;
            hideLoading();
            
            await puter.print('🎉 Ultimate Trading Platform initialized successfully!');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('Failed to initialize platform:', error);
            hideLoading();
            await puter.print(`❌ Platform initialization failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Initialize all platform services
     */
    async initializeServices() {
        console.log('📦 Initializing services...');
        
        // Initialize subscription manager first (authentication)
        await this.services.subscriptionManager.initialize();
        
        // Initialize Hyperliquid integration
        await this.services.hyperliquid.initialize();
        
        // Initialize AI optimizer
        await this.services.aiOptimizer.initialize();
        
        // Initialize monitoring system
        await this.services.monitor.initialize();
        
        console.log('✅ All services initialized');
    }
    
    /**
     * Set up event handlers for the application
     */
    setupEventHandlers() {
        // Dashboard update events
        window.addEventListener('dashboardUpdate', (event) => {
            this.updateDashboard(event.detail);
        });
        
        // Authentication events
        window.addEventListener('userAuthenticated', (event) => {
            this.handleUserAuthentication(event.detail);
        });
        
        // Strategy deployment events
        window.addEventListener('strategyDeployed', (event) => {
            this.handleStrategyDeployment(event.detail);
        });
        
        // Alert events
        window.addEventListener('tradingAlert', (event) => {
            this.handleTradingAlert(event.detail);
        });
        
        // Real-time market data events
        window.addEventListener('marketDataUpdate', (event) => {
            this.handleMarketDataUpdate(event.detail);
        });
    }
    
    /**
     * Initialize UI components and connect to frontend
     */
    async initializeUI() {
        console.log('🎨 Initializing UI components...');
        
        // Connect to frontend variables
        this.connectToFrontend();
        
        // Load user data
        await this.loadUserData();
        
        // Initialize dashboard data
        await this.loadDashboardData();
        
        console.log('✅ UI components initialized');
    }
    
    /**
     * Start background services and monitoring
     */
    async startBackgroundServices() {
        console.log('⚙️ Starting background services...');
        
        // Start AI optimization loop
        this.services.aiOptimizer.startOptimization();
        
        // Start monitoring
        this.services.monitor.startMonitoring();
        
        // Start real-time data feeds
        this.startRealTimeFeeds();
        
        // Start portfolio sync
        this.startPortfolioSync();
        
        console.log('✅ Background services started');
    }
    
    /**
     * Deploy trading strategy
     */
    async deployStrategy(strategyConfig) {
        try {
            console.log(`🚀 Deploying strategy: ${strategyConfig.name}`);
            
            // Validate subscription limits
            await this.services.subscriptionManager.checkSubscriptionLimits('add_strategy');
            await this.services.subscriptionManager.checkSubscriptionLimits('investment_amount', strategyConfig.investmentAmount);
            
            // Create strategy deployment
            const deployment = {
                id: this.generateDeploymentId(),
                userId: this.currentUser.id,
                ...strategyConfig,
                status: 'deploying',
                deployedAt: Date.now()
            };
            
            // Store deployment record
            await this.storeDeployment(deployment);
            
            // Deploy to Hyperliquid
            const hlResult = await this.deployToHyperliquid(strategyConfig);
            
            // Update deployment status
            deployment.status = 'active';
            deployment.hyperliquidOrderId = hlResult.orderId;
            deployment.initialPrice = hlResult.fillPrice;
            
            await this.storeDeployment(deployment);
            
            // Add to active strategies
            await this.addActiveStrategy(deployment);
            
            // Start monitoring for this strategy
            await this.services.monitor.startStrategyMonitoring(deployment.id);
            
            // Send deployment confirmation
            await puter.print(`✅ ${strategyConfig.name} strategy deployed successfully!`);
            
            // Trigger UI update
            window.dispatchEvent(new CustomEvent('strategyDeployed', { 
                detail: deployment 
            }));
            
            return {
                success: true,
                deployment: deployment,
                message: 'Strategy deployed successfully'
            };
            
        } catch (error) {
            console.error('Strategy deployment failed:', error);
            await puter.print(`❌ Strategy deployment failed: ${error.message}`);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Deploy strategy to Hyperliquid
     */
    async deployToHyperliquid(strategyConfig) {
        const strategy = strategyConfig.strategy;
        
        switch (strategy.type) {
            case 'micro-trading':
                return await this.services.hyperliquid.createMicroPosition(
                    strategyConfig.symbol,
                    strategyConfig.side || 'buy',
                    strategyConfig.investmentAmount,
                    strategyConfig.price
                );
                
            case 'arbitrage':
                return await this.services.hyperliquid.executeArbitrage({
                    pairs: strategyConfig.pairs,
                    amount: strategyConfig.investmentAmount,
                    threshold: strategyConfig.threshold
                });
                
            case 'mean-reversion':
                return await this.services.hyperliquid.executeMeanReversion(
                    strategyConfig.symbol,
                    strategyConfig.entryPrice,
                    strategyConfig.currentPrice,
                    {
                        amount: strategyConfig.investmentAmount,
                        threshold: strategyConfig.threshold
                    }
                );
                
            case 'turtle-trading':
                return await this.services.hyperliquid.executeTurtleTrading(
                    strategyConfig.symbol,
                    strategyConfig.priceHistory,
                    {
                        amount: strategyConfig.investmentAmount,
                        lookback: strategyConfig.lookback
                    }
                );
                
            case 'market-making':
                return await this.services.hyperliquid.executeMarketMaking(
                    strategyConfig.symbol,
                    strategyConfig.currentPrice,
                    {
                        amount: strategyConfig.investmentAmount,
                        spread: strategyConfig.spread
                    }
                );
                
            case 'grid-trading':
                return await this.services.hyperliquid.executeGridTrading(
                    strategyConfig.symbol,
                    strategyConfig.currentPrice,
                    {
                        amount: strategyConfig.investmentAmount,
                        gridLevels: strategyConfig.gridLevels,
                        gridSpacing: strategyConfig.gridSpacing
                    }
                );
                
            default:
                throw new Error(`Unknown strategy type: ${strategy.type}`);
        }
    }
    
    /**
     * Get optimal strategies for current market conditions
     */
    async getOptimalStrategies() {
        try {
            const marketConditions = this.services.aiOptimizer.marketConditions;
            const userTier = this.services.subscriptionManager.currentSubscription?.tier;
            
            const recommendations = await this.services.aiOptimizer.selectOptimalStrategies(marketConditions);
            
            // Filter based on subscription tier
            const availableStrategies = this.services.subscriptionManager.getAvailableStrategies();
            const filteredRecommendations = recommendations.filter(rec => 
                availableStrategies.some(strat => strat.name.toLowerCase().includes(rec.name.toLowerCase()))
            );
            
            return {
                recommendations: filteredRecommendations,
                marketConditions: marketConditions,
                userTier: userTier,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Failed to get optimal strategies:', error);
            return {
                recommendations: [],
                marketConditions: { sentiment: 'neutral', volatility: 'medium' },
                userTier: 'micro',
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Get portfolio summary
     */
    async getPortfolioSummary() {
        try {
            const user = this.currentUser;
            const subscription = this.services.subscriptionManager.currentSubscription;
            
            // Get portfolio data
            const portfolioKey = `portfolio_${user.id}`;
            const portfolio = await puter.kv.get(portfolioKey) || {};
            
            // Get active strategies
            const strategiesKey = `active_strategies_${user.id}`;
            const activeStrategies = await puter.kv.get(strategiesKey) || [];
            
            // Calculate metrics
            const totalValue = Object.values(portfolio.holdings || {}).reduce((sum, holding) => 
                sum + (holding.quantity * holding.price), 0
            );
            
            const totalInvested = portfolio.totalInvested || totalValue;
            const totalPnL = totalValue - totalInvested;
            const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
            
            // Get performance metrics from monitor
            const monitor = this.services.monitor;
            const performanceMetrics = await monitor.getPerformanceMetrics();
            
            return {
                summary: {
                    totalValue: totalValue,
                    totalInvested: totalInvested,
                    totalPnL: totalPnL,
                    totalPnLPercent: totalPnLPercent,
                    activeStrategies: activeStrategies.length,
                    subscription: subscription?.tier || 'none'
                },
                performance: performanceMetrics,
                positions: portfolio.holdings || {},
                activeStrategies: activeStrategies,
                subscription: subscription,
                availableStrategies: this.services.subscriptionManager.getAvailableStrategies(),
                lastUpdate: Date.now()
            };
        } catch (error) {
            console.error('Failed to get portfolio summary:', error);
            return {
                summary: {
                    totalValue: 0,
                    totalInvested: 0,
                    totalPnL: 0,
                    totalPnLPercent: 0,
                    activeStrategies: 0,
                    subscription: 'none'
                },
                performance: {},
                positions: {},
                activeStrategies: [],
                subscription: null,
                availableStrategies: [],
                lastUpdate: Date.now()
            };
        }
    }
    
    /**
     * Add investment to existing strategy
     */
    async addInvestment(strategyId, amount) {
        try {
            // Process subscription investment
            const result = await this.services.subscriptionManager.addInvestment(strategyId, amount);
            
            if (result.success) {
                // Update active strategy
                await this.updateStrategyInvestment(strategyId, amount);
                
                // Sync with Hyperliquid
                await this.syncStrategyWithHyperliquid(strategyId, amount);
                
                // Update portfolio
                await this.updatePortfolioAllocation();
                
                window.dispatchEvent(new CustomEvent('investmentAdded', { 
                    detail: result.investment 
                }));
            }
            
            return result;
        } catch (error) {
            console.error('Failed to add investment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Update dashboard with latest data
     */
    async updateDashboard(data) {
        try {
            const summary = await this.getPortfolioSummary();
            
            // Update frontend variables
            updatePortfolioDisplay(summary);
            
            // Update active strategies
            updateActiveStrategiesDisplay(summary.activeStrategies);
            
            // Update alerts
            updateAlertsDisplay(this.services.monitor.getActiveAlerts());
            
        } catch (error) {
            console.error('Failed to update dashboard:', error);
        }
    }
    
    /**
     * Handle user authentication
     */
    handleUserAuthentication(user) {
        this.currentUser = user;
        
        // Reload user-specific data
        this.loadUserData();
        
        // Update UI
        updateUserDisplay(user);
        
        // Resume background services
        this.resumeBackgroundServices();
    }
    
    /**
     * Handle strategy deployment
     */
    handleStrategyDeployment(deployment) {
        console.log('Strategy deployed:', deployment);
        
        // Update active strategies display
        updateActiveStrategiesDisplay([...updateActiveStrategiesDisplay.getActiveStrategies(), deployment]);
        
        // Show success message
        showNotification(`✅ ${deployment.name} deployed successfully!`);
    }
    
    /**
     * Handle trading alerts
     */
    handleTradingAlert(alert) {
        console.log('Trading alert:', alert);
        
        // Update alerts display
        updateAlertsDisplay([alert, ...updateAlertsDisplay.getAlerts()]);
        
        // Show alert notification
        showNotification(`🚨 ${alert.rule.name}: ${alert.message}`, alert.severity);
        
        // Execute alert action if needed
        if (alert.rule.autoExecute) {
            this.executeAlertAction(alert);
        }
    }
    
    /**
     * Handle market data updates
     */
    handleMarketDataUpdate(marketData) {
        // Update market indicators
        updateMarketDisplay(marketData);
        
        // Check for strategy triggers
        this.checkStrategyTriggers(marketData);
    }
    
    /**
     * Load user data
     */
    async loadUserData() {
        try {
            if (await puter.auth.isSignedIn()) {
                this.currentUser = await puter.auth.getUser();
                
                // Load subscription
                await this.services.subscriptionManager.loadUserSubscription();
                
                // Load active strategies
                await this.loadActiveStrategies();
                
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }
    
    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            const summary = await this.getPortfolioSummary();
            updatePortfolioDisplay(summary);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }
    
    /**
     * Load active strategies
     */
    async loadActiveStrategies() {
        try {
            const strategiesKey = `active_strategies_${this.currentUser.id}`;
            const strategies = await puter.kv.get(strategiesKey) || [];
            this.activeStrategies = strategies;
            
            updateActiveStrategiesDisplay(strategies);
        } catch (error) {
            console.error('Failed to load active strategies:', error);
        }
    }
    
    /**
     * Store deployment record
     */
    async storeDeployment(deployment) {
        try {
            const deploymentsKey = `deployments_${this.currentUser.id}`;
            const deployments = await puter.kv.get(deploymentsKey) || [];
            deployments.push(deployment);
            await puter.kv.set(deploymentsKey, deployments);
            
            await puter.kv.incr('total_deployments');
        } catch (error) {
            console.error('Failed to store deployment:', error);
        }
    }
    
    /**
     * Add active strategy
     */
    async addActiveStrategy(strategy) {
        try {
            const strategiesKey = `active_strategies_${this.currentUser.id}`;
            const strategies = await puter.kv.get(strategiesKey) || [];
            strategies.push(strategy);
            await puter.kv.set(strategiesKey, strategies);
        } catch (error) {
            console.error('Failed to add active strategy:', error);
        }
    }
    
    /**
     * Start real-time data feeds
     */
    startRealTimeFeeds() {
        // Market data updates every 5 seconds
        setInterval(() => {
            this.updateMarketData();
        }, 5000);
        
        // Performance updates every 30 seconds
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 30000);
        
        // Portfolio sync every 60 seconds
        setInterval(() => {
            this.syncPortfolioData();
        }, 60000);
    }
    
    /**
     * Update market data
     */
    async updateMarketData() {
        try {
            // Get market data for active symbols
            const symbols = this.getActiveSymbols();
            const marketData = [];
            
            for (const symbol of symbols) {
                const data = await this.services.hyperliquid.getMarketData(symbol);
                marketData.push(data);
            }
            
            // Trigger market data update event
            window.dispatchEvent(new CustomEvent('marketDataUpdate', { 
                detail: marketData 
            }));
            
        } catch (error) {
            console.error('Failed to update market data:', error);
        }
    }
    
    /**
     * Update performance metrics
     */
    async updatePerformanceMetrics() {
        try {
            await this.services.monitor.updatePerformanceMetrics();
        } catch (error) {
            console.error('Failed to update performance metrics:', error);
        }
    }
    
    /**
     * Sync portfolio data
     */
    async syncPortfolioData() {
        try {
            await this.updateDashboard({});
        } catch (error) {
            console.error('Failed to sync portfolio data:', error);
        }
    }
    
    /**
     * Start portfolio sync
     */
    startPortfolioSync() {
        // Initial sync
        this.syncPortfolioData();
        
        // Periodic sync
        setInterval(() => {
            this.syncPortfolioData();
        }, 60000); // Every minute
    }
    
    /**
     * Resume background services
     */
    resumeBackgroundServices() {
        if (this.isInitialized) {
            this.startRealTimeFeeds();
            this.startPortfolioSync();
        }
    }
    
    /**
     * Connect to frontend variables and functions
     */
    connectToFrontend() {
        // Make services available globally
        window.ultimateTrading = {
            app: this,
            services: this.services,
            deployStrategy: this.deployStrategy.bind(this),
            getOptimalStrategies: this.getOptimalStrategies.bind(this),
            getPortfolioSummary: this.getPortfolioSummary.bind(this),
            addInvestment: this.addInvestment.bind(this)
        };
    }
    
    /**
     * Show welcome message
     */
    showWelcomeMessage() {
        const tier = this.services.subscriptionManager.currentSubscription?.tier || 'new user';
        const message = `
            🎉 Welcome to the Ultimate Algorithmic Trading Platform!
            
            Current Tier: ${tier}
            Available Features: ${this.getTierFeatures(tier).join(', ')}
            
            Start by browsing strategies or check your portfolio.
        `;
        
        puter.print(message);
    }
    
    /**
     * Get tier features
     */
    getTierFeatures(tier) {
        const tierInfo = this.services.subscriptionManager.tiers[tier];
        return tierInfo ? tierInfo.features : ['Limited access'];
    }
    
    /**
     * Get active symbols from strategies
     */
    getActiveSymbols() {
        return ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD']; // Default symbols
    }
    
    /**
     * Check strategy triggers
     */
    checkStrategyTriggers(marketData) {
        // Implementation for checking strategy triggers
        // This would iterate through active strategies and check for entry/exit conditions
    }
    
    /**
     * Execute alert action
     */
    executeAlertAction(alert) {
        switch (alert.rule.action) {
            case 'stop_all_trading':
                this.stopAllTrading();
                break;
            case 'reduce_risk':
                this.reduceRiskExposure();
                break;
            case 'pause_strategies':
                this.pauseAllStrategies();
                break;
        }
    }
    
    /**
     * Stop all trading
     */
    stopAllTrading() {
        console.log('🛑 Stopping all trading activities');
        // Implementation to stop all trading
    }
    
    /**
     * Reduce risk exposure
     */
    reduceRiskExposure() {
        console.log('📉 Reducing risk exposure');
        // Implementation to reduce risk
    }
    
    /**
     * Pause all strategies
     */
    pauseAllStrategies() {
        console.log('⏸️ Pausing all strategies');
        // Implementation to pause strategies
    }
    
    // Utility methods
    generateDeploymentId() {
        return 'dep_' + Math.random().toString(36).substr(2, 9);
    }
    
    async updateStrategyInvestment(strategyId, additionalAmount) {
        // Implementation to update strategy investment
    }
    
    async syncStrategyWithHyperliquid(strategyId, amount) {
        // Implementation to sync with Hyperliquid
    }
    
    async updatePortfolioAllocation() {
        // Implementation to update portfolio allocation
    }
}

// Global functions for frontend integration
function updatePortfolioDisplay(summary) {
    const portfolioValue = document.getElementById('portfolio-value');
    const dailyPnL = document.getElementById('daily-pnl');
    
    if (portfolioValue && summary.summary) {
        portfolioValue.textContent = new Intl.NumberFormat('en-US', { 
            style: 'currency', currency: 'USD' 
        }).format(summary.summary.totalValue);
        
        const pnlElement = document.getElementById('daily-pnl');
        if (pnlElement && summary.summary) {
            const pnl = summary.summary.totalPnL;
            pnlElement.textContent = `${pnl >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', { 
                style: 'currency', currency: 'USD' 
            }).format(pnl)} (${summary.summary.totalPnLPercent.toFixed(2)}%)`;
            pnlElement.className = pnl >= 0 ? 'profit' : 'loss';
        }
        
        // Update other metrics
        document.getElementById('active-strategies').textContent = summary.summary.activeStrategies;
        document.getElementById('win-rate').textContent = Math.round(summary.performance.winRate || 0) + '%';
        document.getElementById('sharpe-ratio').textContent = (summary.performance.sharpeRatio || 0).toFixed(2);
    }
}

function updateActiveStrategiesDisplay(strategies) {
    const grid = document.getElementById('active-strategies-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!strategies || strategies.length === 0) {
        grid.innerHTML = `
            <div class="card glassmorphic" style="text-align: center; padding: var(--space-xl);">
                <div style="font-size: 48px; margin-bottom: var(--space-sm);">🚀</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: var(--space-xs);">
                    No Active Strategies
                </div>
                <div style="color: var(--neutral-400); margin-bottom: var(--space-md);">
                    Deploy your first algorithmic trading strategy to start earning profits automatically.
                </div>
                <button class="btn btn-primary" onclick="showSection('strategies')">
                    Browse Strategies
                </button>
            </div>
        `;
        return;
    }
    
    strategies.forEach(strategy => {
        const card = document.createElement('div');
        card.className = 'card glassmorphic strategy-card';
        card.innerHTML = `
            <div class="strategy-header">
                <div class="strategy-title">${strategy.name}</div>
                <div class="strategy-tier">${strategy.tier?.toUpperCase() || 'ACTIVE'}</div>
            </div>
            <div class="metrics">
                <div class="metric">
                    <span class="metric-label">Investment</span>
                    <span class="metric-value">$${(strategy.investmentAmount || 0).toFixed(2)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Current P&L</span>
                    <span class="metric-value ${strategy.currentPnL >= 0 ? 'profit' : 'loss'}">
                        $${(strategy.currentPnL || 0).toFixed(2)}
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">ROI</span>
                    <span class="metric-value ${strategy.roi >= 0 ? 'profit' : 'loss'}">
                        ${(strategy.roi || 0).toFixed(2)}%
                    </span>
                </div>
                <div class="metric">
                    <span class="metric-label">Status</span>
                    <span class="metric-value" style="color: var(--success-500);">
                        ${strategy.status || 'Active'}
                    </span>
                </div>
            </div>
            <div style="display: flex; gap: var(--space-xs); margin-top: var(--space-sm);">
                <button class="btn btn-danger" style="flex: 1;" onclick="stopStrategy('${strategy.id}')">
                    Stop
                </button>
                <button class="btn btn-primary" style="flex: 1;" onclick="viewStrategy('${strategy.id}')">
                    Details
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateAlertsDisplay(alerts) {
    // Update alerts in UI
    console.log('Alerts updated:', alerts.length);
}

function updateUserDisplay(user) {
    // Update user display in UI
    console.log('User updated:', user.username);
}

function updateMarketDisplay(marketData) {
    // Update market display in UI
    console.log('Market data updated:', marketData.length, 'symbols');
}

function showNotification(message, severity = 'info') {
    // Show notification in UI
    console.log(`[${severity.toUpperCase()}] ${message}`);
    
    // Also send via Puter.js
    puter.print(message);
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UltimateTradingApp;
}

// Initialize app when script loads
window.addEventListener('load', async () => {
    try {
        const app = new UltimateTradingApp();
        await app.initialize();
        
        // Make app globally available
        window.app = app;
        
    } catch (error) {
        console.error('Failed to initialize Ultimate Trading App:', error);
    }
});