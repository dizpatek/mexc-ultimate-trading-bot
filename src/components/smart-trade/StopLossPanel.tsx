"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface StopLossPanelProps {
  compact: boolean;
  mode: "TRADE" | "COVER";
  slEnabled: boolean;
  setSlEnabled: (v: boolean) => void;
  slPrice: string;
  setSlPrice: (v: string) => void;
  slPercent: number;
  displaySlPercent: number;
  buyP: number;
  trailingSl: boolean;
  setTrailingSl: (v: boolean) => void;
  moveToBreakeven: boolean;
  setMoveToBreakeven: (v: boolean) => void;
  slTimeout: boolean;
  setSlTimeout: (v: boolean) => void;
  timeframe?: string;
}

export const StopLossPanel: React.FC<StopLossPanelProps> = ({
  compact,
  mode,
  slEnabled,
  setSlEnabled,
  slPrice,
  setSlPrice,
  slPercent,
  displaySlPercent,
  buyP,
  trailingSl,
  setTrailingSl,
  moveToBreakeven,
  setMoveToBreakeven,
  slTimeout,
  setSlTimeout,
  timeframe = "1h",
}) => {
  return (
    <div
      className={cn(
        "relative group/sl transition-all duration-300",
        compact ? "p-0 bg-transparent" : "flex flex-col flex-1",
        compact && !slEnabled && "hidden",
      )}
    >
      {!compact && (
        <>
          <div className="absolute top-8 left-0 p-8 opacity-[0.03] pointer-events-none">
            <ShieldAlert className="w-32 h-32 text-rose-500" />
          </div>
          <div className="flex items-center justify-between relative z-10 mb-1">
            <h3 className="font-black text-rose-400 uppercase tracking-widest flex items-center gap-2 text-[11px]">
              <ShieldAlert className="w-4 h-4" /> {mode === "COVER" ? "SL" : "Zarar Durdur"}
            </h3>
            <button
              onClick={() => setSlEnabled(!slEnabled)}
              className={cn(
                "w-8 h-4 rounded-full transition-all relative px-0.5",
                slEnabled ? "bg-rose-500" : "bg-slate-700",
              )}
            >
              <div
                className={cn(
                  "w-3 h-3 bg-white rounded-full transition-all",
                  slEnabled ? "translate-x-4" : "translate-x-0",
                )}
              />
            </button>
          </div>
        </>
      )}

      <div
        className={cn(
          "transition-opacity duration-300 relative z-10",
          compact ? "space-y-1" : "space-y-1",
          !slEnabled && "opacity-30 pointer-events-none",
        )}
      >
        <div className={cn(compact ? "space-y-1" : "space-y-2")}>
          <div className="flex justify-between items-end mb-0.5 leading-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Durdurma Fiyatı
            </span>
            <span className="text-[10px] font-black text-rose-400 font-mono tracking-tighter">
              {displaySlPercent >= 0 ? "+" : ""}
              {displaySlPercent.toFixed(2)}%
            </span>
          </div>

          {compact ? (
            <div className="space-y-1.5 px-0.5">
              <input
                type="range"
                min="0.1"
                max="50.0"
                step="0.1"
                value={Math.abs(slPercent)}
                onChange={(e) => {
                  const pct = parseFloat(e.target.value);
                  const targetPct = mode === "COVER" ? pct : -pct;
                  const newPrice = buyP * (1 + targetPct / 100);
                  setSlPrice(newPrice.toFixed(6));
                }}
                className="w-full h-1 rounded-full cursor-pointer accent-rose-400 bg-slate-800/50 appearance-none transition-all"
              />
              <div className="flex justify-between items-center px-0.5">
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter font-mono">
                  {slPrice} USDT
                </span>
                <span className="text-[9px] font-black text-rose-400 font-mono">
                  {slPercent >= 0 ? "+" : ""}
                  {slPercent.toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                className={cn(
                  "w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 text-sm font-black text-white outline-none focus:border-rose-500/50 transition-all",
                  compact ? "h-8 py-0" : "h-9 py-0",
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                USDT
              </div>
            </div>
          )}
        </div>

        {/* Advanced SL Options */}
        <div className={cn("pt-1.5 border-t border-white/5 space-y-2", compact ? "px-0.5" : "")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Takip Eden <span className="text-cyan-400/80">({timeframe})</span>
              </span>
              <button
                onClick={() => setTrailingSl(!trailingSl)}
                className={cn("w-6 h-3 rounded-full transition-all relative px-0.5", trailingSl ? "bg-rose-500" : "bg-slate-800")}
              >
                <div
                  className={cn("w-2 h-2 bg-white rounded-full transition-all", trailingSl ? "translate-x-3" : "translate-x-0")}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Breakeven</span>
              <button
                onClick={() => setMoveToBreakeven(!moveToBreakeven)}
                className={cn(
                  "w-6 h-3 rounded-full transition-all relative px-0.5",
                  moveToBreakeven ? "bg-cyan-500" : "bg-slate-800",
                )}
              >
                <div
                  className={cn(
                    "w-2 h-2 bg-white rounded-full transition-all",
                    moveToBreakeven ? "translate-x-3" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </div>

          {!compact && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Timeout</span>
                <button
                  onClick={() => setSlTimeout(!slTimeout)}
                  className={cn("w-6 h-3 rounded-full transition-all relative px-0.5", slTimeout ? "bg-cyan-500" : "bg-slate-800")}
                >
                  <div
                    className={cn("w-2 h-2 bg-white rounded-full transition-all", slTimeout ? "translate-x-3" : "translate-x-0")}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
