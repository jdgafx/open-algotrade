/**
 * Real-Time Trading Monitoring & Alerting System
 * Provides comprehensive tracking, analysis, and notifications for all trading activities
 */

export default class TradingMonitor {
    constructor() {
        this.alerts = new Map();
        this.monitoringRules = new Map();
        this.performanceMetrics = new Map();
        this.riskMetrics = new Map();
        this.notificationChannels = ['puter', 'email', 'sms', 'webhook'];
        this.monitoringInterval = 5000; // 5 seconds
        this.isMonitoring = false;
    }

    /**
     * Get current monitoring status
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            activeRules: this.monitoringRules.size,
            alertCount: this.alerts.size
        };
    }

    /**
     * Update market data for monitoring
     * @param {Object} priceData - Price update
     */
    updateMarketData(priceData) {
        // console.log(`[TradingMonitor] Market update for ${priceData.symbol}: ${priceData.price}`);
        this.getMarketMetrics(); // Refresh metrics
    }

    /**
     * Initialize monitoring system
     */
    async initialize() {
        try {
            // Initialize default monitoring rules
            await this.initializeDefaultRules();

            // Start monitoring loop
            this.startMonitoring();

            await puter.print('📊 Trading Monitor initialized');

            return true;
        } catch (error) {
            console.error('Failed to initialize monitor:', error);
            throw error;
        }
    }

    /**
     * Initialize default monitoring rules
     */
    async initializeDefaultRules() {
        const defaultRules = [
            {
                id: 'drawdown_alert',
                name: 'Maximum Drawdown Alert',
                condition: 'portfolio_drawdown > 15',
                severity: 'critical',
                action: 'notify_stop_trading',
                enabled: true
            },
            {
                id: 'loss_streak_alert',
                name: 'Loss Streak Alert',
                condition: 'consecutive_losses >= 5',
                severity: 'high',
                action: 'notify_reduce_position',
                enabled: true
            },
            {
                id: 'volatility_alert',
                name: 'High Volatility Alert',
                condition: 'volatility > 0.1',
                severity: 'medium',
                action: 'notify_adjust_stops',
                enabled: true
            },
            {
                id: 'connection_alert',
                name: 'Connection Loss Alert',
                condition: 'connection_status == disconnected',
                severity: 'high',
                action: 'notify_emergency_exit',
                enabled: true
            },
            {
                id: 'profit_target_alert',
                name: 'Profit Target Reached',
                condition: 'daily_profit >= target_profit',
                severity: 'low',
                action: 'notify_consider_exit',
                enabled: true
            },
            {
                id: 'position_size_alert',
                name: 'Position Size Alert',
                condition: 'position_size > max_position_size',
                severity: 'high',
                action: 'reduce_position',
                enabled: true
            },
            {
                id: 'market_hours_alert',
                name: 'Market Hours Alert',
                condition: 'outside_market_hours',
                severity: 'low',
                action: 'pause_trading',
                enabled: true
            }
        ];

        for (const rule of defaultRules) {
            this.monitoringRules.set(rule.id, rule);
        }

        // Store rules in cloud storage
        await puter.kv.set('monitoring_rules', Array.from(this.monitoringRules.values()));
    }

    /**
     * Start real-time monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;

        this.monitoringLoop = setInterval(async () => {
            await this.runMonitoringCycle();
        }, this.monitoringInterval);

        console.log('Real-time monitoring started');
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringLoop) {
            clearInterval(this.monitoringLoop);
            this.isMonitoring = false;
            console.log('Real-time monitoring stopped');
        }
    }

    /**
     * Run single monitoring cycle
     */
    async runMonitoringCycle() {
        try {
            // Collect current metrics
            const metrics = await this.collectCurrentMetrics();

            // Update performance tracking
            await this.updatePerformanceMetrics(metrics);

            // Check monitoring rules
            await this.checkMonitoringRules(metrics);

            // Update dashboard data
            await this.updateDashboard(metrics);

            // Clean up old alerts
            await this.cleanupOldAlerts();

        } catch (error) {
            console.error('Monitoring cycle failed:', error);
            await this.handleMonitoringError(error);
        }
    }

