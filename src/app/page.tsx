"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useHoldings } from "@/hooks/usePortfolio";
import { Header } from "@/components/Header";
import { CombatLog } from "@/components/CombatLog";
import { IntelligenceHub } from "@/components/IntelligenceHub";
import { SmartOperationCenter } from "@/components/SmartOperationCenter";
import { UnifiedControlStrip } from "@/components/UnifiedControlStrip";
import { MatrixHorizon } from "@/components/matrix-horizon/MatrixHorizon";
import { HorizonLayout } from "@/components/matrix-horizon/HorizonLayout";
import { HorizonCard } from "@/components/matrix-horizon/HorizonCard";
import { RefreshCw } from "lucide-react";

// Dashboard component starts below

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { data: holdings } = useHoldings();
  const router = useRouter();
  const [activeSymbol, setActiveSymbol] = useState<string>("BTCUSDT");
  const [, setActiveAssetData] = useState<{ holding: number; usdt: number }>({
    holding: 0,
    usdt: 0,
  });

  const tickerSymbols = useMemo(() => {
    if (!holdings) return [];

    // Always include BTC and ETH as leaders
    const baseSymbols = ["BTCUSDT", "ETHUSDT"];
    const holdingSymbols = holdings
      .map((h) => (h.symbol.endsWith("USDT") ? h.symbol : `${h.symbol}USDT`))
      .filter((s) => s !== "USDT");

    const uniqueSymbols = Array.from(
      new Set([...baseSymbols, ...holdingSymbols]),
    );

    return uniqueSymbols.map((s: string) => {
      // Major assets are more stable on Binance in TradingView widgets
      const majorAssets = [
        "BTCUSDT",
        "ETHUSDT",
        "SOLUSDT",
        "BNBUSDT",
        "XRPUSDT",
        "ADAUSDT",
        "AVAXUSDT",
        "DOTUSDT",
        "LINKUSDT",
      ];
      const prefix = majorAssets.includes(s) ? "BINANCE" : "MEXC";

      return {
        proName: `${prefix}:${s}`,
        title: s.replace("USDT", "/USDT"),
      };
    });
  }, [holdings]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
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

      <main className="flex-1 min-w-0 px-2 md:px-4 lg:px-6 py-0.5 md:py-1 lg:py-1.5 space-y-1 overflow-y-auto max-w-full mx-auto w-full pb-24 no-scrollbar">
        {/* MATRIX MISSION CONTROL (Full Width) */}
        <div className="w-full min-h-[400px]">
          <HorizonCard
            className="bg-slate-900/40 backdrop-blur-md border-slate-800"
            glowColor="cyan"
          >
            <div className="p-0">
              <MatrixHorizon />
            </div>
          </HorizonCard>
        </div>

        {/* SMART TRADE OPERATION CENTER */}
        <div className="w-full">
          <SmartOperationCenter />
        </div>

        {/* TERMINAL & NEWS (Side by Side) - F4 Terminal features merged into Portfolio*/}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 h-auto xl:h-[400px]">
          {/* TERMINAL (Combat Log) */}
          <div className="min-h-[300px] xl:min-h-0">
            <div className="h-full overflow-hidden flex flex-col rounded-xl shadow-2xl">
              <CombatLog />
            </div>
          </div>

          {/* NEWS (Intelligence Hub) */}
          <div className="min-h-[300px] xl:min-h-0">
            <IntelligenceHub />
          </div>
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
