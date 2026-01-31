"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Wallet } from 'lucide-react';

const CandleStick = dynamic(() => import('@/components/CandleStick/CandleStick'), { ssr: false });
const BuyOrders = dynamic(() => import('@/components/BuyOrders/BuyOrders'), { ssr: false });
const SellOrders = dynamic(() => import('@/components/SellOrders/SellOrders'), { ssr: false });
const TradeHistory = dynamic(() => import('@/components/TradeHistory/TradeHistory'), { ssr: false });
const Market = dynamic(() => import('@/components/Market/Market'), { ssr: false });
const MyAssets = dynamic(() => import('@/components/MyAssets/MyAssets'), { ssr: false });

interface MarketStatProps {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
  icon: React.ReactNode;
}

function MarketStat({ label, value, change, isPositive, icon }: MarketStatProps) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
              {icon}
            </div>
            <div>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-lg font-bold text-slate-100">{value}</p>
            </div>
          </div>
          {change && (
            <Badge variant={isPositive ? "default" : "destructive"} className="text-xs">
              {isPositive ? '+' : ''}{change}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TradingTerminal() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MarketStat
          label="BTC/USD"
          value="$97,245.32"
          change="2.45%"
          isPositive={true}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MarketStat
          label="24h Volume"
          value="$42.8B"
          change="12.3%"
          isPositive={true}
          icon={<BarChart3 className="w-4 h-4" />}
        />
        <MarketStat
          label="Market Cap"
          value="$1.92T"
          change="1.8%"
          isPositive={true}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MarketStat
          label="Portfolio Value"
          value="$124,532.89"
          change="5.67%"
          isPositive={true}
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 space-y-4">
          <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
            <CardHeader className="border-b border-slate-800 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-lg text-slate-100 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    BTC/USD
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      1H
                    </Badge>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      4H
                    </Badge>
                    <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/50">
                      1D
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">
                    High: <span className="text-green-400">$98,124.00</span>
                  </span>
                  <span className="text-slate-400">
                    Low: <span className="text-red-400">$96,234.50</span>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] bg-slate-950">
                <CandleStick />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="border-b border-slate-800 py-3">
              <CardTitle className="text-sm text-slate-100">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <TradeHistory />
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-1 space-y-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="border-b border-slate-800 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-slate-100">Order Book</CardTitle>
                <div className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-slate-400">Spread: 0.02%</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 space-y-0">
              <div className="border-b border-slate-800">
                <SellOrders />
              </div>
              <div className="bg-slate-950/50 py-2 text-center">
                <span className="text-lg font-bold text-slate-100">$97,245.32</span>
                <span className="text-xs text-green-400 ml-2">+$2,341.20</span>
              </div>
              <div>
                <BuyOrders />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="border-b border-slate-800 py-3">
              <CardTitle className="text-sm text-slate-100">Markets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Market />
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="border-b border-slate-800 py-3">
              <CardTitle className="text-sm text-slate-100">My Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MyAssets />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
