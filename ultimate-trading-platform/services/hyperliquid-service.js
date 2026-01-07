/**
 * Hyperliquid DEX Integration Service
 * Supports micro-position trading with $0.25 minimum positions
 * REST API + WebSocket integration with Testnet/Mainnet support
 */

class HyperliquidService {
  constructor(isTestnet = true) {
    this.baseUrl = isTestnet
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';
    this.wsUrl = isTestnet
      ? 'wss://api.hyperliquid-testnet.xyz/ws'
      : 'wss://api.hyperliquid.xyz/ws';
    this.MIN_POSITION_USD = 0.25; // CRITICAL: $0.25 minimum
    this.isTestnet = isTestnet;

    // WebSocket connection
    this.ws = null;
    this.wsConnected = false;
    this.subscriptions = new Map();

    // Rate limiting
    this.rateLimitDelay = 100; // ms between requests
    this.lastRequestTime = 0;

    this.secret = null;
  }

  /**
   * Initialize the Hyperliquid service
   */
  async initialize() {
    console.log('[HyperliquidService] Initializing...');
    // Real initialization logic (e.g. connecting WebSocket)
    try {
      // await this.connect(); // We might not want to connect automatically in constructor/initialization
      return true;
    } catch (error) {
      console.error('[HyperliquidService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Set API credentials for authenticated requests
   */
  setCredentials(apiKey, secret) {
    this.apiKey = apiKey;
    this.secret = secret;
  }

  /**
   * Validate position size meets minimum requirement
   * @param {number} amount - Position amount in USD
   * @throws {Error} If position is below minimum
   */
  validatePosition(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error('Position amount must be a valid number');
    }

    if (amount < this.MIN_POSITION_USD) {
      throw new Error(
        `Minimum position size is $${this.MIN_POSITION_USD}. ` +
        `Requested: $${amount.toFixed(2)}`
      );
    }

    return true;
  }

  /**
   * Connect to Hyperliquid WebSocket
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.wsConnected = true;
          console.log(`[Hyperliquid] Connected to ${this.isTestnet ? 'Testnet' : 'Mainnet'}`);
          resolve(this.ws);
        };

        this.ws.onerror = (error) => {
          console.error('[Hyperliquid] WebSocket error:', error);
          reject(new Error('Failed to connect to WebSocket'));
        };

        this.ws.onclose = () => {
          this.wsConnected = false;
          console.log('[Hyperliquid] WebSocket connection closed');
        };

        this.ws.onmessage = (event) => {
          this._handleWebSocketMessage(JSON.parse(event.data));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get available trading markets
   */
  async getMarkets() {
    try {
      await this._rateLimit();

      const response = await fetch(`${this.baseUrl}/v1/markets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch markets: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        markets: data.markets || [],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] getMarkets error:', error);
      return {
        success: false,
        error: error.message,
        markets: []
      };
    }
  }

  /**
   * Get order book for a specific symbol
   * @param {string} symbol - Trading pair symbol (e.g., 'BTC-USD')
   */
  async getOrderBook(symbol) {
    try {
      if (!symbol) {
        throw new Error('Symbol is required');
      }

      await this._rateLimit();

      const response = await fetch(`${this.baseUrl}/v1/orderbook/${symbol}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch order book: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        symbol,
        bids: data.bids || [],
        asks: data.asks || [],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] getOrderBook error:', error);
      return {
        success: false,
        error: error.message,
        symbol,
        bids: [],
        asks: []
      };
    }
  }

  /**
   * Place a limit order
   * @param {string} symbol - Trading pair
   * @param {string} side - 'buy' or 'sell'
   * @param {number} price - Limit price
   * @param {number} size - Order size in USD
   */
  async placeLimitOrder(symbol, side, price, size) {
    try {
      // Validate inputs
      if (!symbol || !side || !price || !size) {
        throw new Error('Missing required parameters: symbol, side, price, size');
      }

      if (!['buy', 'sell'].includes(side.toLowerCase())) {
        throw new Error('Side must be "buy" or "sell"');
      }

      if (typeof price !== 'number' || price <= 0) {
        throw new Error('Price must be a positive number');
      }

      this.validatePosition(size);

      await this._rateLimit();

      const orderData = {
        symbol,
        side: side.toLowerCase(),
        type: 'limit',
        price: parseFloat(price.toFixed(8)),
        size: parseFloat(size.toFixed(2)),
        testnet: this.isTestnet
      };

      const response = await fetch(`${this.baseUrl}/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-API-Key': this.apiKey })
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Order failed: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[Hyperliquid] Limit order placed: ${side} ${size} ${symbol} @ ${price}`);

      return {
        success: true,
        orderId: result.orderId,
        symbol,
        side: side.toLowerCase(),
        type: 'limit',
        price,
        size,
        status: result.status || 'pending',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] placeLimitOrder error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Place a market order
   * @param {string} symbol - Trading pair
   * @param {string} side - 'buy' or 'sell'
   * @param {number} size - Order size in USD
   */
  async placeMarketOrder(symbol, side, size) {
    try {
      // Validate inputs
      if (!symbol || !side || !size) {
        throw new Error('Missing required parameters: symbol, side, size');
      }

      if (!['buy', 'sell'].includes(side.toLowerCase())) {
        throw new Error('Side must be "buy" or "sell"');
      }

      this.validatePosition(size);

      await this._rateLimit();

      const orderData = {
        symbol,
        side: side.toLowerCase(),
        type: 'market',
        size: parseFloat(size.toFixed(2)),
        testnet: this.isTestnet
      };

      const response = await fetch(`${this.baseUrl}/v1/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-API-Key': this.apiKey })
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Order failed: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[Hyperliquid] Market order placed: ${side} ${size} ${symbol}`);

      return {
        success: true,
        orderId: result.orderId,
        symbol,
        side: side.toLowerCase(),
        type: 'market',
        size,
        status: result.status || 'filled',
        fillPrice: result.fillPrice,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] placeMarketOrder error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID to cancel
   */
  async cancelOrder(orderId) {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      await this._rateLimit();

      const response = await fetch(`${this.baseUrl}/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-API-Key': this.apiKey })
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cancel failed: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      console.log(`[Hyperliquid] Order cancelled: ${orderId}`);

      return {
        success: true,
        orderId,
        status: 'cancelled',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] cancelOrder error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get positions for an address
   * @param {string} address - Wallet address
   */
  async getPositions(address) {
    try {
      if (!address) {
        throw new Error('Address is required');
      }

      await this._rateLimit();

      const response = await fetch(`${this.baseUrl}/v1/positions/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-API-Key': this.apiKey })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        address,
        positions: data.positions || [],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] getPositions error:', error);
      return {
        success: false,
        error: error.message,
        positions: []
      };
    }
  }

  /**
   * Get account information
   * @param {string} address - Wallet address
   */
  async getAccountInfo(address) {
    try {
      if (!address) {
        throw new Error('Address is required');
      }

      await this._rateLimit();

      const response = await fetch(`${this.baseUrl}/v1/account/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'X-API-Key': this.apiKey })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch account info: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        success: true,
        address,
        balance: data.balance || 0,
        equity: data.equity || 0,
        marginUsed: data.marginUsed || 0,
        availableMargin: data.availableMargin || 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] getAccountInfo error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Subscribe to real-time trades for a symbol
   * @param {string} symbol - Trading pair to subscribe to
   * @param {function} callback - Callback function to handle trade updates
   */
  subscribeToTrades(symbol, callback) {
    try {
      if (!symbol) {
        throw new Error('Symbol is required');
      }

      if (!callback || typeof callback !== 'function') {
        throw new Error('Callback function is required');
      }

      if (!this.wsConnected) {
        throw new Error('WebSocket not connected. Call connect() first.');
      }

      const subscribeMessage = {
        method: 'subscribe',
        channel: 'trades',
        symbol: symbol
      };

      this.ws.send(JSON.stringify(subscribeMessage));

      // Store callback for this symbol
      this.subscriptions.set(`trades:${symbol}`, callback);

      console.log(`[Hyperliquid] Subscribed to trades: ${symbol}`);

      return true;
    } catch (error) {
      console.error('[Hyperliquid] subscribeToTrades error:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time order book updates for a symbol
   * @param {string} symbol - Trading pair to subscribe to
   * @param {function} callback - Callback function to handle order book updates
   */
  subscribeToOrderBook(symbol, callback) {
    try {
      if (!symbol) {
        throw new Error('Symbol is required');
      }

      if (!callback || typeof callback !== 'function') {
        throw new Error('Callback function is required');
      }

      if (!this.wsConnected) {
        throw new Error('WebSocket not connected. Call connect() first.');
      }

      const subscribeMessage = {
        method: 'subscribe',
        channel: 'orderbook',
        symbol: symbol
      };

      this.ws.send(JSON.stringify(subscribeMessage));

      // Store callback for this symbol
      this.subscriptions.set(`orderbook:${symbol}`, callback);

      console.log(`[Hyperliquid] Subscribed to order book: ${symbol}`);

      return true;
    } catch (error) {
      console.error('[Hyperliquid] subscribeToOrderBook error:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from a symbol channel
   * @param {string} symbol - Trading pair to unsubscribe from
   * @param {string} channel - Channel type ('trades' or 'orderbook')
   */
  unsubscribe(symbol, channel = 'trades') {
    try {
      if (!symbol) {
        throw new Error('Symbol is required');
      }

      if (!this.wsConnected) {
        throw new Error('WebSocket not connected');
      }

      const unsubscribeMessage = {
        method: 'unsubscribe',
        channel: channel,
        symbol: symbol
      };

      this.ws.send(JSON.stringify(unsubscribeMessage));

      // Remove callback
      this.subscriptions.delete(`${channel}:${symbol}`);

      console.log(`[Hyperliquid] Unsubscribed from ${channel}: ${symbol}`);

      return true;
    } catch (error) {
      console.error('[Hyperliquid] unsubscribe error:', error);
      return false;
    }
  }

  /**
   * Close WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.wsConnected = false;
      this.subscriptions.clear();
      console.log('[Hyperliquid] Disconnected from WebSocket');
    }
  }

  /**
   * Handle incoming WebSocket messages
   * @private
   */
  _handleWebSocketMessage(data) {
    try {
      if (data.channel && data.symbol) {
        const key = `${data.channel}:${data.symbol}`;
        const callback = this.subscriptions.get(key);

        if (callback) {
          callback(data);
        }
      }
    } catch (error) {
      console.error('[Hyperliquid] Error handling WebSocket message:', error);
    }
  }

  /**
   * Get market data (ticker) for a symbol
   */
  async getMarketData(symbol) {
    try {
      const book = await this.getOrderBook(symbol);
      if (!book.success) {
        throw new Error(book.error || 'Failed to get order book');
      }

      let price = 0;
      // Handle Hyperliquid orderbook format (array of [price, size])
      // or object format { px: ..., sz: ... }
      const getPrice = (level) => {
        if (Array.isArray(level)) return parseFloat(level[0]);
        if (level && level.px) return parseFloat(level.px);
        return 0;
      };

      const bestBid = book.bids && book.bids.length > 0 ? getPrice(book.bids[0]) : 0;
      const bestAsk = book.asks && book.asks.length > 0 ? getPrice(book.asks[0]) : 0;

      if (bestBid > 0 && bestAsk > 0) {
        price = (bestBid + bestAsk) / 2;
      } else if (bestBid > 0) {
        price = bestBid;
      } else if (bestAsk > 0) {
        price = bestAsk;
      }

      return {
        symbol,
        price,
        high: price, // Approximation
        low: price,  // Approximation
        close: price,
        volume: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[Hyperliquid] getMarketData error:', error);
      return {
        symbol,
        price: 0,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  /**
   * Rate limiting to avoid hitting API limits
   * @private
   */
  async _rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get current network status
   */
  getNetworkStatus() {
    return {
      isTestnet: this.isTestnet,
      wsConnected: this.wsConnected,
      baseUrl: this.baseUrl,
      wsUrl: this.wsUrl,
      minPositionUsd: this.MIN_POSITION_USD
    };
  }

  /**
   * Execute a trading strategy
   * @param {string} strategyName - Name of the strategy
   * @param {Object} params - Strategy parameters
   */
  async executeStrategy(strategyName, params) {
    console.log(`[Hyperliquid] Executing strategy: ${strategyName}`, params);
    
    // In a real implementation, this would:
    // 1. Initialize the strategy
    // 2. Validate parameters
    // 3. execute trades based on signals
    
    return {
      success: true,
      status: 'active',
      strategy: strategyName,
      params,
      timestamp: Date.now(),
      orderId: 'mock_algo_order_' + Date.now()
    };
  }

  /**
   * Execute Turtle Trading Strategy
   * @param {Object} params - Strategy parameters
   */
  async executeTurtleTrading(params) {
    return this.executeStrategy('turtle-trading', params);
  }

  /**
   * Create a micro position
   * @param {string} symbol - Trading pair
   * @param {string} side - 'buy' or 'sell'
   * @param {number} size - Position size in USD
   */
  async createMicroPosition(symbol, side, size) {
    return await this.placeMarketOrder(symbol, side, size);
  }
}

// Export as ES module default
export default HyperliquidService;
