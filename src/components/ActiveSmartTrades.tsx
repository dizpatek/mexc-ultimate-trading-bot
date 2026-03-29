"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Search,
  Brain,
  Timer,
  Radar,
  Archive,
  ArrowRightLeft,
  Activity,
  ZapOff,
} from "lucide-react";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import { interpretTradingStatus } from "@/lib/trading-logic";
import { useTradingSignals, MTF_INTERVALS } from "@/hooks/useTradingSignals";
import { useModuleTimeframe } from "@/context/TimeframeContext";
import { logger } from "@/lib/logger";
import { ExpandedTradePanel } from "./matrix-horizon/ExpandedTradePanel";
import { TradeHeader } from "./matrix-horizon/TradeHeader";
import { StatusBadge } from "./matrix-horizon/StatusBadge";
import { TradeProgressBar } from "./matrix-horizon/TradeProgressBar";
import { TradeCommandBar } from "./matrix-horizon/TradeCommandBar";
import { useNotification } from "@/context/NotificationContext";
import { 
  SmartTradeOrder,
  calculateTradePnl, 
  calculateMtfVerdict 
} from "@/lib/trade-utils";

export type { SmartTradeOrder };
export { calculateTradePnl, calculateMtfVerdict };

interface ActiveSmartTradesProps {
  onEdit?: (trade: SmartTradeOrder) => void;
  onNewTrade?: () => void;
  mtfData?: any;
  loadingMtf?: any;
  failedMtf?: any;
  liveSignals?: any;
  fetchMtfAnalysis?: any;
  fetchMultipleMtfAnalysis?: any;
  fetchLiveSignals?: any;
  isManaged?: boolean;
}

