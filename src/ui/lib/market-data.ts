import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export interface MarketAsset {
  symbol: string;
  price: number;
  change24h: number;
  volume: string;
}

const MOCK_ASSETS: MarketAsset[] = [
  { symbol: "BTC-USD", price: 64250.25, change24h: 2.45, volume: "1.2B" },
  { symbol: "ETH-USD", price: 3450.80, change24h: -1.2, volume: "850M" },
  { symbol: "SOL-USD", price: 145.20, change24h: 5.8, volume: "420M" },
  { symbol: "ARB-USD", price: 1.15, change24h: -0.5, volume: "120M" },
];

export function useMarketData() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["market-data"],
    queryFn: async () => MOCK_ASSETS,
    staleTime: Infinity,
  });

  // Simulate real-time updates (Best Practice Pattern: queryClient.setQueryData)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.setQueryData(["market-data"], (old: MarketAsset[] | undefined) => {
        if (!old) return old;
        return old.map((asset) => {
          const volatility = 0.001; // 0.1% max change
          const change = 1 + (Math.random() * volatility * 2 - volatility);
          return {
            ...asset,
            price: Number((asset.price * change).toFixed(2)),
          };
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [queryClient]);

  return query;
}
