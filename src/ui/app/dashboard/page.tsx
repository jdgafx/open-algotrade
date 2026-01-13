import { TradingStats } from "@/components/dashboard/TradingStats";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { MarketOverview } from "@/components/dashboard/MarketOverview";

export default function DashboardPage() {
  return (
    <div className="space-y-8 p-8">
      <TradingStats />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <PerformanceChart />
        <RecentTrades />
      </div>
      <MarketOverview />
    </div>
  );
}
