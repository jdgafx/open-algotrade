import { render, screen } from '@testing-library/react';
import { MarketOverview } from './MarketOverview';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Mock the hook
vi.mock('@/lib/market-data', () => ({
  useMarketData: vi.fn(() => ({
    data: [
      { symbol: "BTC-USD", price: 64250.25, change24h: 2.45, volume: "1.2B" },
    ],
    isLoading: false,
  })),
}));

describe('MarketOverview', () => {
  it('renders the market intelligence node title', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketOverview />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/Market Intelligence Node/i)).toBeInTheDocument();
  });

  it('displays the real-time feed badge', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MarketOverview />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/REAL-TIME FEED/i)).toBeInTheDocument();
  });
});

