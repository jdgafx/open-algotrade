"use client";

import React from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Token {
  id: string;
  name: string;
  ticker: string;
  badge: string;
  price: number;
  change: number;
  chartData: number[];
}

const mockTokens: Token[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    ticker: 'BTC',
    badge: 'Proof of Work',
    price: 80374.47,
    change: -0.54,
    chartData: [78000, 79500, 79000, 81000, 80500, 80000, 79500, 81000, 80000, 82000]
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    ticker: 'ETH',
    badge: 'Proof of Stake',
    price: 1842.07,
    change: -0.65,
    chartData: [1800, 1850, 1820, 1880, 1850, 1900, 1870, 1920, 1890, 1950]
  },
  {
    id: 'solana',
    name: 'Solana',
    ticker: 'SOL',
    badge: 'Proof of History',
    price: 98.45,
    change: 2.34,
    chartData: [92, 94, 93, 96, 95, 97, 96, 98, 97, 99]
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    ticker: 'HYPE',
    badge: 'Layer 1',
    price: 14.14,
    change: -3.93,
    chartData: [15, 14.8, 14.5, 14.8, 14.2, 14.5, 14.0, 14.3, 13.8, 14.0]
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    ticker: 'ARB',
    badge: 'Layer 2',
    price: 0.847,
    change: 1.25,
    chartData: [0.82, 0.83, 0.81, 0.84, 0.83, 0.85, 0.84, 0.86, 0.85, 0.87]
  }
];

function MiniChart({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={isPositive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        points={points}
      />
      <defs>
        <linearGradient id={`gradient-${isPositive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0.3" />
          <stop offset="100%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#gradient-${isPositive})`}
        points={`0,100 ${points} 100,100`}
      />
    </svg>
  );
}

export function TrendingTokens() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {mockTokens.map((token) => (
        <Card key={token.id} className="bg-card/50 border-border/50 hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                  {token.ticker[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{token.name}</h3>
                  <span className="text-xs text-muted-foreground">{token.ticker}</span>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {token.badge}
              </span>
            </div>
            
            <div className="mb-3">
              <MiniChart data={token.chartData} isPositive={token.change >= 0} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">
                ${token.price.toLocaleString()}
              </span>
              <div className={`flex items-center gap-1 text-sm ${token.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {token.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span>{token.change > 0 ? '+' : ''}{token.change}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