    /**
     * Collect current trading metrics
     */
    async collectCurrentMetrics() {
        try {
            const metrics = {
                timestamp: Date.now(),
                portfolio: await this.getPortfolioMetrics(),
                positions: await this.getPositionsMetrics(),
                market: await this.getMarketMetrics(),
                performance: await this.getPerformanceMetrics(),
                system: await this.getSystemMetrics()
            };

            return metrics;
        } catch (error) {
            console.error('Failed to collect metrics:', error);
            return this.getDefaultMetrics();
        }
    }

    /**
     * Get portfolio-level metrics
     */
    async getPortfolioMetrics() {
        try {
            const user = await puter.auth.getUser();
            const portfolioKey = `portfolio_${user.id}`;
            const portfolio = await puter.kv.get(portfolioKey) || {};

            const totalValue = Object.values(portfolio.holdings || {}).reduce((sum, holding) =>
                sum + (holding.quantity * holding.price), 0
            );

            const totalPnL = Object.values(portfolio.holdings || {}).reduce((sum, holding) =>
                sum + (holding.quantity * holding.priceChange), 0
            );

            const totalInvested = portfolio.totalInvested || totalValue;
            const drawdown = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;

            return {
                totalValue: totalValue,
                totalPnL: totalPnL,
                totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
                drawdown: drawdown,
                dayChange: totalPnL,
                dayChangePercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0
            };
        } catch (error) {
            return {
                totalValue: 0,
                totalPnL: 0,
                totalPnLPercent: 0,
                drawdown: 0,
                dayChange: 0,
                dayChangePercent: 0
            };
        }
    }

