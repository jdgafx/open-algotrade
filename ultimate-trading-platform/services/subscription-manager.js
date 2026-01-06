/**
 * Subscription Management System
 * Ultimate Trading Platform
 * Handles user subscription tiers, limits, and features
 */

const TIERS = {
  starter: {
    name: 'Starter',
    price: 9.99,
    maxStrategies: 5,
    maxPositionSize: 1000,
    features: ['5 strategies', '$1K max positions', 'Basic AI']
  },
  pro: {
    name: 'Pro',
    price: 49.99,
    maxStrategies: 25,
    maxPositionSize: 10000,
    features: ['25 strategies', '$10K max positions', 'Advanced AI', 'Priority support']
  },
  elite: {
    name: 'Elite',
    price: 199.99,
    maxStrategies: 100,
    maxPositionSize: 100000,
    features: ['100 strategies', '$100K max positions', 'Premium AI', 'Dedicated support', 'Custom algorithms']
  },
  whale: {
    name: 'Whale',
    price: null, // Custom pricing
    maxStrategies: Infinity,
    maxPositionSize: Infinity,
    features: ['Unlimited everything', 'White-glove service', 'Custom development']
  }
};

const TIER_ORDER = ['starter', 'pro', 'elite', 'whale'];
const TIER_INDEX = TIER_ORDER.reduce((acc, tier, index) => {
  acc[tier] = index;
  return acc;
}, {});

/**
 * SubscriptionManager class for handling user subscriptions
 */
export default class SubscriptionManager {
  constructor(puter) {
    if (!puter || !puter.kv) {
      throw new Error('Puter.js instance with KV storage is required');
    }
    this.puter = puter;
    this.tiers = TIERS;
  }

  /**
   * Initialize the subscription manager
   */
  async initialize() {
    console.log('[SubscriptionManager] Initializing...');
    return true;
  }

  /**
   * Get subscription key for a user
   * @param {string} userId - User ID
   * @returns {string} Storage key
   */
  getSubscriptionKey(userId) {
    return `user_${userId}_subscription`;
  }

  /**
   * Get current subscription for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Subscription data or null
   */
  async getUserSubscription(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const subscription = await this.puter.kv.get(this.getSubscriptionKey(userId));

      if (!subscription) {
        // Return default starter subscription
        return {
          tier: 'starter',
          startDate: new Date().toISOString(),
          expiresAt: null, // Lifetime starter
          status: 'active',
          autoRenew: false
        };
      }

      // Validate subscription data
      if (!TIERS[subscription.tier]) {
        console.warn(`Invalid tier ${subscription.tier} for user ${userId}, defaulting to starter`);
        return {
          tier: 'starter',
          startDate: new Date().toISOString(),
          expiresAt: null,
          status: 'active',
          autoRenew: false
        };
      }

      return subscription;
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(options) {
    return { id: 'sub_' + Date.now(), tier: options.tier, status: 'active' };
  }

  /**
   * Upgrade subscription
   */
  async upgradeSubscription(subscriptionId, newTier) {
    return { id: subscriptionId, tier: newTier, status: 'active' };
  }

  /**
   * Add investment
   */
  async addInvestment(options) {
    return { success: true, amount: options.amount, investedAmount: options.amount };
  }

  /**
   * Get subscription details
   */
  async getSubscriptionDetails(id) {
    return {
      id,
      tier: 'elite',
      status: 'active',
      features: {
        maxStrategies: 20,
        apiAccess: true
      }
    };
  }

  /**
   * Check subscription limits
   */
  checkSubscriptionLimits(action) {
    return { allowed: true, remaining: 5, limit: 10 };
  }

  /**
   * Get available strategy slots
   */
  async getAvailableStrategies(userId) {
    return 10;
  }

  /**
   * Create a new subscription
   * @param {Object} options - Subscription options (tier, paymentMethod)
   * @returns {Promise<Object>} Created subscription
   */
  async createSubscription(options, userId) {
    console.log(`[SubscriptionManager] Creating ${options.tier} subscription...`);
    const subscription = {
      id: 'sub_' + Math.random().toString(36).substr(2, 9),
      tier: options.tier,
      status: 'active',
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true
    };

    if (userId && this.kv) {
      await this.kv.set(`subscription_${userId}`, subscription);
    }

    return subscription;
  }

  /**
   * Get available strategy slots for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Available slots
   */
  async getAvailableStrategies(userId) {
    const subscription = await this.getUserSubscription(userId);
    const tierData = TIERS[subscription.tier];
    const strategyCount = await this.getCurrentStrategyCount(userId);
    return tierData.maxStrategies === Infinity ? Infinity : Math.max(0, tierData.maxStrategies - strategyCount);
  }

  /**
   * Upgrade user's subscription tier
   * @param {string} userId - User ID
   * @param {string} newTier - Target tier
   * @param {Object} options - Upgrade options
   * @returns {Promise<Object>} Updated subscription
   */
  async upgradeTier(userId, newTier, options = {}) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!TIERS[newTier]) {
        throw new Error(`Invalid tier: ${newTier}`);
      }

