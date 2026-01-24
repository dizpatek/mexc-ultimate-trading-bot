"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { PortfolioSummary } from '@/components/PortfolioSummary';
import { PortfolioChart } from '@/components/PortfolioChart';
import { NewsSection } from '@/components/NewsSection';
import { TradeForm } from '@/components/TradeForm';
import { HoldingsTable } from '@/components/HoldingsTable';
import { RecentTrades } from '@/components/RecentTrades';
import { StrategyManagement } from '@/components/StrategyManagement';
import { AlarmManager } from '@/components/AlarmManager';
import { F4Monitor } from '@/components/F4Monitor';
import { MarketSentiment } from '@/components/MarketSentiment';
import { PricePredictionWidget } from '@/components/PricePredictionWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RefreshCw } from 'lucide-react';

// NEW: TradingView Mini Widgets
const MarketTickerTape = () => (
  <div className="w-full h-[40px] mb-4 opacity-80 overflow-hidden rounded-lg">
    <iframe
      src="https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#%7B%22symbols%22%3A%5B%7B%22proName%22%3A%22BINANCE%3ABTCUSDT%22%2C%22title%22%3A%22BTC%2FUSDT%22%7D%2C%7B%22proName%22%3A%22BINANCE%3AETHUSDT%22%2C%22title%22%3A%22ETH%2FUSDT%22%7D%2C%7B%22proName%22%3A%22BINANCE%3ASOLUSDT%22%2C%22title%22%3A%22SOL%2FUSDT%22%7D%2C%7B%22proName%22%3A%22BINANCE%3ABNBUSDT%22%2C%22title%22%3A%22BNB%2FUSDT%22%7D%5D%2C%22showSymbolLogo%22%3Atrue%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22displayMode%22%3A%22adaptive%22%7D"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  </div>
);

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Header />

      <main className="container mx-auto px-4 py-8 space-y-8 max-w-[1600px]">

        {/* MARKET DATA STRIP */}
        <MarketTickerTape />

        {/* SUMMARY STATS (Top Section) */}
        <section className="w-full">
          <ErrorBoundary componentName="Portfolio Summary">
            <PortfolioSummary />
          </ErrorBoundary>
        </section>

        {/* MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* LEFT CONTENT AREA: Graphics & Assets */}
          <div className="xl:col-span-3 space-y-8">

            {/* Main Interactive Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* TradingView Advanced Chart (Primary focus) */}
              <div className="lg:col-span-2 stat-card h-[500px] !p-0 overflow-hidden shadow-2xl border-white/10 ring-1 ring-white/5">
                <PortfolioChart />
              </div>

              {/* Technical indicators / F4 (Secondary focus) */}
              <div className="lg:col-span-1 stat-card h-[500px] overflow-hidden scrollbar-thin">
                <F4Monitor />
              </div>
            </div>

            {/* Assets Table */}
            <div className="stat-card !p-0 overflow-hidden border border-white/10 shadow-2xl">
              <HoldingsTable />
            </div>

          </div>

          {/* RIGHT SIDEBAR: AI Hub & Signals */}
          <div className="xl:col-span-1 space-y-6 flex flex-col h-full">

            <PricePredictionWidget />

            <MarketSentiment />

            {/* Embedded Action Center */}
            <div className="shadow-2xl shadow-primary/10 border border-primary/20 rounded-3xl overflow-hidden">
              <TradeForm />
            </div>

            {/* World Events */}
            <div className="stat-card flex-1 overflow-y-auto no-scrollbar min-h-[300px] border-white/5 bg-white/[0.02]">
              <h4 className="text-xs font-bold uppercase tracking-tighter mb-4 text-primary">Global News Context</h4>
              <NewsSection />
            </div>
          </div>

        </div>

        {/* STRATEGY & LOGS (Lower Section) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-12">

          <div className="xl:col-span-2 stat-card overflow-hidden border-white/5 bg-white/[0.01]">
            <StrategyManagement />
          </div>

          <div className="xl:col-span-1 space-y-8">
            <div className="stat-card border-white/5 bg-white/[0.01]">
              <AlarmManager />
            </div>
            <div className="stat-card !p-0 overflow-hidden border-white/5 bg-white/[0.01]">
              <RecentTrades />
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
