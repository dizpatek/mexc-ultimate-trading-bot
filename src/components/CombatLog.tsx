"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import {
  Terminal,
  Activity,
  Crosshair,
  Zap,
  Radar,
  Target,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { extractBaseAsset } from "@/lib/symbol-utils";
import { useTrade } from "@/context/TradeContext";
import { useTimeframe } from "@/context/TimeframeContext";
import { useHoldings } from "../hooks/usePortfolio";
import {
  useCombatLogs,
  LogEntry,
  deduplicateSystemLogs,
  filterSignalsByHoldings,
} from "../hooks/useCombatLogs";

const DEFAULT_SYSTEM_LOGS: LogEntry[] = [
  {
    id: "def-1",
    timestamp: Date.now() - 5000,
    type: "SYSTEM",
    message: "Veri akışı optimize edildi, ağ senkronizasyonu tamamlandı.",
    level: "SUCCESS",
  },
  {
    id: "def-2",
    timestamp: Date.now() - 15000,
    type: "SYSTEM",
    message: "Yedek sunucular bekleme konumuna alındı.",
    level: "INFO",
  },
  {
    id: "def-3",
    timestamp: Date.now() - 25000,
    type: "SYSTEM",
    message: "API hız sınırları kontrol edildi: Optimal.",
    level: "INFO",
  },
  {
    id: "def-4",
    timestamp: Date.now() - 35000,
    type: "SYSTEM",
    message: "Güvenlik duvarı güncellendi, yeni protokoller devrede.",
    level: "WARN",
  },
  {
    id: "def-5",
    timestamp: Date.now() - 45000,
    type: "SYSTEM",
    message: "Piyasa dalgalanma analizi arka planda algılandı.",
    level: "INFO",
  },
  {
    id: "def-6",
    timestamp: Date.now() - 55000,
    type: "SYSTEM",
    message: "Veritabanı bağlantısı kuruldu, gecikme < 5ms.",
    level: "SUCCESS",
  },
  {
    id: "def-7",
    timestamp: Date.now() - 65000,
    type: "SYSTEM",
    message: "Matrix Engine v5.3.4 ALPHA sistem başlangıcı yapıldı.",
    level: "INFO",
  },
];

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
  // Filter mode: 'ALL' or 'ASSETS' (only signals related to held assets)
  const [signalFilter, setSignalFilter] = useState<"ALL" | "ASSETS">("ASSETS");

  const tradeLogs = useMemo(
    () => logs.filter((l: LogEntry) => l.type !== "SYSTEM"),
    [logs],
  );

  const filteredTradeLogs = useMemo(() => {
    if (signalFilter === "ALL") return tradeLogs;
    return filterSignalsByHoldings(tradeLogs, holdings ?? undefined);
  }, [tradeLogs, signalFilter, holdings]);

  const systemLogs = useMemo(
    () => deduplicateSystemLogs(logs, DEFAULT_SYSTEM_LOGS),
    [logs],
  );

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

  const getSystemLogStyle = (level?: string) => {
    switch (level) {
      case "ERROR":
        return {
          text: "text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/20",
          icon: "text-rose-500",
        };
      case "WARN":
        return {
          text: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          icon: "text-amber-500",
        };
      case "SUCCESS":
        return {
          text: "text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          icon: "text-emerald-500 glow-text-emerald",
        };
      case "INFO":
        return {
          text: "text-cyan-400",
          bg: "bg-transparent",
          border: "border-transparent",
          icon: "text-cyan-500",
        };
      default:
        return {
          text: "text-slate-400",
          bg: "bg-transparent",
          border: "border-transparent",
          icon: "text-slate-600",
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
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
              {/* Filter Toggle */}
              <span className="text-[8px] text-slate-700 font-black ml-1">
                link:
              </span>
              <button
                onClick={() => setSignalFilter("ASSETS")}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border",
                  signalFilter === "ASSETS"
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600",
                )}
              >
                Assets
              </button>
              <button
                onClick={() => setSignalFilter("ALL")}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all border",
                  signalFilter === "ALL"
                    ? "bg-slate-700 border-slate-500 text-slate-300"
                    : "bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600",
                )}
              >
                All
              </button>
            </div>
          </div>
          <div
            ref={tradeScrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-[11px] custom-scrollbar"
          >
            {isLoadingHoldings && signalFilter === "ASSETS" ? (
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
                    : signalFilter === "ASSETS"
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
            className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono text-[10px] custom-scrollbar"
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
                const style = getSystemLogStyle(log.level);
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex gap-2 group p-1.5 rounded transition-colors border",
                      style.bg,
                      style.border,
                    )}
                  >
                    <span className="text-slate-600 shrink-0 select-none opacity-70">
                      [
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                      ]
                    </span>
                    <span
                      className={cn(
                        "shrink-0 select-none font-bold",
                        style.icon,
                      )}
                    >
                      {">"}_{" "}
                    </span>
                    <span
                      className={cn(
                        "flex-1 break-word drop-shadow-sm",
                        style.text,
                      )}
                    >
                      {log.message}
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
    trade.setTpEnabled(true);
    trade.setSlEnabled(true);
    trade.setIsPanelOpen(true);
    // scrollToTrade handles pending case via context state - no setTimeout needed
    trade.scrollToTrade("UNITS");
  };

  return (
    <div className="group flex gap-2.5 animate-in fade-in slide-in-from-left-1 duration-300 hover:bg-white/5 p-1 rounded transition-colors relative">
      <div className="text-slate-600 shrink-0 select-none opacity-50 text-[10px] mt-0.5 min-w-[50px]">
        {new Date(log.timestamp).toLocaleTimeString([], {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </div>
      <div className="mt-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-all">
        {icon}
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "font-black tracking-tight flex items-center gap-2",
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
              <span className="text-[8px] bg-amber-400/10 px-1 border border-amber-400/20 rounded">
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
          </span>

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
        {log.details && (
          <span className="text-slate-500 text-[10px] truncate opacity-70 group-hover:opacity-100 transition-opacity">
            {log.details}
          </span>
        )}
      </div>
    </div>
  );
};
