"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Activity, Cpu, Database, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoResearchData {
  bestExperiment: {
    composite_score: number;
    params: Record<string, any>;
    win_rate: number;
    total_trades: number;
    total_pnl_pct: number;
    search_phase: string;
  } | null;
  latestExperiment: {
    experiment_num: number;
    composite_score: number;
    search_phase: string;
    params: Record<string, any>;
  } | null;
  totalExperiments: number;
  latestAiInsight: string | null;
}

export const AutoResearchMonitor = () => {
  const [data, setData] = useState<AutoResearchData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/autoresearch/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-48 rounded-xl border border-slate-800/60 bg-[#020617]/50 flex items-center justify-center">
        <Activity className="w-5 h-5 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col rounded-xl border border-emerald-900/40 bg-slate-950/80 overflow-hidden shadow-[0_0_30px_-15px_rgba(16,185,129,0.15)] relative">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-900/50 bg-emerald-950/20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-black tracking-widest text-emerald-100 uppercase">
            AutoResearch Lab
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] text-emerald-500 font-mono tracking-widest uppercase">
            KARPATHY LOOP ACTIVE
          </span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-emerald-900/30">
        
        {/* LEADING STATS: BEST PARAMS */}
        <div className="flex-1 p-4 grid grid-cols-2 gap-4">
          <div className="col-span-2 text-[10px] text-emerald-500/70 font-mono font-bold tracking-widest uppercase mb-1">
             MATRIX ALPHA (BEST SCORE)
          </div>

          <div className="flex flex-col">
            <span className="text-[12px] text-slate-400 font-light font-mono">Composite Score</span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {data?.bestExperiment?.composite_score?.toFixed(2) || "0.00"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[12px] text-slate-400 font-light font-mono">Win Rate (PnL)</span>
            <span className="text-xl font-black text-emerald-400 font-mono">
              {(data?.bestExperiment?.win_rate ?? 0) * 100}% <span className="text-sm text-slate-400">/ %{data?.bestExperiment?.total_pnl_pct.toFixed(2)}</span>
            </span>
          </div>

          <div className="col-span-2 mt-2">
            <div className="text-[10px] text-emerald-500/50 mb-1 font-mono">LEADING PARAMETERS</div>
            <div className="flex flex-wrap gap-1.5">
              {data?.bestExperiment?.params && Object.entries(data.bestExperiment.params).slice(0, 5).map(([k, v]) => (
                <div key={k} className="px-2 py-1 rounded bg-slate-900 border border-emerald-900/30 text-[10px] font-mono text-slate-300">
                  <span className="text-emerald-500 mr-1">{k.split('_').pop()}:</span>
                  {typeof v === 'number' ? v.toFixed(2) : String(v)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI INSIGHT TERMINAL */}
        <div className="flex-1 relative bg-black/60 p-4 font-mono overflow-hidden">
          <div className="text-[10px] text-cyan-500/70 font-bold tracking-widest uppercase mb-3 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            AI ORACLE INSIGHT
          </div>
          
          <div className="relative z-10 text-[11px] text-cyan-300 leading-relaxed overflow-hidden">
            {data?.latestAiInsight ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="whitespace-pre-wrap"
              >
                {data.latestAiInsight.length > 200 
                  ? data.latestAiInsight.substring(0, 200) + "...\n[CONTINUED IN LOGS]" 
                  : data.latestAiInsight}
              </motion.div>
            ) : (
              <span className="text-slate-600 italic">Waiting for 10th epoch to synthesize insight...</span>
            )}
          </div>

          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none" />
          <div className="absolute bottom-4 left-4 flex gap-3 text-[10px] border-t border-cyan-900/30 pt-2 w-full pr-8">
            <span className="text-slate-500">Total Exp: <b className="text-slate-300">{data?.totalExperiments}</b></span>
            <span className="text-slate-500">Current Phase: <b className={cn(
              "uppercase tracking-wider",
              data?.latestExperiment?.search_phase === "ai_guided" ? "text-fuchsia-400 animate-pulse" : "text-amber-400"
            )}>{data?.latestExperiment?.search_phase || "UNKNOWN"}</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};
