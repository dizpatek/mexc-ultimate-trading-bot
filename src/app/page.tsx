"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useHoldings } from '@/hooks/usePortfolio';
import { Header } from '@/components/Header';
import { PortfolioChart } from '@/components/PortfolioChart';
import { CombatLog } from '@/components/CombatLog';
import { CommandDeck } from '@/components/CommandDeck';
import { IntelligenceHub } from '@/components/IntelligenceHub';
import { SmartOperationCenter } from '@/components/SmartOperationCenter';
import { UnifiedControlStrip } from '@/components/UnifiedControlStrip';
import { MatrixHorizon } from '@/components/matrix-horizon/MatrixHorizon';
import { HorizonLayout } from '@/components/matrix-horizon/HorizonLayout';
import { HorizonCard } from '@/components/matrix-horizon/HorizonCard';
import { RefreshCw } from 'lucide-react';

// Dashboard component starts below

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: holdings } = useHoldings();
  const router = useRouter();
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');
  const [, setActiveAssetData] = useState<{ holding: number; usdt: number }>({ holding: 0, usdt: 0 });

  const tickerSymbols = useMemo(() => {
    if (!holdings) return [];
    
    // Always include BTC and ETH as leaders
    const baseSymbols = ['BTCUSDT', 'ETHUSDT'];
    const holdingSymbols = holdings
      .map(h => h.symbol.endsWith('USDT') ? h.symbol : `${h.symbol}USDT`)
      .filter(s => s !== 'USDT'); 
      
    const uniqueSymbols = Array.from(new Set([...baseSymbols, ...holdingSymbols]));
    
    return uniqueSymbols.map((s: string) => {
      // Major assets are more stable on Binance in TradingView widgets
      const majorAssets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT'];
      const prefix = majorAssets.includes(s) ? 'BINANCE' : 'MEXC';
      
      return {
        proName: `${prefix}:${s}`,
        title: s.replace('USDT', '/USDT')
      };
    });
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
      <Header />

      <main className="flex-1 min-w-0 p-2 space-y-4 overflow-y-auto max-w-full mx-auto w-full pb-24 no-scrollbar">
        {/* MIDDLE ROW: WIDE CHART */}
        <div className="grid grid-cols-12 gap-4 h-[900px]">
            {/* MAIN CHART - FULL WIDTH */}
            <div className="col-span-12">
                <HorizonCard className="h-full bg-slate-900/30 backdrop-blur-sm border-slate-800" glowColor="emerald">
                     <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-2 py-1 bg-slate-950/80 backdrop-blur text-[10px] uppercase font-bold rounded text-emerald-400 border border-emerald-500/20">Market View</span>
                    </div>
                    <PortfolioChart />
                </HorizonCard>
            </div>
        </div>

        {/* MATRIX MISSION CONTROL (Full Width) */}
        <div className="w-full min-h-[400px]">
            <HorizonCard className="bg-slate-900/40 backdrop-blur-md border-slate-800" glowColor="cyan">
                <div className="p-0">
                    <MatrixHorizon />
                </div>
            </HorizonCard>
        </div>

        {/* TACTICAL OPERATIONS CENTER */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-auto xl:h-[500px]">
            <CommandDeck />
            <CombatLog />
            <IntelligenceHub />
        </div>

        {/* SMART TRADE OPERATION CENTER */}
        <div className="w-full">
            <SmartOperationCenter />
        </div>
      </main>

      {/* RIGHT SIDEBAR: Trading & Controls */}
      <UnifiedControlStrip 
          activeSymbol={activeSymbol}
          onSymbolSelect={setActiveSymbol}
          onAssetDataUpdate={setActiveAssetData}
          symbols={tickerSymbols}
      />

    </HorizonLayout>
  );
}
