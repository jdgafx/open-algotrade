"use client";

import { useMarketData } from "@/lib/market-data";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

export function MarketOverview() {
  const { data: assets, isLoading } = useMarketData();

  if (isLoading) {
    return (
      <Card className="col-span-1 lg:col-span-3 bg-card/50 backdrop-blur-sm border-border/40 h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading Market Intelligence...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-3 bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
          Market Intelligence Node
        </CardTitle>
        <Badge variant="outline" className="font-mono text-[10px] border-green-500/50 text-green-500 animate-pulse bg-green-500/10">
          REAL-TIME FEED
        </Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead>Asset Pair</TableHead>
              <TableHead>Last Price</TableHead>
              <TableHead>24h Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets?.map((asset) => (
              <TableRow key={asset.symbol} className="hover:bg-muted/50 border-border/40">
                <TableCell className="font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary border border-primary/20">
                    {asset.symbol.substring(0, 1)}
                  </div>
                  {asset.symbol}
                </TableCell>
                <TableCell className="font-mono">
                  ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 ${asset.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.change24h >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span className="font-bold text-xs">{Math.abs(asset.change24h).toFixed(2)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-xs font-mono">
                  {asset.volume}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
