"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import {
  Terminal,
  Activity,
  Crosshair,
  Zap,
  Clock,
  Radar,
  Target,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractBaseAsset } from "@/lib/symbol-utils";
import { useTrade } from "@/context/TradeContext";
import { useTimeframe } from "@/context/TimeframeContext";
import { useHoldings } from "../hooks/usePortfolio";
import { useBotConfig } from "../hooks/useBotConfig";
import {
  useCombatLogs,
  LogEntry,
  deduplicateSystemLogs,
  filterSignalsByHoldings,
} from "../hooks/useCombatLogs";


export const CombatLog = () => {
  const { timeframe } = useTimeframe();
  const {
    logs,
    scanStatus,
    lastScanTime,
    isLoading,
    error,
    fetchLogs,
    triggerScan,
  } = useCombatLogs(timeframe);
  const tradeScrollRef = useRef<HTMLDivElement>(null);
  const systemScrollRef = useRef<HTMLDivElement>(null);
  const trade = useTrade();
  const { data: holdings, isLoading: isLoadingHoldings } = useHoldings();
  const { config } = useBotConfig();

  const tradeLogs = useMemo(
    () =>
      logs.filter((l: LogEntry) => {
        if (l.type === "SYSTEM") return false;
        // Filter by specific timeframe if available, otherwise consider it Global
        if (
          l.timeframe &&
          l.timeframe.toLowerCase() !== "global" &&
          l.timeframe.toLowerCase() !== "system" &&
          l.timeframe.toLowerCase() !== timeframe.toLowerCase()
        ) {
          return false;
        }
        return true;
      }),
    [logs, timeframe],
  );

  const filteredTradeLogs = useMemo(() => {
    // Determine filter mode based on bot config (pilot_only_holdings)
    // If setting is ON, we only show held assets. Otherwise, show ALL.
    const effectiveFilter = config?.pilot_only_holdings ? "ASSETS" : "ALL";
    
    if (effectiveFilter === "ALL") return tradeLogs;
    return filterSignalsByHoldings(tradeLogs, holdings ?? undefined);
  }, [tradeLogs, config?.pilot_only_holdings, holdings]);

  const systemLogs = useMemo(() => {
    const sortedLogs = deduplicateSystemLogs(logs.filter((l) => l.type === "SYSTEM"));
    
    // Group identical consecutive logs
    const groups: (LogEntry & { count?: number })[] = [];
    sortedLogs.forEach((log) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.message === log.message && lastGroup.sentiment === log.sentiment) {
        lastGroup.count = (lastGroup.count || 1) + 1;
        // Keep the latest timestamp for the group
        lastGroup.timestamp = Math.max(lastGroup.timestamp, log.timestamp);
      } else {
        groups.push({ ...log, count: 1 });
      }
    });

    return groups;
  }, [logs]);

  const tradeLogsLength = tradeLogs.length;
  const systemLogsLength = systemLogs.length;

  useEffect(() => {
    if (tradeScrollRef.current) tradeScrollRef.current.scrollTop = 0;
  }, [tradeLogsLength]);

  useEffect(() => {
    if (systemScrollRef.current) systemScrollRef.current.scrollTop = 0;
  }, [systemLogsLength]);

  const getIcon = (type: string) => {
    switch (type) {
      case "EXECUTION":
        return (
          <Zap className="w-3 h-3 text-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
        );
      case "WHALE_ALERT":
        return <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />;
      case "AI_DECISION":
        return <Crosshair className="w-3 h-3 text-purple-400" />;
      case "STRUCTURE":
        return <Crosshair className="w-3 h-3 text-amber-400" />;
      case "F4_SIGNAL":
        return <Zap className="w-3 h-3 text-emerald-400" />;
      case "SYSTEM":
        return <Terminal className="w-3 h-3 text-blue-400" />;
      default:
        return <Terminal className="w-3 h-3 text-slate-500" />;
    }
  };

  const getSystemLogStyle = (sentiment?: string) => {
    switch (sentiment) {
      case "POSITIVE":
        return {
          text: "text-emerald-400 font-bold",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          icon: "text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]",
          glow: "shadow-[inset_0_0_12px_rgba(16,185,129,0.05)]",
        };
      case "NEGATIVE":
        return {
          text: "text-rose-400 font-bold",
          bg: "bg-rose-500/10",
          border: "border-rose-500/30",
          icon: "text-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]",
          glow: "shadow-[inset_0_0_12px_rgba(244,63,94,0.05)]",
        };
      case "NEUTRAL":
      default:
        return {
          text: "text-slate-300",
          bg: "bg-slate-800/20",
          border: "border-slate-700/30",
          icon: "text-slate-500",
          glow: "",
        };
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[600px] bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
      {/* Main Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/10 p-1.5 rounded-lg border border-cyan-500/20">
            <Terminal className="w-4 h-4 text-cyan-500" />
          </div>
          <h3 className="text-[10px] font-black text-cyan-100 uppercase tracking-[0.3em]">
            Combat Dual Terminal v2.4
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {/* Interactive Scan Button (P3 Fix) */}
          <button
            onClick={() => triggerScan()}
            disabled={scanStatus === "scanning"}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider transition-all shadow-inner",
              scanStatus === "scanning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-wait"
                : scanStatus === "done"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 active:scale-95"
                  : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300 active:scale-95",
            )}
          >
            <Radar
              className={cn(
                "w-3 h-3",
                scanStatus === "scanning" && "animate-spin",
              )}
            />
            {scanStatus === "scanning" ? "TARANIYOR" : "TARA"}
          </button>
          <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-slate-950 border border-white/5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
              LIVE SYNC
            </span>
          </div>
        </div>
      </div>

      {/* Content Area - Dual Split */}
      <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
        {/* LEFT: SIGNAL FEED */}
        <div className="flex-1 flex flex-col bg-slate-950/20 max-w-[50%]">
          <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Zap size={10} className="text-yellow-400" /> Sinyal Akışı
            </span>
            <div className="flex items-center gap-1.5">
              {lastScanTime && (
                <span className="text-[8px] text-slate-700 font-mono">
                  Son:{" "}
                  {new Date(lastScanTime).toLocaleTimeString([], {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
          <div
            ref={tradeScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-[11px] cyber-scrollbar"
          >
            {isLoadingHoldings && config?.pilot_only_holdings ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                <Activity size={12} className="opacity-20 animate-spin" />
                <div>VARLIKLAR SENKRONİZE EDİLİYOR...</div>
                <div className="text-[8px] text-slate-800/50 mt-1">
                  Lütfen Bekleyin · Canlı Senkronizasyon
                </div>
              </div>
            ) : filteredTradeLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                <Radar
                  className={cn(
                    "w-6 h-6 opacity-30",
                    scanStatus === "scanning" && "animate-spin",
                  )}
                />
                <div>
                  {scanStatus === "scanning"
                    ? "SİNYALLER TARANIYOR..."
                    : config?.pilot_only_holdings
                      ? "VARLIKLARINIZLA EŞLEŞMEDİ"
                      : "SİNYAL HATTI ANALİZ EDİLİYOR..."}
                </div>
                <div className="text-[8px] text-slate-800/50 mt-1">
                  Dinamik Tarama · 1dk aralık · 60sn döngü
                </div>
              </div>
            ) : (
              filteredTradeLogs.map((log: LogEntry) => {
                const isHeld = holdings?.some(
                  (h) =>
                    h.symbol !== "USDT" &&
                    h.symbol !== "USDC" &&
                    log.assetSymbol &&
                    extractBaseAsset(log.assetSymbol) ===
                      extractBaseAsset(h.symbol),
                );
                return (
                  <LogLine
                    key={log.id}
                    log={log}
                    icon={getIcon(log.type)}
                    isHeld={!!isHeld}
                    trade={trade}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: SYSTEM CONSOLE */}
        <div className="flex-1 flex flex-col bg-slate-900/10">
          <div className="px-3 py-1.5 bg-slate-900/30 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Activity size={10} className="text-blue-400" /> Sistem Konsolu
            </span>
          </div>
          <div
            ref={systemScrollRef}
            className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono text-[10px] cyber-scrollbar"
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                <Activity size={12} className="opacity-20 animate-spin" />
                <div>KONSOL BAŞLATILIYOR...</div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-rose-800/50 text-[9px] uppercase tracking-[0.2em] gap-2">
                <AlertTriangle size={12} className="text-rose-500/30" />
                <div>{error}</div>
                <button
                  onClick={() => fetchLogs()}
                  className="mt-1 text-[8px] text-cyan-500/50 hover:text-cyan-400 font-black"
                >
                  VENİDEN DENE
                </button>
              </div>
            ) : systemLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-800 text-[9px] uppercase tracking-[0.2em] gap-2">
                <Activity size={12} className="opacity-20 h-3" />
                <div>SİSTEM BEKLEMEDE</div>
              </div>
            ) : (
              systemLogs.map((log) => {
                const style = getSystemLogStyle(log.sentiment);
                const isGroup = (log as any).count > 1;
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-start justify-between gap-3 group p-2 rounded transition-all border animate-in fade-in slide-in-from-right-1 duration-200",
                      style.bg,
                      style.border,
                      style.glow
                    )}
                  >
                    <div className="flex gap-2 min-w-0">
                      <span
                        className={cn(
                          "shrink-0 select-none font-bold opacity-80 mt-0.5",
                          style.icon,
                        )}
                      >
                        {">"}_{" "}
                      </span>
                      <span
                        className={cn(
                          "flex-1 break-word",
                          style.text,
                        )}
                      >
                        {log.message}
                        {isGroup && (
                          <span className="ml-2 px-1 rounded bg-white/10 text-[9px] font-black tracking-tighter align-middle">
                            x{(log as any).count}
                          </span>
                        )}
                      </span>
                    </div>

                    <span className="text-slate-600 shrink-0 select-none opacity-40 text-[8px] font-mono mt-0.5 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Input Overlay */}
      <div className="px-4 py-1.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-cyan-500 font-black">{">"}</span>
          <input
            type="text"
            placeholder="Matrix kernel scan active..."
            className="bg-transparent border-none outline-none text-[10px] text-slate-500 placeholder:text-slate-800 w-full font-mono uppercase tracking-widest"
            disabled
          />
        </div>
        <div className="text-[9px] font-black text-slate-700 tracking-[0.2em]">
          MATRIX V5.3.4 ALPHA
        </div>
      </div>
    </div>
  );
};

const LogLine = ({
  log,
  icon,
  isHeld,
  trade,
}: {
  log: LogEntry;
  icon: React.ReactNode;
  isHeld: boolean;
  trade: ReturnType<typeof useTrade>;
}) => {
  const isExecution = log.type === "EXECUTION";
  const isF4 = log.type === "F4_SIGNAL";

  // Extract symbol for buttons
  const symbolMatch = log.message.match(/([A-Z0-9]+USDT)/);
  const asset = symbolMatch ? symbolMatch[1] : null;

  const handleTrade = (direction: "BUY" | "SELL") => {
    if (!asset) return;
    const assetSymbol = `${asset.replace("USDT", "")}/USDT`;
    trade.setSymbol(assetSymbol);
    trade.setMode(direction === "BUY" ? "TRADE" : "COVER");
    
    if (direction === "SELL" && isHeld) {
      trade.setUseExisting(true);
      // We don't have the exact amount here, but setting useExisting(true) 
      // will allow SmartTrade to show the 'MAX' button and existing balance.
    } else {
      trade.setUseExisting(false);
      trade.setAmount("0");
      trade.setAllocationPercent(0);
    }

    trade.setTpEnabled(true);
    trade.setSlEnabled(true);
    trade.setIsTradeFormOpen(true);
    trade.scrollToTrade("UNITS");
  };

  return (
    <div className="group flex gap-2.5 animate-in fade-in slide-in-from-left-1 duration-300 hover:bg-white/5 p-1 rounded transition-colors relative">
      <div className="mt-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-all">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "font-black tracking-tight flex items-center gap-2 truncate",
                log.sentiment === "POSITIVE"
                  ? "text-emerald-400"
                  : log.sentiment === "NEGATIVE"
                    ? "text-rose-400"
                    : log.type === "WHALE_ALERT"
                      ? "text-cyan-400"
                      : "text-slate-300",
              )}
            >
              {log.message}
            </span>
            <span className="text-slate-600 font-mono text-[9px] opacity-40 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString([], {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isExecution && (
              <span
                className={cn(
                  "text-[8px] px-1 border rounded animate-pulse",
                  log.sentiment === "POSITIVE"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : log.sentiment === "NEGATIVE"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-yellow-400/10 border-yellow-400/20 text-yellow-400",
                )}
              >
                {log.sentiment === "POSITIVE"
                  ? "BUY"
                  : log.sentiment === "NEGATIVE"
                    ? "SELL"
                    : "TRADE"}
              </span>
            )}
            {log.type === "STRUCTURE" && (
              <span className="text-[8px] bg-amber-400/10 px-1 border border-amber-400/20 rounded text-amber-500">
                SMC
              </span>
            )}
            {isF4 && (
              <span
                className={cn(
                  "text-[8px] px-1 border rounded",
                  log.sentiment === "POSITIVE"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : log.sentiment === "NEGATIVE"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-slate-800 border-slate-700 text-slate-400",
                )}
              >
                F4
              </span>
            )}
            {isHeld && (
              <Target size={10} className="text-blue-500 animate-pulse" />
            )}
          </div>

          {/* Quick Trade Buttons */}
          {asset && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => handleTrade("BUY")}
                className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black hover:bg-emerald-500/20 transition-colors"
              >
                AL
              </button>
              <button
                onClick={() => handleTrade("SELL")}
                className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[8px] font-black hover:bg-rose-500/20 transition-colors"
              >
                SAT
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {/* Strategy / Source Badge */}
          {log.strategyName && (
            <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-tight flex items-center gap-1 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 shadow-[0_0_5px_rgba(6,182,212,0.1)]">
              <Activity size={10} className="text-cyan-400" /> {log.strategyName}
            </span>
          )}

          {/* Timeframe Badge (Fallback if not in message) */}
          {log.timeframe && (
            <span className="text-[9px] bg-slate-800/60 border border-slate-700/50 text-slate-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
               <Clock size={9} /> {log.timeframe}
            </span>
          )}

          {/* F4 POWER BADGE (GIGA MASTER) */}
          {log.meta?.f4Power !== undefined && (
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1 shadow-sm",
                Math.abs(log.meta.f4Power) >= 70 ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-cyan-500/20" :
                Math.abs(log.meta.f4Power) >= 40 ? "bg-blue-500/15 border-blue-500/30 text-blue-300" :
                "bg-slate-800/40 border-slate-700 text-slate-400"
              )}>
                <Zap size={10} fill={Math.abs(log.meta.f4Power) >= 70 ? "currentColor" : "none"} />
                F4: {Math.round(log.meta.f4Power)}%
              </span>
              
              {log.meta.f4PowerLoss !== undefined && log.meta.f4PowerLoss > 20 && (
                <span className="text-[8px] text-rose-400 font-bold animate-pulse">
                  -{Math.round(log.meta.f4PowerLoss)}% GÜÇ KAYBI
                </span>
              )}
            </div>
          )}

          {/* AI SCORE */}
          {log.meta?.aiScore !== undefined && (
            <span className={cn(
              "text-[9px] font-black px-1.5 py-0.5 rounded border flex items-center gap-1",
              log.meta.aiScore >= 80 ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10" :
              log.meta.aiScore >= 50 ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
              "bg-rose-500/10 border-rose-500/30 text-rose-400"
            )}>
              AI: {Math.round(log.meta.aiScore)}
            </span>
          )}

          {/* REGIME */}
          {log.meta?.regime && (
            <span className="text-[9px] bg-purple-500/10 border border-purple-500/30 text-purple-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-sm shadow-purple-500/5">
              RGM: {log.meta.regime.replace(/_/g, " ")}
            </span>
          )}

          {/* MTF VERDICT */}
          {log.meta?.mtf && (
            <span className="text-[9px] bg-blue-500/10 border border-blue-500/30 text-blue-300 font-bold px-1.5 py-0.5 rounded">
              MTF: {log.meta.mtf}
            </span>
          )}

          {/* PREDICTION */}
          {log.meta?.prediction && (
            <span className="text-[9px] bg-slate-800/80 border border-slate-700 text-slate-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
              {log.meta.prediction}
            </span>
          )}

          {/* VETO REASON */}
          {log.meta?.veto && (
            <span className="text-[9px] bg-amber-900/20 border border-amber-500/30 text-amber-500/90 italic px-1.5 py-0.5 rounded flex items-center gap-1 border-dashed">
              <AlertTriangle size={9} /> {log.meta.veto}
            </span>
          )}

          {/* RAW DETAILS (Fallback) */}
          {log.details && !log.meta?.veto && (
            <span className="text-slate-500 text-[9px] break-words opacity-60 italic">
              {log.details}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
