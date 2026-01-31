"use client";

import React, { useState, useEffect } from 'react';
import { Play, Square, TrendingUp, Activity, GitBranch, Target, Zap, BarChart3, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tradingAPI, Strategy } from '@/lib/api';
import { StrategyConfigModal, StrategyConfig } from './StrategyConfigModal';
import { PositionMonitor } from './PositionMonitor';

interface StrategyCardProps {
  strategy: Strategy;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}

function StrategyCard({ strategy, isActive, onActivate, onDeactivate }: StrategyCardProps) {
  const icons: Record<string, React.ReactNode> = {
    turtle_trending: <TrendingUp className="w-6 h-6" />,
    consolidation_pop: <Target className="w-6 h-6" />,
    nadarya_watson: <Activity className="w-6 h-6" />,
    correlation: <GitBranch className="w-6 h-6" />,
    market_maker: <Zap className="w-6 h-6" />,
    mean_reversion: <BarChart3 className="w-6 h-6" />,
  };

  return (
    <Card className={`transition-all ${isActive ? 'border-green-500 shadow-lg shadow-green-500/20' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isActive ? 'bg-green-500/20 text-green-500' : 'bg-primary/10 text-primary'}`}>
              {icons[strategy.id] || <Activity className="w-6 h-6" />}
            </div>
            <div>
              <CardTitle className="text-lg">{strategy.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{strategy.description}</p>
            </div>
          </div>
          {isActive && <Badge className="bg-green-500">Active</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {strategy.timeframe_options.map((tf) => (
              <Badge key={tf} variant="secondary" className="text-xs">
                {tf}
              </Badge>
            ))}
          </div>
          
          <div className="flex gap-2">
            {isActive ? (
              <Button variant="destructive" className="w-full gap-2" onClick={onDeactivate}>
                <Square className="w-4 h-4" />
                Stop Strategy
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={onActivate}>
                <Settings className="w-4 h-4" />
                Configure & Activate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StrategyMarketplaceProps {
  walletAddress?: string;
  apiSecret?: string;
}

export function StrategyMarketplace({ walletAddress, apiSecret }: StrategyMarketplaceProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStrategies, setActiveStrategies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      const data = await tradingAPI.getStrategies();
      setStrategies(data);
    } catch (error) {
      console.error('Failed to load strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateClick = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    setIsModalOpen(true);
  };

  const handleActivateSubmit = async (config: StrategyConfig) => {
    if (!walletAddress || !apiSecret) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      const result = await tradingAPI.startStrategy({
        strategy_id: config.strategy_id,
        symbol: config.symbol,
        size: config.size,
        timeframe: config.timeframe,
        take_profit: config.take_profit,
        stop_loss: config.stop_loss,
        api_key: walletAddress,
        api_secret: apiSecret,
        sandbox: config.sandbox,
      });
      
      setActiveStrategies((prev) => new Set([...prev, config.strategy_id]));
      setIsModalOpen(false);
      console.log('Strategy started:', result);
    } catch (error) {
      console.error('Failed to start strategy:', error);
      alert('Failed to start strategy: ' + (error as Error).message);
    }
  };

  const handleDeactivate = async (strategy: Strategy) => {
    try {
      // In a real app, you'd track the strategy_key from the start response
      // For now, we'll just remove it from the UI
      setActiveStrategies((prev) => {
        const next = new Set(prev);
        next.delete(strategy.id);
        return next;
      });
    } catch (error) {
      console.error('Failed to stop strategy:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading strategies...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Strategy Marketplace</h2>
              <p className="text-muted-foreground">Activate proven MoonDev trading algorithms</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Active Strategies</p>
              <p className="text-2xl font-bold text-green-500">{activeStrategies.size}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isActive={activeStrategies.has(strategy.id)}
                onActivate={() => handleActivateClick(strategy)}
                onDeactivate={() => handleDeactivate(strategy)}
              />
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <PositionMonitor walletAddress={walletAddress} apiSecret={apiSecret} />
        </div>
      </div>

      <StrategyConfigModal
        strategy={selectedStrategy}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onActivate={handleActivateSubmit}
        walletAddress={walletAddress}
      />
    </div>
  );
}
