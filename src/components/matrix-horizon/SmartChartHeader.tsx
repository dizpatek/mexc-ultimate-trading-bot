"use client";

import React from "react";
import { Target, ChevronLeft, ChevronRight } from "lucide-react";
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
}

export const TIMEFRAMES = [
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
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
}) => {
  if (compact) return null;

  return (
    <div className="flex items-center gap-4 w-full px-1 py-0">
      {/* Current Price Indicator & Assets List */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        {currentPrice > 0 ? (
          <div className="flex items-center gap-3 pr-6 border-r border-slate-800/50">
            <div className="relative group/asset">
              <div className="absolute -inset-2 bg-gradient-to-tr from-amber-500/20 to-transparent rounded-full blur-md opacity-0 group-hover/asset:opacity-100 transition-opacity duration-500" />
              <AssetIcon
                symbol={symbol}
                size={28}
                className="relative z-10 shadow-lg"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-0">
                {symbol}
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0 rounded-lg bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                <span className="text-sm font-black text-amber-400 font-mono leading-tight">
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

        {/* Active Assets Horizontal Scroll */}
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
                  "flex items-center gap-3 p-1 rounded-xl border transition-all relative group h-[36px] min-w-fit flex-shrink-0",
                  symbol.split("/")[0] === asset.symbol
                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                    : "bg-slate-900/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50",
                )}
              >
                <div className="relative">
                  <AssetIcon symbol={asset.symbol} size={22} />
                  {symbol.startsWith(asset.symbol) && (
                    <div className="absolute -top-1 -right-1">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-start">
                  <div className="text-[10px] font-black text-white leading-none mb-1">
                    {asset.symbol}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                      {asset.holding.toFixed(asset.holding < 1 ? 4 : 2)}
                    </span>
                    <span className="text-[9px] font-black text-emerald-400 font-mono group-hover:block hidden">
                      ${asset.price.toLocaleString()}
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
      <div className="flex flex-row items-center flex-shrink-0 gap-3">
        <div className="flex gap-1 p-1 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                timeframe === tf.value
                  ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  : "text-slate-500 hover:text-white hover:bg-slate-800",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <button
          onClick={focusOnPrices}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/40 border border-slate-800/50 text-[9px] font-black text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400/30 transition-all backdrop-blur-md group/focus"
        >
          <Target className="w-3 h-3 group-hover/focus:scale-125 transition-transform" />
          ODAKLA (FİYATA HİZALA)
        </button>
      </div>
    </div>
  );
};
