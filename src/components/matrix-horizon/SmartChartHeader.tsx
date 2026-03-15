"use client";

import React from "react";
import { Target, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { AssetIcon } from "@/components/AssetIcon";
import { cn } from "@/lib/utils";
import type { Holding } from "@/services/api";

interface SmartChartHeaderProps {
  compact: boolean;
  symbol: string;
  currentPrice: number;
  assets: Holding[];
  onAssetChange?: (asset: Holding) => void;
  timeframe: string;
  setTimeframe: (tf: string) => void;
  focusOnPrices: () => void;
  startScroll: (dir: "left" | "right") => void;
  stopScroll: () => void;
  assetScrollRef: React.RefObject<HTMLDivElement | null>;
  isLoading?: boolean;
  historyLoading?: boolean;
  showChart?: boolean;
  onToggleChart?: () => void;
}

export const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
  { label: "1w", value: "1w" },
  { label: "1M", value: "1M" },
];

export const SmartChartHeader: React.FC<SmartChartHeaderProps> = ({
  compact,
  symbol,
  currentPrice,
  assets,
  onAssetChange,
  timeframe,
  setTimeframe,
  focusOnPrices,
  startScroll,
  stopScroll,
  assetScrollRef,
  isLoading,
  historyLoading,
  showChart,
  onToggleChart,
}) => {
  if (compact) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full px-2 py-1.5 sm:py-0">
      {/* Current Price Indicator & Assets List */}
      <div className="w-full sm:flex-1 flex items-center gap-3 sm:gap-4 min-w-0">
        {currentPrice > 0 ? (
          <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-slate-800/50 flex-shrink-0">
            <AssetIcon
              symbol={symbol}
              size={24}
              className="relative z-10 shadow-lg"
            />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0">
                {symbol}
              </span>
              <div className="flex items-center gap-1.5 px-1.5 py-0 rounded-lg bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl">
                <span className="text-xs font-black text-amber-400 font-mono leading-tight">
                  {currentPrice > 0
                    ? currentPrice < 1
                      ? currentPrice.toFixed(4)
                      : currentPrice < 100
                        ? currentPrice.toFixed(2)
                        : currentPrice.toFixed(0)
                    : "---"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[42px] flex items-center pr-6 border-r border-slate-800/50">
            <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Active Assets Horizontal Scroll - Hidden on very small screens, visible on sm and up or when space permits */}
        <div className="flex-1 flex items-center gap-1 relative group/scroll-container overflow-hidden min-w-0">
          <div
            onMouseEnter={() => startScroll("left")}
            onMouseLeave={stopScroll}
            className="absolute left-0 top-0 bottom-0 w-10 z-20 flex items-center justify-start bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent cursor-pointer opacity-0 group-hover/scroll-container:opacity-100 transition-opacity duration-300"
          >
            <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center backdrop-blur-sm ml-1 hover:bg-cyan-500/20 transition-colors">
              <ChevronLeft className="w-4 h-4 text-cyan-400" />
            </div>
          </div>

          <div
            ref={assetScrollRef as React.LegacyRef<HTMLDivElement>}
            className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-2 min-w-0"
          >
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => onAssetChange?.(asset)}
                className={cn(
                  "flex items-center gap-2 p-1 rounded-xl border transition-all relative group h-[32px] min-w-fit flex-shrink-0",
                  symbol.split("/")[0] === asset.symbol
                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : "bg-slate-900/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50",
                )}
              >
                <div className="relative">
                  <AssetIcon symbol={asset.symbol} size={18} />
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-[9px] font-black text-white leading-none mb-0.5">
                    {asset.symbol}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                      {asset.holding.toFixed(asset.holding < 1 ? 2 : 1)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div
            onMouseEnter={() => startScroll("right")}
            onMouseLeave={stopScroll}
            className="absolute right-0 top-0 bottom-0 w-10 z-20 flex items-center justify-end bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent cursor-pointer opacity-0 group-hover/scroll-container:opacity-100 transition-opacity duration-300"
          >
            <div className="w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center backdrop-blur-sm mr-1 hover:bg-cyan-500/20 transition-colors">
              <ChevronRight className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Timeframe Selector & Focus */}
      <div className="flex flex-row items-center justify-between sm:justify-end w-full sm:w-auto flex-shrink-0 gap-2 sm:gap-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-800/50">
        <div className="flex gap-0.5 p-0.5 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-lg overflow-x-auto no-scrollbar">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all min-w-[28px]",
                timeframe === tf.value
                  ? "bg-cyan-500 text-white"
                  : "text-slate-500 hover:text-white hover:bg-slate-800",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <button
          onClick={focusOnPrices}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/40 border border-slate-800/50 text-[8px] font-black text-cyan-400 hover:bg-cyan-400/10 transition-all group/focus"
        >
          <Target className="w-2.5 h-2.5" />
          ODAKLA
        </button>

        {onToggleChart && (
          <button
            onClick={onToggleChart}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/40 border border-slate-800/50 text-[8px] font-black text-violet-400 hover:bg-violet-400/10 transition-all"
            title={showChart ? "Grafiği Gizle" : "Grafiği Göster"}
          >
            {showChart ? <EyeOff size={10} /> : <Eye size={10} />}
            {showChart ? "GİZLE" : "GÖSTER"}
          </button>
        )}

        {/* Sync/Loading Indicators */}
        {isLoading && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 capitalize tracking-tight pointer-events-none">
            <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Senkronizasyon
          </div>
        )}
        {historyLoading && !isLoading && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 capitalize tracking-tight pointer-events-none">
            <div className="w-2.5 h-2.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            Geçmiş...
          </div>
        )}
      </div>
    </div>
  );
};
