"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useHoldings } from '@/hooks/usePortfolio';
import { Header } from '@/components/Header';
import { PortfolioSummary } from '@/components/PortfolioSummary';
import { PortfolioChart } from '@/components/PortfolioChart';
import { CombatLog } from '@/components/CombatLog';
import { CommandDeck } from '@/components/CommandDeck';
import { IntelligenceHub } from '@/components/IntelligenceHub';
import { TradeForm } from '@/components/TradeForm';
import { MatrixHorizon } from '@/components/matrix-horizon/MatrixHorizon';
import { HorizonLayout } from '@/components/matrix-horizon/HorizonLayout';
import { HorizonCard } from '@/components/matrix-horizon/HorizonCard';
import { MarketSentiment } from '@/components/MarketSentiment';
import { PricePredictionWidget } from '@/components/PricePredictionWidget';
import { UserGuideModal } from '@/components/UserGuideModal';
import { USER_GUIDE_CONTENT } from '@/components/UserGuideContent';
import { RefreshCw, Activity } from 'lucide-react';

// TRADINGVIEW TICKER TAPE
const MarketTickerTape = ({ symbols }: { symbols: { proName: string; title: string }[] }) => {
  const config = useMemo(() => {
    return {
      symbols: symbols.length > 0 ? symbols : [
        { proName: "BINANCE:BTCUSDT", title: "BTC/USDT" },
        { proName: "BINANCE:ETHUSDT", title: "ETH/USDT" },
        { proName: "BINANCE:SOLUSDT", title: "SOL/USDT" },
        { proName: "BINANCE:BNBUSDT", title: "BNB/USDT" }
      ],
      showSymbolLogo: false,
      colorTheme: "dark",
      isTransparent: true,
      displayMode: "adaptive"
    };
  }, [symbols]);

  const encodedConfig = encodeURIComponent(JSON.stringify(config));

  return (
    <div className="w-full h-[32px] border-b border-white/5 bg-[#050505]">
      <iframe
        key={encodedConfig}
        src={`https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#${encodedConfig}`}
        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
      />
    </div>
  );
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: holdings } = useHoldings();
  const router = useRouter();
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const tickerSymbols = useMemo(() => {
    if (!holdings) return [];
    
    // Always include BTC and ETH as leaders
    const baseSymbols = ['BTCUSDT', 'ETHUSDT'];
    const holdingSymbols = holdings
      .map(h => h.symbol.endsWith('USDT') ? h.symbol : `${h.symbol}USDT`)
      .filter(s => s !== 'USDT'); // Filter out lone USDT
      
    const uniqueSymbols = Array.from(new Set([...baseSymbols, ...holdingSymbols]));
    
    return uniqueSymbols.map(s => ({
      proName: `BINANCE:${s}`,
      title: s.replace('USDT', '/USDT')
    }));
  }, [holdings]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <HorizonLayout>
      <Header onOpenGuide={() => setIsGuideOpen(true)} />
      <MarketTickerTape symbols={tickerSymbols} />

      <main className="flex-1 p-3 space-y-3 overflow-y-auto max-w-[1920px] mx-auto w-full pb-24">
        
        {/* TOP ROW: SUMMARY & ALPHA (Compact) */}
        <div className="grid grid-cols-12 gap-3 min-h-[120px]">
           <div className="col-span-9 relative">
              <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="indigo">
                <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none">
                     <Activity className="w-32 h-32 text-indigo-500" />
                </div>
                <div className="p-2 h-full">
                    <PortfolioSummary />
                </div>
              </HorizonCard>
           </div>
           <div className="col-span-3">
               <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="cyan">
                   <div className="p-2 h-full">
                       <MarketSentiment />
                   </div>
               </HorizonCard>
           </div>
        </div>

        {/* MIDDLE ROW: CHART & ACTION CENTER */}
        <div className="grid grid-cols-12 gap-3 min-h-[600px]">
            {/* MAIN CHART */}
            <div className="col-span-12 lg:col-span-8">
                <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="emerald">
                     <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-2 py-1 bg-slate-950/80 backdrop-blur text-[10px] uppercase font-bold rounded text-emerald-400 border border-emerald-500/20">Market View</span>
                    </div>
                    <PortfolioChart />
                </HorizonCard>
            </div>

            {/* ACTION CENTER */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 h-full">
                <div className="flex-1">
                    <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="amber">
                        <PricePredictionWidget />
                    </HorizonCard>
                </div>
                <div className="h-[280px]">
                    <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="rose">
                         <TradeForm />
                    </HorizonCard>
                </div>
            </div>
        </div>

        {/* MATRIX MISSION CONTROL (Full Width) */}
        {/* Added mt-12 (3rem) based on user feedback to lower the component */}
        <div className="w-full min-h-[400px] mt-12 mb-8">
            <HorizonCard className="bg-slate-900/40 backdrop-blur-md border-slate-800" glowColor="cyan">
                <div className="p-0">
                    <MatrixHorizon />
                </div>
            </HorizonCard>
        </div>

        {/* TACTICAL OPERATIONS CENTER */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-[500px]">
            <CommandDeck />
            <CombatLog />
            <IntelligenceHub />
        </div>

      </main>

      {/* Render Modal at root level to avoid z-index/backdrop/stacking context issues */}
      <UserGuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        // We will fetch the content in a real app, passing empty string for now will result in empty modal, 
        // I need to fetch that content back. I'll read Header.tsx content first to be sure.
        content={USER_GUIDE_CONTENT}
      />
    </HorizonLayout>
  );
}
