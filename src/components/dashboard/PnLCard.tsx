"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { runBacktestSim } from "@/lib/backtestEngine";

interface PnLCardProps {
  totalPnL: number;
  percentage: number;
  dailyVolume: number;
  signal?: "STRONG_BUY" | "STRONG_SELL" | "NEUTRAL";
}

interface Oscillators {
  rsi: number;
  bbPosition: number; // 0-100: 0=lower, 50=mid, 100=upper
}

export const PnLCard = React.memo(({ totalPnL, percentage, dailyVolume, signal = "NEUTRAL" }: PnLCardProps) => {
  const isProfit = totalPnL >= 0;
  const [oscillators, setOscillators] = useState<Oscillators>({ rsi: 50, bbPosition: 50 });
  const [simRunning, setSimRunning] = useState(false);

  // Canlı oscillator verisi çek
  useEffect(() => {
    const fetchOsc = async () => {
      try {
        const r = await fetch("/api/orderbook?symbol=BTCUSDT");
        if (r.ok) {
          const d = await r.json();
          // RSI simülasyonu ratio'dan türet
          const ratio = d.ratio || 1;
          const rsi = Math.min(Math.max(30 + ratio * 15, 10), 90);
          const bb = Math.min(Math.max(ratio * 40, 5), 95);
          setOscillators({ rsi, bbPosition: bb });
        }
      } catch {}
    };
    fetchOsc();
    const iv = setInterval(fetchOsc, 30000);
    return () => clearInterval(iv);
  }, []);

  const getRsiColor = (rsi: number) => {
    if (rsi > 70) return { bar: "bg-rose-500", text: "text-rose-400", label: "AŞIRI ALIM" };
    if (rsi < 30) return { bar: "bg-emerald-500", text: "text-emerald-400", label: "AŞIRI SATIM" };
    return { bar: "bg-cyan-500", text: "text-cyan-400", label: "NÖTR" };
  };

  const rsiStyle = getRsiColor(oscillators.rsi);

  const renderSignalBadge = () => {
    if (signal === "STRONG_BUY") return (
      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider glow-emerald">
        GÜÇLÜ AL ▲
      </span>
    );
    if (signal === "STRONG_SELL") return (
      <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider glow-rose">
        GÜÇLÜ SAT ▼
      </span>
    );
    return (
      <span className="bg-slate-700/30 text-slate-500 border border-slate-700/40 px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider">
        NÖTR ◎
      </span>
    );
  };

  const runSim = async () => {
    setSimRunning(true);
    try {
      const prices = Array.from({length: 100}, () => 65000 * (0.95 + Math.random() * 0.1));
      const res = await runBacktestSim(prices, 1000);
      alert(`🎯 Taktik Backtest Tamamlandı\n\nNet P&L: $${res.totalPnL.toFixed(2)}\nWin Rate: ${res.winRate.toFixed(1)}%\nToplam İşlem: ${res.totalTrades}\nFinal Sermaye: $${res.finalCapital.toFixed(2)}`);
    } catch (e) {
      console.error("Sim error:", e);
    }
    setSimRunning(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card-glow overflow-hidden p-5 w-full max-w-sm flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[9px] text-slate-500 font-mono tracking-[0.2em] uppercase">Reel Kâr/Zarar</p>
            {renderSignalBadge()}
          </div>
          <motion.h2
            key={totalPnL}
            initial={{ scale: 1.1, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-3xl font-black tracking-tight font-mono ${
              isProfit ? "text-emerald-400 glow-emerald" : "text-rose-400 glow-rose"
            }`}
          >
            {isProfit ? "+" : ""}${totalPnL.toFixed(2)}
          </motion.h2>
        </div>
        <div className={`px-3 py-1 rounded-lg text-xs font-bold font-mono ${
          isProfit
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        }`}>
          {isProfit ? "+" : ""}{percentage.toFixed(2)}%
        </div>
      </div>

      {/* 24h Volume */}
      <div className="flex justify-between items-center text-xs border-t border-slate-800/40 pt-3">
        <span className="text-slate-600 font-mono text-[10px]">24h Hacim</span>
        <span className="text-slate-300 font-mono font-bold">${dailyVolume.toFixed(2)}</span>
      </div>

      {/* Oscillator Gauges */}
      <div className="flex flex-col gap-2 border-t border-slate-800/40 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono text-slate-600 tracking-wider">RSI (14)</span>
          <span className={`text-[8px] font-mono font-bold ${rsiStyle.text}`}>
            {oscillators.rsi.toFixed(0)} · {rsiStyle.label}
          </span>
        </div>
        <div className="oscillator-gauge">
          <motion.div
            animate={{ width: `${oscillators.rsi}%` }}
            className={`fill ${rsiStyle.bar}`}
          />
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[8px] font-mono text-slate-600 tracking-wider">BB POS</span>
          <span className="text-[8px] font-mono text-violet-400 font-bold">
            {oscillators.bbPosition.toFixed(0)}%
          </span>
        </div>
        <div className="oscillator-gauge">
          <motion.div
            animate={{ width: `${oscillators.bbPosition}%` }}
            className="fill bg-violet-500"
          />
        </div>
      </div>

      {/* Tactical Backtest Button */}
      <button
        onClick={runSim}
        disabled={simRunning}
        className="btn-neon w-full py-2.5 rounded-lg text-[10px] tracking-[0.15em] flex justify-center items-center gap-2 relative z-10 disabled:opacity-50"
      >
        {simRunning ? (
          <>
            <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            ÇALIŞIYOR...
          </>
        ) : (
          <>⚔️ TAKTİK BACKTEST</>
        )}
      </button>

      {/* Corner Glow */}
      <div className={`absolute -bottom-12 -right-12 w-28 h-28 rounded-full blur-3xl opacity-10 pointer-events-none ${
        isProfit ? "bg-emerald-500" : "bg-rose-500"
      }`} />
    </motion.div>
  );
});

PnLCard.displayName = "PnLCard";
