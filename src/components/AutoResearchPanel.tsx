"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw, Play, Square, Settings, Zap, ChevronDown, ChevronUp,
  Cpu, Activity, Target, TrendingUp, TrendingDown, BarChart3,
  Crosshair, Layers, ArrowRightLeft, Sparkles, Timer, Award,
  CircleDot, Hash, Globe, Flame, Settings2, PieChart, AlertTriangle, CheckCircle2
} from "lucide-react";
import { useBotConfig } from "@/hooks/useBotConfig";
import { useNotification } from "@/context/NotificationContext";
import { api } from "@/services/api";
import type { AutoResearchExperiment } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";

interface ApiResponse {
  ok: boolean;
  experiments: AutoResearchExperiment[];
  best: AutoResearchExperiment | null;
  total: number;
}

function fmt(n: number | undefined | null, dec = 2) {
  return typeof n === "number" ? n.toFixed(dec) : "—";
}

function scoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#3b82f6";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

function scoreGlow(score: number) {
  if (score >= 80) return "0 0 20px rgba(34,197,94,0.3)";
  if (score >= 65) return "0 0 20px rgba(59,130,246,0.3)";
  if (score >= 50) return "0 0 20px rgba(234,179,8,0.3)";
  return "0 0 20px rgba(239,68,68,0.3)";
}

function timeSince(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.round(diff / 1000)}s`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}dk`;
  return `${Math.round(diff / 3600_000)}sa`;
}

const PHASE_ICONS: Record<string, React.ReactNode> = {
  auto: <Sparkles className="w-3 h-3" />,
  random: <CircleDot className="w-3 h-3" />,
  hillclimb: <TrendingUp className="w-3 h-3" />,
  ucb: <Crosshair className="w-3 h-3" />,
};

const PHASE_DESCRIPTIONS: Record<string, string> = {
  auto: "Tüm stratejileri sırayla test eder",
  random: "Rastgele parametre kombinasyonları",
  hillclimb: "En iyi sonuçtan yola çıkarak iyileştirir",
  ucb: "Keşif-sömürü dengesi ile optimize eder",
};

const PARAM_CATEGORIES: Record<string, { label: string; icon: React.ReactNode; keys: string[] }> = {
  signal: {
    label: "Sinyal Motoru",
    icon: <Zap className="w-3.5 h-3.5 text-cyan-400" />,
    keys: ["ai_threshold", "f4_length", "f4_multiplier", "f4_power_loss_threshold", "f4_slope_threshold", "f4_lookback_bars", "f4_squeeze_threshold", "min_power_loss"],
  },
  risk: {
    label: "Risk Yönetimi",
    icon: <Target className="w-3.5 h-3.5 text-amber-400" />,
    keys: ["pilot_tp_trailing", "pilot_tp_deviation", "pilot_sl_trailing", "pilot_sl_deviation"],
  },
  mtf: {
    label: "MTF Analiz",
    icon: <Layers className="w-3.5 h-3.5 text-purple-400" />,
    keys: ["pilot_mtf_veto", "pilot_mtf_threshold", "pilot_mtf_long_threshold", "pilot_mtf_short_threshold"],
  },
  whale: {
    label: "Balina & Hacim",
    icon: <Globe className="w-3.5 h-3.5 text-emerald-400" />,
    keys: ["whale_multiplier"],
  },
};

