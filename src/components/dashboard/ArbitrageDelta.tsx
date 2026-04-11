"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ArbData {
  gapPercent: number;
  isArbitrage: boolean;
  hlPrice: number | null;
  mexcPrice: number | null;
  fasterExchange: string;
}

export const ArbitrageDelta = React.memo(({ symbol }: { symbol: string }) => {
  const [data, setData] = useState<ArbData | null>(null);

  useEffect(() => {
    let active = true;
    const fetch_ = async () => {
      try {
        const r = await fetch(`/api/arb?symbol=${symbol}`);
        if (r.ok && active) setData(await r.json());
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 10000);
    return () => { active = false; clearInterval(iv); };
  }, [symbol]);

  if (!data) return null;

  const pct = Math.min(Math.abs(data.gapPercent) / 1, 1) * 100; // normalize to 1% max
  const isHot = data.isArbitrage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full card-glow overflow-hidden ${isHot ? "ring-1 ring-amber-500/30" : ""}`}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: Exchange Labels */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-mono text-slate-600 tracking-wider">HYPERLIQUID</span>
            <span className="text-xs font-bold text-violet-400 font-mono">
              ${data.hlPrice?.toFixed(2) ?? "—"}
            </span>
          </div>

          {/* Delta Bar */}
          <div className="flex flex-col items-center gap-1 w-[140px]">
            <div className="w-full h-2 bg-slate-800/60 rounded-full overflow-hidden relative">
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  isHot
                    ? "bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    : "bg-gradient-to-r from-slate-600 to-slate-500"
                }`}
              />
            </div>
            <span className={`text-xs font-black font-mono ${
              isHot ? "text-amber-400 glow-amber" : "text-slate-500"
            }`}>
              Δ {data.gapPercent.toFixed(3)}%
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[7px] font-mono text-slate-600 tracking-wider">MEXC</span>
            <span className="text-xs font-bold text-cyan-400 font-mono">
              ${data.mexcPrice?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>

        {/* Right: Signal Badge */}
        {isHot ? (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/40 rounded-lg"
          >
            <span className="text-amber-400 text-lg">⚡</span>
            <div>
              <div className="text-[8px] font-black text-amber-400 tracking-wider glow-amber">SİNYAL DOĞRULANDI</div>
              <div className="text-[7px] text-amber-300/60 font-mono">{data.fasterExchange} → MEXC</div>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/30 rounded-lg">
            <span className="text-slate-600 text-sm">◎</span>
            <span className="text-[8px] font-mono text-slate-600 tracking-wider">SPREAD NORMAL</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

ArbitrageDelta.displayName = "ArbitrageDelta";
