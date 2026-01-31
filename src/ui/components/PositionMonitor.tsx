"use client";

import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tradingAPI, Portfolio } from '@/lib/api';

interface PositionMonitorProps {
  walletAddress?: string;
  apiSecret?: string;
}

export function PositionMonitor({ walletAddress, apiSecret }: PositionMonitorProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    if (!walletAddress || !apiSecret) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await tradingAPI.getPortfolio(walletAddress, apiSecret, true);
      setPortfolio(data);
    } catch (err) {
      setError('Failed to fetch portfolio');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [walletAddress, apiSecret]);

  const totalPnl = portfolio?.positions.reduce((sum, pos) => sum + pos.unrealized_pnl, 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Portfolio</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPortfolio} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error ? (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : !portfolio ? (
          <div className="text-center py-4 text-muted-foreground">
            Connect wallet to view portfolio
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Account Value</p>
                <p className="text-xl font-bold">${portfolio.account_value.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Unrealized P&L</p>
                <p className={`text-xl font-bold ${totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                </p>
              </div>
            </div>

            {portfolio.positions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Active Positions</p>
                {portfolio.positions.map((position) => (
                  <div key={position.symbol} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant={position.side === 'long' ? 'default' : 'destructive'}>
                        {position.side.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{position.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{position.size} @ ${position.entry_price}</p>
                      <p className={`text-xs ${position.unrealized_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No active positions
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
