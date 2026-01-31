"use client";

import React from 'react';
import { Wallet, Link2, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Web3ConnectCard() {
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-card to-primary/10 border-primary/20 relative overflow-hidden h-full">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
      
      <CardContent className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <span className="font-bold text-lg">OpenAlgo</span>
        </div>

        <h3 className="text-xl font-bold mb-3 leading-tight">
          Algorithmic Trading for Everyone
        </h3>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Connect your wallet to access proven MoonDev strategies on HyperLiquid. 
          From micro-investments to institutional scale.
        </p>

        <div className="space-y-3 mt-auto">
          <Button className="w-full gap-2 shadow-lg shadow-primary/20">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </Button>
          <Button variant="outline" className="w-full gap-2">
            <Link2 className="w-5 h-5" />
            View Strategies
          </Button>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <Users className="w-3 h-3" />
            Trusted by <span className="text-primary font-semibold">2.4K+</span> traders
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
