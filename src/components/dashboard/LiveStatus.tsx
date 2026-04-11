"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

// --- LiveStatus Component ---
// Sağ üst için WebSocket / SSE kopukluk göstergesi
export const LiveStatus = React.memo(({ isConnected = true }: { isConnected?: boolean }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/60 border border-slate-800/50 rounded-full backdrop-blur-sm shadow-xl z-50">
      <span className="relative flex h-2 w-2">
        {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`}></span>
      </span>
      <span className={`text-[10px] font-black tracking-widest uppercase ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>
        {isConnected ? "WS CONN" : "DISCONNECTED"}
      </span>
    </div>
  );
});

LiveStatus.displayName = "LiveStatus";

// --- RecentTrades Component ---
// Ag-Grid'in ağır kaynak tüketimi yerine hafif DOM, Tailwind flex-grid.
export interface TradeRow {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  time: string;
}

interface RecentTradesProps {
  trades: TradeRow[];
}

export const RecentTrades = React.memo(({ trades }: RecentTradesProps) => {
  return (
    <div className="w-full max-w-sm rounded-xl overflow-hidden bg-slate-950/40 border border-slate-800/40 backdrop-blur-sm">
      <div className="px-4 py-2 border-b border-slate-800/60 bg-slate-900/50">
        <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Live Tape (Son 5 İşlem)</h3>
      </div>
      <div className="flex flex-col">
        {trades.slice(0, 5).map((trade, i) => (
          <motion.div 
            key={trade.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`flex items-center justify-between px-4 py-2 text-xs font-mono border-b border-slate-800/20 last:border-0 hover:bg-slate-800/20 transition-colors`}
          >
            <div>
              <span className={trade.side === "BUY" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {trade.side}
              </span>
              <span className="ml-2 text-slate-300">{trade.symbol}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-100">${trade.price}</span>
              <div className="text-[9px] text-slate-500">{trade.time}</div>
            </div>
          </motion.div>
        ))}
        {trades.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-600 font-mono italic">No recent trades...</div>
        )}
      </div>
    </div>
  );
});

RecentTrades.displayName = "RecentTrades";
