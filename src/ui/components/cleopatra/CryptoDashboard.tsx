"use client";

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { TrendingTokens } from './TrendingTokens';
import { MarketTable } from './MarketTable';
import { Web3ConnectCard } from './Web3ConnectCard';

export function CryptoDashboard() {
  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Crypto Market</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your favorite tokens and trading performance</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Last updated: Just now</span>
          <button className="p-2 rounded-lg bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trending Tokens */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trending Projects</h2>
          <button className="text-sm text-primary hover:text-primary/80 font-medium">
            View All →
          </button>
        </div>
        <TrendingTokens />
      </div>

      {/* Market Table + Web3 Connect */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-stretch">
        <div className="xl:col-span-3">
          <MarketTable />
        </div>
        <div className="xl:col-span-1">
          <Web3ConnectCard />
        </div>
      </div>
    </div>
  );
}
