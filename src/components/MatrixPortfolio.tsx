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

export function MatrixPortfolio() {
  // 1. Portfolio Data
  const { data: holdings, isLoading: isHoldingsLoading } = useHoldings();
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
      <div className="flex justify-between items-center p-3 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center text-[10px] gap-3">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700 ${isConnected ? "text-emerald-400 border-emerald-500/20" : "text-rose-400 border-rose-500/20"}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
            />
            <span className="font-bold tracking-wide">
              {isConnected ? "SOKET: ÇEVRİMİÇİ" : "SOKET: ÇEVRİMDIŞI"}
            </span>
            {isLoadingSignals && (
              <div className="ml-2 flex items-center gap-1 border-l border-slate-700 pl-2 text-cyan-400">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                <span className="animate-pulse text-[9px]">SYNC</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/50 shadow-inner">
            {intervals.map((item) => (
              <button
                key={item.id}
                onClick={() => setIntervalState(item.id)}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-bold rounded transition-all duration-200",
                  interval === item.id
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.1)]"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-bold text-slate-500 tracking-widest px-2 py-1 bg-slate-950 rounded border border-slate-800">
            Matrix Portföy
          </div>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-800/40">
          <thead className="bg-slate-900/60 backdrop-blur-md sticky top-0 z-10 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3 text-left border-r border-slate-800/40">
                VARLIK
              </th>
              <th className="px-3 py-3 text-right border-r border-slate-800/40">
                PORTFÖY
              </th>
              <th className="px-3 py-3 text-right border-r border-slate-800/40">
                FİYAT / DEĞİŞİM
              </th>
              <th className="px-3 py-3 text-left border-r border-slate-800/40 w-[140px]">
                AI SKOR & GÜÇ
              </th>
              <th className="px-3 py-3 text-left border-r border-slate-800/40">
                PİYASA REJİMİ
              </th>
              <th className="px-3 py-3 text-left border-r border-slate-800/40">
                BALİNA & VOLATİLİTE
              </th>
              <th className="px-3 py-3 text-left border-r border-slate-800/40">
                TAHMİN
              </th>
              <th className="px-3 py-3 text-center border-r border-slate-800/40 text-[10px]">
                KARAR
              </th>
              <th className="px-3 py-3 text-center border-slate-800/40">
                HIZLI İŞLEM (USDT)
              </th>
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
              holdings?.map((holding) => {
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
                              window.open(
                                `https://www.mexc.com/exchange/${assetName}_USDT`,
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
                              {signalData?.aiScore || 0}/100
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
                                ? signalData.whaleStatus === "ALIM_AKTİF" ||
                                  signalData.whaleStatus === "RALLİ_HAZIRLIĞI"
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
                              signalData?.volatilityRegime === "PATLAMA" ||
                                signalData?.volatilityRegime === "SIKIŞTIRMA"
                                ? "bg-purple-500 border-purple-400 text-white animate-pulse"
                                : signalData?.volatilityRegime === "YÜKSEK_VOL"
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

                      {/* 7. PREDICTION + SMART ANALYSIS */}
                      <td className="px-3 py-2.5 border-r border-slate-800/30">
                        {(() => {
                          const sp = calculateSmartPrediction(signalData);
                          return (
                            <div className="flex flex-col gap-1 min-w-[130px]">
                              {/* Ana etiket */}
                              <span
                                className={`text-[9px] font-black leading-tight ${sp.verdictColor}`}
                              >
                                {sp.label}
                              </span>
                              {/* Bull/bear yüzdesi bar */}
                              <div className="flex gap-0.5 items-center">
                                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      sp.bulletScore >= 60
                                        ? "bg-emerald-500"
                                        : sp.bulletScore <= 40
                                          ? "bg-rose-500"
                                          : "bg-amber-500"
                                    }`}
                                    style={{ width: `${sp.bulletScore}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-[8px] font-mono w-7 text-right font-bold ${
                                    sp.bulletScore >= 60
                                      ? "text-emerald-400"
                                      : sp.bulletScore <= 40
                                        ? "text-rose-400"
                                        : "text-amber-400"
                                  }`}
                                >
                                  {sp.bulletScore}%
                                </span>
                              </div>
                              {/* Up prob mini bar */}
                              {signalData?.prediction && (
                                <div className="flex gap-0.5 items-center">
                                  <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-cyan-500/70 rounded-full"
                                      style={{
                                        width: `${signalData.prediction.upProb}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-[8px] text-cyan-500 font-mono w-7 text-right">
                                    {Math.round(signalData.prediction.upProb)}%↑
                                  </span>
                                </div>
                              )}
                              {/* Tepe/dip sinyal özeti */}
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {sp.bullPoints
                                  .slice(0, 2)
                                  .map((p: string, i: number) => (
                                    <span
                                      key={i}
                                      className="text-[7px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/15 leading-tight max-w-[120px] truncate"
                                      title={p}
                                    >
                                      {p}
                                    </span>
                                  ))}
                                {sp.bearPoints
                                  .slice(0, 2)
                                  .map((p: string, i: number) => (
                                    <span
                                      key={i}
                                      className="text-[7px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded border border-rose-500/15 leading-tight max-w-[120px] truncate"
                                      title={p}
                                    >
                                      {p}
                                    </span>
                                  ))}
                              </div>
                              {(signalData?.aiComponents?.trapPenalty || 0) <
                                0 && (
                                <span className="text-[9px] text-rose-400 flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> TUZAK
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
                    </tr>

                    {/* EXPANDED DETAILS — GELİŞMİŞ SINYAL AÇIKLAMASI */}
                    {expandedRow === fullSymbol &&
                      (() => {
                        const sp = calculateSmartPrediction(signalData);
                        return (
                          <tr className="bg-slate-900/90 border-b border-slate-800/40">
                            <td colSpan={9} className="p-0">
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
                                              signalData?.whaleStatus ===
                                                "TUZAK" ||
                                              (signalData?.aiComponents
                                                ?.trapPenalty ?? 0) < 0,
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
        <span>SYNC: {new Date().toLocaleTimeString()}</span>
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
