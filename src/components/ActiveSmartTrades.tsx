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

// --- Pure Helper Functions (Extracted to reduce Component God-Object antipattern) ---

export function calculateTradePnl(
  side: "BUY" | "SELL",
  mode: string,
  entry: number,
  currentPrice: number,
  qty: number,
) {
  const pnlPercent =
    side === "BUY" && mode !== "COVER"
      ? ((currentPrice - entry) / entry) * 100
      : ((entry - currentPrice) / entry) * 100;

  const pnlUsdt =
    side === "BUY" && mode !== "COVER"
      ? qty * (currentPrice - entry)
      : qty * (entry - currentPrice);

  return { pnlPercent, pnlUsdt };
}

export function calculateMtfVerdict(
  allTfs: {
    trend?: string;
    signal?: string | null;
    f4EarlyBuy?: boolean;
    f4ConfirmedBuy?: boolean;
    f4EarlySell?: boolean;
    f4ConfirmedSell?: boolean;
    aiScore?: number;
  }[],
) {
  const bullCount = allTfs.filter(
    (d) =>
      d &&
      (d.trend === "BULLISH" ||
        d.signal === "BUY" ||
        d.f4EarlyBuy ||
        d.f4ConfirmedBuy),
  ).length;
  const bearCount = allTfs.filter(
    (d) =>
      d &&
      (d.trend === "BEARISH" ||
        d.signal === "SELL" ||
        d.f4EarlySell ||
        d.f4ConfirmedSell),
  ).length;
  const total = allTfs.length;
  const bullPct = total > 0 ? Math.round((bullCount / total) * 100) : 50;

  let verdictText = "NÖTR";
  let verdictColor = "text-amber-400";
  if (bullPct >= 70) {
    verdictText = "GÜÇLÜ AL";
    verdictColor = "text-emerald-400";
  } else if (bullPct >= 55) {
    verdictText = "AL";
    verdictColor = "text-emerald-300";
  } else if (bullPct <= 30) {
    verdictText = "GÜÇLÜ SAT";
    verdictColor = "text-rose-400";
  } else if (bullPct <= 45) {
    verdictText = "SAT";
    verdictColor = "text-rose-300";
  }

  const avgMtfScore =
    total > 0
      ? Math.round(allTfs.reduce((sum, d) => sum + (d.aiScore || 0), 0) / total)
      : 0;

  return {
    bullCount,
    bearCount,
    total,
    bullPct,
    verdictText,
    verdictColor,
    avgMtfScore,
  };
}

// --- Sub-components to reduce cognitive load ---

// --- Sub-components extracted ---

export interface SmartTradeOrder {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  currentPrice?: number;
  qty: number;
  status: string;
  created_at: number;
  meta: {
    mode: string;
    lastAiScore?: number | string;
    smartTrade?: boolean;
    dca?: boolean;
    monitorError?: string;
    exitPrice?: number | string;
    exitResult?: { price: string; orderId: string };
    entryReason?: string;
    entryResult?: { price: string; orderId: string };
    exitReason?: string;
    closedAt?: number | string;
    filledAt?: number | string;
    highestPrice?: number;
    lowestPrice?: number;
    activeStopLoss?: number;
    activeTakeProfit?: number;
    tpTriggered?: boolean;
    tslActivated?: boolean;
    entryTriggered?: boolean;
    // Activity log from backend (optional, synthesized client-side if missing)
    activityLog?: Array<{
      time: number;
      type:
        | "ENTRY"
        | "SL_NEAR"
        | "TP_TEST"
        | "TTP_ACTIVE"
        | "TSL_ACTIVE"
        | "SL_UPDATE"
        | "TP_UPDATE"
        | "SL_HIT"
        | "TP_HIT"
        | "AI_SIGNAL"
        | "WHALE"
        | "MTF_CHANGE"
        | "ERROR"
        | "F4_SIGNAL"
        | "PRICE_UPDATE"
        | "STATUS_CHANGE";
      message: string;
      data?: Record<string, unknown>;
    }>;
    slUpdateHistory?: Array<{ time: number; from: number; to: number }>;
    tpUpdateHistory?: Array<{ time: number; from: number; to: number }>;
    peakDrawdown?: number;
    payload: {
      symbol: string;
      amount: string;
      buyPrice: string;
      buyType: string;
      trailingBuy?: boolean;
      trailingBuyDev?: number;
      takeProfit?: {
        price: string;
        type?: string;
        trailing?: boolean;
        deviation?: number;
        isSplit?: boolean;
        targets?: { price: string; volume: string }[];
      } | null;
      stopLoss?: {
        price: string;
        type?: string;
        trailing?: boolean;
        deviation?: number;
        timeout?: boolean;
        timeoutSeconds?: number;
        breakeven?: boolean;
      } | null;
    };
  };
}

