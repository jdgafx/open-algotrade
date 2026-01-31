// API Client for OpenAlgo Trading Engine
// Connects Next.js frontend to FastAPI backend

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Strategy {
  id: string;
  name: string;
  description: string;
  timeframe_options: string[];
  default_params: Record<string, any>;
}

export interface TradingRequest {
  strategy_id: string;
  symbol: string;
  size: number;
  timeframe?: string;
  take_profit?: number;
  stop_loss?: number;
  api_key: string;
  api_secret: string;
  sandbox?: boolean;
}

export interface Portfolio {
  wallet: string;
  account_value: number;
  available_balance: number;
  positions: Position[];
}

export interface Position {
  symbol: string;
  size: number;
  side: string;
  entry_price: number;
  mark_price: number;
  unrealized_pnl: number;
  leverage: number;
}

class TradingAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async getStrategies(): Promise<Strategy[]> {
    const response = await fetch(`${this.baseUrl}/strategies`);
    if (!response.ok) throw new Error('Failed to fetch strategies');
    return response.json();
  }

  async startStrategy(request: TradingRequest): Promise<{ status: string; strategy_key: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/strategy/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start strategy');
    }
    return response.json();
  }

  async stopStrategy(strategyKey: string): Promise<{ status: string; strategy_key: string }> {
    const response = await fetch(`${this.baseUrl}/strategy/stop/${strategyKey}`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to stop strategy');
    return response.json();
  }

  async getPortfolio(walletAddress: string, apiSecret: string, sandbox: boolean = true): Promise<Portfolio> {
    const params = new URLSearchParams({
      api_secret: apiSecret,
      sandbox: sandbox.toString(),
    });
    const response = await fetch(`${this.baseUrl}/portfolio/${walletAddress}?${params}`);
    if (!response.ok) throw new Error('Failed to fetch portfolio');
    return response.json();
  }

  async killSwitch(walletAddress: string, apiSecret: string, symbol?: string, sandbox: boolean = true): Promise<any> {
    const response = await fetch(`${this.baseUrl}/kill-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: walletAddress,
        api_secret: apiSecret,
        symbol,
        sandbox,
      }),
    });
    if (!response.ok) throw new Error('Kill switch failed');
    return response.json();
  }

  connectWebSocket(onMessage: (data: any) => void): WebSocket {
    const ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/ws/trades`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return ws;
  }
}

export const tradingAPI = new TradingAPI();
