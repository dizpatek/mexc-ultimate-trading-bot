"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { PortfolioSummary } from '@/components/PortfolioSummary';
import { MarketOverview } from '@/components/MarketOverview';
import { PortfolioChart } from '@/components/PortfolioChart';
import { NewsSection } from '@/components/NewsSection';
import { TradeForm } from '@/components/TradeForm';
import { HoldingsTable } from '@/components/HoldingsTable';
import { RecentTrades } from '@/components/RecentTrades';

import { StrategyManagement } from '@/components/StrategyManagement';
import { F3Monitor } from '@/components/F3Monitor';
import { TradingViewChart } from '@/components/TradingViewChart';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not loading and no user, redirect to login
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user is not logged in, we return null while redirecting
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-12">
        <PortfolioSummary />

        <div className="grid grid-cols-1">
          <HoldingsTable />
        </div>

        <StrategyManagement />

        <F3Monitor />

        <TradingViewChart />

        <MarketOverview />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <PortfolioChart />
          </div>
          <div>
            <NewsSection />
          </div>
        </div>

        <TradeForm />

        <div className="grid grid-cols-1">
          <RecentTrades />
        </div>
      </main>
    </div>
  );
}
