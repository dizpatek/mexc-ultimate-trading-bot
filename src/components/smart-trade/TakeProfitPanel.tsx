"use client";

import React from "react";
import { TrendingUp, Split, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TakeProfitPanelProps {
  compact: boolean;
  mode: "TRADE" | "COVER";
  tpEnabled: boolean;
  setTpEnabled: (v: boolean) => void;
  tpPrice: string;
  setTpPrice: (v: string) => void;
  tpPercent: number;
  displayTpPercent: number;
  buyP: number;
  isSplitTp: boolean;
  setIsSplitTp: (v: boolean) => void;
  tpTargets: { id: string; price: string; volume: number }[];
  updateTpTarget: (id: string, updates: Partial<{ price: string; volume: number }>) => void;
  removeTpTarget: (id: string) => void;
  addTpTarget: () => void;
  totalTpVolume: number;
  trailingTp: boolean;
  setTrailingTp: (v: boolean) => void;
  tpDeviation: number;
  setTpDeviation: (v: number) => void;
}

export const TakeProfitPanel: React.FC<TakeProfitPanelProps> = ({
  compact,
  mode,
  tpEnabled,
  setTpEnabled,
  tpPrice,
  setTpPrice,
  tpPercent,
  displayTpPercent,
  buyP,
  isSplitTp,
  setIsSplitTp,
  tpTargets,
  updateTpTarget,
  removeTpTarget,
  addTpTarget,
  totalTpVolume,
  trailingTp,
  setTrailingTp,
  tpDeviation,
  setTpDeviation,
}) => {
  return (
    <div
      className={cn(
        "relative group/tp transition-all duration-300",
        compact ? "p-0 bg-transparent mb-1" : "flex flex-col flex-1",
        compact && !tpEnabled && "hidden",
      )}
    >
      {!compact && (
        <>
          <div className="absolute top-8 right-0 p-8 opacity-[0.03] pointer-events-none">
            <TrendingUp className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="flex items-center justify-between relative z-10 mb-1">
            <h3 className="font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 text-[11px]">
              <TrendingUp className="w-4 h-4" /> {mode === "COVER" ? "TP" : "Kar Al"}
            </h3>
            <button
              onClick={() => setTpEnabled(!tpEnabled)}
              className={cn(
                "w-8 h-4 rounded-full transition-all relative px-0.5",
                tpEnabled ? "bg-emerald-500" : "bg-slate-700",
              )}
            >
              <div
                className={cn(
                  "w-3 h-3 bg-white rounded-full transition-all",
                  tpEnabled ? "translate-x-4" : "translate-x-0",
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
          !tpEnabled && "opacity-30 pointer-events-none",
        )}
      >
        <div className={cn(compact ? "space-y-1" : "space-y-2")}>
          <div className="flex justify-between items-end mb-0.5 leading-none">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Hedef Fiyat
            </span>
            <span className="text-[10px] font-black text-emerald-400 font-mono tracking-tighter">
              {displayTpPercent >= 0 ? "+" : ""}
              {displayTpPercent.toFixed(2)}%
            </span>
          </div>

          {!isSplitTp ? (
            <div className={cn("animate-in fade-in zoom-in-95", compact ? "space-y-2.5" : "space-y-2")}>
              {compact ? (
                <div className="space-y-1.5 px-0.5">
                  <input
                    type="range"
                    min="0.1"
                    max="100.0"
                    step="0.1"
                    value={Math.abs(tpPercent)}
                    onChange={(e) => {
                      const pct = parseFloat(e.target.value);
                      const targetPct = mode === "COVER" ? -pct : pct;
                      const newPrice = buyP * (1 + targetPct / 100);
                      setTpPrice(newPrice.toFixed(6));
                    }}
                    className="w-full h-1 rounded-full cursor-pointer accent-emerald-400 bg-slate-800/50 appearance-none transition-all"
                  />
                  <div className="flex justify-between items-center px-0.5">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter font-mono">
                      {tpPrice} USDT
                    </span>
                    <span className="text-[9px] font-black text-emerald-400 font-mono">
                      {tpPercent >= 0 ? "+" : ""}
                      {tpPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={tpPrice}
                    onChange={(e) => setTpPrice(e.target.value)}
                    className={cn(
                      "w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 text-sm font-black text-white outline-none focus:border-emerald-500/50 transition-all",
                      compact ? "h-8 py-0" : "h-9 py-0",
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    USDT
                  </div>
                </div>
              )}

              {!compact && (
                <button
                  onClick={() => {
                    setIsSplitTp(true);
                    // Initial target set in parent or here
                  }}
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-white/5 hover:bg-emerald-500/10 transition-all flex items-center justify-center gap-2 group/split",
                    compact ? "py-1" : "py-1.5",
                  )}
                >
                  <Split className="w-3 h-3 text-emerald-400 group-hover/split:rotate-12 transition-transform" />
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    Hedefleri Böl
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5">
                <span>Fiyat</span>
                <span>Miktar %</span>
              </div>
              <div
                className={cn(
                  "space-y-1.5 custom-scrollbar pr-1",
                  compact ? "max-h-[160px]" : "max-h-[320px] overflow-y-auto",
                )}
              >
                {tpTargets.map((target) => {
                  const tP = parseFloat(target.price) || 0;
                  const tPct = buyP > 0 ? (tP / buyP - 1) * 100 : 0;
                  const dPct = mode === "COVER" ? -tPct : tPct;
                  return (
                    <div key={target.id} className="grid grid-cols-3 gap-1.5 items-center">
                      <input
                        type="text"
                        value={target.price}
                        onChange={(e) => updateTpTarget(target.id, { price: e.target.value })}
                        placeholder="0.0"
                        className="bg-slate-900/50 border border-slate-800 rounded px-1.5 py-1 text-[11px] font-mono text-white outline-none focus:border-cyan-500/50 col-span-2 h-7"
                      />
                      <div className="flex items-center justify-between">
                        <span className={cn("text-[10px] font-black", dPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {dPct.toFixed(1)}%
                        </span>
                        <button
                          onClick={() => removeTpTarget(target.id)}
                          className="text-slate-700 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="col-span-3 flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={target.volume}
                          onChange={(e) => updateTpTarget(target.id, { volume: parseInt(e.target.value) })}
                          className="flex-1 accent-emerald-500 h-1 rounded-full bg-slate-800"
                        />
                        <span className="text-[8px] font-black text-white w-6 text-right">{target.volume}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-1.5 flex items-center justify-between border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Toplam:</span>
                  <span className={cn("text-[9px] font-black", totalTpVolume === 100 ? "text-emerald-400" : "text-rose-400")}>
                    {totalTpVolume}%
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={addTpTarget}
                    disabled={tpTargets.length >= 8}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[8px] font-black text-emerald-400 uppercase disabled:opacity-30"
                  >
                    + HEDEF
                  </button>
                  <button
                    onClick={() => setIsSplitTp(false)}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[8px] font-black text-slate-400 uppercase"
                  >
                    İPTAL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trailing TP Micro-Settings */}
        <div className={cn("pt-1.5 border-t border-white/5 space-y-2", compact ? "px-0.5" : "")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Takip Eden</span>
              <button
                onClick={() => setTrailingTp(!trailingTp)}
                className={cn("w-6 h-3 rounded-full transition-all relative px-0.5", trailingTp ? "bg-emerald-500" : "bg-slate-800")}
              >
                <div
                  className={cn("w-2 h-2 bg-white rounded-full transition-all", trailingTp ? "translate-x-3" : "translate-x-0")}
                />
              </button>
            </div>
            {trailingTp && (
              <span className="text-[9px] font-black text-emerald-400 font-mono">{tpDeviation.toFixed(1)}%</span>
            )}
          </div>

          {trailingTp && (
            <div className="flex items-center gap-3 animate-in slide-in-from-top-1 duration-300">
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={Math.abs(tpDeviation)}
                onChange={(e) => setTpDeviation(-parseFloat(e.target.value))}
                className="flex-1 h-1 rounded-full cursor-pointer accent-emerald-400 bg-slate-800/50 appearance-none"
              />
              <span className="text-[8px] font-black text-slate-500 uppercase w-8">Sapma</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
