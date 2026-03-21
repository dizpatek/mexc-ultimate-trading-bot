"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useHoldings } from "@/hooks/usePortfolio";
import { Header } from "@/components/Header";
import { UnifiedControlStrip } from "@/components/UnifiedControlStrip";
import { MatrixHorizon } from "@/components/matrix-horizon/MatrixHorizon";
import { ActiveSmartTrades } from "@/components/ActiveSmartTrades";
import { HorizonLayout } from "@/components/matrix-horizon/HorizonLayout";
import { HorizonCard } from "@/components/matrix-horizon/HorizonCard";
import { MatrixPortfolio } from "@/components/MatrixPortfolio";
import { SmartOperationCenter } from "@/components/SmartOperationCenter";
import { CombatLog } from "@/components/CombatLog";
import { IntelligenceHub } from "@/components/IntelligenceHub";
import { MoneyFlowSection } from "@/components/matrix-v5/MoneyFlow";
import { PilotPipeline3D } from "@/components/PilotPipeline3D";
import { ExchangeFlow } from "@/components/matrix-v5/ExchangeFlow";
import { fetchGlobalMarketData, GlobalMarketData } from "@/lib/market-data";
import { useCombatLogs } from "@/hooks/useCombatLogs";
import { useNewsData } from "@/hooks/useNewsData";
import { useNewsAnalytics } from "@/hooks/useNewsAnalytics";
import { useTimeframe } from "@/context/TimeframeContext";
import { useTradingSignals } from "@/hooks/useTradingSignals";
import { 
  Terminal, 
  Activity, 
  Radar, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  TrendingUp, 
  TrendingDown 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  const [isBottomSectionExpanded, setIsBottomSectionExpanded] = useState(false);
  const [globalMarketData, setGlobalMarketData] = useState<GlobalMarketData | null>(null);

  // Lifted Hooks for Unified Header & Performance
  const { timeframe } = useTimeframe();
  const logsData = useCombatLogs(timeframe);
  const newsData = useNewsData();
  const newsAnalytics = useNewsAnalytics(newsData.rawNews);
  const signalsData = useTradingSignals();

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

  // Centralized Global Market Data Polling
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchGlobalMarketData();
        setGlobalMarketData(res);
      } catch (err) {
        console.warn("[Dashboard] Global data fetch failed", err);
      }
    };
    load();
    const id = setInterval(load, 20000); // 20s interval
    return () => clearInterval(id);
  }, []);

  // Centralized Signal Polling (Anti-Explosion)
  const activeSymbols = useMemo(() => {
    const symbolsInHoldings = holdings
      ? holdings
          .filter((h) => h.symbol !== "USDT" && h.symbol !== "USDC")
          .map((h) => (h.symbol.endsWith("USDT") ? h.symbol : `${h.symbol}USDT`))
      : [];
    
    // Merge with active symbol to ensure dashboard always has data for current selection
    // Also include common leaders if not present
    const base = Array.from(new Set([...symbolsInHoldings, activeSymbol, "BTCUSDT", "ETHUSDT"]));
    return base;
  }, [holdings, activeSymbol]);

  useEffect(() => {
    if (activeSymbols.length > 0) {
      signalsData.fetchIntervalForSymbols(activeSymbols, timeframe);
    }
    
    // Refresh signals every 60s
    const intervalId = setInterval(() => {
      if (activeSymbols.length > 0) {
        signalsData.fetchIntervalForSymbols(activeSymbols, timeframe);
      }
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, [activeSymbols.length, timeframe, signalsData.fetchIntervalForSymbols]);

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

      <main className="flex-1 min-w-0 px-2 md:px-4 lg:px-6 py-0.5 md:py-1 lg:py-1.5 space-y-1 overflow-y-auto max-w-full mx-auto w-full pb-4 no-scrollbar">
        {/* MATRIX MISSION CONTROL (Full Width) */}
        <div className="w-full">
          <MatrixHorizon 
            isManaged={true} 
            signalDataMap={signalsData.signalDataMap}
            globalMarketData={globalMarketData}
          />
        </div>

        {/* PILOT PIPELINE 3D (Ezzstar Style - New Dashboard Standard) */}
        <div className="w-full relative min-h-[400px] mb-2 mt-1 overflow-visible">
          <PilotPipeline3D />
        </div>

        {/* MONEY FLOW (Legacy Section - Keeping for data depth) */}
        <MoneyFlowSection globalMarketData={globalMarketData} />

        {/* EXCHANGE FLOW & MAKER TAKER (Main Menu Section) */}
        <ExchangeFlow />

        {/* SMART TRADE OPERATION CENTER & ASSET LIST */}
        <div className="w-full flex flex-col gap-2">
          <MatrixPortfolio 
            signalDataMap={signalsData.signalDataMap}
            isLoadingSignals={signalsData.isLoadingSignals}
            fetchIntervalForSymbols={signalsData.fetchIntervalForSymbols}
          />
          <SmartOperationCenter signalsData={signalsData} />
        </div>

        {/* UNIFIED TERMINAL & INTELLIGENCE CENTER */}
        <div className={cn(
          "w-full overflow-hidden transition-all duration-500",
          isBottomSectionExpanded ? "bg-slate-900/40 backdrop-blur-md" : "bg-transparent"
        )}>
          {/* UNIFIED HEADER */}
            <div 
              className="relative z-20 flex flex-col lg:grid lg:grid-cols-3 items-center py-2 px-3 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-colors backdrop-blur-sm font-mono cursor-pointer"
              onClick={() => setIsBottomSectionExpanded(!isBottomSectionExpanded)}
            >
              {/* LEFT: TITLES */}
              <div className="flex items-center gap-3 lg:justify-self-start w-full lg:w-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 shadow-lg">
                  <Terminal className="w-4 h-4 text-cyan-500" />
                  <span className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden xl:block">
                    COMBAT
                  </span>
                </div>
                <div className="w-px h-4 bg-slate-800/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 shadow-lg">
                  <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                  <span className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden xl:block">
                    INTELLIGENCE
                  </span>
                </div>
              </div>

              {/* CENTER: STATUS INDICATORS (CENTERED) */}
              <div className="flex items-center gap-4 lg:justify-self-center justify-center w-full lg:w-auto">
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/40 border border-slate-800/40 rounded-lg">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest hidden sm:inline">LIVE SYNC</span>
                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest sm:hidden">SYNC</span>
                </div>

                <div className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[8px] font-black uppercase tracking-wider bg-slate-950/40",
                  newsAnalytics.aggregateSentiment > 5 ? "text-emerald-400 border-emerald-500/20" : 
                  newsAnalytics.aggregateSentiment < -5 ? "text-rose-400 border-rose-500/20" : "text-slate-400 border-slate-800/40"
                )}>
                  24S: {newsAnalytics.aggregateSentiment > 0 ? "+" : ""}{newsAnalytics.aggregateSentiment}
                </div>
              </div>

              {/* RIGHT: ACTIONS & TOGGLE (END) */}
              <div className="flex items-center gap-2 lg:justify-self-end justify-between w-full lg:w-auto">
                <div className="flex items-center p-1 bg-slate-950/60 gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); logsData.triggerScan(true); }}
                    disabled={logsData.scanStatus === "scanning"}
                    className={cn(
                      "p-1.5 rounded-lg border border-slate-800 transition-all",
                      logsData.scanStatus === "scanning" ? "text-amber-500 bg-amber-500/10 border-amber-500/30" : "text-slate-500 hover:text-white"
                    )}
                    title="Terminal Scan"
                  >
                    <Radar className={cn("w-3.5 h-3.5", logsData.scanStatus === "scanning" && "animate-spin")} />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); newsData.fetchNews(); }}
                    className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white transition-all"
                    title="News Refresh"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", newsData.loading && "animate-spin text-cyan-400")} />
                  </button>

                  <button
                     className={cn(
                       "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                       isBottomSectionExpanded ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
                     )}
                     onClick={(e) => { e.stopPropagation(); setIsBottomSectionExpanded(!isBottomSectionExpanded); }}
                  >
                    {isBottomSectionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span className="">{isBottomSectionExpanded ? "GİZLE" : "GÖSTER"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* COLLAPSIBLE CONTENT AREA */}
            <AnimatePresence>
              {isBottomSectionExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 p-2">
                    <CombatLog 
                      hideHeader 
                      isExpanded={isBottomSectionExpanded} 
                      data={logsData.logs}
                      isLoading={logsData.isLoading}
                      error={logsData.error}
                      scanStatus={logsData.scanStatus}
                      triggerScan={logsData.triggerScan}
                      fetchLogs={logsData.fetchLogs}
                      lastScanTime={logsData.lastScanTime}
                    />
                    <IntelligenceHub 
                      hideHeader 
                      isExpanded={isBottomSectionExpanded}
                      data={newsData.rawNews}
                      isLoading={newsData.loading}
                      error={newsData.error}
                      fetchNews={newsData.fetchNews}
                      aggregateSentiment={newsAnalytics.aggregateSentiment}
                      stats={newsAnalytics.stats}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