interface ActiveSmartTradesProps {
  onEdit?: (trade: SmartTradeOrder) => void;
  onNewTrade?: () => void;
}

export const ActiveSmartTrades: React.FC<ActiveSmartTradesProps> = ({
  onEdit,
  onNewTrade,
}) => {
  const [trades, setTrades] = useState<SmartTradeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"AKTIF" | "PASIF">("AKTIF");
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const prevActiveCountRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [clearingAction, setClearingAction] = useState<
    "active" | "passive" | null
  >(null);
  const [pendingClear, setPendingClear] = useState<"active" | "passive" | null>(
    null,
  );

  const {
    mtfData,
    loadingMtf,
    failedMtf,
    liveSignals,
    fetchMtfAnalysis,
    fetchMultipleMtfAnalysis,
    fetchLiveSignals,
  } = useTradingSignals();

  const [timeframe] = useModuleTimeframe("4h");

  const fetchTrades = async () => {
    try {
      const response = await api.get("/trade/smart");
      setTrades(response.data);
      setLastFetchTime(Date.now());
      setError(null);
    } catch (err: unknown) {
      let msg = "Unknown error occurred";
      let status = 500;

      if (err && typeof err === "object" && "response" in err) {
        // Axios error
        const axiosError = err as {
          response?: {
            status?: number;
            data?: {
              details?: string;
              error?: string;
              message?: string;
              stack?: string;
            };
          };
          message: string;
        };
        status = axiosError.response?.status || 500;

        // Prefer 'details', then 'error', then 'message', then generic.
        const start =
          axiosError.response?.data?.details ||
          axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          axiosError.message;
        const stack = axiosError.response?.data?.stack;
        msg = stack ? `${start} \n\nServer Stack:\n${stack}` : start;

        if (status === 400 || status === 401) {
          console.warn("[SmartTrade] Config Warning:", start);
        } else {
          console.error("Failed to fetch smart trades:", err);
        }
      } else if (err instanceof Error) {
        msg = err.message;
        console.error("Failed to fetch smart trades:", err);
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePanicClose = async (
    e: React.MouseEvent,
    trade: SmartTradeOrder,
  ) => {
    e.stopPropagation();
    try {
      await api.delete(`/trade/smart?id=${trade.id}`);
      logger.warn(
        "🚨 MANUEL POZİSYON İPTALİ",
        `${trade.symbol} için iptal ve satış komutu verildi.`,
      );
      fetchTrades();
    } catch (error) {
      console.error("Panic close failed:", error);
      logger.error("⚠️ Pozisyon İptal Hatası", `${trade.symbol} kapatılamadı.`);
    }
  };

  const handleSilentClose = async (
    e: React.MouseEvent,
    trade: SmartTradeOrder,
  ) => {
    e.stopPropagation();
    try {
      await api.delete(`/trade/smart?id=${trade.id}&silent=true`);
      fetchTrades();
    } catch (error) {
      console.error("Silent close failed:", error);
    }
  };

  const handleFlashOpen = async (
    e: React.MouseEvent,
    trade: SmartTradeOrder,
  ) => {
    e.stopPropagation();
    if (
      !confirm(
        `FLASH OPEN: ${trade.symbol} anlık piyasa fiyatından hemen işleme girecek. Devam et?`,
      )
    )
      return;

    try {
      // Disable trailing buy and force immediate execution at market price
      await api.put(`/trade/smart?id=${trade.id}`, {
        trailingBuy: false,
        forceExecute: true,
      });
      logger.success(
        "⚡ FLASH OPEN TETİKLENDİ",
        `${trade.symbol} bekleyen alımı piyasa fiyattan anında işleme alındı.`,
      );
      fetchTrades();
    } catch (error) {
      console.error("Flash open failed:", error);
      logger.error("⚠️ Flash Open Hatası", `${trade.symbol} tetiklenemedi.`);
    }
  };

  const handleClearAll = async (type: "active" | "passive") => {
    console.log("[ClearAll] Executing:", type);
    setClearingAction(type);
    setPendingClear(null);

    try {
      let result;
      if (type === "active") {
        result = await api.delete("/trade/smart?all=true");
        logger.warn(
          "🧹 AKTİF İŞLEMLER TEMİZLENDİ",
          "Kullanıcı tüm aktif pozisyonları piyasadan kapattı.",
        );
      } else {
        result = await api.delete("/trade/smart?clearHistory=true");
        logger.info(
          "🗄️ İŞLEM GEÇMİŞİ SİLİNDİ",
          "Arşivlenen eski işlemler sistemden temizlendi.",
        );
      }
      console.log("[ClearAll] Success:", result.data);
      await new Promise((r) => setTimeout(r, 500));
      await fetchTrades();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (
              err as {
                response?: {
                  data?: { error?: string; details?: string; message?: string };
                };
              }
            ).response?.data?.error ||
            (err as { response?: { data?: { details?: string } } }).response
              ?.data?.details ||
            "Bilinmeyen sunucu hatası"
          : err instanceof Error
            ? err.message
            : String(err);
      console.error("Clear all failed:", msg);
      alert(`İŞLEM BAŞARISIZ: ${msg}`);
    } finally {
      setClearingAction(null);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 1000); // 1s refresh as requested
    return () => clearInterval(interval);
  }, []);

  // Auto-expand if a new Active trade is added
  useEffect(() => {
    const activeTrades = trades.filter((t) => t.status !== "CLOSED");
    if (activeTrades.length > prevActiveCountRef.current) {
      setIsSectionExpanded(true);
      setActiveTab("AKTIF"); // switch to active tab immediately just in case
    }
    prevActiveCountRef.current = activeTrades.length;
  }, [trades]);

  // Use refs for MTF metadata to prevent infinite rerender loops in sync logic
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

    const activeSymbols = [
      ...new Set(activeTrades.map((t) => t.symbol.replace("/", ""))),
    ];
    fetchLiveSignals(activeSymbols, timeframe);

    // MTF verisi yüklenmemiş ve hata almamış aktif işlemler için otomatik yükleme yap (Batch)
    const missingMtfTrades = activeTrades
      .filter(
        (trade) =>
          !mtfDataRef.current[trade.id] &&
          !loadingMtfRef.current[trade.id] &&
          !failedMtfRef.current[trade.id],
      )
      .map((t) => ({ id: t.id, symbol: t.symbol.replace("/", "") }));

    if (missingMtfTrades.length > 0) {
      if (fetchMultipleMtfAnalysis) {
        fetchMultipleMtfAnalysis(missingMtfTrades);
      } else {
        missingMtfTrades.forEach((t) => fetchMtfAnalysis(t.id, t.symbol));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, timeframe]); // Removed mtfData, loadingMtf, failedMtf dependencies to break loop

  // Canlı sinyalleri 30 saniyede bir güncelle
  useEffect(() => {
    triggerDataSync();
    const signalInterval = setInterval(triggerDataSync, 30000); // 30s refresh for AI signals
    return () => clearInterval(signalInterval);
  }, [triggerDataSync]);

  // Hızlı tetikleme: Veri eksikse (Ref üzerinden kontrol) hemen sync et
  useEffect(() => {
    const activeTrades = trades.filter((t) => t.status !== "CLOSED");
    const hasMissingMtf = activeTrades.some(
      (t) =>
        !mtfDataRef.current[t.id] &&
        !loadingMtfRef.current[t.id] &&
        !failedMtfRef.current[t.id],
    );
    if (hasMissingMtf) {
      triggerDataSync();
    }
  }, [trades, triggerDataSync]); // Removed mtfData dependencies

  if (isLoading) {
    return (
      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4 mt-6">
        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Nöral Mantık Çekirdeği Başlatılıyor...
        </span>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* FUTURISTIC HEADER */}
      <TradeHeader
        isSectionExpanded={isSectionExpanded}
        setIsSectionExpanded={setIsSectionExpanded}
        tradesCount={trades.length}
        lastFetchTime={lastFetchTime}
        error={error}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewTrade={onNewTrade || (() => {})}
        clearingAction={clearingAction}
        pendingClear={pendingClear}
        setPendingClear={setPendingClear}
        handleClearAll={handleClearAll}
        hasTradeItems={
          trades.filter((t) =>
            activeTab === "AKTIF"
              ? t.status === "FILLED" || t.status === "PENDING"
              : t.status === "CLOSED",
          ).length > 0
        }
      />

      {/* TABLE-LIKE LIST (ACCORDION EFFECT) */}
      <div
        className={cn(
          "transition-all duration-500 overflow-hidden",
          isSectionExpanded
            ? "max-h-[5000px] opacity-100"
            : "max-h-0 opacity-0",
        )}
      >
        <div className="bg-[#0f172a]/20 backdrop-blur-xl border border-slate-800/60 rounded-2xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
          {/* HEADERS */}
          <div className="grid grid-cols-[0.7fr_0.8fr_0.5fr_0.6fr_2fr_1.4fr_0.7fr_0.7fr_28px] gap-1.5 px-3 py-2.5 border-b border-white/5 bg-slate-950/60 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
            <div className="flex items-center justify-center gap-1">PARİTE</div>
            <div className="flex items-center justify-center gap-1">
              GİRİŞ / PİYASA
            </div>
            <div className="flex items-center justify-center gap-1">
              CANLI AI
            </div>
            <div className="flex items-center justify-center gap-1">DURUM</div>
            <div className="flex items-center justify-center gap-1">
              AKILLI HEDEFLER
            </div>
            <div className="flex items-center justify-center gap-1">
              MTF ANALİZİ
            </div>
            <div className="flex items-center justify-center gap-1">
              MTF SİNYALİ
            </div>
            <div className="flex items-center justify-center gap-1">
              KAR/ZARAR
            </div>
            <div></div>
          </div>

          <div className="divide-y divide-white/5">
            {trades.filter((t) =>
              activeTab === "AKTIF"
                ? t.status === "FILLED" || t.status === "PENDING"
                : t.status === "CLOSED",
            ).length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                  <Search className="w-6 h-6 text-slate-700" />
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                  {activeTab === "AKTIF"
                    ? "Aktif İşlem Bulunamadı"
                    : "Geçmiş İşlem Bulunamadı"}
                </span>
                <p className="text-xs text-slate-700 max-w-[240px]">
                  {activeTab === "AKTIF"
                    ? "Şu anda takip edilen aktif bir pozisyon yok."
                    : "Kapatılmış veya pasife düşmüş bir işlem geçmişi görünmüyor."}
                </p>
              </div>
            ) : (
              trades
                .filter((t) =>
                  activeTab === "AKTIF"
                    ? t.status === "FILLED" || t.status === "PENDING"
                    : t.status === "CLOSED",
                )
                .map((trade) => {
                  const isExpanded = expandedTrade === trade.id;
                  const payload = trade.meta.payload;
                  const isClosed = trade.status === "CLOSED";
                  const meta = trade.meta;
                  const exitPriceNum = meta.exitPrice
                    ? parseFloat(String(meta.exitPrice))
                    : meta.exitResult?.price
                      ? parseFloat(String(meta.exitResult.price))
                      : 0;

                  // For closed trades, use the exitPriceNum. For active, use ticker currentPrice or fallback to entry.
                  const currentPrice = isClosed
                    ? exitPriceNum || trade.price
                    : trade.currentPrice || trade.price;

                  const payloadTp = parseFloat(
                    payload?.takeProfit?.price || "0",
                  );
                  const payloadSl = parseFloat(payload?.stopLoss?.price || "0");

                  // Use calculated trailing prices from monitor if available
                  const tp = meta.activeTakeProfit || payloadTp;
                  const sl = meta.activeStopLoss || payloadSl;

                  const entry = trade.price;

                  // Real PNL Calculation — PENDING (TBUY) trades have NO position yet, PNL must be 0
                  const isPending = trade.status === "PENDING";
                  const effectiveQty = isPending
                    ? 0
                    : trade.qty || parseFloat(payload?.amount || "0") || 0;
                  const { pnlPercent, pnlUsdt } = isPending
                    ? { pnlPercent: 0, pnlUsdt: 0 }
                    : calculateTradePnl(
                        trade.side,
                        meta.mode,
                        entry,
                        currentPrice,
                        effectiveQty,
                      );

                  const aiScoreStatic = meta.lastAiScore
                    ? Number(meta.lastAiScore)
                    : 0;
                  const hasTrailing =
                    payload.takeProfit?.trailing || payload.stopLoss?.trailing;

                  // Live trailing status — use monitor's confirmation flags, not naive price checks
                  // TTP is active only if the monitor has triggered tpTriggered (TP was reached and trailing started)
                  const isTtpActive =
                    tp > 0 &&
                    payload.takeProfit?.trailing &&
                    !isClosed &&
                    !!meta.tpTriggered;
                  // TSL is active only if the monitor has activated TSL (TP was reached first, then trailing SL started)
                  const isTslActive =
                    sl > 0 &&
                    payload.stopLoss?.trailing &&
                    !isClosed &&
                    !!meta.tslActivated;

                  // CANLI sinyal verisinden AI Score ve STATUS — Shared Lib kullanılıyor
                  const symNorm = trade.symbol.replace("/", "");
                  const liveData = liveSignals[symNorm] || null;

                  const {
                    statusText,
                    statusColor,
                    liveAiScore: aiScore,
                  } = interpretTradingStatus(
                    liveData,
                    trade.status === "CLOSED",
                    trade.side,
                    currentPrice,
                    tp,
                    sl,
                    liveData ? liveData.aiScore : Number(trade.aiScore) || 0,
                    trade.status,
                    meta,
                  );

                  // Label logic
                  let opLabel = "STANDART İŞLEM";
                  if (meta.smartTrade) opLabel = "AKILLI İŞLEM";
                  else if (meta.mode === "TRADE") opLabel = "STANDART ALIM";
                  else if (meta.mode === "COVER") opLabel = "STANDART SATIŞ";
                  else if (meta.dca) opLabel = "DCA BOTU";

                  const isBuyExit = trade.side === "BUY" && isClosed;
                  const isSellExit = trade.side === "SELL" && isClosed;

                  // MTF Verdict Calculation
                  const mtfResults = mtfData[trade.id] || {};
                  const allTfs = MTF_INTERVALS.map(
                    (tf) => mtfResults[tf],
                  ).filter(Boolean);
                  const {
                    bullCount,
                    bearCount,
                    bullPct,
                    verdictText,
                    verdictColor,
                    avgMtfScore,
                  } = calculateMtfVerdict(allTfs);

                  return (
                    <div
                      key={trade.id}
                      className={cn(
                        "group transition-all duration-300",
                        !isClosed && "hover:bg-cyan-400/[0.03]",
                        isBuyExit &&
                          "bg-emerald-500/5 opacity-80 border-l-2 border-emerald-500/20",
                        isSellExit &&
                          "bg-rose-500/5 opacity-80 border-l-2 border-rose-500/20",
                      )}
                    >
                      <div
                        className="grid grid-cols-[0.7fr_0.8fr_0.5fr_0.6fr_2fr_1.4fr_0.7fr_0.7fr_28px] gap-1.5 px-3 py-2 items-center cursor-pointer"
                        onClick={() => {
                          const next = isExpanded ? null : trade.id;
                          setExpandedTrade(next);
                          if (next !== null && !mtfData[trade.id]) {
                            fetchMtfAnalysis(
                              trade.id,
                              trade.symbol.replace("/", ""),
                            );
                          }
                        }}
                      >
                        {/* PAIR */}
                        <div className="flex items-center gap-3 justify-center w-full">
                          <div className="relative">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover:scale-105",
                                trade.side === "BUY"
                                  ? "bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                  : "bg-rose-500/10 border-rose-500/20 group-hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]",
                              )}
                            >
                              <Zap
                                className={cn(
                                  "w-5 h-5",
                                  trade.side === "BUY"
                                    ? "text-emerald-400"
                                    : "text-rose-400",
                                )}
                              />
                            </div>
                            <div
                              className={cn(
                                "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#020617]",
                                trade.side === "BUY"
                                  ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                                  : "bg-rose-500 shadow-[0_0_8px_#f43f5e]",
                              )}
                            ></div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white tracking-tight">
                                {trade.symbol.replace("USDT", "")}
                                <span className="text-slate-600 font-bold">
                                  /USDT
                                </span>
                              </span>
                              {hasTrailing && !isClosed && (
                                <Timer className="w-3 h-3 text-cyan-400 animate-pulse" />
                              )}
                            </div>
                            <div className="text-xs font-black uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded-sm text-[10px]",
                                  opLabel === "AKILLI İŞLEM"
                                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                    : opLabel === "DCA BOTU"
                                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                      : "bg-slate-800 text-slate-400 border border-white/5",
                                )}
                              >
                                {opLabel}
                              </span>
                              <span className="text-slate-600 font-bold">
                                V{trade.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ENTRY / MARKET */}
                        <div className="flex flex-col items-center justify-center w-full min-w-0">
                          <div className="text-xs font-black text-slate-300 font-mono whitespace-nowrap">
                            E:{" "}
                            <span className="text-white font-black">
                              ${entry.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                            {isClosed ? "X:" : "M:"}{" "}
                            <span
                              className={cn(
                                "transition-colors duration-500 font-black",
                                currentPrice >= entry
                                  ? trade.side === "BUY"
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                  : trade.side === "BUY"
                                    ? "text-rose-400"
                                    : "text-emerald-400",
                              )}
                            >
                              ${currentPrice.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* AI SCORE — CANLI 4H */}
                        <div className="flex flex-col items-center justify-center gap-1 w-full">
                          <div className="flex items-center gap-1.5">
                            <Brain
                              className={cn(
                                "w-4 h-4",
                                liveData
                                  ? aiScore >= 60
                                    ? "text-emerald-400"
                                    : aiScore <= 35
                                      ? "text-rose-400"
                                      : "text-cyan-400"
                                  : "text-slate-500",
                              )}
                            />
                            <span
                              className={cn(
                                "text-sm font-black",
                                liveData
                                  ? aiScore >= 60
                                    ? "text-emerald-400"
                                    : aiScore <= 35
                                      ? "text-rose-400"
                                      : "text-cyan-300"
                                  : "text-slate-300",
                              )}
                            >
                              {aiScore > 0 ? `${aiScore}%` : "SİNYAL..."}
                            </span>
                            {liveData && (
                              <span className="text-[8px] text-slate-600 font-bold px-1 bg-slate-800/50 rounded">
                                {timeframe.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="w-16 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-white/5">
                            <div
                              style={{ width: `${aiScore}%` }}
                              className={cn(
                                "h-full transition-all duration-700",
                                aiScore >= 60
                                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  : aiScore <= 35
                                    ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                                    : "bg-cyan-400",
                              )}
                            ></div>
                          </div>

                          {!isClosed && (isTtpActive || isTslActive) && (
                            <div className="flex flex-col gap-1 w-full mt-1.5">
                              {isTtpActive && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] whitespace-nowrap">
                                  TTP AKTİF 🚀{" "}
                                  <Radar className="w-2.5 h-2.5 animate-spin drop-shadow-[0_0_5px_rgba(16,185,129,0.8)] ml-auto" />
                                </span>
                              )}
                              {isTslActive && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)] whitespace-nowrap">
                                  TSL AKTİF 🚨{" "}
                                  <Radar className="w-2.5 h-2.5 animate-spin drop-shadow-[0_0_5px_rgba(244,63,94,0.8)] ml-auto" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* STATUS — CANLI SİNYAL */}
                        <div className="flex justify-center w-full">
                          <StatusBadge
                            meta={meta}
                            side={trade.side}
                            isClosed={isClosed}
                            timeframe={timeframe}
                            liveData={liveData}
                            statusText={statusText}
                            statusColor={statusColor}
                          />
                        </div>

                        {/* SMART TARGETS BAR */}
                        <div className="flex flex-col justify-center w-full min-w-0">
                          <TradeProgressBar
                            trade={trade}
                            entry={entry}
                            currentPrice={currentPrice}
                            sl={sl}
                            tp={tp}
                            pnlPercent={pnlPercent}
                            pnlUsdt={pnlUsdt}
                            isProfit={pnlPercent >= 0}
                            trailingTpDev={payload.takeProfit?.deviation}
                            trailingSlDev={payload.stopLoss?.deviation}
                            isTtpActive={!!isTtpActive}
                            isTslActive={!!isTslActive}
                            trailingBuyDev={payload.trailingBuyDev}
                          />
                          {/* Compact feature badges */}
                          {!isClosed &&
                            (payload.trailingBuy ||
                              payload.takeProfit?.trailing ||
                              payload.stopLoss?.trailing ||
                              payload.stopLoss?.timeout ||
                              payload.stopLoss?.breakeven) && (
                              <div className="flex items-center gap-1 px-1.5 flex-wrap">
                                {payload.trailingBuy && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    TBY{" "}
                                    {payload.trailingBuyDev
                                      ? `${Math.abs(payload.trailingBuyDev)}%`
                                      : "AKTİF"}
                                  </span>
                                )}
                                {payload.takeProfit?.trailing && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {payload.takeProfit.deviation
                                      ? `TTP ${payload.takeProfit.deviation}%`
                                      : "TTP"}
                                  </span>
                                )}
                                {payload.stopLoss?.trailing && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    {payload.stopLoss.deviation
                                      ? `TSL ${Math.abs(payload.stopLoss.deviation)}%`
                                      : "TSL"}
                                  </span>
                                )}
                                {payload.stopLoss?.timeout && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    ⏱{payload.stopLoss.timeoutSeconds || 10}s
                                  </span>
                                )}
                                {payload.stopLoss?.breakeven && (
                                  <span className="px-1 py-0.5 rounded text-[8px] font-black bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                    BE✓
                                  </span>
                                )}
                              </div>
                            )}
                        </div>

                        {/* YENİ SÜTUN 1: MTF ANALYSIS (COMPACT) */}
                        <div
                          className="flex items-center justify-center gap-1 overflow-hidden w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchMtfAnalysis(
                              trade.id,
                              trade.symbol.replace("/", ""),
                            );
                          }}
                        >
                          {loadingMtf[trade.id] && !mtfData[trade.id] ? (
                            <div className="w-full text-center text-[11px] text-slate-500 font-bold animate-pulse">
                              ANALİZ EDİLİYOR...
                            </div>
                          ) : !mtfData[trade.id] && failedMtf[trade.id] ? (
                            <div className="w-full text-center text-[11px] text-rose-500/70 font-bold cursor-pointer hover:text-rose-400">
                              YENİDEN DENEMEK İÇİN TIKLA
                            </div>
                          ) : !mtfData[trade.id] ? (
                            <div className="w-full text-center text-[11px] text-slate-600 font-bold cursor-pointer hover:text-cyan-400">
                              YÜKLENİYOR...
                            </div>
                          ) : (
                            MTF_INTERVALS.map((tf) => {
                              const d = mtfData[trade.id]?.[tf];
                              if (!d) return null;

                              const hasBuySignal =
                                d.f4ConfirmedBuy || d.f4EarlyBuy;
                              const hasSellSignal =
                                d.f4ConfirmedSell || d.f4EarlySell;

                              const tfColor = hasBuySignal
                                ? "bg-emerald-500/10 border-emerald-500/20"
                                : hasSellSignal
                                  ? "bg-rose-500/10 border-rose-500/20"
                                  : "bg-slate-800/10 border-slate-700/30";
                              const textColor = hasBuySignal
                                ? "text-emerald-400"
                                : hasSellSignal
                                  ? "text-rose-400"
                                  : "text-slate-500";
                              const tfVerdict = hasBuySignal
                                ? "AL"
                                : hasSellSignal
                                  ? "SAT"
                                  : "NÖTR";

                              return (
                                <div
                                  key={tf}
                                  className={`flex-1 flex flex-col items-center gap-2 py-2.5 px-1.5 border rounded ${tfColor} hover:scale-105 transition-transform`}
                                >
                                  <div className="flex flex-col items-center justify-center w-full">
                                    <span className="text-[13px] font-black text-white leading-none">
                                      {tf}
                                    </span>
                                    <span
                                      className={`text-[12px] font-black mt-1.5 ${textColor} leading-none ${hasBuySignal || hasSellSignal ? "animate-pulse" : ""}`}
                                    >
                                      {tfVerdict}
                                    </span>
                                  </div>
                                  <div className="w-full px-2 h-1 flex-1 max-w-[28px] mt-1">
                                    <div className="w-full h-full bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${d.aiScore >= 60 ? "bg-emerald-500" : d.aiScore <= 35 ? "bg-rose-500" : "bg-amber-500"}`}
                                        style={{
                                          width: `${Math.min(100, d.aiScore)}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                  {/* F4 Signali */}
                                  <div className="w-full flex items-center justify-center mt-1.5">
                                    <span className="text-[11px] font-black leading-none opacity-100 text-center">
                                      {d.f4ConfirmedBuy ? (
                                        <span className="text-emerald-400">
                                          ✅F4
                                        </span>
                                      ) : d.f4EarlyBuy ? (
                                        <span className="text-emerald-300">
                                          🔔F4
                                        </span>
                                      ) : d.f4ConfirmedSell ? (
                                        <span className="text-rose-400">
                                          ❌F4
                                        </span>
                                      ) : d.f4EarlySell ? (
                                        <span className="text-rose-300">
                                          🔕F4
                                        </span>
                                      ) : d.whaleDetected ? (
                                        <span title={d.whaleStatus}>🐋</span>
                                      ) : (
                                        <span className="text-slate-500/50">
                                          -
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* YENİ SÜTUN 2: MTF VERDICT */}
                        <div className="flex flex-col items-center justify-center border-l border-white/5 overflow-hidden w-full">
                          {mtfData[trade.id] ? (
                            <div
                              className="flex flex-col items-center gap-1.5 w-full text-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchMtfAnalysis(
                                  trade.id,
                                  trade.symbol.replace("/", ""),
                                );
                              }}
                            >
                              <div className="flex items-center gap-1.5 scale-110">
                                <TrendingUp
                                  className={cn(
                                    "w-4 h-4",
                                    verdictText === "AL" ||
                                      verdictText === "GÜÇLÜ AL"
                                      ? "text-emerald-400"
                                      : verdictText === "NÖTR"
                                        ? "text-slate-500"
                                        : "text-rose-400",
                                  )}
                                />
                                <span
                                  className={`text-[12px] font-black tracking-widest leading-none ${verdictColor}`}
                                >
                                  {verdictText}
                                </span>
                              </div>
                              <div
                                className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5 shadow-inner min-w-[60px]"
                                title={`Ortalama Skor: ${avgMtfScore}%`}
                              >
                                <div
                                  className={`h-full transition-all duration-1000 ${bullPct >= 55 ? "bg-emerald-500" : bullPct <= 45 ? "bg-rose-500" : "bg-amber-500"}`}
                                  style={{ width: `${bullPct}%` }}
                                />
                              </div>

                              <div className="flex items-center gap-1 bg-slate-900/50 px-1.5 py-1 rounded border border-white/5 shadow-inner">
                                <span className="text-[10px] font-black text-emerald-500">
                                  {bullCount} BOĞA
                                </span>
                                <span className="text-[8px] text-slate-600 opacity-50">
                                  |
                                </span>
                                <span className="text-[10px] font-black text-rose-500">
                                  {bearCount} AYI
                                </span>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchMtfAnalysis(
                                  trade.id,
                                  trade.symbol.replace("/", ""),
                                );
                              }}
                              className="text-[10px] font-black text-cyan-500 uppercase px-3 py-1.5 bg-cyan-500/10 rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-all animate-pulse"
                            >
                              YÜKLE
                            </button>
                          )}
                        </div>

                        {/* PNL REAL */}
                        <div className="text-center flex flex-col items-center justify-center w-full">
                          <div className="flex items-center justify-center gap-1">
                            {pnlPercent >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-rose-500" />
                            )}
                            <span
                              className={cn(
                                "text-sm font-black font-mono tracking-tighter",
                                pnlPercent >= 0
                                  ? "text-emerald-400"
                                  : "text-rose-400",
                              )}
                            >
                              {pnlPercent >= 0 ? "+" : ""}$
                              {pnlUsdt.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "text-[10px] font-black font-mono tracking-tighter mt-0.5 opacity-80",
                              pnlPercent >= 0
                                ? "text-emerald-500"
                                : "text-rose-500",
                            )}
                          >
                            {pnlPercent >= 0 ? "+" : ""}
                            {pnlPercent.toFixed(2)}%
                          </div>
                        </div>

                        {/* EXPAND ICON */}
                        <div className="flex justify-center text-slate-700 mx-auto">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-cyan-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 group-hover:text-cyan-500 transition-colors" />
                          )}
                        </div>
                      </div>

                      {/* EXPANDED PANEL (SADECE CONSOLIDATED STATS VE NEURAL LOGS) */}
                      {isExpanded && (
                        <ExpandedTradePanel
                          trade={trade}
                          currentPrice={currentPrice}
                          isClosed={isClosed}
                          meta={meta}
                          entry={entry}
                          aiScore={aiScore}
                          statusText={statusText}
                          statusColor={statusColor}
                          tp={tp}
                          sl={sl}
                          payload={payload}
                          pnlPercent={pnlPercent}
                          pnlUsdt={pnlUsdt}
                          onEdit={onEdit}
                          handlePanicClose={handlePanicClose}
                          handleSilentClose={handleSilentClose}
                          handleFlashOpen={handleFlashOpen}
                          fetchTrades={fetchTrades}
                          isTtpActive={!!isTtpActive}
                          isTslActive={!!isTslActive}
                          liveData={
                            liveData as unknown as Record<
                              string,
                              unknown
                            > | null
                          }
                          mtfVerdictText={verdictText}
                          bullCount={bullCount}
                          bearCount={bearCount}
                        />
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* FOOTER */}
          <div className="px-6 py-4 border-t border-white/5 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-650 uppercase tracking-[0.3em]">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>{" "}
                VERSİYON: V2.6.2-TERMİNAL
              </span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> VERİ
                AKIŞI: AKTİF
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-2">YENİLEME: 500MS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
