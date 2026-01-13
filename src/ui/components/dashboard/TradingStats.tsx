"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Wallet, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function TradingStats() {
  const stats = [
    {
      title: "Net Profit",
      value: "$12,450.00",
      change: "+15.2%",
      trend: "up",
      icon: Wallet,
      description: "Total profit this month"
    },
    {
      title: "Win Rate",
      value: "68.5%",
      change: "+2.4%",
      trend: "up",
      icon: TrendingUp,
      description: "Winning trades percentage"
    },
    {
      title: "Profit Factor",
      value: "2.45",
      change: "+0.15",
      trend: "up",
      icon: BarChart3,
      description: "Gross profit / Gross loss"
    },
    {
      title: "Active Trades",
      value: "8",
      change: "-2",
      trend: "down",
      icon: Activity,
      description: "Currently open positions"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-card/50 backdrop-blur-sm border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
            <p className="text-xs flex items-center mt-1 text-muted-foreground">
              <span className={`flex items-center ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'} mr-1`}>
                {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                {stat.change}
              </span>
              from last month
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