export function AutoResearchPanel() {
  const { notify } = useNotification();
  const { config } = useBotConfig();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [updatingParams, setUpdatingParams] = useState(false);

  // Form states
  const [symbols, setSymbols] = useState("BTCUSDT, ETHUSDT, SOLUSDT");
  const [timeframe, setTimeframe] = useState("4h");
  const [isRunning, setIsRunning] = useState(false);
  const [searchPhase, setSearchPhase] = useState<string>("auto");
  const [availableAssets, setAvailableAssets] = useState<string[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  // Analysis Tab States
  const [activeTab, setActiveTab] = useState<"simulator" | "analysis">("simulator");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      console.log("[AutoResearch] Fetching analysis via API service...");
      const res = await api.get("/autoresearch/analyze");
      setAnalysisData(res.data);
    } catch (e: any) {
      console.error("[AutoResearch] Analysis crash:", e);
      notify(e.response?.data?.error || "Analiz motoru hatası", "error");
    } finally {
      setAnalysisLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (activeTab === "analysis" && !analysisData) fetchAnalysis();
  }, [activeTab, analysisData, fetchAnalysis]);

  useEffect(() => {
    async function loadPortfolio() {
      setAssetsLoading(true);
      try {
        const res = await api.get("/portfolio/holdings");
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) {
          const coins = data
            .filter((h: any) => h.symbol && h.symbol !== 'USDT' && h.symbol !== 'USDC')
            .map((h: any) => `${h.symbol}USDT`.toUpperCase());

          if (coins.length > 0) {
            const distinctCoins = Array.from(new Set(coins)) as string[];
            setAvailableAssets(distinctCoins);
            setSymbols(distinctCoins.join(", "));
            setAssetsLoading(false);
            return;
          }
        }
        setAvailableAssets(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"]);
      } catch (e: any) {
        console.error("[AutoResearch] Portfolio load crash:", e);
        if (e.response?.status !== 401) {
           setAvailableAssets(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"]);
        }
      } finally {
        setAssetsLoading(false);
      }
    }
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (config?.timeframe_settings) {
      const ts = config.timeframe_settings as any;
      if (ts.ar_symbols && Array.isArray(ts.ar_symbols) && ts.ar_symbols.length > 0) {
        setSymbols(ts.ar_symbols.join(", "));
      }
      if (typeof ts.ar_timeframe === "string") setTimeframe(ts.ar_timeframe);
      if (typeof ts.ar_is_running === "boolean") setIsRunning(ts.ar_is_running);
      if (ts.ar_phase) setSearchPhase(ts.ar_phase);
    }
  }, [config]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/autoresearch?limit=50");
      const json = await res.json() as ApiResponse;
      setData(json);
    } catch (e) {
      console.error("[AutoResearch] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateEngineConfig = async (override?: { is_running?: boolean; phase?: string; [key: string]: any }) => {
    setUpdatingParams(true);
    const newPhase = override?.phase ?? searchPhase;
    try {
      await fetch("/api/autoresearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_config",
          symbols,
          timeframe,
          is_running: override?.is_running !== undefined ? override.is_running : isRunning,
          phase: newPhase,
          params: override // If we are applying specific params
        }),
      });
      notify("⚙️ Parametreler Güncellendi", "success");
      if (override?.is_running !== undefined) setIsRunning(override.is_running);
      if (override?.phase !== undefined) setSearchPhase(override.phase);
    } catch (e) {
      notify("❌ Hata oluştu.", "error");
    } finally {
      setUpdatingParams(false);
    }
  };

  const applyBest = async () => {
    setApplying(true);
    try {
      const res = await fetch("/api/autoresearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_best" }),
      });
      const json = await res.json() as { ok: boolean; message?: string };
      if (json.ok) {
        notify(json.message ?? "✅ Uygulandı.", "success");
        window.dispatchEvent(new Event("botConfigUpdated"));
      } else {
        notify("❌ Hata", "error");
      }
    } catch (e) {
      notify("❌ Hata", "error");
    } finally {
      setApplying(false);
    }
  };

  const best = data?.best ?? null;
  const experiments = (data?.experiments ?? []).slice(0, 30);
  const currentSymbols = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const bestParams = best?.params as any;

  const toggleSymbol = (sym: string) => {
    if (currentSymbols.includes(sym)) {
      setSymbols(currentSymbols.filter(s => s !== sym).join(', '));
    } else {
      setSymbols([...currentSymbols, sym].join(', '));
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 mx-auto pb-8">
      {/* ═══ LEFT SIDEBAR: CONFIG & CONTROLS ═══ */}
      <aside className="w-full xl:w-[400px] space-y-4 shrink-0">
        <div className="bg-[#0a0a0a]/90 backdrop-blur-3xl p-6 rounded-[2rem] border border-primary/20 shadow-[inset_0_0_30px_rgba(110,89,255,0.02)] h-full flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-[0_0_20px_-5px_rgba(110,89,255,0.3)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/20 rotate-45 group-hover:rotate-90 transition-transform duration-700" />
              <Target className="w-6 h-6 text-primary relative z-10" />
            </div>
            <div>
              <h2 className="text-xl font-black italic tracking-tighter text-white">
                AR_CORE <span className="text-primary text-[10px] font-mono ml-1 not-italic opacity-50 bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase tracking-widest">v2.0</span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-white/10'}`} />
                {isRunning && <Settings2 className="w-3 h-3 text-emerald-400 animate-spin" />}
                <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isRunning ? 'text-emerald-400' : 'text-white/30'}`}>
                  {isRunning ? 'MOTOR AKTİF / HESAPLANIYOR' : 'BEKLEMEDE'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6 flex-1">
             {/* Mode Selector */}
             <div className="space-y-3">
               <label className="text-[8px] text-primary/50 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                 <RefreshCw className="w-3 h-3" /> {"//"} RUN_MODE
               </label>
               <div className="flex bg-black/60 rounded-2xl p-1.5 border border-white/10 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
                  <button
                    onClick={() => setActiveTab("simulator")}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'simulator' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-white/40 hover:text-white'}`}
                  >
                    SIM
                  </button>
                  <button
                    onClick={() => setActiveTab("analysis")}
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'analysis' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'text-white/40 hover:text-white'}`}
                  >
                    AI_ANALİZ
                  </button>
               </div>
             </div>

             {/* Action Buttons */}
             <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={updatingParams}
                  onClick={() => updateEngineConfig({ is_running: true })}
                  className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-2 relative overflow-hidden group ${isRunning ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]" : "bg-white/5 text-white/40 hover:text-white border border-white/5"}`}
                >
                  <Play className={`w-4 h-4 ${isRunning ? 'fill-emerald-400' : ''}`} />
                  START
                </button>
                <button
                  disabled={updatingParams}
                  onClick={() => updateEngineConfig({ is_running: false })}
                  className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-2 border ${!isRunning ? "bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : "bg-white/5 text-white/40 hover:text-white border border-white/5"}`}
                >
                  <Square className={`w-4 h-4 ${!isRunning ? 'fill-rose-400' : ''}`} />
                  STOP
                </button>
             </div>

             {/* Phase Selector */}
             <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="text-[8px] text-primary/50 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                  <Globe className="w-3 h-3 text-primary" /> {"//"} PHASE_CONTROL
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['auto', 'random', 'hillclimb', 'ucb'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => updateEngineConfig({ phase: p })}
                      className={`relative py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${searchPhase === p
                        ? 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(110,89,255,0.2)]'
                        : 'bg-black/60 text-white/30 border-white/5 hover:text-white'
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
             </div>

             {/* Asset List */}
             <div className="space-y-4 pt-4 border-t border-white/5 max-h-[400px] overflow-y-auto no-scrollbar">
                <label className="text-[8px] text-primary/50 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                  <BarChart3 className="w-3 h-3 text-primary" /> {"//"} ASSETS_POOL
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableAssets.map(asset => {
                    const isActive = currentSymbols.includes(asset);
                    return (
                      <button
                        key={asset}
                        onClick={() => toggleSymbol(asset)}
                        className={`py-2 rounded px-1 text-[8px] font-black uppercase tracking-widest transition-all border ${isActive
                          ? 'bg-primary text-black border-primary'
                          : 'bg-white/5 text-white/30 border-white/5 hover:text-white'
                          }`}
                      >
                        {asset.replace("USDT", "")}
                      </button>
                    );
                  })}
                </div>
             </div>
          </div>
          
          <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
             <button
              onClick={() => updateEngineConfig()}
              disabled={updatingParams}
              className="w-full py-4 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              SAVE_ENGINE_STATE
            </button>

            {/* 🔥 Moved Hillclimb Card (Elit Skor) */}
            {best && (
              <div className="bg-[#0a0a0a] border border-primary/30 p-6 rounded-[2rem] relative overflow-hidden group shadow-[0_0_40px_rgba(110,89,255,0.05)] mt-4">
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-primary" />
                        <span className="text-[8px] uppercase font-black tracking-[0.2em] text-white/40">ELİT_SKOR</span>
                      </div>
                      <h3 className="text-xl font-black italic text-white tracking-tighter">
                        {best?.search_phase.toUpperCase() || "OPTIMIZED"} <span className="text-primary text-[10px] ml-1 opacity-50 font-mono">#{String(best?.id).padStart(4, '0')}</span>
                      </h3>
                    </div>
                    <div className="text-right">
                        <div className="text-4xl font-black italic tracking-tighter leading-none" style={{ color: scoreColor(best.composite_score), textShadow: scoreGlow(best.composite_score) }}>
                          {fmt(best.composite_score, 1)}
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/10 text-center space-y-1">
                        <div className="text-lg font-mono font-black text-emerald-400 tracking-tighter">%{fmt(best.win_rate, 1)}</div>
                        <div className="text-[7px] font-black text-white/20 uppercase tracking-[0.1em]">WIN_RATE</div>
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-cyan-500/10 text-center space-y-1">
                        <div className="text-lg font-mono font-black text-cyan-400 tracking-tighter">{fmt(best.profit_factor, 2)}</div>
                        <div className="text-[7px] font-black text-white/20 uppercase tracking-[0.1em]">PROFIT_FACTOR</div>
                      </div>
                  </div>

                  <button
                    onClick={() => applyBest()}
                    disabled={applying || !best}
                    className="w-full py-4 bg-primary/20 text-primary border border-primary/40 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary/30 transition-all flex items-center justify-center gap-3"
                  >
                    {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                    DEPLOY_OPTIMAL_MATRIX
                  </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ═══ RIGHT CONTENT AREA: HERO & LOGS ═══ */}
      <div className="flex-1 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === "simulator" ? (
            <motion.div 
              key="simulator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 gap-6">
              {/* Parameter Details (Right of Hero) */}
              <div className="bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col h-full shadow-[inset_0_0_50px_rgba(255,255,255,0.01)]">
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Settings2 className="w-32 h-32 text-primary" />
                 </div>
                 
                 <div className="text-xs font-black text-white/20 uppercase tracking-[0.5em] mb-8 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(110,89,255,1)]" />
                   CONFIG_ARRAY_DUMP
                 </div>
                 
                 <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 cyber-scrollbar">
                    {bestParams && Object.entries(bestParams).map(([k, v]) => {
                      if (typeof v === 'object') return null;
                      return (
                        <div key={k} className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-primary/30 transition-all group">
                           <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest group-hover:text-primary transition-colors">{k.replace(/_/g, ' ')}</span>
                           <span className="text-sm font-mono font-black text-cyan-400 tracking-tight group-hover:text-white transition-colors">
                             {typeof v === 'boolean' ? (v ? 'YES' : 'NO') : String(v)}
                           </span>
                        </div>
                      );
                    })}
                 </div>
              </div>

              {/* Log Matrix Table (Full Width) */}
              <div className="xl:col-span-2 bg-[#0a0a0a]/90 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/5 shadow-[inset_0_0_30px_rgba(255,255,255,0.01)] relative overflow-hidden">
                <div className="flex items-center justify-between mb-8 border-b border-white/[0.05] pb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                      <Activity className="w-6 h-6 text-white/40" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-[0.4em] text-white">EXP_LOG_MATRIX</h3>
                      <p className="text-[9px] font-mono text-white/20 uppercase tracking-widest mt-1">SİMÜLASYON VERİ AKIŞI // {experiments.length} KAYIT</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <div className="flex flex-col items-end">
                        <span className="text-white font-black text-sm">{experiments.length}</span>
                        <span className="text-[7px] text-white/20 uppercase font-black tracking-widest">SİMÜLASYON</span>
                     </div>
                  </div>
                </div>

                <div className="overflow-auto cyber-scrollbar max-h-[600px] -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em]">ID</th>
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em]">PHASE</th>
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em] text-center">SKOR</th>
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em] text-center">W_RATE</th>
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em] text-center">PNL</th>
                        <th className="py-4 font-black text-[9px] text-white/20 uppercase tracking-[0.3em] text-right">VERSION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {experiments.map((exp) => (
                        <tr key={exp.id} className="border-b border-white/[0.02] last:border-0 hover:bg-white/5 transition-colors group">
                          <td className="py-4 text-[10px] font-mono text-white/40">#{String(exp.id).padStart(4, '0')}</td>
                          <td className="py-4">
                            <span className="px-3 py-1 bg-black/40 text-white/30 text-[8px] font-black uppercase tracking-widest rounded border border-white/5">
                              {exp.search_phase}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <span className="font-mono text-xs font-black" style={{ color: scoreColor(exp.composite_score) }}>
                              {fmt(exp.composite_score, 1)}
                            </span>
                          </td>
                          <td className="py-4 text-center font-mono text-[10px] font-black text-emerald-400">%{fmt(exp.win_rate, 1)}</td>
                          <td className={`py-4 text-center font-mono text-[10px] font-black ${exp.total_pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {exp.total_pnl_pct >= 0 ? '+' : ''}{fmt(exp.total_pnl_pct, 1)}%
                          </td>
                          <td className="py-4 text-right text-[9px] font-mono text-white/20">RC_CORE_V2</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0a0a0a]/90 backdrop-blur-3xl p-10 rounded-[3rem] border border-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.05)] min-h-[600px] flex flex-col"
            >
              {analysisLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 gap-8">
                  <div className="relative">
                    <RefreshCw className="w-16 h-16 text-purple-500 animate-spin" />
                    <Activity className="absolute inset-0 m-auto w-6 h-6 text-purple-400 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xl font-black text-white italic tracking-tighter uppercase">AI_ENGINE_SCANNING</h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] mt-3">Derin öğrenme modelleri portföy sağlığını analiz ediyor...</p>
                  </div>
                </div>
              ) : analysisData ? (
                <div className="space-y-10">
                   <div className="flex items-center gap-6 border-b border-white/5 pb-8">
                     <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                       <Zap className="w-8 h-8 text-purple-400" />
                     </div>
                     <div>
                       <h3 className="text-2xl font-black italic tracking-tighter text-white">STRATEJİK_ANALİZ_RAPORU</h3>
                       <p className="text-[10px] font-mono text-purple-400/50 uppercase tracking-[0.3em] mt-1">{analysisData.symbol} {"//"} PİLOT KARAR DESTEK SİSTEMİ</p>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {analysisData.insights.map((msg: string, i: number) => (
                        <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 transition-all flex gap-4 group">
                           <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0 group-hover:scale-125 transition-all shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                           <p className="text-sm font-medium text-white/70 leading-relaxed italic">"{msg}"</p>
                        </div>
                      ))}
                   </div>

                   <div className="pt-10 border-t border-white/5 space-y-8">
                      <div className="text-center">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">ÖNERİLEN_ADAPTİF_PARAMETRELER</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(analysisData.recommendedParams).map(([k, v]) => (
                          <div key={k} className="p-5 rounded-2xl bg-black/40 border border-emerald-500/10 text-center hover:border-emerald-500/40 transition-all">
                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block mb-1">{k.replace(/_/g, " ")}</span>
                            <span className="text-sm font-mono font-black text-emerald-400">{String(v)}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => updateEngineConfig(analysisData.recommendedParams)}
                        disabled={updatingParams}
                        className="w-full py-6 bg-emerald-500 text-black rounded-3xl text-[12px] font-black uppercase tracking-[0.4em] hover:bg-emerald-400 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-4"
                      >
                         <CheckCircle2 className="w-6 h-6" /> ADAPTİF_STRATEJİYİ_HESABA_KAT
                      </button>
                   </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center opacity-20 italic">
                  VERİ_YOK
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-400/5 border-emerald-400/10",
    cyan: "text-cyan-400 bg-cyan-400/5 border-cyan-400/10",
    rose: "text-rose-400 bg-rose-400/5 border-rose-400/10",
    amber: "text-amber-400 bg-amber-400/5 border-amber-400/10",
  };
  const classes = colorMap[color] || colorMap.cyan;

  return (
    <div className={`p-4 rounded-3xl border flex flex-col items-center transition-all hover:scale-105 duration-300 ${classes}`}>
      <div className="flex items-center justify-center gap-2 mb-2 opacity-60">
        {icon}
        <span className="text-[7px] font-black uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-xl font-black italic leading-none">{value}</div>
    </div>
  );
}
