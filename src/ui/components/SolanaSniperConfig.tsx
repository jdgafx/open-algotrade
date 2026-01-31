"use client";

import React, { useState } from 'react';
import { Shield, Target, TrendingUp, Users, Droplets } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface SolanaSniperConfig {
  birdeye_api_key: string;
  hours_to_look: number;
  max_market_cap: number;
  max_top10_percent: number;
  min_liquidity: number;
  min_trades_1h: number;
  min_unique_wallets: number;
  check_freeze: boolean;
  check_mutable: boolean;
  check_token2022: boolean;
}

interface SolanaSniperConfigProps {
  config: Partial<SolanaSniperConfig>;
  onChange: (config: SolanaSniperConfig) => void;
}

export function SolanaSniperConfigPanel({ config, onChange }: SolanaSniperConfigProps) {
  const [localConfig, setLocalConfig] = useState<SolanaSniperConfig>({
    birdeye_api_key: config.birdeye_api_key || '',
    hours_to_look: config.hours_to_look || 0.2,
    max_market_cap: config.max_market_cap || 30000,
    max_top10_percent: config.max_top10_percent || 0.7,
    min_liquidity: config.min_liquidity || 400,
    min_trades_1h: config.min_trades_1h || 9,
    min_unique_wallets: config.min_unique_wallets || 30,
    check_freeze: config.check_freeze ?? true,
    check_mutable: config.check_mutable ?? true,
    check_token2022: config.check_token2022 ?? true,
  });

  const updateConfig = (updates: Partial<SolanaSniperConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  return (
    <div className="space-y-6">
      {/* API Key */}
      <div className="space-y-2">
        <Label htmlFor="birdeye_key" className="flex items-center gap-2">
          <Target className="w-4 h-4" />
          Birdeye API Key
        </Label>
        <Input
          id="birdeye_key"
          type="password"
          placeholder="Enter your Birdeye API key"
          value={localConfig.birdeye_api_key}
          onChange={(e) => updateConfig({ birdeye_api_key: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Required for token security checks and market data
        </p>
      </div>

      {/* Launch Time */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Hours to Look Back
          </Label>
          <span className="text-sm text-muted-foreground">{localConfig.hours_to_look}h</span>
        </div>
        <Slider
          value={[localConfig.hours_to_look]}
          onValueChange={([v]) => updateConfig({ hours_to_look: v })}
          min={0.1}
          max={24}
          step={0.1}
        />
        <p className="text-xs text-muted-foreground">
          Scan for tokens launched in the last {localConfig.hours_to_look} hours
        </p>
      </div>

      {/* Market Cap */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Max Market Cap
          </Label>
          <span className="text-sm text-muted-foreground">${localConfig.max_market_cap.toLocaleString()}</span>
        </div>
        <Slider
          value={[localConfig.max_market_cap]}
          onValueChange={([v]) => updateConfig({ max_market_cap: v })}
          min={1000}
          max={100000}
          step={1000}
        />
      </div>

      {/* Liquidity */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="flex items-center gap-2">
            <Droplets className="w-4 h-4" />
            Min Liquidity
          </Label>
          <span className="text-sm text-muted-foreground">${localConfig.min_liquidity.toLocaleString()}</span>
        </div>
        <Slider
          value={[localConfig.min_liquidity]}
          onValueChange={([v]) => updateConfig({ min_liquidity: v })}
          min={100}
          max={5000}
          step={100}
        />
      </div>

      {/* Holder Distribution */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Max Top 10 Holder %
          </Label>
          <span className="text-sm text-muted-foreground">{(localConfig.max_top10_percent * 100).toFixed(0)}%</span>
        </div>
        <Slider
          value={[localConfig.max_top10_percent * 100]}
          onValueChange={([v]) => updateConfig({ max_top10_percent: v / 100 })}
          min={10}
          max={100}
          step={5}
        />
        <p className="text-xs text-muted-foreground">
          Reject tokens where top 10 holders own more than {(localConfig.max_top10_percent * 100).toFixed(0)}%
        </p>
      </div>

      {/* Activity Requirements */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Min Trades (1h)</Label>
          <Input
            type="number"
            value={localConfig.min_trades_1h}
            onChange={(e) => updateConfig({ min_trades_1h: parseInt(e.target.value) })}
            min={1}
            max={100}
          />
        </div>
        <div className="space-y-2">
          <Label>Min Unique Wallets</Label>
          <Input
            type="number"
            value={localConfig.min_unique_wallets}
            onChange={(e) => updateConfig({ min_unique_wallets: parseInt(e.target.value) })}
            min={1}
            max={200}
          />
        </div>
      </div>

      {/* Security Checks */}
      <Card className="border-yellow-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500" />
            Security Filters (Anti-Rug)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Block Freezable Tokens</p>
              <p className="text-xs text-muted-foreground">Prevent dev from freezing your wallet</p>
            </div>
            <Switch
              checked={localConfig.check_freeze}
              onCheckedChange={(v) => updateConfig({ check_freeze: v })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Block Mutable Metadata</p>
              <p className="text-xs text-muted-foreground">Prevent dev from changing token info</p>
            </div>
            <Switch
              checked={localConfig.check_mutable}
              onCheckedChange={(v) => updateConfig({ check_mutable: v })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Block Token 2022 Program</p>
              <p className="text-xs text-muted-foreground">Avoid newer token program with transfer fees</p>
            </div>
            <Switch
              checked={localConfig.check_token2022}
              onCheckedChange={(v) => updateConfig({ check_token2022: v })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
