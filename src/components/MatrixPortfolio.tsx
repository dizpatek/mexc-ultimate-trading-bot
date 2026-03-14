"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  Fish,
  AlertCircle,
  Activity,
  Zap,
  LineChart,
  CircleDollarSign,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { api } from "@/services/api";
import { TradingViewEmbedChart } from "./TradingViewEmbedChart";
import { AssetDetailModal } from "./AssetDetailModal";
import { useHoldings } from "../hooks/usePortfolio";
import { useMexcWebSocket } from "../hooks/useMexcWebSocket";
import { cn } from "@/lib/utils";
import { AssetIcon } from "./AssetIcon";
import { normalizeSymbol } from "@/lib/symbol-utils";
import { useTradingSignals } from "@/hooks/useTradingSignals";
import { useCombatLogs, LogEntry } from "@/hooks/useCombatLogs";
import { calculateSmartPrediction } from "@/lib/trading-logic";
import { extractBaseAsset } from "@/lib/symbol-utils";
import { useModuleTimeframe } from "@/context/TimeframeContext";

import { F4Data } from "@/lib/trading-logic";
import { useSortedHoldings } from "@/hooks/useSortedHoldings";

export function MatrixPortfolio() {
  const lastSyncTime = useMemo(() => new Date().toLocaleTimeString(), []);
  // 1. Portfolio Data
  const { data: holdings, isLoading: isHoldingsLoading, refetch } = useHoldings();
  const [viewDetailAsset, setViewDetailAsset] = useState<{
    symbol: string;
    price: number;
    score: number;
    decision: string;
    prediction: string;
    trap: boolean;
    smc?: F4Data["smc"];
    vpa?: F4Data["vpa"];
    adm?: F4Data["adm"];
    liquidity?: F4Data["liquidity"];
    whaleTrust?: number;
  } | null>(null);

  // 2. Real-time Price Data (WebSocket)
  const activeSymbols = useMemo(() => {
    return (
      holdings
        ?.filter((h) => h.symbol !== "USDT" && h.symbol !== "USDC")
        ?.map((h) => normalizeSymbol(h.symbol)) || []
    );
  }, [holdings]);

  const { tickerData, isConnected } = useMexcWebSocket(activeSymbols);

  // 3. Interval Selection
  const [interval, setIntervalState] = useModuleTimeframe("4h");
  const intervals = [
    { id: "15m", label: "15D" },
    { id: "1h", label: "1S" },
    { id: "4h", label: "4S" },
    { id: "1d", label: "1G" },
    { id: "1w", label: "1H" },
  ];

  // 4. AI Signal Data
  const { signalDataMap, isLoadingSignals, fetchIntervalForSymbols } =
    useTradingSignals();
  const [tradeAmounts, setTradeAmounts] = useState<Record<string, string>>({});
  const [isTrading, setIsTrading] = useState<Record<string, boolean>>({});
  const [tradeStatus, setTradeStatus] = useState<
    Record<string, { type: "success" | "error"; msg: string } | null>
  >({});
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(
    null,
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);

  // --- Sorting (via dedicated hook) ---
  const { sortedHoldings, sortKey, sortDir, handleSort } = useSortedHoldings({
    holdings,
    signalDataMap,
    tickerData,
  });

  // 5. Signals Alarm Sync
  const { logs: combatLogs } = useCombatLogs(interval);

  // Fetch AI signals — Hook tarafından yönetiliyor
  useEffect(() => {
    if (activeSymbols.length > 0) {
      fetchIntervalForSymbols(activeSymbols, interval);
    }
  }, [activeSymbols.length, interval, fetchIntervalForSymbols, activeSymbols]);

  const setTradeAmountToMax = useCallback(
    (symbol: string, side: "BUY" | "SELL") => {
      if (!holdings) return;

      if (side === "BUY") {
        const usdt = holdings.find(
          (h) => h.symbol === "USDT" || h.symbol === "USDC",
        );
        if (usdt) {
          // Formatting to 2 decimals for USDT
          setTradeAmounts((prev) => ({
            ...prev,
            [symbol]: usdt.holding.toFixed(2),
          }));
        }
      } else {
        const assetBase = symbol.replace("USDT", "");
        const asset = holdings.find((h) => h.symbol === assetBase);
        if (asset) {
          // Using 6 decimals for asset quantity
          setTradeAmounts((prev) => ({
            ...prev,
            [symbol]: asset.holding.toString(),
          }));
        }
      }
    },
    [holdings],
  );

  const handleQuickTrade = async (symbol: string, side: "BUY" | "SELL") => {
    const amount = tradeAmounts[symbol] || "10"; // Default to 10 if empty
    setIsTrading((prev) => ({ ...prev, [symbol]: true }));
    setTradeStatus((prev) => ({ ...prev, [symbol]: null }));

    try {
      const normalizedSymbol = normalizeSymbol(symbol); // Ensure symbol is normalized for the API call

      const payload =
        side === "BUY"
          ? { symbol: normalizedSymbol, side, usdtAmount: amount }
          : { symbol: normalizedSymbol, side, quantity: amount };

      const response = await api.post("/trade/execute", payload);

      if (response.status === 200 && response.data.success) {
        setTradeStatus((prev) => ({
          ...prev,
          [symbol]: { type: "success", msg: "Tamam!" },
        }));
        setTimeout(
          () => setTradeStatus((prev) => ({ ...prev, [symbol]: null })),
          3000,
        );
      } else {
        const errorMsg = response.data.error || "İşlem Başarısız";
        setTradeStatus((prev) => ({
          ...prev,
          [symbol]: { type: "error", msg: errorMsg },
        }));
        setTimeout(
          () => setTradeStatus((prev) => ({ ...prev, [symbol]: null })),
          5000,
        );
      }
    } catch (error: unknown) {
      console.error("Trade execution error", error);
      const errorMsg = error instanceof Error ? error.message : "Hata Oluştu";
      setTradeStatus((prev) => ({
        ...prev,
        [symbol]: { type: "error", msg: errorMsg },
      }));
      setTimeout(
        () => setTradeStatus((prev) => ({ ...prev, [symbol]: null })),
        5000,
      );
    } finally {
      setIsTrading((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  const getScoreColor = useCallback((score: number) => {
    if (score >= 70) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-rose-500";
  }, []);

  const getDecisionStyle = useCallback((decision: string) => {
    switch (decision) {
      case "GO_LONG":
        return "bg-emerald-900/40 text-emerald-400 border-emerald-700/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
      case "GO_SHORT":
        return "bg-rose-900/40 text-rose-400 border-rose-700/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]";
      case "WAIT":
        return "bg-slate-800/40 text-slate-400 border-slate-700/50";
      default:
        return "bg-slate-800/40 text-slate-400 border-slate-700/50";
    }
  }, []);

  // getPredictionColor/Label removed — buildSmartPrediction handles all label/color logic now

  // ============================================================
  // AKILLI TAHMİN ÜRETECİ — ~50 formül çıktısı + açıklama
  // ============================================================
  // buildSmartPrediction — Shared Lib calculateSmartPrediction kullanılıyor

  if (isHoldingsLoading) {
    return (
      <div className="bg-transparent text-slate-200 rounded-lg h-48 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mr-2" />
        <span className="text-slate-400 font-mono text-xs">
          MATRIX V3 MOTORU BAŞLATILIYOR...
        </span>
      </div>
    );
  }

  return (
    <div className="bg-transparent text-slate-200 rounded-lg h-full flex flex-col font-sans">
      {/* UNIFIED COMMAND BAR (Header) */}
      <div 
        className="relative z-20 flex flex-wrap items-center justify-center sm:justify-between py-2 px-2 gap-3 border-b border-slate-800/40 bg-slate-950/20 backdrop-blur-sm rounded-t-xl mb-2 font-mono cursor-pointer group"
        onClick={() => setIsSectionExpanded(!isSectionExpanded)}
      >
        {/* GROUP 1: SECTION TITLE */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-lg">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden lg:block">
              Matrix Portföy
            </h2>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">VARLIK:</span>
             <span className="text-[10px] font-black text-emerald-400">
               {holdings?.length || 0}
             </span>
          </div>
        </div>

        {/* GROUP 2: STATUS & INTERVAL */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
            <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
            <span className={cn("text-[9px] font-black uppercase tracking-widest leading-none", isConnected ? "text-emerald-400" : "text-rose-400")}>
              {isConnected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            {intervals.map((item) => (
              <button
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setIntervalState(item.id);
                }}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black rounded-lg transition-all duration-200 uppercase tracking-tighter",
                  interval === item.id
                    ? "bg-cyan-500 text-slate-950 shadow-lg"
                    : "text-slate-500 hover:text-white"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* GROUP 3: ACTIONS */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl gap-1">
             <button
              onClick={(e) => { 
                e.stopPropagation(); 
                refetch();
                if (activeSymbols.length > 0) {
                  fetchIntervalForSymbols(activeSymbols, interval);
                }
              }}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white transition-all"
              title="Yenile"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoadingSignals && "animate-spin text-cyan-400")} />
            </button>
            
            <button
               className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white transition-all"
               onClick={(e) => { e.stopPropagation(); setIsSectionExpanded(!isSectionExpanded); }}
            >
              {isSectionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className={cn(
        "transition-all duration-500 overflow-hidden flex-1 flex flex-col",
        isSectionExpanded
          ? "max-h-[5000px] opacity-100"
          : "max-h-0 opacity-0"
      )}>
        <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-800/40">
          <thead className="bg-slate-900/60 backdrop-blur-md sticky top-0 z-10 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <tr>
              {/* Sortable Header Helper */}
              {([
                { key: "symbol" as const,     label: "VARLIK",           align: "left",   extra: "" },
                { key: "value" as const,       label: "PORTFÖY",          align: "right",  extra: "" },
                { key: "change24h" as const,   label: "FİYAT / DEĞİŞİM",  align: "right",  extra: "" },
                { key: "aiScore" as const,     label: "AI SKOR & GÜÇ",   align: "left",   extra: "w-[140px]" },
                { key: "regime" as const,      label: "PİYASA REJİMİ",    align: "left",   extra: "" },
                { key: "whale" as const,       label: "BALİNA & VOLATİLİTE", align: "left", extra: "" },
                { key: "prediction" as const,  label: "TAHMİN",           align: "left",   extra: "" },
                { key: "decision" as const,    label: "KARAR",            align: "center", extra: "" },
              ] as { key: "symbol"|"value"|"change24h"|"aiScore"|"regime"|"whale"|"prediction"|"decision"; label: string; align: string; extra: string }[]).map(({ key, label, align, extra }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className={cn(
                    `px-3 py-3 border-r border-slate-800/40 cursor-pointer select-none group transition-colors hover:bg-cyan-950/30 hover:text-cyan-300 ${extra}`,
                    `text-${align}`,
                    sortKey === key ? "text-cyan-400 bg-cyan-950/20" : "",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="inline-flex flex-col ml-0.5 opacity-60 group-hover:opacity-100">
                      {sortKey === key ? (
                        sortDir === "asc"
                          ? <ChevronUp className="w-2.5 h-2.5 text-cyan-400" />
                          : <ChevronDown className="w-2.5 h-2.5 text-cyan-400" />
                      ) : (
                        <ChevronDown className="w-2.5 h-2.5 opacity-30" />
                      )}
                    </span>
                  </span>
                </th>
              ))}
              <th className="px-3 py-3 text-center border-slate-800/40 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                HIZLI İŞLEM (USDT)
              </th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {!holdings || holdings.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Wallet className="w-10 h-10 opacity-10" />
                    <span className="text-xs">
                      Takip edilecek varlık bulunamadı.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedHoldings.map((holding) => {
                const assetName = holding.symbol;
                const isStablecoin =
                  assetName === "USDT" || assetName === "USDC";
                const fullSymbol = isStablecoin
                  ? assetName
                  : `${assetName}USDT`;
                const signalData = isStablecoin
                  ? null
                  : signalDataMap[fullSymbol];
                const ticker = isStablecoin ? null : tickerData[fullSymbol];
                const currentPrice = isStablecoin
                  ? 1
                  : ticker
                    ? parseFloat(ticker.p)
                    : signalData?.currentPrice || 0;
                const holdingValue = holding.holding * currentPrice;

                return (
                  <React.Fragment key={fullSymbol}>
                    <tr
                      className={`hover:bg-cyan-950/20 transition-all duration-200 group relative cursor-pointer ${expandedRow === fullSymbol ? "bg-cyan-950/10" : ""}`}
                      onClick={() =>
                        setExpandedRow(
                          expandedRow === fullSymbol ? null : fullSymbol,
                        )
                      }
                    >
                      {/* 1. ASSET */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        <div className="flex items-center justify-between group/cell">
                          <div className="flex items-center gap-2.5">
                            <AssetIcon symbol={assetName} />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-200 text-xs">
                                  {assetName}
                                </span>
                                {(() => {
                                  const recentSignal = combatLogs.find(
                                    (l: LogEntry) =>
                                      l.assetSymbol &&
                                      extractBaseAsset(l.assetSymbol) ===
                                        extractBaseAsset(assetName) &&
                                      Date.now() - l.timestamp <
                                        30 * 60 * 1000 &&
                                      l.type !== "SYSTEM",
                                  );
                                  if (!recentSignal) return null;
                                  return (
                                    <div
                                      className={cn(
                                        "relative flex h-2 w-2",
                                        recentSignal.sentiment === "POSITIVE"
                                          ? "text-emerald-400"
                                          : "text-rose-400",
                                      )}
                                      title={`ALARM: ${recentSignal.message}`}
                                    >
                                      <span
                                        className={cn(
                                          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                          recentSignal.sentiment === "POSITIVE"
                                            ? "bg-emerald-400"
                                            : "bg-rose-400",
                                        )}
                                      ></span>
                                      <span
                                        className={cn(
                                          "relative inline-flex rounded-full h-2 w-2",
                                          recentSignal.sentiment === "POSITIVE"
                                            ? "bg-emerald-500"
                                            : "bg-rose-500",
                                        )}
                                      ></span>
                                    </div>
                                  );
                                })()}
                              </div>
                              <span className="text-[9px] text-slate-500 font-mono">
                                USDT
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const assetClean = assetName.replace("USDT", "");
                              window.open(
                                `https://www.mexc.com/exchange/${assetClean}_USDT`,
                                "_blank",
                              );
                            }}
                            className="p-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all opacity-100 shadow-sm hover:shadow-cyan-500/10"
                            title="MEXC'de Aç"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 2. HOLDINGS */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                        <div className="flex flex-col">
                          <span className="text-slate-300 font-mono text-xs">
                            {holding.holding.toFixed(4)}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            $
                            {holdingValue.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        </div>
                      </td>

                      {/* 3. PRICE & DAILY PERFORMANCE (COMBINED) */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                        <div className="flex flex-col gap-1.5 items-end">
                          <span className="font-mono text-xs text-slate-300">
                            $
                            {currentPrice > 0
                              ? currentPrice.toLocaleString(undefined, {
                                  minimumFractionDigits:
                                    currentPrice < 1 ? 4 : 2,
                                  maximumFractionDigits:
                                    currentPrice < 1 ? 6 : 2,
                                })
                              : "---"}
                          </span>
                          <div
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/50 border ${holding.change24h >= 0 ? "text-emerald-400 border-emerald-500/20" : "text-rose-400 border-rose-500/20"}`}
                          >
                            {holding.change24h >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="font-mono text-[10px] font-black">
                              {holding.change24h >= 0 ? "+" : ""}
                              {holding.change24h.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. AI SCORE + V5 SPARK INDICATORS */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">
                              AI SCORE (V5)
                            </span>
                            <div
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-black font-mono transition-all border",
                                (signalData?.aiScore || 0) >= 50
                                  ? "bg-emerald-500 border-emerald-400 text-white"
                                  : "bg-rose-500 border-rose-400 text-black shadow-[0_0_10px_rgba(244,63,94,0.2)]",
                              )}
                            >
                              {Math.round(signalData?.aiScore || 0)}/100
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${getScoreColor(signalData?.aiScore || 0).replace("text-", "bg-")}`}
                              style={{ width: `${signalData?.aiScore || 0}%` }}
                            />
                          </div>
                          {/* V5 Indicator Spark dots */}
                          {Array.isArray(signalData?.v5Indicators) &&
                            signalData.v5Indicators.length > 0 && (
                              <div
                                className="flex gap-0.5 mt-0.5"
                                title="V5 İndikatörler: RSI / MACD / ST / StochRSI / ADX / VWAP / EMA / Ichimoku"
                              >
                                {signalData.v5Indicators.map((ind, i) => (
                                  <div
                                    key={i}
                                    title={`${ind.name}: ${ind.state}`}
                                    className={cn(
                                      "flex-1 h-2.5 rounded-sm transition-all",
                                      ind.color === "green"
                                        ? "bg-emerald-500"
                                        : ind.color === "red"
                                          ? "bg-rose-500"
                                          : ind.color === "orange"
                                            ? "bg-amber-500"
                                            : "bg-slate-700",
                                    )}
                                  />
                                ))}
                              </div>
                            )}
                          <div className="flex gap-1 mt-0.5">
                            {signalData?.mtfConsensus === "GÜÇLÜ YÜKSELİŞ" && (
                              <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded border border-emerald-500/20">
                                MTF++
                              </span>
                            )}
                            {signalData?.mtfConsensus === "GÜÇLÜ DÜŞÜŞ" && (
                              <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1 rounded border border-rose-500/20">
                                MTF--
                              </span>
                            )}
                            <span className="text-[8px] text-slate-600 truncate">
                              {signalData?.mtfConsensus}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. MARKET REGIME & TREND */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all",
                              (signalData?.aiScore || 0) >= 50
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                : "bg-rose-500 border-rose-400 text-black shadow-lg",
                            )}
                          >
                            {signalData?.marketRegime === "RISK_ON" ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                              {signalData?.marketRegime === "RISK_ON"
                                ? "BOĞA (RISK-ON)"
                                : signalData?.marketRegime === "RISK_OFF"
                                  ? "AYI (RISK-OFF)"
                                  : "NÖTR"}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "inline-flex px-1.5 py-0.5 rounded border text-[9px] font-black uppercase mt-1 tracking-tighter",
                              signalData?.trend === "BULLISH"
                                ? "bg-emerald-500 border-emerald-400 text-white"
                                : signalData?.trend === "BEARISH"
                                  ? "bg-rose-500 border-rose-400 text-black"
                                  : "bg-slate-800 border-slate-700 text-slate-400",
                            )}
                          >
                            TREND:{" "}
                            {signalData?.trend === "BULLISH"
                              ? "YÜKSELİŞ"
                              : signalData?.trend === "BEARISH"
                                ? "DÜŞÜŞ"
                                : "NÖTR"}
                          </div>
                        </div>
                      </td>

                      {/* 6. WHALE & VOLATILITY */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        <div className="flex flex-col gap-1">
                          <div
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-0.5 rounded border transition-all",
                              signalData?.whaleDetected
                                ? signalData.whaleStatus === "BUY_ACTIVE" ||
                                  signalData.whaleStatus === "ACCUMULATING"
                                  ? "bg-emerald-500 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                  : "bg-rose-500 border-rose-400 text-black shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                : "bg-slate-800 border-slate-700 text-slate-500",
                            )}
                          >
                            <Fish className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase truncate tracking-tighter">
                              {signalData?.whaleDetected
                                ? signalData.whaleStatus?.replace("_", " ") ||
                                  "WHALE"
                                : "YOK"}
                            </span>
                          </div>
                          {/* Volatility */}
                          <div
                            className={cn(
                              "flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded border transition-all",
                              signalData?.volatilityRegime === "EXPLOSION" ||
                                signalData?.volatilityRegime === "SQUEEZE"
                                ? "bg-purple-500 border-purple-400 text-white animate-pulse"
                                : signalData?.volatilityRegime === "HIGH_VOL"
                                  ? "bg-amber-500 border-amber-400 text-black"
                                  : "bg-slate-800 border-slate-700 text-slate-500",
                            )}
                          >
                            <Activity className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase tracking-tighter">
                              {signalData?.volatilityRegime || "NORMAL"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 7. PREDICTION + SMART ANALYSIS — Tüm Alt Kollar */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        {(() => {
                          const sp = calculateSmartPrediction(signalData);
                          const pred = signalData?.prediction;
                          const adm = signalData?.adm;
                          const vpa = signalData?.vpa;
                          return (
                            <div className="flex flex-col gap-1 min-w-[160px]">
                              {/* Ana Karar Etiketi */}
                              <span className={`text-[9px] font-black leading-tight ${sp.verdictColor}`}>
                                {sp.label}
                              </span>

                              {/* Boğa/Ayı Puan Barı */}
                              <div className="flex gap-0.5 items-center">
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      sp.bulletScore >= 60 ? "bg-emerald-500" : sp.bulletScore <= 40 ? "bg-rose-500" : "bg-amber-500"
                                    }`}
                                    style={{ width: `${sp.bulletScore}%` }}
                                  />
                                </div>
                                <span className={`text-[8px] font-mono w-6 text-right font-bold ${
                                  sp.bulletScore >= 60 ? "text-emerald-400" : sp.bulletScore <= 40 ? "text-rose-400" : "text-amber-400"
                                }`}>{sp.bulletScore}%</span>
                              </div>

                              {/* UpProb / DownProb İkili Bar */}
                              {pred && (
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex gap-0.5 items-center">
                                    <div className="w-3 text-[7px] text-emerald-500 font-bold">↑</div>
                                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500/70 rounded-full transition-all" style={{ width: `${pred.upProb}%` }} />
                                    </div>
                                    <span className="text-[7px] text-emerald-400 font-mono w-6 text-right">{Math.round(pred.upProb)}%</span>
                                  </div>
                                  <div className="flex gap-0.5 items-center">
                                    <div className="w-3 text-[7px] text-rose-500 font-bold">↓</div>
                                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-rose-500/70 rounded-full transition-all" style={{ width: `${pred.downProb}%` }} />
                                    </div>
                                    <span className="text-[7px] text-rose-400 font-mono w-6 text-right">{Math.round(pred.downProb)}%</span>
                                  </div>
                                </div>
                              )}

                              {/* 4'lü Analiz Grubu (Yan Yana) */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {adm && adm.evidence && adm.evidence !== "YOK" && (
                                  <span className={`text-[7px] px-1 py-0.5 rounded border font-black whitespace-nowrap ${
                                    (adm.classification ?? 0) > 0
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  }`} title={`ADM: ${adm.bias}`}>
                                    ADM {adm.evidence}
                                  </span>
                                )}
                                {vpa && vpa.netPressure !== undefined && Math.abs(vpa.netPressure) > 10 && (
                                  <span className={`text-[7px] px-1 py-0.5 rounded border font-black whitespace-nowrap ${
                                    vpa.netPressure > 0
                                      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                                      : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                  }`} title={`VPA Baskı: ${vpa.netPressure?.toFixed(1)}`}>
                                    VPA {vpa.netPressure > 0 ? "+" : ""}{vpa.netPressure.toFixed(0)}
                                  </span>
                                )}
                                {(signalData?.f4ConfirmedBuy || signalData?.f4EarlyBuy ||
                                  signalData?.f4ConfirmedSell || signalData?.f4EarlySell) && (
                                  <span className={`text-[7px] font-black px-1 py-0.5 rounded border whitespace-nowrap ${
                                    signalData.f4ConfirmedBuy ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse" :
                                    signalData.f4EarlyBuy ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    signalData.f4ConfirmedSell ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse" :
                                    "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                  }`}>
                                    {signalData.f4ConfirmedBuy ? "✅ F4 ONAYLI" :
                                     signalData.f4EarlyBuy ? "🔔 F4 ERKEN" :
                                     signalData.f4ConfirmedSell ? "❌ F4 ONAYLI" : "🔕 F4 ERKEN"}
                                  </span>
                                )}
                                {signalData?.regimePrediction && signalData.regimePrediction !== "NORMAL" && (
                                  <span className={cn(
                                    "text-[7px] px-1 py-0.5 rounded border font-mono whitespace-nowrap transition-colors",
                                    signalData.regimePrediction.includes("YUKARI") || signalData.regimePrediction.includes("UP") || signalData.regimePrediction.includes("BULL") || signalData.regimePrediction.includes("BOTTOM")
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : signalData.regimePrediction.includes("AŞAĞI") || signalData.regimePrediction.includes("DOWN") || signalData.regimePrediction.includes("BEAR") || signalData.regimePrediction.includes("DROP") || signalData.regimePrediction.includes("EXHAUSTION")
                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                        : "bg-slate-800/40 text-slate-300 border-slate-700"
                                  )} title={signalData.regimePrediction}>
                                    📊 {signalData.regimePrediction.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>

                              {/* Tuzak Uyarısı */}
                              {(signalData?.aiComponents?.trapPenalty || 0) < 0 && (
                                <span className="text-[7px] text-rose-400 flex items-center gap-1 font-black">
                                  <AlertCircle className="w-2.5 h-2.5" /> TUZAK TESPİT
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* 8. DECISION + KILL SWITCH */}
                      <td className="px-3 py-2.5 text-center border-r border-slate-800/30">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md border w-full ${getDecisionStyle(signalData?.systemDecision || "WAIT")}`}
                          >
                            <span className="text-[10px] font-black tracking-wider">
                              {signalData?.systemDecision === "GO_LONG"
                                ? "LONG AÇ ✅"
                                : signalData?.systemDecision === "GO_SHORT"
                                  ? "SHORT AÇ 🔻"
                                  : "BEKLE ⏸"}
                            </span>
                          </div>
                          {signalData?.deathRisk && (
                            <span className="text-[8px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded px-1.5 py-0.5 font-black animate-pulse w-full text-center">
                              🛑 KILL SW
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. QUICK TRADE */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="relative group">
                            <CircleDollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 group-focus-within:text-cyan-400" />
                            <input
                              type="number"
                              value={tradeAmounts[fullSymbol] ?? ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setTradeAmounts((prev) => ({
                                  ...prev,
                                  [fullSymbol]: e.target.value,
                                }));
                              }}
                              className="w-20 bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1 text-[10px] pl-5 font-bold focus:outline-none focus:border-cyan-500/50 transition-colors"
                              placeholder="50"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickTrade(fullSymbol, "BUY");
                              }}
                              disabled={isTrading[fullSymbol]}
                              className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-black transition-all active:scale-95 disabled:opacity-50"
                            >
                              {isTrading[fullSymbol] ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <Zap className="w-2.5 h-2.5 fill-emerald-500/20" />
                              )}
                              AL
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTradeAmountToMax(fullSymbol, "BUY");
                              }}
                              className="px-1 text-[7px] text-emerald-500/60 hover:text-emerald-400 font-bold uppercase transition-colors"
                            >
                              MAX USDT
                            </button>
                          </div>
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickTrade(fullSymbol, "SELL");
                              }}
                              disabled={isTrading[fullSymbol]}
                              className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded text-[9px] font-black transition-all active:scale-95 disabled:opacity-50"
                            >
                              {isTrading[fullSymbol] ? (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <TrendingDown className="w-2.5 h-2.5" />
                              )}
                              SAT
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTradeAmountToMax(fullSymbol, "SELL");
                              }}
                              className="px-1 text-[7px] text-rose-500/60 hover:text-rose-400 font-bold uppercase transition-colors"
                            >
                              MAX ASSET
                            </button>
                          </div>
                          {tradeStatus[fullSymbol] && (
                            <div
                              className={`text-[8px] font-bold animate-in fade-in slide-in-from-right-2 duration-300 ${tradeStatus[fullSymbol]?.type === "success" ? "text-emerald-400" : "text-rose-400"}`}
                            >
                              {tradeStatus[fullSymbol]?.msg}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 10. EXPAND ICON */}
                      <td className="px-3 py-2.5 text-center">
                        {expandedRow === fullSymbol ? (
                          <ChevronUp className="w-4 h-4 text-cyan-400 mx-auto" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-cyan-500 transition-colors mx-auto" />
                        )}
                      </td>
                    </tr>

                    {/* EXPANDED DETAILS — GELİŞMİŞ SINYAL AÇIKLAMASI */}
                    {expandedRow === fullSymbol &&
                      (() => {
                        const sp = calculateSmartPrediction(signalData);
                        return (
                          <tr className="bg-slate-900/90 border-b border-slate-800/40">
                            <td colSpan={10} className="p-0">
                              <div className="p-4 space-y-4">
                                {/* KARAR BANNER */}
                                <div
                                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                                    sp.verdict === "AL"
                                      ? "bg-emerald-900/30 border-emerald-600/30"
                                      : sp.verdict === "SAT"
                                        ? "bg-rose-900/30 border-rose-600/30"
                                        : "bg-amber-900/20 border-amber-600/20"
                                  }`}
                                >
                                  <div className="flex-1">
                                    <div
                                      className={`text-sm font-black ${sp.verdictColor}`}
                                    >
                                      {sp.label}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                      {sp.explanation}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-center gap-1">
                                    <div
                                      className={`text-xl font-black ${sp.verdict === "AL" ? "text-emerald-400" : sp.verdict === "SAT" ? "text-rose-400" : "text-amber-400"}`}
                                    >
                                      {sp.bulletScore}
                                      <span className="text-xs">%</span>
                                    </div>
                                    <div className="text-[8px] text-slate-500 uppercase tracking-wider">
                                      Boğa Puanı
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  {/* BOĞA NEDENLERİ */}
                                  <div className="space-y-1.5">
                                    <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                      AL SİNYALLERİ ({sp.bullPoints.length})
                                    </div>
                                    {sp.bullPoints.length === 0 && (
                                      <div className="text-[9px] text-slate-600 italic">
                                        Boğa sinyali yok
                                      </div>
                                    )}
                                    {sp.bullPoints.map((p, i) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-1.5 text-[9px] font-mono text-emerald-300 bg-emerald-500/5 border border-emerald-500/10 rounded px-2 py-1 leading-relaxed"
                                      >
                                        <span className="text-emerald-500 mt-0.5">
                                          ▲
                                        </span>
                                        <span>{p}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* AYI NEDENLERİ */}
                                  <div className="space-y-1.5">
                                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                      SAT SİNYALLERİ ({sp.bearPoints.length})
                                    </div>
                                    {sp.bearPoints.length === 0 && (
                                      <div className="text-[9px] text-slate-600 italic">
                                        Ayı sinyali yok
                                      </div>
                                    )}
                                    {sp.bearPoints.map((p, i) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-1.5 text-[9px] font-mono text-rose-300 bg-rose-500/5 border border-rose-500/10 rounded px-2 py-1 leading-relaxed"
                                      >
                                        <span className="text-rose-500 mt-0.5">
                                          ▼
                                        </span>
                                        <span>{p}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* TEKNİK DETAYLAR */}
                                <div className="grid grid-cols-5 gap-3 text-[9px] font-mono border-t border-slate-800/50 pt-3">
                                  <div className="space-y-1">
                                    <div className="text-slate-500 uppercase tracking-wider font-bold">
                                      Rejim
                                    </div>
                                    <div
                                      className={`font-black ${signalData?.marketRegime === "RISK_ON" ? "text-emerald-400" : "text-rose-400"}`}
                                    >
                                      {signalData?.marketRegime || "-"}
                                    </div>
                                    <div className="text-slate-400">
                                      {signalData?.regimePrediction?.replace(
                                        /_/g,
                                        " ",
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-slate-500 uppercase tracking-wider font-bold">
                                      AI Katkısı
                                    </div>
                                    <div className="text-slate-300">
                                      Trend:{" "}
                                      <span className="text-white font-bold">
                                        +
                                        {signalData?.aiComponents
                                          ?.trendAlignment || 0}
                                      </span>
                                    </div>
                                    <div className="text-slate-300">
                                      Hacim:{" "}
                                      <span className="text-white font-bold">
                                        +
                                        {signalData?.aiComponents
                                          ?.volumePower || 0}
                                      </span>
                                    </div>
                                    <div className="text-slate-300">
                                      Balina:{" "}
                                      <span className="text-amber-400 font-bold">
                                        +
                                        {signalData?.aiComponents
                                          ?.whaleConfirmed || 0}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-slate-500 uppercase tracking-wider font-bold">
                                      Likidite
                                    </div>
                                    <div
                                      className={
                                        signalData?.liquidityZone?.includes(
                                          "BOĞA",
                                        )
                                          ? "text-emerald-400 font-bold"
                                          : signalData?.liquidityZone?.includes(
                                                "AYI",
                                              )
                                            ? "text-rose-400 font-bold"
                                            : "text-slate-500"
                                      }
                                    >
                                      {signalData?.liquidityZone || "YOK"}
                                    </div>
                                    <div className="text-slate-400">
                                      Güç Kaybı:{" "}
                                      <span
                                        className={
                                          (signalData?.f4PowerLoss ?? 0) > 50
                                            ? "text-rose-400 font-bold"
                                            : "text-emerald-400 font-bold"
                                        }
                                      >
                                        %
                                        {(signalData?.f4PowerLoss ?? 0).toFixed(
                                          0,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-slate-500 uppercase tracking-wider font-bold">
                                      VPA / ADM
                                    </div>
                                    <div
                                      className={
                                        signalData?.vpa?.state ===
                                        "ALIM BASKISI"
                                          ? "text-emerald-400"
                                          : signalData?.vpa?.state ===
                                              "SATIM BASKISI"
                                            ? "text-rose-400"
                                            : "text-slate-400"
                                      }
                                    >
                                      {signalData?.vpa?.state || "NÖTR"}
                                    </div>
                                    <div className="text-slate-400">
                                      {signalData?.adm?.bias || "-"}
                                    </div>
                                  </div>
                                  <div className="space-y-1 border-l border-slate-700/50 pl-3">
                                    <div className="text-cyan-500 uppercase tracking-wider font-bold flex items-center justify-between">
                                      <span>V5.4 Motoru</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewDetailAsset({
                                            symbol: assetName,
                                            price: currentPrice,
                                            score: signalData?.aiScore || 0,
                                            decision:
                                              signalData?.systemDecision ||
                                              "WAIT",
                                            prediction:
                                              signalData?.prediction?.text ||
                                              signalData?.regimePrediction ||
                                              "NÖTR",
                                            trap:
                                              // trapPenalty < 0 is the actual engine-side trap signal
                                              (signalData?.aiComponents?.trapPenalty ?? 0) < 0,
                                            smc: signalData?.smc,
                                            vpa: signalData?.vpa,
                                            adm: signalData?.adm,
                                            liquidity: signalData?.liquidity,
                                            whaleTrust: signalData?.whaleTrust,
                                          });
                                        }}
                                        className="px-1.5 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[8px]"
                                      >
                                        TAM
                                      </button>
                                    </div>
                                    <div
                                      className={
                                        signalData?.f4EarlyBuy ||
                                        signalData?.f4ConfirmedBuy
                                          ? "text-emerald-400 font-bold animate-pulse"
                                          : signalData?.f4EarlySell ||
                                              signalData?.f4ConfirmedSell
                                            ? "text-rose-400 font-bold animate-pulse"
                                            : "text-slate-500"
                                      }
                                    >
                                      {signalData?.f4ConfirmedBuy
                                        ? "✅ ONAYLI AL"
                                        : signalData?.f4EarlyBuy
                                          ? "🔔 ERKEN AL"
                                          : signalData?.f4ConfirmedSell
                                            ? "❌ ONAYLI SAT"
                                            : signalData?.f4EarlySell
                                              ? "🔕 ERKEN SAT"
                                              : "⏸ BEKLE"}
                                    </div>
                                    <div className="text-slate-400">
                                      Z-Score:{" "}
                                      <span
                                        className={
                                          Math.abs(
                                            signalData?.zScoreValue || 0,
                                          ) > 2
                                            ? "text-amber-400 font-bold"
                                            : "text-white"
                                        }
                                      >
                                        {(signalData?.zScoreValue || 0).toFixed(
                                          2,
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center text-[9px] text-slate-600 font-mono uppercase">
        <span>Matrix Portföy // AKTİF</span>
        <span>SYNC: {lastSyncTime}</span>
      </div>
      </div>

      {/* CHART MODAL */}
      {selectedChartSymbol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#131722] w-full max-w-6xl h-[80vh] rounded-xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-[#1e222d]">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-slate-200">
                  {selectedChartSymbol} / USDT
                </span>
                <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 font-mono">
                  TradingViewEmbedChart
                </span>
              </div>
              <button
                onClick={() => setSelectedChartSymbol(null)}
                className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 relative">
              <TradingViewEmbedChart
                symbol={selectedChartSymbol}
                theme="dark"
                height={window.innerHeight * 0.75}
              />
            </div>
          </div>
        </div>
      )}

      {/* ASSET DETAIL MODAL */}
      {viewDetailAsset && (
        <AssetDetailModal
          isOpen={!!viewDetailAsset}
          onClose={() => setViewDetailAsset(null)}
          symbol={viewDetailAsset.symbol}
          currentPrice={viewDetailAsset.price}
          f4Score={viewDetailAsset.score}
          f4Decision={viewDetailAsset.decision}
          f4Prediction={viewDetailAsset.prediction}
          trapWarning={viewDetailAsset.trap}
        />
      )}
    </div>
  );
}
