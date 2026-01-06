/**
 * WebSocket Real-Time Market Data Service
 * Provides live price feeds and market data via WebSocket connections
 */

export default class WebSocketService {
    constructor() {
        this.connections = new Map();
        this.subscribers = new Map();
        this.reconnectAttempts = new Map();
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.isConnected = false;

        // Default market data endpoints
        this.endpoints = {
            binance: 'wss://stream.binance.com:9443/ws/',
            coinbase: 'wss://ws-feed.exchange.coinbase.com',
            hyperliquid: 'wss://api.hyperliquid.xyz/ws'
        };

        // Active subscriptions
        this.activeSubscriptions = new Set();

        // Price data cache
        this.priceData = new Map();

        // Event listeners
        this.listeners = {
            connect: [],
            disconnect: [],
            error: [],
            priceUpdate: [],
            orderBookUpdate: [],
            tradeUpdate: []
        };
    }

    /**
     * Initialize WebSocket connections
     */
    async initialize() {
        try {
            console.log('🔌 Initializing WebSocket connections...');

            // Connect to multiple exchanges for redundancy
            await Promise.all([
                this.connectToBinance(),
                this.connectToCoinbase(),
                this.connectToHyperliquid()
            ]);

            this.isConnected = true;
            this.emit('connect', { timestamp: Date.now() });

            // Subscribe to default symbols
            this.subscribeToSymbols(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT']);

            console.log('✅ WebSocket service initialized');

        } catch (error) {
            console.error('Failed to initialize WebSocket service:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Connect to Binance WebSocket
     */
    async connectToBinance() {
        try {
            const ws = new WebSocket(`${this.endpoints.binance}!ticker@arr`);

            ws.onopen = () => {
                console.log('📡 Connected to Binance WebSocket');
                this.connections.set('binance', ws);
                this.reconnectAttempts.set('binance', 0);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleBinanceData(data);
                } catch (error) {
                    console.error('Binance data parsing error:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('Binance WebSocket error:', error);
                this.emit('error', { exchange: 'binance', error });
            };

            ws.onclose = () => {
                console.log('🔌 Binance WebSocket disconnected');
                this.connections.delete('binance');
                this.handleReconnect('binance');
            };

        } catch (error) {
            console.error('Failed to connect to Binance:', error);
            throw error;
        }
    }

    /**
     * Connect to Coinbase WebSocket
     */
    async connectToCoinbase() {
        try {
            const ws = new WebSocket(this.endpoints.coinbase);

            ws.onopen = () => {
                console.log('📡 Connected to Coinbase WebSocket');
                this.connections.set('coinbase', ws);
                this.reconnectAttempts.set('coinbase', 0);

                // Subscribe to ticker channel
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'AVAX-USD'],
                    channels: ['ticker']
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleCoinbaseData(data);
                } catch (error) {
                    console.error('Coinbase data parsing error:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('Coinbase WebSocket error:', error);
                this.emit('error', { exchange: 'coinbase', error });
            };

            ws.onclose = () => {
                console.log('🔌 Coinbase WebSocket disconnected');
                this.connections.delete('coinbase');
                this.handleReconnect('coinbase');
            };

        } catch (error) {
            console.error('Failed to connect to Coinbase:', error);
            throw error;
        }
    }

    /**
     * Connect to Hyperliquid WebSocket
     */
    async connectToHyperliquid() {
        try {
            const ws = new WebSocket(this.endpoints.hyperliquid);

            ws.onopen = () => {
                console.log('📡 Connected to Hyperliquid WebSocket');
                this.connections.set('hyperliquid', ws);
                this.reconnectAttempts.set('hyperliquid', 0);

                // Subscribe to market data
                ws.send(JSON.stringify({
                    method: 'subscribe',
                    params: { channel: 'marketData' }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleHyperliquidData(data);
                } catch (error) {
                    console.error('Hyperliquid data parsing error:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('Hyperliquid WebSocket error:', error);
                this.emit('error', { exchange: 'hyperliquid', error });
            };

            ws.onclose = () => {
                console.log('🔌 Hyperliquid WebSocket disconnected');
                this.connections.delete('hyperliquid');
                this.handleReconnect('hyperliquid');
            };

        } catch (error) {
            console.error('Failed to connect to Hyperliquid:', error);
            throw error;
        }
    }

    /**
     * Handle Binance data
     */
    handleBinanceData(data) {
        if (Array.isArray(data)) {
            data.forEach(ticker => {
                const priceData = {
                    exchange: 'binance',
                    symbol: ticker.s,
                    price: parseFloat(ticker.c),
                    change: parseFloat(ticker.P),
                    changePercent: parseFloat(ticker.P),
                    volume: parseFloat(ticker.v),
                    timestamp: ticker.E,
                    bid: parseFloat(ticker.b),
                    ask: parseFloat(ticker.a)
                };

                this.updatePriceData(priceData);
            });
        }
    }

    /**
     * Handle Coinbase data
     */
    handleCoinbaseData(data) {
        if (data.type === 'ticker') {
            const priceData = {
                exchange: 'coinbase',
                symbol: data.product_id,
                price: parseFloat(data.price),
                volume: parseFloat(data.volume_24h),
                timestamp: new Date(data.time).getTime(),
                bid: data.best_bid ? parseFloat(data.best_bid) : null,
                ask: data.best_ask ? parseFloat(data.best_ask) : null
            };

            this.updatePriceData(priceData);
        }
    }

    /**
     * Handle Hyperliquid data
     */
    handleHyperliquidData(data) {
        if (data.channel === 'marketData' && data.data) {
            const priceData = {
                exchange: 'hyperliquid',
                symbol: data.data.symbol,
                price: data.data.price,
                timestamp: Date.now(),
                volume: data.data.volume
            };

            this.updatePriceData(priceData);
        } else if (data.type === 'l2Book' || data.type === 'trades') {
            // Fallback for direct API data structures
            const priceData = {
                exchange: 'hyperliquid',
                symbol: data.coin || data.symbol,
                price: data.price || (data.data ? data.data.price : null),
                timestamp: Date.now(),
                volume: data.volume || 0
            };
            if (priceData.price) this.updatePriceData(priceData);
        }
    }

    /**
     * Update price data and notify subscribers
     */
    updatePriceData(priceData) {
        const symbol = priceData.symbol;

        // Update cache
        if (!this.priceData.has(symbol)) {
            this.priceData.set(symbol, []);
        }

        const history = this.priceData.get(symbol);
        history.push(priceData);

        // Keep only last 1000 entries
        if (history.length > 1000) {
            history.shift();
        }

        // Notify listeners
        this.emit('priceUpdate', { symbol, data: priceData });

        // Update UI
        this.updateUI(priceData);
    }

    /**
     * Subscribe to symbols
     */
    subscribeToSymbols(symbols) {
        symbols.forEach(symbol => {
            this.activeSubscriptions.add(symbol);

            // Notify connected exchanges
            this.connections.forEach((ws, exchange) => {
                if (exchange === 'coinbase') {
                    ws.send(JSON.stringify({
                        type: 'subscribe',
                        product_ids: [symbol],
                        channels: ['ticker']
                    }));
                }
            });
        });

        console.log('📊 Subscribed to symbols:', symbols);
    }

    /**
     * Unsubscribe from symbols
     */
    unsubscribeFromSymbols(symbols) {
        symbols.forEach(symbol => {
            this.activeSubscriptions.delete(symbol);
        });

        console.log('📊 Unsubscribed from symbols:', symbols);
    }

    /**
     * Get current price for symbol
     */
    getCurrentPrice(symbol) {
        const history = this.priceData.get(symbol);
        if (history && history.length > 0) {
            return history[history.length - 1];
        }
        return null;
    }

    /**
     * Get price history for symbol
     */
    getPriceHistory(symbol, limit = 100) {
        const history = this.priceData.get(symbol);
        if (history) {
            return history.slice(-limit);
        }
        return [];
    }

    /**
     * Handle reconnection with exponential backoff
     */
    handleReconnect(exchange) {
        const attempts = this.reconnectAttempts.get(exchange) || 0;

        if (attempts >= this.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for ${exchange}`);
            return;
        }

        const delay = this.reconnectDelay * Math.pow(2, attempts);
        this.reconnectAttempts.set(exchange, attempts + 1);

        console.log(`🔄 Reconnecting to ${exchange} in ${delay}ms (attempt ${attempts + 1})`);

        setTimeout(() => {
            switch (exchange) {
                case 'binance':
                    this.connectToBinance();
                    break;
                case 'coinbase':
                    this.connectToCoinbase();
                    break;
                case 'hyperliquid':
                    this.connectToHyperliquid();
                    break;
            }
        }, delay);
    }

    /**
     * Update UI with new price data
     */
    updateUI(priceData) {
        // Update portfolio values if available
        if (window.ultimateTrading && window.ultimateTrading.services) {
            window.ultimateTrading.services.monitor.updateMarketData(priceData);
        }

        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('marketDataUpdate', {
            detail: priceData
        }));
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     */
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        const status = {};

        this.connections.forEach((ws, exchange) => {
            status[exchange] = {
                connected: ws.readyState === WebSocket.OPEN,
                readyState: ws.readyState,
                url: ws.url
            };
        });

        return {
            overall: this.isConnected,
            connections: status,
            subscriptions: Array.from(this.activeSubscriptions),
            timestamp: Date.now()
        };
    }

    /**
     * Close all connections
     */
    disconnect() {
        console.log('🔌 Disconnecting WebSocket connections...');

        this.connections.forEach((ws, exchange) => {
            ws.close();
            console.log(`🔌 Closed ${exchange} WebSocket`);
        });

        this.connections.clear();
        this.isConnected = false;
        this.activeSubscriptions.clear();

        this.emit('disconnect', { timestamp: Date.now() });
    }

    /**
     * Reconnect all connections
     */
    reconnect() {
        console.log('🔄 Reconnecting all WebSocket connections...');
        this.disconnect();
        setTimeout(() => this.initialize(), 1000);
    }
}



// Create global instance
window.webSocketService = new WebSocketService();

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        try {
            await window.webSocketService.initialize();
            console.log('🚀 WebSocket service ready');
        } catch (error) {
            console.error('Failed to initialize WebSocket service:', error);
        }
    });
}
