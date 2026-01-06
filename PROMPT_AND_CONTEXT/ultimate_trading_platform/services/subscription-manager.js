/**
 * Subscription & Payment Management System
 * Handles flexible "buy into" model with micro to institutional positions
 */

class SubscriptionManager {
    constructor() {
        this.tiers = {
            micro: {
                name: 'Micro Trader',
                minInvestment: 0.25,
                maxInvestment: 10,
                monthlyFee: 0,
                features: [
                    'Basic trading strategies',
                    '1 active strategy',
                    'Real-time data',
                    'Basic risk management',
                    'Email support'
                ],
                strategyLimit: 1,
                positionSizes: ['$0.25', '$0.50', '$1.00', '$2.50', '$5.00', '$10.00'],
                supportedStrategies: ['turtle', 'rsi', 'bollinger'],
                aiFeatures: false,
                apiAccess: false,
                priority: 'low'
            },
            standard: {
                name: 'Standard',
                minInvestment: 100,
                maxInvestment: 1000,
                monthlyFee: 29,
                features: [
                    'All basic strategies',
                    '5 active strategies',
                    'AI-powered strategy selection',
                    'Advanced analytics',
                    'Portfolio optimization',
                    'Email & chat support',
                    'Strategy backtesting'
                ],
                strategyLimit: 5,
                positionSizes: ['$100', '$250', '$500', '$750', '$1,000'],
                supportedStrategies: ['turtle', 'correlation', 'mean-reversion', 'vwap', 'rsi', 'bollinger'],
                aiFeatures: true,
                apiAccess: false,
                priority: 'medium'
            },
            pro: {
                name: 'Pro',
                minInvestment: 1000,
                maxInvestment: 10000,
                monthlyFee: 99,
                features: [
                    'All strategies unlocked',
                    'Unlimited strategies',
                    'Custom strategy builder',
                    'Advanced AI optimization',
                    'Priority support',
                    'API access',
                    'Portfolio rebalancing',
                    'Risk management tools',
                    'White-label options'
                ],
                strategyLimit: -1, // unlimited
                positionSizes: ['$1,000', '$2,500', '$5,000', '$7,500', '$10,000'],
                supportedStrategies: ['all'],
                aiFeatures: true,
                apiAccess: true,
                priority: 'high'
            },
            elite: {
                name: 'Elite',
                minInvestment: 10000,
                maxInvestment: 100000,
                monthlyFee: 299,
                features: [
                    'Everything in Pro',
                    'Dedicated account manager',
                    'Custom algorithm development',
                    'Direct market access',
                    '24/7 phone support',
                    'Institutional risk management',
                    'Multi-exchange integration',
                    'Custom integrations',
                    'SLA guarantees'
                ],
                strategyLimit: -1, // unlimited
                positionSizes: ['$10,000', '$25,000', '$50,000', '$75,000', '$100,000'],
                supportedStrategies: ['all'],
                aiFeatures: true,
                apiAccess: true,
                priority: 'highest'
            }
        };
        
        this.currentUser = null;
        this.currentSubscription = null;
        this.paymentMethods = ['crypto', 'credit-card', 'bank-transfer', 'paypal'];
    }
    
    /**
     * Initialize subscription system with user authentication
     */
    async initialize() {
        try {
            // Check if user is authenticated
            if (!await puter.auth.isSignedIn()) {
                throw new Error('User must be authenticated to access subscription system');
            }
            
            this.currentUser = await puter.auth.getUser();
            
            // Load existing subscription
            await this.loadUserSubscription();
            
            await puter.print(`💳 Subscription system initialized for ${this.currentUser.username}`);
            
            return true;
        } catch (error) {
            console.error('Failed to initialize subscription system:', error);
            throw error;
        }
    }
    