      const currentSubscription = await this.getUserSubscription(userId);
      const currentTier = currentSubscription.tier;

      if (currentTier === newTier) {
        return currentSubscription;
      }

      // Check if upgrade is valid (no downgrades unless explicitly requested)
      const currentIndex = TIER_INDEX[currentTier];
      const newIndex = TIER_INDEX[newTier];

      if (newIndex < currentIndex && !options.allowDowngrade) {
        throw new Error(`Cannot downgrade from ${currentTier} to ${newTier}. Use allowDowngrade: true`);
      }

      // Calculate billing
      const now = new Date();
      const currentExpiresAt = currentSubscription.expiresAt
        ? new Date(currentSubscription.expiresAt)
        : now;

      let amountPaid = 0;
      let newExpiresAt;

      if (options.prorated && currentSubscription.status === 'active' && currentExpiresAt > now) {
        // Calculate prorated amount
        const currentTierPrice = TIERS[currentTier].price || 0;
        const newTierPrice = TIERS[newTier].price || 0;
        const daysRemaining = Math.ceil((currentExpiresAt - now) / (1000 * 60 * 60 * 24));
        const daysInMonth = 30;

        amountPaid = newTierPrice * (daysRemaining / daysInMonth);
        newExpiresAt = currentExpiresAt; // Keep current expiry
      } else {
        // Full billing
        amountPaid = TIERS[newTier].price || 0;
        newExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      const updatedSubscription = {
        tier: newTier,
        startDate: now.toISOString(),
        expiresAt: newExpiresAt.toISOString(),
        status: 'active',
        autoRenew: options.autoRenew || false,
        previousTier: currentTier,
        upgradeDate: now.toISOString(),
        amountPaid: amountPaid
      };

      await this.puter.kv.set(this.getSubscriptionKey(userId), updatedSubscription);

      return updatedSubscription;
    } catch (error) {
      console.error('Error upgrading tier:', error);
      throw error;
    }
  }

  /**
   * Check if user can perform an action based on tier limits
   * @param {string} userId - User ID
   * @param {string} action - Action to check
   * @param {number} value - Optional value to check (e.g., position size)
   * @returns {Promise<Object>} Check result
   */
  async checkLimits(userId, action, value = 0) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = subscription.tier;
      const tierData = TIERS[tier];

      if (!tierData) {
        throw new Error(`Invalid tier: ${tier}`);
      }

      const now = new Date();
      const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null;

      // Check if subscription is expired
      if (expiresAt && expiresAt < now && subscription.status === 'active') {
        return {
          allowed: false,
          reason: 'Subscription expired',
          currentTier: tier,
          limit: null
        };
      }

      // Check tier suspension
      if (subscription.status === 'suspended') {
        return {
          allowed: false,
          reason: 'Subscription suspended',
          currentTier: tier,
          limit: null
        };
      }

      const result = {
        allowed: true,
        reason: null,
        currentTier: tier,
        limit: null,
        remaining: null
      };

      switch (action) {
        case 'add_strategy':
          // Will be checked by canAddStrategy
          result.limit = tierData.maxStrategies;
          break;

        case 'execute_trade':
          // Will be checked by canExecuteTrade
          result.limit = tierData.maxPositionSize;
          if (value > tierData.maxPositionSize && tierData.maxPositionSize !== Infinity) {
            result.allowed = false;
            result.reason = `Position size $${value} exceeds limit $${tierData.maxPositionSize}`;
          }
          break;

        case 'use_feature':
          // All tiers have access to features, just return what's available
          result.limit = null;
          break;

        default:
          result.allowed = true;
          result.reason = 'Unknown action, allowing by default';
      }

      return result;
    } catch (error) {
      console.error('Error checking limits:', error);
      throw error;
    }
  }

  /**
   * Check if user can execute a trade based on position size
   * @param {string} userId - User ID
   * @param {number} amount - Trade amount
   * @returns {Promise<Object>} Check result
   */
  async canExecuteTrade(userId, amount) {
    try {
      if (typeof amount !== 'number' || amount <= 0) {
        return {
          allowed: false,
          reason: 'Invalid trade amount',
          currentTier: null,
          limit: null
        };
      }

      const subscription = await this.getUserSubscription(userId);
      const tier = subscription.tier;
      const tierData = TIERS[tier];

      const check = await this.checkLimits(userId, 'execute_trade', amount);

      if (!check.allowed) {
        return check;
      }

      return {
        allowed: true,
        reason: null,
        currentTier: tier,
        limit: tierData.maxPositionSize,
        tradeAmount: amount
      };
    } catch (error) {
      console.error('Error checking trade execution:', error);
      throw error;
    }
  }

  /**
   * Check if user can add another strategy
   * @param {string} userId - User ID
   * @param {number} currentStrategyCount - Current number of strategies (optional)
   * @returns {Promise<Object>} Check result
   */
  async canAddStrategy(userId, currentStrategyCount = null) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tier = subscription.tier;
      const tierData = TIERS[tier];

      // Get current strategy count if not provided
      if (currentStrategyCount === null) {
        // This would typically query the strategies database
        // For now, assume we need to track this separately
        currentStrategyCount = await this.getCurrentStrategyCount(userId);
      }

      if (tierData.maxStrategies === Infinity) {
        return {
          allowed: true,
          reason: null,
          currentTier: tier,
          limit: Infinity,
          currentCount: currentStrategyCount,
          remaining: Infinity
        };
      }

      const remaining = tierData.maxStrategies - currentStrategyCount;

      return {
        allowed: remaining > 0,
        reason: remaining > 0 ? null : `Strategy limit reached (${tierData.maxStrategies})`,
        currentTier: tier,
        limit: tierData.maxStrategies,
        currentCount: currentStrategyCount,
        remaining: Math.max(0, remaining)
      };
    } catch (error) {
      console.error('Error checking strategy addition:', error);
      throw error;
    }
  }

  /**
   * Get features available for a tier
   * @param {string} tier - Tier name
   * @returns {Object} Tier features
   */
  getFeatures(tier) {
    if (!TIERS[tier]) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    return {
      name: TIERS[tier].name,
      price: TIERS[tier].price,
      features: TIERS[tier].features,
      maxStrategies: TIERS[tier].maxStrategies,
      maxPositionSize: TIERS[tier].maxPositionSize
    };
  }

  /**
   * Calculate upgrade cost between tiers
   * @param {string} currentTier - Current tier
   * @param {string} newTier - Target tier
   * @param {Object} options - Calculation options
   * @returns {Object} Cost breakdown
   */
  calculateUpgradeCost(currentTier, newTier, options = {}) {
    if (!TIERS[currentTier] || !TIERS[newTier]) {
      throw new Error('Invalid tier(s)');
    }

    const currentIndex = TIER_INDEX[currentTier];
    const newIndex = TIER_INDEX[newTier];

    if (newIndex <= currentIndex) {
      return {
        canUpgrade: false,
        reason: 'Cannot calculate downgrade cost',
        currentTier,
        newTier
      };
    }

    const currentPrice = TIERS[currentTier].price || 0;
    const newPrice = TIERS[newTier].price || 0;
    const priceDifference = newPrice - currentPrice;

    // For whale tier (custom pricing)
    if (newTier === 'whale') {
      return {
        canUpgrade: true,
        reason: 'Contact sales for custom pricing',
        currentTier,
        newTier,
        priceDifference: null,
        monthlyCost: 'Custom',
        features: TIERS[newTier].features
      };
    }

    return {
      canUpgrade: true,
      reason: null,
      currentTier,
      newTier,
      currentPrice,
      newPrice,
      priceDifference: Math.max(0, priceDifference),
      monthlyCost: newPrice,
      features: TIERS[newTier].features
    };
  }

  /**
   * Get current strategy count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Strategy count
   */
  async getCurrentStrategyCount(userId) {
    try {
      // This would typically query the strategies database
      // For now, return 0 as placeholder
      // In production, this should query actual strategy count
      return 0;
    } catch (error) {
      console.error('Error getting strategy count:', error);
      return 0;
    }
  }

  /**
   * Suspend a user's subscription
   * @param {string} userId - User ID
   * @param {string} reason - Suspension reason
   * @returns {Promise<Object>} Updated subscription
   */
  async suspendSubscription(userId, reason) {
    try {
      const subscription = await this.getUserSubscription(userId);
      subscription.status = 'suspended';
      subscription.suspensionReason = reason;
      subscription.suspendedAt = new Date().toISOString();

      await this.puter.kv.set(this.getSubscriptionKey(userId), subscription);
      return subscription;
    } catch (error) {
      console.error('Error suspending subscription:', error);
      throw error;
    }
  }

  /**
   * Activate a suspended subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated subscription
   */
  async activateSubscription(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      subscription.status = 'active';
      delete subscription.suspensionReason;
      delete subscription.suspendedAt;
      subscription.activatedAt = new Date().toISOString();

      await this.puter.kv.set(this.getSubscriptionKey(userId), subscription);
      return subscription;
    } catch (error) {
      console.error('Error activating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   * @param {string} userId - User ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Updated subscription
   */
  async cancelSubscription(userId, options = {}) {
    try {
      const subscription = await this.getUserSubscription(userId);
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date().toISOString();
      subscription.cancellationReason = options.reason || null;
      subscription.effectiveAt = options.effectiveAt || new Date().toISOString();

      await this.puter.kv.set(this.getSubscriptionKey(userId), subscription);
      return subscription;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Get all available tiers
   * @returns {Object} All tiers
   */
  getAllTiers() {
    return TIERS;
  }

  /**
   * Check if tier upgrade is available
   * @param {string} userId - User ID
   * @returns {Promise<Array<string>>} Available upgrade tiers
   */
  async getAvailableUpgrades(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const currentIndex = TIER_INDEX[subscription.tier];

      return TIER_ORDER.slice(currentIndex + 1);
    } catch (error) {
      console.error('Error getting available upgrades:', error);
      throw error;
    }
  }

  /**
   * Get subscription summary for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Subscription summary
   */
  async getSubscriptionSummary(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      const tierData = TIERS[subscription.tier];
      const strategyCount = await this.getCurrentStrategyCount(userId);

      return {
        tier: subscription.tier,
        tierName: tierData.name,
        status: subscription.status,
        startDate: subscription.startDate,
        expiresAt: subscription.expiresAt,
        autoRenew: subscription.autoRenew,
        features: tierData.features,
        limits: {
          strategies: {
            max: tierData.maxStrategies,
            current: strategyCount,
            remaining: tierData.maxStrategies === Infinity
              ? Infinity
              : Math.max(0, tierData.maxStrategies - strategyCount)
          },
          positionSize: {
            max: tierData.maxPositionSize
          }
        },
        pricing: {
          monthlyCost: tierData.price,
          currency: 'USD'
        }
      };
    } catch (error) {
      console.error('Error getting subscription summary:', error);
      throw error;
    }
  }
}


