"use client";

import React, { useState } from 'react';
import { X, Settings, DollarSign, Percent, Clock, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Strategy } from '@/lib/api';

interface StrategyConfigModalProps {
  strategy: Strategy | null;
  isOpen: boolean;
  onClose: () => void;
  onActivate: (config: StrategyConfig) => void;
  walletAddress?: string;
}

export interface StrategyConfig {
  strategy_id: string;
  symbol: string;
  size: number;
  timeframe: string;
  take_profit?: number;
  stop_loss?: number;
  max_position: number;
  sandbox: boolean;
}

const AVAILABLE_SYMBOLS = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC', 'LINK', 'UNI', 'AAVE', 'ARB', 'OP'];

export function StrategyConfigModal({ strategy, isOpen, onClose, onActivate, walletAddress }: StrategyConfigModalProps) {
  const [config, setConfig] = useState<Partial<StrategyConfig>>({
    symbol: 'BTC',
    size: 0.01,
    timeframe: '1h',
    take_profit: 0.5,
    stop_loss: 0.25,
    max_position: 1000,
    sandbox: true,
  });

  if (!strategy) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onActivate({
      strategy_id: strategy.id,
      symbol: config.symbol || 'BTC',
      size: config.size || 0.01,
      timeframe: config.timeframe || '1h',
      take_profit: config.take_profit,
      stop_loss: config.stop_loss,
      max_position: config.max_position || 1000,
      sandbox: config.sandbox ?? true,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configure {strategy.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trading Pair */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Trading Pair</Label>
            <Select 
              value={config.symbol} 
              onValueChange={(value) => setConfig({ ...config, symbol: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trading pair" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_SYMBOLS.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol}-USD
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeframe */}
          <div className="space-y-2">
            <Label htmlFor="timeframe">Timeframe</Label>
            <Select 
              value={config.timeframe} 
              onValueChange={(value) => setConfig({ ...config, timeframe: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {strategy.timeframe_options.map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Position Size */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="size">Position Size</Label>
              <span className="text-sm text-muted-foreground">{config.size} {config.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={config.size}
                onChange={(e) => setConfig({ ...config, size: parseFloat(e.target.value) })}
                className="flex-1"
              />
            </div>
          </div>

          {/* Risk Management */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="take_profit">Take Profit %</Label>
                <span className="text-sm text-green-500">{config.take_profit}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={config.take_profit}
                  onChange={(e) => setConfig({ ...config, take_profit: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="stop_loss">Stop Loss %</Label>
                <span className="text-sm text-red-500">{config.stop_loss}%</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5"
                  value={config.stop_loss}
                  onChange={(e) => setConfig({ ...config, stop_loss: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </div>

          {/* Max Position */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Max Position Size (USD)</Label>
              <span className="text-sm text-muted-foreground">${config.max_position}</span>
            </div>
            <Slider
              value={[config.max_position || 1000]}
              onValueChange={([value]) => setConfig({ ...config, max_position: value })}
              min={100}
              max={10000}
              step={100}
            />
          </div>

          {/* Sandbox Mode */}
          <div className="flex items-center justify-between p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <Label htmlFor="sandbox" className="cursor-pointer">Sandbox Mode</Label>
                <p className="text-xs text-muted-foreground">Paper trading - no real money at risk</p>
              </div>
            </div>
            <Switch
              id="sandbox"
              checked={config.sandbox}
              onCheckedChange={(checked) => setConfig({ ...config, sandbox: checked })}
            />
          </div>

          {/* Wallet Info */}
          {walletAddress && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">Connected Wallet</p>
              <p className="text-sm font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gap-2">
              <Settings className="w-4 h-4" />
              Activate Strategy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
