export default class AuthService {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.authStateListeners = [];
    this.subscriptionManager = null;
  }

  /**
   * Initialize the authentication service
   * Check for existing session on startup
   */
  async initialize() {
    try {
      console.log('[AuthService] Initializing authentication service...');

      // Check if user is already logged in
      const user = await puter.auth.getUser();

      if (user) {
        console.log('[AuthService] Found existing session for user:', user.username);
        this.user = user;
        this.isAuthenticated = true;

        // Load user profile from KV storage
        await this.loadUserProfile();

        // Notify listeners of auth state change
        this.notifyAuthStateChange();
      } else {
        console.log('[AuthService] No existing session found');
        this.isAuthenticated = false;
        this.user = null;
      }

      return this.isAuthenticated;
    } catch (error) {
      console.error('[AuthService] Initialization error:', error);
      this.isAuthenticated = false;
      this.user = null;
      return false;
    }
  }

  /**
   * Sign in user using Puter.js authentication
   */
  async signIn() {
    try {
      console.log('[AuthService] Initiating sign-in...');

      // Trigger Puter.js sign-in flow
      await puter.auth.signIn();

      // Get the authenticated user
      const user = await puter.auth.getUser();

      if (!user) {
        throw new Error('Sign-in failed - no user returned');
      }

      console.log('[AuthService] Sign-in successful for user:', user.username);

      this.user = user;
      this.isAuthenticated = true;

      // Load or create user profile
      await this.loadUserProfile();

      // Notify listeners of auth state change
      this.notifyAuthStateChange();

      return {
        success: true,
        user: this.user
      };
    } catch (error) {
      console.error('[AuthService] Sign-in error:', error);
      this.isAuthenticated = false;
      this.user = null;

      throw new Error(`Sign-in failed: ${error.message}`);
    }
  }

  /**
   * Sign out user
   */
  async signOut() {
    try {
      console.log('[AuthService] Signing out user...');

      // Sign out using Puter.js
      await puter.auth.signOut();

      // Clear local state
      this.user = null;
      this.isAuthenticated = false;

      // Notify listeners of auth state change
      this.notifyAuthStateChange();

      console.log('[AuthService] Sign-out successful');

      return {
        success: true
      };
    } catch (error) {
      console.error('[AuthService] Sign-out error:', error);
      throw new Error(`Sign-out failed: ${error.message}`);
    }
  }

  /**
   * Get current authenticated user
   */
  async getUser() {
    if (!this.user) {
      try {
        this.user = await puter.auth.getUser();
        this.isAuthenticated = !!this.user;
      } catch (error) {
        console.error('[AuthService] Error getting user:', error);
        this.user = null;
        this.isAuthenticated = false;
      }
    }

    return this.user;
  }

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return this.isAuthenticated;
  }

  /**
   * Load user profile from KV storage
   */
  async loadUserProfile() {
    try {
      if (!this.user) {
        return null;
      }

      const profileKey = `user_${this.user.id}_profile`;
      const profile = await puter.kv.get(profileKey);

      if (profile) {
        console.log('[AuthService] Loaded user profile from KV storage');
        return profile;
      } else {
        // Create default profile
        const defaultProfile = {
          id: this.user.id,
          username: this.user.username,
          email: this.user.email,
          preferences: {
            theme: 'dark',
            notifications: true,
            language: 'en',
            timezone: 'UTC'
          },
          tradingSettings: {
            defaultPortfolio: 'default',
            riskLevel: 'medium',
            autoTrading: false
          },
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };

        await this.updateUserProfile(defaultProfile);
        return defaultProfile;
      }
    } catch (error) {
      console.error('[AuthService] Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Get user profile from KV storage
   */
  async getUserProfile() {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const profileKey = `user_${this.user.id}_profile`;
      const profile = await puter.kv.get(profileKey);

      if (!profile) {
        // Create and return default profile
        return await this.loadUserProfile();
      }

      return profile;
    } catch (error) {
      console.error('[AuthService] Error getting user profile:', error);
      throw new Error(`Failed to get user profile: ${error.message}`);
    }
  }

  /**
   * Update user profile in KV storage
   */
  async updateUserProfile(data) {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const profileKey = `user_${this.user.id}_profile`;

      // Get existing profile
      const existingProfile = await puter.kv.get(profileKey) || {};

      // Merge with new data
      const updatedProfile = {
        ...existingProfile,
        ...data,
        updatedAt: new Date().toISOString()
      };

      // Save to KV storage
      await puter.kv.set(profileKey, updatedProfile);

      console.log('[AuthService] User profile updated successfully');

      return updatedProfile;
    } catch (error) {
      console.error('[AuthService] Error updating user profile:', error);
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences) {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const profile = await this.getUserProfile();
      const updatedProfile = {
        ...profile,
        preferences: {
          ...profile.preferences,
          ...preferences
        },
        updatedAt: new Date().toISOString()
      };

      await this.updateUserProfile(updatedProfile);
      return updatedProfile.preferences;
    } catch (error) {
      console.error('[AuthService] Error updating user preferences:', error);
      throw new Error(`Failed to update preferences: ${error.message}`);
    }
  }

  /**
   * Update trading settings
   */
  async updateTradingSettings(tradingSettings) {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const profile = await this.getUserProfile();
      const updatedProfile = {
        ...profile,
        tradingSettings: {
          ...profile.tradingSettings,
          ...tradingSettings
        },
        updatedAt: new Date().toISOString()
      };

      await this.updateUserProfile(updatedProfile);
      return updatedProfile.tradingSettings;
    } catch (error) {
      console.error('[AuthService] Error updating trading settings:', error);
      throw new Error(`Failed to update trading settings: ${error.message}`);
    }
  }

  /**
   * Get user's subscription tier
   */
  async getSubscriptionTier() {
    try {
      if (!this.user) {
        return 'free';
      }

      // Check with subscription manager if available
      if (this.subscriptionManager) {
        return await this.subscriptionManager.getUserTier(this.user.id);
      }

      // Fallback: check KV storage for subscription data
      const subscriptionKey = `user_${this.user.id}_subscription`;
      const subscription = await puter.kv.get(subscriptionKey);

      if (subscription && subscription.tier) {
        return subscription.tier;
      }

      return 'free';
    } catch (error) {
      console.error('[AuthService] Error getting subscription tier:', error);
      return 'free';
    }
  }

  /**
   * Set subscription manager dependency
   */
  setSubscriptionManager(subscriptionManager) {
    this.subscriptionManager = subscriptionManager;
  }

  /**
   * Register listener for authentication state changes
   */
  onAuthStateChange(callback) {
    if (typeof callback === 'function') {
      this.authStateListeners.push(callback);

      // Return unsubscribe function
      return () => {
        const index = this.authStateListeners.indexOf(callback);
        if (index > -1) {
          this.authStateListeners.splice(index, 1);
        }
      };
    }
  }

  /**
   * Notify all listeners of auth state change
   */
  notifyAuthStateChange() {
    const state = {
      isAuthenticated: this.isAuthenticated,
      user: this.user
    };

    this.authStateListeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[AuthService] Error in auth state listener:', error);
      }
    });
  }

  /**
   * Store session data in KV
   */
  async storeSessionData(key, data) {
    try {
      if (!this.user) {
        throw new Error('User not authenticated');
      }

      const sessionKey = `user_${this.user.id}_session_${key}`;
      await puter.kv.set(sessionKey, {
        ...data,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('[AuthService] Error storing session data:', error);
      return false;
    }
  }

  /**
   * Retrieve session data from KV
   */
  async getSessionData(key) {
    try {
      if (!this.user) {
        return null;
      }

      const sessionKey = `user_${this.user.id}_session_${key}`;
      const data = await puter.kv.get(sessionKey);

      return data;
    } catch (error) {
      console.error('[AuthService] Error getting session data:', error);
      return null;
    }
  }

  /**
   * Clear specific session data
   */
  async clearSessionData(key) {
    try {
      if (!this.user) {
        return false;
      }

      const sessionKey = `user_${this.user.id}_session_${key}`;
      await puter.kv.delete(sessionKey);

      return true;
    } catch (error) {
      console.error('[AuthService] Error clearing session data:', error);
      return false;
    }
  }

  /**
   * Get user's authentication token or session info
   */
  async getAuthToken() {
    try {
      if (!this.user) {
        return null;
      }

      // Return user ID as the session identifier
      // Puter.js handles the actual authentication tokens
      return {
        userId: this.user.id,
        username: this.user.username,
        authenticated: this.isAuthenticated
      };
    } catch (error) {
      console.error('[AuthService] Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(permission) {
    try {
      const tier = await this.getSubscriptionTier();

      // Define permission tiers
      const permissions = {
        free: ['view_dashboard', 'basic_analytics'],
        basic: ['view_dashboard', 'basic_analytics', 'manual_trading', 'basic_alerts'],
        pro: ['view_dashboard', 'advanced_analytics', 'auto_trading', 'advanced_alerts', 'custom_strategies'],
        enterprise: ['view_dashboard', 'premium_analytics', 'auto_trading', 'premium_alerts', 'custom_strategies', 'api_access', 'white_label']
      };

      return permissions[tier]?.includes(permission) || false;
    } catch (error) {
      console.error('[AuthService] Error checking permission:', error);
      return false;
    }
  }
}


