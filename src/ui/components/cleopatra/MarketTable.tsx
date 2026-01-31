"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Star, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MarketAsset {
  rank: number;
  name: string;
  ticker: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  marketCap: string;
  volume: string;
  isFavorite?: boolean;
}

const marketData: MarketAsset[] = [
  { rank: 1, name: 'Bitcoin', ticker: 'BTC', price: 80374.47, change1h: -0.54, change24h: -2.86, change7d: 5.56, marketCap: '$1.59T', volume: '$41.48B', isFavorite: false },
  { rank: 2, name: 'Ethereum', ticker: 'ETH', price: 1842.07, change1h: -0.65, change24h: -2.23, change7d: 12.43, marketCap: '$222.45B', volume: '$22.56B', isFavorite: false },
  { rank: 3, name: 'Tether', ticker: 'USDT', price: 0.9999, change1h: 0.00, change24h: -0.01, change7d: -0.01, marketCap: '$143.26B', volume: '$69.12B', isFavorite: false },
  { rank: 4, name: 'XRP', ticker: 'XRP', price: 2.2235, change1h: -2.54, change24h: -2.93, change7d: 15.89, marketCap: '$129.05B', volume: '$5.52B', isFavorite: false },
  { rank: 5, name: 'BNB', ticker: 'BNB', price: 571.81, change1h: -4.65, change24h: -1.32, change7d: -6.25, marketCap: '$81.52B', volume: '$32.29B', isFavorite: true },
  { rank: 6, name: 'Polygon', ticker: 'MATIC', price: 0.2174, change1h: -0.13, change24h: -6.48, change7d: 12.92, marketCap: '$123.39B', volume: '$42.71B', isFavorite: false },
];

const tabs = ['Top', 'Trending', 'Gainers', 'Decliner', 'New-Launch', 'Most Visited'];

export function MarketTable() {
  const [activeTab, setActiveTab] = React.useState('Top');

  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-0">
        <div className="p-4 border-b border-border/50 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {tab === 'Top' && <Activity className="w-3.5 h-3.5" />}
              {tab}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">#</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Name</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Price</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium hidden md:table-cell">1h %</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">24h %</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">7d %</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium hidden lg:table-cell">Market Cap</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium hidden xl:table-cell">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {marketData.map((asset) => (
                <tr key={asset.ticker} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="py-3 px-4 text-muted-foreground">{asset.rank.toString().padStart(2, '0')}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button className={`transition-colors ${asset.isFavorite ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}>
                        <Star className={`w-4 h-4 ${asset.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold">
                        {asset.ticker[0]}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{asset.name}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">{asset.ticker}</Badge>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">${asset.price.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right hidden md:table-cell ${asset.change1h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change1h > 0 ? '+' : ''}{asset.change1h}%
                  </td>
                  <td className={`py-3 px-4 text-right ${asset.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change24h > 0 ? '+' : ''}{asset.change24h}%
                  </td>
                  <td className={`py-3 px-4 text-right hidden lg:table-cell ${asset.change7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change7d > 0 ? '+' : ''}{asset.change7d}%
                  </td>
                  <td className="py-3 px-4 text-right hidden lg:table-cell">{asset.marketCap}</td>
                  <td className="py-3 px-4 text-right hidden xl:table-cell text-muted-foreground">{asset.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