export const ActiveSmartTrades: React.FC<ActiveSmartTradesProps> = ({
  onEdit,
  onNewTrade,
  mtfData: managedMtfData,
  loadingMtf: managedLoadingMtf,
  failedMtf: managedFailedMtf,
  liveSignals: managedLiveSignals,
  fetchMtfAnalysis: managedFetchMtfAnalysis,
  fetchMultipleMtfAnalysis: managedFetchMultipleMtfAnalysis,
  fetchLiveSignals: managedFetchLiveSignals,
  isManaged = false,
}) => {
  const [trades, setTrades] = useState<SmartTradeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"AKTIF" | "PASIF">("AKTIF");
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const prevActiveCountRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [clearingAction, setClearingAction] = useState<
    "active" | "passive" | "archive" | null
  >(null);

  const internalSignals = useTradingSignals();
  
  const mtfData = isManaged ? managedMtfData : internalSignals.mtfData;
  const loadingMtf = isManaged ? managedLoadingMtf : internalSignals.loadingMtf;
  const failedMtf = isManaged ? managedFailedMtf : internalSignals.failedMtf;
  const liveSignals = isManaged ? managedLiveSignals : internalSignals.liveSignals;
  const fetchMtfAnalysis = isManaged ? managedFetchMtfAnalysis : internalSignals.fetchMtfAnalysis;
  const fetchMultipleMtfAnalysis = isManaged ? managedFetchMultipleMtfAnalysis : internalSignals.fetchMultipleMtfAnalysis;
  const fetchLiveSignals = isManaged ? managedFetchLiveSignals : internalSignals.fetchLiveSignals;

  const [timeframe] = useModuleTimeframe("4h");
  const { notify, confirm } = useNotification();

  const fetchTrades = async () => {
    try {
      const response = await api.get("/trade/smart");
      setTrades(response.data);
      setLastFetchTime(Date.now());
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch smart trades:", err);
      setError(err?.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePanicClose = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
    e.stopPropagation();
    try {
      await api.delete(`/trade/smart?id=${trade.id}`);
      logger.warn("🚨 MANUEL POZİSYON İPTALİ", `${trade.symbol} için iptal ve satış komutu verildi.`);
      fetchTrades();
    } catch (error) {
      console.error("Panic close failed:", error);
      logger.error("⚠️ Pozisyon İptal Hatası", `${trade.symbol} kapatılamadı.`);
    }
  };

  const handleSilentClose = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
    e.stopPropagation();
    try {
      await api.delete(`/trade/smart?id=${trade.id}&silent=true`);
      fetchTrades();
    } catch (error) {
      console.error("Silent close failed:", error);
    }
  };

  const handleFlashOpen = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
    e.stopPropagation();
    confirm({
      message: `FLASH OPEN: ${trade.symbol} anlık piyasa fiyatından hemen işleme girecek. Devam et?`,
      onConfirm: async () => {
        try {
          await api.put(`/trade/smart?id=${trade.id}`, { trailingBuy: false, forceExecute: true });
          notify(`⚡ FLASH OPEN: ${trade.symbol} piyasa fiyattan işleme alındı.`, "success");
          fetchTrades();
        } catch (error) {
          console.error("Flash open failed:", error);
          notify(`⚠️ Flash Open Hatası: ${trade.symbol}`, "error");
        }
      }
    });
  };

  const handleClearAll = async (type: "active" | "passive" | "archive") => {
    let message = type === "active" ? "SİTE İÇİ KRİTİK TÜM ASSETLER SATILACAK!" : type === "archive" ? "DİKKAT: Sadece Robot listesinden kaldırılıp arşive taşınacak." : "İşlem geçmişini temizlemek istediğinize emin misiniz?";
    confirm({
      message,
      onConfirm: async () => {
        setClearingAction(type);
        try {
          if (type === "active") await api.delete("/trade/smart?all=true");
          else if (type === "archive") await api.delete("/trade/smart?all=true&silent=true");
          else await api.delete("/trade/smart?clearHistory=true");
          await fetchTrades();
        } catch (err: any) {
          notify(`İŞLEM BAŞARISIZ: ${err.message}`, "error");
        } finally {
          setClearingAction(null);
        }
      }
    });
  };

  useEffect(() => {
    setIsMounted(true);
    setLastFetchTime(Date.now());
    fetchTrades();
    const interval = setInterval(fetchTrades, 5000); // 5 seconds - Snappy but safer
    const handlePilotOrder = () => fetchTrades();
    window.addEventListener("pilotOrderCreated", handlePilotOrder);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pilotOrderCreated", handlePilotOrder);
    };
  }, []);

  useEffect(() => {
    const activeTrades = trades.filter((t) => t.status !== "CLOSED");
    // Removed auto-expand to keep UI clean by default as requested
    prevActiveCountRef.current = activeTrades.length;
  }, [trades]);

  const mtfDataRef = useRef(mtfData);
  const loadingMtfRef = useRef(loadingMtf);
  const failedMtfRef = useRef(failedMtf);

  useEffect(() => {
    mtfDataRef.current = mtfData;
    loadingMtfRef.current = loadingMtf;
    failedMtfRef.current = failedMtf;
  }, [mtfData, loadingMtf, failedMtf]);

  const triggerDataSync = useCallback(() => {
    if (trades.length === 0) return;
    const activeTrades = trades.filter((t) => t.status !== "CLOSED");
    if (activeTrades.length === 0) return;
    const missingMtfTrades = activeTrades
      .filter(t => !mtfDataRef.current[t.id] && !loadingMtfRef.current[t.id] && !failedMtfRef.current[t.id])
      .map(t => ({ id: t.id, symbol: t.symbol.replace("/", "") }));

    if (missingMtfTrades.length > 0) {
      if (fetchMultipleMtfAnalysis) fetchMultipleMtfAnalysis(missingMtfTrades);
      else missingMtfTrades.forEach(t => fetchMtfAnalysis(t.id, t.symbol));
    }
  }, [trades, fetchMultipleMtfAnalysis, fetchMtfAnalysis]);

  useEffect(() => {
    const syncLiveOnly = () => {
      const activeTrades = trades.filter((t) => t.status !== "CLOSED");
      if (activeTrades.length === 0) return;
      const activeSymbols = [...new Set(activeTrades.map(t => t.symbol.replace("/", "")))];
      if (fetchLiveSignals) fetchLiveSignals(activeSymbols, timeframe);
      if (fetchMultipleMtfAnalysis) {
        const mtfList = activeTrades.map(t => ({ id: t.id, symbol: t.symbol.replace("/", "") }));
        fetchMultipleMtfAnalysis(mtfList);
      }
    };
    syncLiveOnly();
    const signalInterval = setInterval(syncLiveOnly, 15000); // 15 seconds
    return () => clearInterval(signalInterval);
  }, [trades, timeframe, fetchLiveSignals]);

  useEffect(() => { triggerDataSync(); }, [triggerDataSync]);

  // P4.7: Dashboard-side Monitor Trigger (Restored)
  useEffect(() => {
    const monitorInterval = setInterval(async () => {
      const activeCount = trades.filter(t => t.status !== "CLOSED").length;
      if (activeCount > 0) {
        try {
          await api.get("/cron/trailing-stop");
        } catch (e) {
          console.warn("[MonitorTrigger] Cron call failed:", e);
        }
      }
    }, 25000); // 25s
    return () => clearInterval(monitorInterval);
  }, [trades.length]);

  const pnlSummary = React.useMemo(() => {
    const visibleTrades = trades.filter(t => activeTab === "AKTIF" ? t.status === "FILLED" || t.status === "PENDING" : t.status === "CLOSED");
    return visibleTrades.reduce((acc, trade) => {
      const meta = (trade.meta as any) || {};
      const exitPriceNum = meta.exitPrice ? parseFloat(String(meta.exitPrice)) : (meta.exitResult?.price ? parseFloat(String(meta.exitResult.price)) : 0);
      const currentPrice = trade.status === "CLOSED" ? exitPriceNum || trade.price : trade.currentPrice || trade.price;
      const isPending = trade.status === "PENDING";
      const effectiveQty = isPending ? 0 : trade.qty || parseFloat((trade.meta as any)?.payload?.amount || "0") || 0;
      const { pnlUsdt } = calculateTradePnl(trade.side, meta.mode, trade.price, currentPrice, effectiveQty);
      if (pnlUsdt > 0) acc.grossProfit += pnlUsdt; else if (pnlUsdt < 0) acc.grossLoss += Math.abs(pnlUsdt);
      acc.total += pnlUsdt;
      return acc;
    }, { grossProfit: 0, grossLoss: 0, total: 0 });
  }, [trades, activeTab]);

  if (isLoading || !isMounted) {
    return null;
  }

  return (
    <div id="active-smart-trades-section" className="mt-0 space-y-0.5">
      <TradeCommandBar
        activeTradesCount={trades.filter(t => t.status !== "CLOSED").length}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewTrade={onNewTrade}
        handleClearAll={handleClearAll}
        clearingAction={clearingAction}
        isSectionExpanded={isSectionExpanded}
        setIsSectionExpanded={setIsSectionExpanded}
      />

      <div className={cn("transition-all duration-500 overflow-hidden", isSectionExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="bg-[#0f172a]/20 backdrop-blur-xl border border-slate-800/60 rounded-2xl overflow-x-auto custom-scrollbar shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
          {/* HEADERS */}
          <div className="flex items-center gap-1.5 pl-8 pr-3 py-2.5 border-b border-white/5 bg-slate-950/60 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center min-w-[1400px] w-full">
            <div className="w-[120px] shrink-0">PARİTE</div>
            <div className="w-[150px] shrink-0">GİRİŞ / PİYASA</div>
            <div className="w-[130px] shrink-0">OLASILIK & AI</div>
            <div className="w-[180px] shrink-0">DURUM & KARAR</div>
            <div className="flex-1 min-w-[240px]">AKILLI HEDEFLER</div>
            <div className="w-[280px] shrink-0 hidden xl:flex">MTF ANALİZİ</div>
            <div className="w-[130px] shrink-0">MTF SİNYALİ</div>
            <div className="w-[180px] shrink-0">KAR/ZARAR</div>
            <div className="w-[28px] shrink-0"></div>
          </div>

          <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto scrollbar-thin min-w-[1400px] w-full">
            {trades.filter(t => activeTab === "AKTIF" ? t.status !== "CLOSED" && t.status !== "ARCHIVED" : t.status === "CLOSED" || t.status === "ARCHIVED").length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <Search className="w-8 h-8 text-slate-700 mb-4" />
                <span className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">{activeTab === "AKTIF" ? "Aktif İşlem Bulunamadı" : "Geçmiş İşlem Bulunamadı"}</span>
              </div>
            ) : (
              trades.filter(t => activeTab === "AKTIF" ? t.status !== "CLOSED" && t.status !== "ARCHIVED" : t.status === "CLOSED" || t.status === "ARCHIVED").map((trade) => {
                const meta = (trade.meta as any) || {};
                const payload = (meta.payload as any) || {};
                const isExpanded = expandedTrade === trade.id;
                const isClosed = trade.status === "CLOSED";
                const currentPrice = isClosed ? (meta.exitPrice || meta.exitResult?.price || trade.price) : (trade.currentPrice || trade.price);
                const entry = trade.price;
                const { pnlPercent, pnlUsdt } = isClosed ? calculateTradePnl(trade.side, meta.mode, entry, currentPrice, trade.qty) : (trade.status === "PENDING" ? { pnlPercent: 0, pnlUsdt: 0 } : calculateTradePnl(trade.side, meta.mode, entry, currentPrice, trade.qty || parseFloat(payload?.amount || "0") || 0));
                
                const symNorm = trade.symbol.replace("/", "");
                const orderTf = (payload?.timeframe as string) || timeframe;
                const mtfResults = mtfData[trade.id] || {};
                const liveData = (mtfResults[orderTf] || liveSignals[symNorm] || null) as any;
                const isShort = meta.mode === "COVER" || trade.side === "SELL";
                const aiScore = liveData ? (liveData.aiScore || 0) : Number(meta?.lastAiScore) || 0;
                
                // P5.1: Calculate probability based on signal direction if raw upProb is missing
                const rawUpProb = liveData?.prediction?.upProb;
                let upProb = 50;
                if (typeof rawUpProb === 'number') {
                  upProb = rawUpProb;
                } else if (liveData?.signal === "SELL") {
                  upProb = aiScore > 50 ? 100 - aiScore : 50;
                } else if (liveData?.signal === "BUY") {
                  upProb = aiScore > 50 ? aiScore : 50;
                } else {
                  upProb = aiScore > 50 ? aiScore : 50;
                }

                // Flight Plan Logic Integration
                const isSmcBullish = liveData?.smc?.swingTrend === "BULLISH";
                const flightPlanStatus = `${isSmcBullish ? "BOĞA 📈" : "AYI 📉"} / ${(liveData as any)?.marketPhaseText || "DURGUN"}`;
                
                // Kısa pozisyon (COVER) için karar: Yüksek AI = satış baskısı devam, düşük AI = ters yön uyarısı
                const decision = isShort
                  ? (aiScore > 75
                      ? "SATIŞI TUT 📉"
                      : aiScore > 55
                        ? "BEKLE / KAPANIŞA YAKLAŞ"
                        : "TERS TREND ⚠ KAPANDIR")
                  : (aiScore > 80
                      ? "LONG AÇ ✅"
                      : aiScore > 60
                        ? "EKLE/TUT 📈"
                        : "BEKLE ❌");

                const { statusText, statusColor } = interpretTradingStatus(liveData, isClosed, trade.side, currentPrice, meta.activeTakeProfit || parseFloat(payload?.takeProfit?.price || "0"), meta.activeStopLoss || parseFloat(payload?.stopLoss?.price || "0"), aiScore, trade.status, meta);

                const allTfs = MTF_INTERVALS.map(tf => mtfResults[tf]).filter(Boolean);
                // isShort: meta.mode bazlı doğru COVER tespiti
                const { verdictText, verdictColor, bullCount, bearCount, goodPct, dominantPct, sentimentColor } = calculateMtfVerdict(allTfs, isShort ? "SELL" : "BUY");

                return (
                  <div key={trade.id} className={cn("group transition-all duration-300 relative", pnlPercent >= 0 ? "bg-emerald-500/5 border-l-2 border-emerald-500/20" : "bg-rose-500/5 border-l-2 border-rose-500/20")}>
                    <div className="flex items-center gap-1.5 pl-8 pr-3 py-2 cursor-pointer min-w-[1400px] w-full" onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}>
                      {/* PAIR */}
                      <div className="flex items-center gap-3 w-[120px] shrink-0">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", meta.mode === "COVER" ? "bg-rose-500/10 border-rose-500/20 shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]" : "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]")}>
                          {meta.mode === "COVER" ? (
                            <ArrowRightLeft className="w-5 h-5 text-rose-400" />
                          ) : (
                            <Zap className="w-5 h-5 text-emerald-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-white tracking-tighter">
                              {trade.symbol.includes("/") ? trade.symbol.split("/")[0] : trade.symbol.replace("USDT", "")}
                              <span className="text-slate-500 text-[10px]">/{trade.symbol.includes("/") ? trade.symbol.split("/")[1] : "USDT"}</span>
                            </span>
                            <span className={cn("text-[8px] px-1 py-0.5 rounded font-black border", meta.mode === "COVER" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
                              {meta.mode || "TRADE"}
                            </span>
                          </div>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter ml-0.5">V{trade.id}</span>
                        </div>
                      </div>

                      {/* ENTRY / MARKET */}
                      <div className="flex flex-col items-center w-[150px] shrink-0 font-mono">
                        <span className="text-xs font-black text-slate-300">E: ${entry.toLocaleString()}</span>
                        <span className={cn("text-xs font-black mt-0.5", currentPrice >= entry ? (trade.side === "BUY" ? "text-emerald-400" : "text-rose-400") : (trade.side === "BUY" ? "text-rose-400" : "text-emerald-400"))}>
                          {isClosed ? "X" : "M"}: ${currentPrice.toLocaleString()}
                        </span>
                      </div>

                      {/* OLASILIK & AI */}
                      <div className="flex flex-col items-center gap-1 w-[130px] shrink-0">
                        <div className="flex items-center justify-between w-full px-2">
                          <span className="text-[9px] font-black text-emerald-400">%{upProb.toFixed(0)}</span>
                          <Activity className={cn("w-3 h-3", upProb > 50 ? "text-emerald-400" : "text-rose-400")} />
                          <span className="text-[9px] font-black text-rose-400">%{(100 - upProb).toFixed(0)}</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5 flex shadow-inner">
                          <div style={{ width: `${upProb}%` }} className="h-full bg-emerald-500 transition-all duration-700 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                          <div style={{ width: `${100 - upProb}%` }} className="h-full bg-rose-500 transition-all duration-700 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Brain className="w-2.5 h-2.5 text-cyan-400" />
                          <span className="text-[8px] font-black text-white/70 uppercase tracking-tighter">GÜVEN: %{aiScore}</span>
                        </div>
                      </div>

                      {/* DURUM & KARAR */}
                      <div className="flex flex-col items-center justify-center w-[180px] shrink-0 gap-1">
                        <div className={cn("flex flex-col items-center justify-center px-1.5 py-1 rounded text-[10px] font-black tracking-widest uppercase border min-w-[140px] transition-all relative overflow-hidden", statusColor)}>
                           <div className="flex items-center gap-1 mb-0.5 opacity-60">
                             <Timer className="w-2.5 h-2.5" />
                             <span className="text-[8px]">{orderTf} PERİYOT</span>
                           </div>
                           <span className="text-center leading-tight">{statusText}</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="text-[10px] font-black text-cyan-400/80 cyber-glow-text uppercase tracking-tighter">
                            {decision}
                          </div>
                          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest opacity-60">
                            {flightPlanStatus.split("/")[1]?.trim() || "DURGUN"}
                          </div>
                        </div>
                      </div>

                      {/* SMART TARGETS */}
                      <div className="flex-1 min-w-[240px] flex items-center justify-center">
                        <TradeProgressBar trade={trade} entry={entry} currentPrice={currentPrice} sl={meta.activeStopLoss || parseFloat(payload?.stopLoss?.price || "0")} tp={meta.activeTakeProfit || parseFloat(payload?.takeProfit?.price || "0")} pnlPercent={pnlPercent} pnlUsdt={pnlUsdt} isProfit={pnlPercent >= 0} isTtpActive={!!meta.tpTriggered} isTslActive={!!meta.tslActivated} />
                      </div>

                      {/* MTF ANALYSIS */}
                      <div className="hidden xl:flex items-center justify-center gap-1 w-[280px] shrink-0">
                        {MTF_INTERVALS.map(tf => {
                          const d = mtfResults[tf];
                          if (!d) return null;
                          let weight = 0.5;
                          if (typeof d.bullWeight === 'number') {
                            weight = d.bullWeight;
                          } else {
                            if (d.f4ConfirmedBuy || d.f4EarlyBuy) weight = 0.9;
                            else if (d.f4ConfirmedSell || d.f4EarlySell) weight = 0.1;
                            else if (d.signal === "BUY" || d.trend === "BULLISH") weight = 0.75;
                            else if (d.signal === "SELL" || d.trend === "BEARISH") weight = 0.25;
                          }
                          
                          // Artık sırf trend bullish diye AL demiyoruz, 5 üzerinden kaçın AL dediğine (bullWeight) bakıyoruz.
                          const hasBuy = weight > 0.55;
                          const hasSell = weight < 0.45;

                          // MTF hücre etiketi:
                          // COVER (isShort=true): SAT = iyi (rose), AL = ters uyarı (orange)
                          // TRADE (isShort=false): AL = iyi (emerald), SAT = ters uyarı (orange)
                          const cellColorClass = isShort
                            ? (hasSell
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                : hasBuy
                                  ? "bg-orange-500/10 border-orange-500/30 text-orange-400 animate-pulse"
                                  : "bg-slate-800/20 border-white/5 text-slate-600")
                            : (hasBuy
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : hasSell
                                  ? "bg-orange-500/10 border-orange-500/30 text-orange-400 animate-pulse"
                                  : "bg-slate-800/20 border-white/5 text-slate-600");

                          // Etiketler: Sadece AL/SAT yerine, gücünü de (3/5, 4/5 gibi) ifade edebiliriz
                          // weight = 0.2 (1/5 bull) -> SAT
                          // weight = 0.8 (4/5 bull) -> AL
                          const cellLabel = isShort
                            ? (hasSell ? "SAT ✓" : hasBuy ? "AL ⚠" : "NÖTR")
                            : (hasBuy ? "AL ✓" : hasSell ? "SAT ⚠" : "NÖTR");
                          return (
                            <div key={tf} className={cn(
                              "flex-1 p-1 rounded border text-center flex flex-col gap-0.5 transition-all duration-300",
                              cellColorClass
                            )}>
                              <span className="text-[9px] font-black">{tf}</span>
                              <span className="text-[8px] font-bold">{cellLabel}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* MTF SİNYALİ */}
                      <div className="flex flex-col items-center justify-center w-[130px] shrink-0">
                         <div className={cn("text-[11px] font-black tracking-widest", verdictColor)}>{verdictText}</div>
                         <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                           <div style={{ width: `${dominantPct}%` }} className={cn("h-full transition-all duration-700", sentimentColor)} />
                         </div>
                      </div>

                      {/* KAR/ZARAR */}
                      <div className="flex flex-col items-center justify-center w-[180px] shrink-0 font-mono">
                        <span className={cn("text-[13px] font-black", pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {pnlPercent >= 0 ? "+" : "-"}${Math.abs(pnlUsdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className={cn("text-[10px] font-black", pnlPercent >= 0 ? "text-emerald-500" : "text-rose-500")}>
                          {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                        </span>
                      </div>

                      {/* EXPAND */}
                      <div className="w-[28px] shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-500" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && (
                       <ExpandedTradePanel trade={trade} currentPrice={currentPrice} isClosed={isClosed} meta={meta} entry={entry} aiScore={aiScore} statusText={statusText} statusColor={statusColor} tp={meta.activeTakeProfit || parseFloat(payload.takeProfit?.price || "0")} sl={meta.activeStopLoss || parseFloat(payload.stopLoss?.price || "0")} payload={payload} pnlPercent={pnlPercent} pnlUsdt={pnlUsdt} onEdit={onEdit} handlePanicClose={handlePanicClose} handleSilentClose={handleSilentClose} handleFlashOpen={handleFlashOpen} fetchTrades={fetchTrades} isTtpActive={!!meta.tpTriggered} isTslActive={!!meta.tslActivated} liveData={liveData as any} mtfVerdictText={verdictText} bullCount={bullCount} bearCount={bearCount} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-3 border-t border-white/5 bg-slate-950/80 flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">V2.6.2-TERMİNAL</span>
              <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> VERİ AKIŞI: AKTİF</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
