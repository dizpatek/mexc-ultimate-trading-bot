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

        {/* SUMMARY STATS (Top Section) */}
        <section className="w-full">
          <ErrorBoundary componentName="Portfolio Summary">
            <PortfolioSummary />
          </ErrorBoundary>
        </section>

        {/* MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">

          {/* LEFT CONTENT AREA (3 Cols) */}
          <div className="xl:col-span-3 space-y-8">

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="stat-card h-[450px] !p-0 overflow-hidden shadow-lg border-white/5">
                <PortfolioChart />
              </div>
              <div className="stat-card h-[450px] overflow-hidden shadow-lg border-white/5">
                <F4Monitor />
              </div>
            </div>

            {/* Holdings Section (Single Row Table) */}
            <div className="stat-card !p-0 overflow-hidden border border-white/10 shadow-2xl">
              <HoldingsTable />
            </div>

          </div>

          {/* RIGHT INTELLIGENCE SIDEBAR (1 Col) */}
          <div className="xl:col-span-1 space-y-6 flex flex-col h-full">

            {/* 1. Prediction */}
            <PricePredictionWidget />

            {/* 2. Sentiment */}
            <MarketSentiment />

            {/* 3. Trade Form (Now embedded here, NOT floating) */}
            <div className="shadow-2xl shadow-primary/5">
              <TradeForm />
            </div>

            {/* 4. News */}
            <div className="stat-card flex-1 overflow-y-auto no-scrollbar min-h-[300px] border-white/5">
              <NewsSection />
            </div>
          </div>

        </div>

        {/* STRATEGY & ACTIONS (Lower Section) */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 pb-12">

          <div className="xl:col-span-2 stat-card overflow-hidden border-white/5">
            <StrategyManagement />
          </div>

          <div className="xl:col-span-1 space-y-8">
            <div className="stat-card border-white/5">
              <AlarmManager />
            </div>
            <div className="stat-card !p-0 overflow-hidden border-white/5">
              <RecentTrades />
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
