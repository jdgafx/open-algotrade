"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const trades = [
  {
    id: "1",
    pair: "BTC/USD",
    type: "LONG",
    entry: "$64,230",
    exit: "$65,100",
    pnl: "+$870",
    status: "CLOSED",
    date: "2 mins ago"
  },
  {
    id: "2",
    pair: "ETH/USD",
    type: "SHORT",
    entry: "$3,450",
    exit: "$3,420",
    pnl: "+$300",
    status: "CLOSED",
    date: "15 mins ago"
  },
  {
    id: "3",
    pair: "SOL/USD",
    type: "LONG",
    entry: "$145.20",
    exit: "-",
    pnl: "+$12.50",
    status: "OPEN",
    date: "1 hour ago"
  },
  {
    id: "4",
    pair: "ARB/USD",
    type: "LONG",
    entry: "$1.12",
    exit: "$1.15",
    pnl: "+$450",
    status: "CLOSED",
    date: "3 hours ago"
  },
  {
    id: "5",
    pair: "LINK/USD",
    type: "SHORT",
    entry: "$18.50",
    exit: "$18.80",
    pnl: "-$150",
    status: "CLOSED",
    date: "5 hours ago"
  }
];

export function RecentTrades() {
  return (
    <Card className="col-span-1 h-full min-h-[400px] bg-card/50 backdrop-blur-sm border-border/40">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="w-[100px]">Pair</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">PnL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id} className="hover:bg-muted/50 border-border/40">
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span className="font-bold">{trade.pair}</span>
                    <span className="text-[10px] text-muted-foreground">{trade.date}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={trade.type === "LONG" ? "default" : "destructive"}
                    className="text-[10px] h-5"
                  >
                    {trade.type}
                  </Badge>
                </TableCell>
                <TableCell className={`text-right font-medium ${trade.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                  {trade.pnl}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