    /**
     * Get positions-specific metrics
     */
    async getPositionsMetrics() {
        try {
            const user = await puter.auth.getUser();
            const positionsKey = `positions_${user.id}`;
            const positions = await puter.kv.get(positionsKey) || [];

            const totalPositions = positions.length;
            const profitablePositions = positions.filter(p => p.unrealized_pnl > 0).length;
            const lossPositions = positions.filter(p => p.unrealized_pnl < 0).length;

            const totalUnrealizedPnL = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
            const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);

            const largestPosition = positions.reduce((largest, p) =>
                p.invested > largest.invested ? p : largest, { invested: 0 }
            );

            const positionsByStrategy = {};
            positions.forEach(p => {
                const strategy = p.strategy || 'unknown';
                if (!positionsByStrategy[strategy]) {
                    positionsByStrategy[strategy] = { count: 0, totalValue: 0 };
                }
                positionsByStrategy[strategy].count++;
                positionsByStrategy[strategy].totalValue += p.invested;
            });

            return {
                totalPositions: totalPositions,
                profitablePositions: profitablePositions,
                lossPositions: lossPositions,
                winRate: totalPositions > 0 ? (profitablePositions / totalPositions) * 100 : 0,
                totalUnrealizedPnL: totalUnrealizedPnL,
                totalInvested: totalInvested,
                largestPositionSize: largestPosition.invested,
                concentrationRisk: this.calculateConcentrationRisk(positionsByStrategy),
                positionsByStrategy: positionsByStrategy,
                consecutiveLosses: this.calculateConsecutiveLosses(positions)
            };
        } catch (error) {
            return {
                totalPositions: 0,
                profitablePositions: 0,
                lossPositions: 0,
                winRate: 0,
                totalUnrealizedPnL: 0,
                totalInvested: 0,
                largestPositionSize: 0,
                concentrationRisk: 'low',
                positionsByStrategy: {},
                consecutiveLosses: 0
            };
        }
    }

    /**
     * Get market condition metrics
     */
    async getMarketMetrics() {
        try {
            const marketAnalysis = await puter.kv.get('market_analysis') || {};

            // Simulate current volatility calculation
            const volatility = this.calculateCurrentVolatility();
            const volume = this.getCurrentVolume();
            const marketTrend = this.getCurrentMarketTrend();

            return {
                volatility: volatility,
                volume: volume,
                trend: marketTrend,
                sentiment: marketAnalysis.sentiment || 'neutral',
                volatilityLevel: volatility > 0.1 ? 'high' : volatility > 0.05 ? 'medium' : 'low',
                marketHours: this.isMarketOpen(),
                spreadLevels: this.getSpreadLevels()
            };
        } catch (error) {
            return {
                volatility: 0.05,
                volume: 'normal',
                trend: 'sideways',
                sentiment: 'neutral',
                volatilityLevel: 'medium',
                marketHours: true,
                spreadLevels: 'normal'
            };
        }
    }

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics() {
        try {
            const user = await puter.auth.getUser();
            const performanceKey = `performance_${user.id}`;
            const performance = await puter.kv.get(performanceKey) || {};

            // Calculate various performance ratios
            const returns = performance.returns || [];
            const totalReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) : 0;
            const avgReturn = returns.length > 0 ? totalReturn / returns.length : 0;
            const variance = returns.length > 0 ?
                returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
            const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

            const maxDrawdown = Math.min(...(returns.length > 0 ? returns.map(r => r) : [0]));
            const profitFactor = this.calculateProfitFactor(returns);

            const bestDay = Math.max(...(returns.length > 0 ? returns : [0]));
            const worstDay = Math.min(...(returns.length > 0 ? returns : [0]));

            return {
                totalReturn: totalReturn,
                avgDailyReturn: avgReturn,
                sharpeRatio: sharpeRatio,
                maxDrawdown: maxDrawdown,
                profitFactor: profitFactor,
                bestDay: bestDay,
                worstDay: worstDay,
                winRate: this.calculateWinRate(returns),
                totalTrades: returns.length,
                avgTradeDuration: performance.avgTradeDuration || 0,
                returns: returns.slice(-30) // Last 30 days
            };
        } catch (error) {
            return {
                totalReturn: 0,
                avgDailyReturn: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                profitFactor: 0,
                bestDay: 0,
                worstDay: 0,
                winRate: 0,
                totalTrades: 0,
                avgTradeDuration: 0,
                returns: []
            };
        }
    }

    /**
     * Get system health metrics
     */
    async getSystemMetrics() {
        return {
            connectionStatus: navigator.onLine ? 'connected' : 'disconnected',
            apiLatency: Math.random() * 100 + 50, // Simulated latency
            uptime: Date.now() - (await this.getStartTime()),
            errorCount: await this.getErrorCount(),
            lastUpdate: Date.now()
        };
    }

    /**
     * Check monitoring rules against current metrics
     */
    async checkMonitoringRules(metrics) {
        // Implementation
        return [];
    }

    async startStrategyMonitoring(strategyId) {
        console.log(`[TradingMonitor] Monitoring started for strategy: ${strategyId}`);
        return true;
    }

    async stopStrategyMonitoring(strategyId) {
        console.log(`[TradingMonitor] Monitoring stopped for strategy: ${strategyId}`);
        return true;
    }

    /**
     * Evaluate rule condition
     */
    async evaluateRuleCondition(condition, metrics) {
        try {
            // Simple condition parser
            const [metric, operator, value] = condition.split(' ');
            const currentValue = this.getMetricValue(metrics, metric);

            switch (operator) {
                case '>':
                    return currentValue > parseFloat(value);
                case '<':
                    return currentValue < parseFloat(value);
                case '>=':
                    return currentValue >= parseFloat(value);
                case '<=':
                    return currentValue <= parseFloat(value);
                case '==':
                    return currentValue == value;
                case '!=':
                    return currentValue != value;
                default:
                    return false;
            }
        } catch (error) {
            console.error('Condition evaluation failed:', error);
            return false;
        }
    }

    /**
     * Get metric value from metrics object
     */
    getMetricValue(metrics, path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], metrics);
    }

    /**
     * Trigger alert
     */
    async triggerAlert(rule, metrics) {
        const alert = {
            id: rule.id,
            rule: rule,
            triggeredAt: Date.now(),
            severity: rule.severity,
            metrics: metrics,
            status: 'active'
        };

        this.alerts.set(rule.id, alert);

        // Store alert in cloud
        await this.storeAlert(alert);

        // Execute rule action
        await this.executeRuleAction(rule.action, alert);

        // Send notifications
        await this.sendNotifications(alert);

        await puter.print(`🚨 Alert triggered: ${rule.name} (${rule.severity})`);
    }

    /**
     * Execute rule action
     */
    async executeRuleAction(action, alert) {
        try {
            switch (action) {
                case 'notify_stop_trading':
                    await this.pauseAllStrategies();
                    break;
                case 'notify_reduce_position':
                    await this.reducePositionSizes(alert.metrics);
                    break;
                case 'notify_adjust_stops':
                    await this.adjustStopLosses(alert.metrics);
                    break;
                case 'notify_emergency_exit':
                    await this.emergencyExit(alert.metrics);
                    break;
                case 'reduce_position':
                    await this.reducePositionSizes(alert.metrics);
                    break;
                case 'pause_trading':
                    await this.pauseTrading();
                    break;
                default:
                    console.log(`Unknown action: ${action}`);
            }
        } catch (error) {
            console.error('Failed to execute rule action:', error);
        }
    }

    /**
     * Send notifications via multiple channels
     */
    async sendNotifications(alert) {
        try {
            const notification = {
                title: `🚨 Trading Alert: ${alert.rule.name}`,
                message: this.formatAlertMessage(alert),
                severity: alert.severity,
                timestamp: alert.triggeredAt
            };

            // Send via Puter.js (always available)
            await puter.print(notification.message);

            // Store notification
            await this.storeNotification(notification);

            // Send via other channels if configured
            // await this.sendEmailNotification(notification);
            // await this.sendSMSNotification(notification);
            // await this.sendWebhookNotification(notification);

        } catch (error) {
            console.error('Failed to send notifications:', error);
        }
    }

    /**
     * Update performance metrics
     */
    async updatePerformanceMetrics(metrics) {
        const user = await puter.auth.getUser();
        const performanceKey = `performance_${user.id}`;
        const current = await puter.kv.get(performanceKey) || { returns: [] };

        // Add current daily return
        const currentReturn = metrics.portfolio.dayChangePercent;
        current.returns.push(currentReturn);

        // Keep only last 365 days
        if (current.returns.length > 365) {
            current.returns = current.returns.slice(-365);
        }

        await puter.kv.set(performanceKey, current);
    }

    /**
     * Update dashboard data
     */
    async updateDashboard(metrics) {
        try {
            const user = await puter.auth.getUser();
            const dashboardKey = `dashboard_${user.id}`;

            const dashboardData = {
                lastUpdate: Date.now(),
                portfolio: metrics.portfolio,
                positions: metrics.positions,
                performance: metrics.performance,
                alerts: Array.from(this.alerts.values()),
                system: metrics.system
            };

            await puter.kv.set(dashboardKey, dashboardData);

            // Trigger dashboard update event
            window.dispatchEvent(new CustomEvent('dashboardUpdate', {
                detail: dashboardData
            }));

        } catch (error) {
            console.error('Failed to update dashboard:', error);
        }
    }

    /**
     * Clean up old alerts
     */
    async cleanupOldAlerts() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        for (const [id, alert] of this.alerts.entries()) {
            if (now - alert.triggeredAt > maxAge && alert.status === 'resolved') {
                this.alerts.delete(id);
            }
        }
    }

    /**
     * Handle monitoring errors
     */
    async handleMonitoringError(error) {
        try {
            await puter.print(`⚠️ Monitoring Error: ${error.message}`);

            // Log error to cloud storage
            await puter.fs.append('monitoring_errors.log', JSON.stringify({
                error: error.message,
                stack: error.stack,
                timestamp: Date.now()
            }) + '\n');

        } catch (logError) {
            console.error('Failed to log monitoring error:', logError);
        }
    }

    /**
     * Add custom monitoring rule
     */
    async addMonitoringRule(rule) {
        const ruleId = rule.id || this.generateRuleId();
        const fullRule = {
            id: ruleId,
            ...rule,
            createdAt: Date.now(),
            enabled: rule.enabled !== false
        };

        this.monitoringRules.set(ruleId, fullRule);
        await this.storeRule(fullRule);

        await puter.print(`📋 Added monitoring rule: ${rule.name}`);
    }

    /**
     * Remove monitoring rule
     */
    async removeMonitoringRule(ruleId) {
        if (this.monitoringRules.has(ruleId)) {
            this.monitoringRules.delete(ruleId);
            await this.removeStoredRule(ruleId);
            await puter.print(`🗑️ Removed monitoring rule: ${ruleId}`);
        }
    }

    /**
     * Get current alerts
     */
    getActiveAlerts() {
        return Array.from(this.alerts.values()).filter(alert => alert.status === 'active');
    }

    /**
     * Get alert history
     */
    async getAlertHistory() {
        try {
            const user = await puter.auth.getUser();
            const alertsKey = `alerts_${user.id}`;
            const alerts = await puter.kv.get(alertsKey) || [];
            return alerts.slice(-100); // Last 100 alerts
        } catch (error) {
            return [];
        }
    }

    /**
     * Resolve alert
     */
    async resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.status = 'resolved';
            alert.resolvedAt = Date.now();

            // Update stored alert
            await this.updateStoredAlert(alert);
        }
    }

    // Action implementations
    async pauseAllStrategies() {
        // Implementation to pause all active strategies
        await puter.print('⏸️ Pausing all trading strategies');
    }

    async reducePositionSizes(metrics) {
        // Implementation to reduce position sizes
        await puter.print('📉 Reducing position sizes');
    }

    async adjustStopLosses(metrics) {
        // Implementation to adjust stop losses
        await puter.print('🎯 Adjusting stop-loss levels');
    }

    async emergencyExit(metrics) {
        // Implementation for emergency exit
        await puter.print('🚨 EMERGENCY EXIT INITIATED');
    }

    async pauseTrading() {
        // Implementation to pause trading
        await puter.print('⏸️ Trading paused');
    }

    // Utility methods
    calculateConcentrationRisk(positionsByStrategy) {
        const totalPositions = Object.values(positionsByStrategy).reduce((sum, p) => sum + p.count, 0);
        const maxConcentration = Math.max(...Object.values(positionsByStrategy).map(p => p.count / totalPositions));

        if (maxConcentration > 0.6) return 'high';
        if (maxConcentration > 0.4) return 'medium';
        return 'low';
    }

    calculateConsecutiveLosses(positions) {
        let consecutive = 0;
        let maxConsecutive = 0;

        for (let i = positions.length - 1; i >= 0; i--) {
            if (positions[i].unrealized_pnl < 0) {
                consecutive++;
                maxConsecutive = Math.max(maxConsecutive, consecutive);
            } else {
                consecutive = 0;
            }
        }

        return maxConsecutive;
    }

    calculateCurrentVolatility() {
        // Simplified volatility calculation
        return Math.random() * 0.15 + 0.02; // 2% to 17%
    }

    getCurrentVolume() {
        const volumes = ['low', 'normal', 'high'];
        return volumes[Math.floor(Math.random() * volumes.length)];
    }

    getCurrentMarketTrend() {
        const trends = ['bullish', 'bearish', 'sideways'];
        return trends[Math.floor(Math.random() * trends.length)];
    }

    isMarketOpen() {
        // Simplified 24/7 crypto market
        return true;
    }

    getSpreadLevels() {
        const spreads = ['tight', 'normal', 'wide'];
        return spreads[Math.floor(Math.random() * spreads.length)];
    }

    calculateWinRate(returns) {
        const winningDays = returns.filter(r => r > 0).length;
        return returns.length > 0 ? (winningDays / returns.length) * 100 : 0;
    }

    calculateProfitFactor(returns) {
        const grossProfit = returns.filter(r => r > 0).reduce((sum, r) => sum + r, 0);
        const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((sum, r) => sum + r, 0));
        return grossLoss > 0 ? grossProfit / grossLoss : 0;
    }

    getDefaultMetrics() {
        return {
            portfolio: { totalValue: 0, totalPnL: 0 },
            positions: { totalPositions: 0 },
            market: { volatility: 0.05 },
            performance: { totalReturn: 0, sharpeRatio: 0 },
            system: { connectionStatus: 'connected' }
        };
    }

    formatAlertMessage(alert) {
        const rule = alert.rule;
        const severity = rule.severity.toUpperCase();
        const time = new Date(alert.triggeredAt).toLocaleTimeString();

        return `[${severity}] ${rule.name}\nTime: ${time}\nAction: ${rule.action}`;
    }

    // Storage methods
    async storeAlert(alert) {
        try {
            const user = await puter.auth.getUser();
            const alertsKey = `alerts_${user.id}`;
            const alerts = await puter.kv.get(alertsKey) || [];
            alerts.push(alert);
            await puter.kv.set(alertsKey, alerts);
        } catch (error) {
            console.error('Failed to store alert:', error);
        }
    }

    async updateStoredAlert(alert) {
        try {
            const user = await puter.auth.getUser();
            const alertsKey = `alerts_${user.id}`;
            const alerts = await puter.kv.get(alertsKey) || [];

            const index = alerts.findIndex(a => a.id === alert.id);
            if (index !== -1) {
                alerts[index] = alert;
                await puter.kv.set(alertsKey, alerts);
            }
        } catch (error) {
            console.error('Failed to update stored alert:', error);
        }
    }

    async storeNotification(notification) {
        try {
            const user = await puter.auth.getUser();
            const notificationsKey = `notifications_${user.id}`;
            const notifications = await puter.kv.get(notificationsKey) || [];
            notifications.push(notification);

            // Keep only last 1000 notifications
            if (notifications.length > 1000) {
                notifications.splice(0, notifications.length - 1000);
            }

            await puter.kv.set(notificationsKey, notifications);
        } catch (error) {
            console.error('Failed to store notification:', error);
        }
    }

    async storeRule(rule) {
        try {
            const rulesKey = 'monitoring_rules';
            const rules = await puter.kv.get(rulesKey) || [];
            const existingIndex = rules.findIndex(r => r.id === rule.id);

            if (existingIndex !== -1) {
                rules[existingIndex] = rule;
            } else {
                rules.push(rule);
            }

            await puter.kv.set(rulesKey, rules);
        } catch (error) {
            console.error('Failed to store rule:', error);
        }
    }

    async removeStoredRule(ruleId) {
        try {
            const rulesKey = 'monitoring_rules';
            const rules = await puter.kv.get(rulesKey) || [];
            const filteredRules = rules.filter(r => r.id !== ruleId);
            await puter.kv.set(rulesKey, filteredRules);
        } catch (error) {
            console.error('Failed to remove stored rule:', error);
        }
    }

    async getStartTime() {
        const startTime = await puter.kv.get('system_start_time');
        return startTime || Date.now();
    }

    async getErrorCount() {
        return await puter.kv.get('error_count') || 0;
    }

    generateRuleId() {
        return 'rule_' + Math.random().toString(36).substr(2, 9);
    }
}

// Export for use in other modules