    /**
     * Create new subscription
     */
    async createSubscription(tier, paymentMethod = 'crypto') {
        try {
            const tierInfo = this.tiers[tier];
            if (!tierInfo) {
                throw new Error(`Invalid tier: ${tier}`);
            }
            
            // Create subscription record
            const subscription = {
                id: this.generateSubscriptionId(),
                userId: this.currentUser.id,
                tier: tier,
                status: 'active',
                createdAt: Date.now(),
                features: tierInfo.features,
                constraints: {
                    minInvestment: tierInfo.minInvestment,
                    maxInvestment: tierInfo.maxInvestment,
                    strategyLimit: tierInfo.strategyLimit,
                    positionSizes: tierInfo.positionSizes
                }
            };
            
            // Process payment
            const paymentResult = await this.processPayment(tierInfo.monthlyFee, paymentMethod);
            
            if (paymentResult.success) {
                subscription.paymentId = paymentResult.paymentId;
                subscription.nextBilling = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
                
                // Store subscription in cloud
                await this.storeSubscription(subscription);
                
                this.currentSubscription = subscription;
                
                await puter.print(`🎉 Successfully subscribed to ${tierInfo.name} tier!`);
                
                return {
                    success: true,
                    subscription: subscription,
                    message: `Welcome to ${tierInfo.name}! Your trading algorithms are now active.`
                };
            } else {
                throw new Error(`Payment failed: ${paymentResult.error}`);
            }
        } catch (error) {
            console.error('Failed to create subscription:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Upgrade subscription tier
     */
    async upgradeSubscription(newTier, paymentMethod = 'crypto') {
        try {
            const currentTier = this.currentSubscription?.tier;
            const newTierInfo = this.tiers[newTier];
            
            if (!newTierInfo) {
                throw new Error(`Invalid tier: ${newTier}`);
            }
            
            if (currentTier && this.tiers[currentTier]?.priority >= newTierInfo.priority) {
                throw new Error(`Cannot downgrade or maintain same tier`);
            }
            
            // Calculate upgrade cost (pro-rated)
            const currentTierInfo = this.tiers[currentTier];
            const upgradeCost = this.calculateUpgradeCost(currentTierInfo, newTierInfo);
            
            // Process payment
            const paymentResult = await this.processPayment(upgradeCost, paymentMethod);
            
            if (paymentResult.success) {
                // Update subscription
                this.currentSubscription.tier = newTier;
                this.currentSubscription.upgradedAt = Date.now();
                this.currentSubscription.features = newTierInfo.features;
                this.currentSubscription.constraints = {
                    minInvestment: newTierInfo.minInvestment,
                    maxInvestment: newTierInfo.maxInvestment,
                    strategyLimit: newTierInfo.strategyLimit,
                    positionSizes: newTierInfo.positionSizes
                };
                
                // Store updated subscription
                await this.storeSubscription(this.currentSubscription);
                
                // Send welcome message with new features
                await this.sendUpgradeNotification(newTierInfo);
                
                return {
                    success: true,
                    subscription: this.currentSubscription,
                    message: `Successfully upgraded to ${newTierInfo.name}! New features unlocked.`
                };
            } else {
                throw new Error(`Payment failed: ${paymentResult.error}`);
            }
        } catch (error) {
            console.error('Failed to upgrade subscription:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Add investment to existing strategy (micro positions)
     */
    async addInvestment(strategyId, amount) {
        try {
            if (!this.currentSubscription) {
                throw new Error('No active subscription found');
            }
            
            const tierInfo = this.tiers[this.currentSubscription.tier];
            
            // Validate investment amount
            if (amount < tierInfo.minInvestment) {
                throw new Error(`Minimum investment for ${tierInfo.name} is $${tierInfo.minInvestment}`);
            }
            
            if (amount > tierInfo.maxInvestment) {
                throw new Error(`Maximum investment for ${tierInfo.name} is $${tierInfo.maxInvestment}`);
            }
            
            // Process investment payment
            const paymentResult = await this.processPayment(amount, 'crypto');
            
            if (paymentResult.success) {
                const investment = {
                    id: this.generateInvestmentId(),
                    strategyId: strategyId,
                    amount: amount,
                    userId: this.currentUser.id,
                    paymentId: paymentResult.paymentId,
                    timestamp: Date.now(),
                    status: 'active'
                };
                
                // Store investment
                await this.storeInvestment(investment);
                
                // Deploy strategy with new investment
                await this.deployInvestmentStrategy(investment);
                
                await puter.print(`💰 Added $${amount} investment to ${strategyId} strategy`);
                
                return {
                    success: true,
                    investment: investment,
                    message: `Successfully invested $${amount} in ${strategyId} strategy`
                };
            } else {
                throw new Error(`Investment payment failed: ${paymentResult.error}`);
            }
        } catch (error) {
            console.error('Failed to add investment:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get available strategies for current tier
     */
    getAvailableStrategies() {
        if (!this.currentSubscription) {
            return [];
        }
        
        const tierInfo = this.tiers[this.currentSubscription.tier];
        const allStrategies = [
            { id: 'turtle', name: 'Turtle Trading', category: 'trend', minInvestment: 0.25 },
            { id: 'correlation', name: 'Correlation Trading', category: 'arbitrage', minInvestment: 100 },
            { id: 'mean-reversion', name: 'Mean Reversion', category: 'mean-reversion', minInvestment: 1000 },
            { id: 'market-maker', name: 'Market Maker', category: 'market-making', minInvestment: 1000 },
            { id: 'vwap', name: 'VWAP Algorithm', category: 'trend', minInvestment: 100 },
            { id: 'rsi', name: 'RSI Strategy', category: 'momentum', minInvestment: 0.25 },
            { id: 'bollinger', name: 'Bollinger Bands', category: 'volatility', minInvestment: 100 },
            { id: 'grid-trading', name: 'Grid Trading', category: 'range', minInvestment: 1000 }
        ];
        
        return allStrategies.filter(strategy => {
            // Check if strategy is supported in current tier
            if (tierInfo.supportedStrategies.includes('all')) {
                return true;
            }
            return tierInfo.supportedStrategies.includes(strategy.id);
        }).filter(strategy => {
            // Check if user meets minimum investment requirement
            return strategy.minInvestment >= tierInfo.minInvestment;
        });
    }
    
    /**
     * Check subscription limits
     */
    async checkSubscriptionLimits(action, value = null) {
        const tierInfo = this.tiers[this.currentSubscription.tier];
        
        switch (action) {
            case 'add_strategy':
                if (tierInfo.strategyLimit > 0) {
                    const activeStrategies = await this.getActiveStrategiesCount();
                    if (activeStrategies >= tierInfo.strategyLimit) {
                        throw new Error(`Strategy limit reached (${tierInfo.strategyLimit})`);
                    }
                }
                break;
                
            case 'investment_amount':
                if (value < tierInfo.minInvestment) {
                    throw new Error(`Minimum investment is $${tierInfo.minInvestment}`);
                }
                if (value > tierInfo.maxInvestment) {
                    throw new Error(`Maximum investment is $${tierInfo.maxInvestment}`);
                }
                break;
                
            case 'feature_access':
                if (value === 'ai_features' && !tierInfo.aiFeatures) {
                    throw new Error('AI features require Standard tier or higher');
                }
                if (value === 'api_access' && !tierInfo.apiAccess) {
                    throw new Error('API access requires Pro tier or higher');
                }
                break;
        }
        
        return true;
    }
    
    /**
     * Get subscription usage statistics
     */
    async getUsageStats() {
        try {
            const activeStrategies = await this.getActiveStrategiesCount();
            const totalInvested = await this.getTotalInvested();
            const monthlyUsage = await this.getMonthlyUsage();
            
            return {
                tier: this.currentSubscription.tier,
                activeStrategies: activeStrategies,
                strategyLimit: this.tiers[this.currentSubscription.tier].strategyLimit,
                totalInvested: totalInvested,
                monthlyUsage: monthlyUsage,
                availableFeatures: this.tiers[this.currentSubscription.tier].features,
                nextBilling: this.currentSubscription?.nextBilling || null
            };
        } catch (error) {
            console.error('Failed to get usage stats:', error);
            return null;
        }
    }
    
    /**
     * Process payment via multiple methods
     */
    async processPayment(amount, method) {
        try {
            switch (method) {
                case 'crypto':
                    return await this.processCryptoPayment(amount);
                case 'credit-card':
                    return await this.processCreditCardPayment(amount);
                case 'bank-transfer':
                    return await this.processBankTransferPayment(amount);
                case 'paypal':
                    return await this.processPayPalPayment(amount);
                default:
                    throw new Error(`Unsupported payment method: ${method}`);
            }
        } catch (error) {
            console.error('Payment processing failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Process cryptocurrency payment (via Hyperliquid integration)
     */
    async processCryptoPayment(amount) {
        try {
            // Simulate crypto payment processing
            const paymentId = this.generatePaymentId();
            const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;
            
            // Store payment record
            await this.storePayment({
                id: paymentId,
                amount: amount,
                method: 'crypto',
                transactionHash: transactionHash,
                status: 'completed',
                timestamp: Date.now()
            });
            
            return {
                success: true,
                paymentId: paymentId,
                transactionHash: transactionHash,
                message: 'Payment confirmed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Process credit card payment (simulated)
     */
    async processCreditCardPayment(amount) {
        try {
            // In real implementation, integrate with Stripe, PayPal, etc.
            const paymentId = this.generatePaymentId();
            
            await this.storePayment({
                id: paymentId,
                amount: amount,
                method: 'credit-card',
                status: 'completed',
                timestamp: Date.now()
            });
            
            return {
                success: true,
                paymentId: paymentId,
                message: 'Credit card payment processed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Process bank transfer payment
     */
    async processBankTransferPayment(amount) {
        try {
            const paymentId = this.generatePaymentId();
            const bankReference = `BT${Date.now()}`;
            
            await this.storePayment({
                id: paymentId,
                amount: amount,
                method: 'bank-transfer',
                bankReference: bankReference,
                status: 'pending',
                timestamp: Date.now()
            });
            
            return {
                success: true,
                paymentId: paymentId,
                bankReference: bankReference,
                message: 'Bank transfer initiated'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Process PayPal payment
     */
    async processPayPalPayment(amount) {
        try {
            const paymentId = this.generatePaymentId();
            
            await this.storePayment({
                id: paymentId,
                amount: amount,
                method: 'paypal',
                status: 'completed',
                timestamp: Date.now()
            });
            
            return {
                success: true,
                paymentId: paymentId,
                message: 'PayPal payment completed'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Calculate upgrade cost (pro-rated)
     */
    calculateUpgradeCost(currentTier, newTier) {
        if (!currentTier) {
            return newTier.monthlyFee;
        }
        
        const currentMonth = new Date().getMonth();
        const daysInMonth = new Date(new Date().getFullYear(), currentMonth + 1, 0).getDate();
        const currentDay = new Date().getDate();
        const remainingDays = daysInMonth - currentDay;
        
        const dailyRate = newTier.monthlyFee / daysInMonth;
        return dailyRate * remainingDays;
    }
    
    /**
     * Send upgrade notification
     */
    async sendUpgradeNotification(tierInfo) {
        try {
            const message = `
                🎉 Welcome to ${tierInfo.name}!
                
                Your new features are now active:
                ${tierInfo.features.map(feature => `• ${feature}`).join('\n')}
                
                Available position sizes: ${tierInfo.positionSizes.join(', ')}
                
                Start deploying strategies and maximizing your returns!
            `;
            
            await puter.print(message);
            
            // Store notification
            await this.storeNotification({
                type: 'upgrade',
                title: 'Subscription Upgraded',
                message: message,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Failed to send upgrade notification:', error);
        }
    }
    
    /**
     * Deploy investment strategy
     */
    async deployInvestmentStrategy(investment) {
        try {
            // Connect to Hyperliquid service
            const hlService = new (require('./hyperliquid-service.js'))();
            await hlService.initialize();
            
            // Create micro position
            await hlService.createMicroPosition(
                investment.strategyId,
                'buy', // or determine direction based on strategy
                investment.amount
            );
            
            await puter.print(`🚀 Deployed $${investment.amount} investment in ${investment.strategyId} strategy`);
        } catch (error) {
            console.error('Failed to deploy investment strategy:', error);
        }
    }
    
    // Storage methods using Puter.js
    async storeSubscription(subscription) {
        try {
            await puter.kv.set(`subscription_${this.currentUser.id}`, subscription);
            await puter.kv.incr('total_subscriptions');
        } catch (error) {
            console.error('Failed to store subscription:', error);
        }
    }
    
    async loadUserSubscription() {
        try {
            const subscription = await puter.kv.get(`subscription_${this.currentUser.id}`);
            if (subscription) {
                this.currentSubscription = subscription;
            }
        } catch (error) {
            console.error('Failed to load user subscription:', error);
        }
    }
    
    async storeInvestment(investment) {
        try {
            const investmentsKey = `investments_${this.currentUser.id}`;
            const investments = await puter.kv.get(investmentsKey) || [];
            investments.push(investment);
            await puter.kv.set(investmentsKey, investments);
            await puter.kv.incr('total_investments');
        } catch (error) {
            console.error('Failed to store investment:', error);
        }
    }
    
    async storePayment(payment) {
        try {
            const paymentsKey = `payments_${this.currentUser.id}`;
            const payments = await puter.kv.get(paymentsKey) || [];
            payments.push(payment);
            await puter.kv.set(paymentsKey, payments);
            await puter.kv.incr('total_payments');
        } catch (error) {
            console.error('Failed to store payment:', error);
        }
    }
    
    async storeNotification(notification) {
        try {
            const notificationsKey = `notifications_${this.currentUser.id}`;
            const notifications = await puter.kv.get(notificationsKey) || [];
            notifications.push(notification);
            await puter.kv.set(notificationsKey, notifications);
        } catch (error) {
            console.error('Failed to store notification:', error);
        }
    }
    
    async getActiveStrategiesCount() {
        try {
            const strategiesKey = `active_strategies_${this.currentUser.id}`;
            const strategies = await puter.kv.get(strategiesKey) || [];
            return strategies.length;
        } catch (error) {
            return 0;
        }
    }
    
    async getTotalInvested() {
        try {
            const investmentsKey = `investments_${this.currentUser.id}`;
            const investments = await puter.kv.get(investmentsKey) || [];
            return investments.reduce((sum, inv) => sum + inv.amount, 0);
        } catch (error) {
            return 0;
        }
    }
    
    async getMonthlyUsage() {
        try {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            const investmentsKey = `investments_${this.currentUser.id}`;
            const investments = await puter.kv.get(investmentsKey) || [];
            
            const monthlyInvestment = investments
                .filter(inv => {
                    const invDate = new Date(inv.timestamp);
                    return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
                })
                .reduce((sum, inv) => sum + inv.amount, 0);
            
            return monthlyInvestment;
        } catch (error) {
            return 0;
        }
    }
    
    // Utility methods
    generateSubscriptionId() {
        return 'sub_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateInvestmentId() {
        return 'inv_' + Math.random().toString(36).substr(2, 9);
    }
    
    generatePaymentId() {
        return 'pay_' + Math.random().toString(36).substr(2, 9);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubscriptionManager;
}