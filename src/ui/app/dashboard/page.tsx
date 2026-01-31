import { TradingTerminal } from '@/components/TradingTerminal';
import { StrategyMarketplace } from '@/components/StrategyMarketplace';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OpenAlgo Dashboard</h1>
          <p className="text-muted-foreground">Professional algorithmic trading on HyperLiquid</p>
        </div>
      </div>

      <Tabs defaultValue="market" className="space-y-6">
        <TabsList>
          <TabsTrigger value="market">Market Overview</TabsTrigger>
          <TabsTrigger value="strategies">Strategy Marketplace</TabsTrigger>
        </TabsList>

        <TabsContent value="market">
          <TradingTerminal />
        </TabsContent>

        <TabsContent value="strategies">
          <StrategyMarketplace />
        </TabsContent>
      </Tabs>
    </div>
  );
}
