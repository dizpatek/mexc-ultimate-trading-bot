"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Square, Zap, Brain, Database, Activity, RefreshCw,
  ChevronRight, Terminal, Cpu, Thermometer, MemoryStick,
  BookOpen, FlaskConical, BarChart3, CheckCircle2, Clock,
  AlertTriangle, Download, Settings2,
} from "lucide-react";
import { useNotification } from "@/context/NotificationContext";

// ─── Topic Definitions ───────────────────────────────────────────────────────

const TRAINING_TOPICS = [
  { id: "kripto_bot",        label: "Kripto Bot Mimarisi",     color: "text-cyan-400",    emoji: "🤖" },
  { id: "pine_script",       label: "Pine Script / TradingView",color: "text-emerald-400", emoji: "📊" },
  { id: "teknik_analiz",     label: "Teknik Analiz",           color: "text-yellow-400",  emoji: "📈" },
  { id: "risk_yonetimi",     label: "Risk Yönetimi (TP/SL)",   color: "text-orange-400",  emoji: "🛡️" },
  { id: "exchange_api",      label: "Exchange API (MEXC/Binance)", color: "text-purple-400", emoji: "🔌" },
  { id: "backtesting",       label: "Backtesting & Optimizasyon", color: "text-rose-400",  emoji: "🔬" },
  { id: "websocket",         label: "WebSocket & Realtime",    color: "text-blue-400",    emoji: "⚡" },
  { id: "ml_ai_strateji",    label: "ML / AI Strateji",        color: "text-violet-400",  emoji: "🧠" },
  { id: "defi_onchain",      label: "DeFi & On-Chain Bot",     color: "text-teal-400",    emoji: "⛓️" },
  { id: "sentiment_analiz",  label: "Sentiment Analizi",       color: "text-pink-400",    emoji: "💬" },
  { id: "portfoy_yonetimi",  label: "Portföy Yönetimi",        color: "text-amber-400",   emoji: "💼" },
  { id: "market_structure",  label: "Market Microstructure",   color: "text-sky-400",     emoji: "🏗️" },
];

const POWER_PRESETS = [
  { label: "ECO", watts: 100, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  { label: "STD", watts: 150, color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5" },
  { label: "PRO", watts: 210, color: "text-orange-400 border-orange-500/30 bg-orange-500/5" },
  { label: "MAX", watts: 250, color: "text-red-400 border-red-500/30 bg-red-500/5" },
];

interface TrainingStatus {
  isTraining: boolean;
  isGenerating: boolean;
  startedAt: number | null;
  elapsed: number;
  powerLimit: number;
  lastTopic: string;
  datasetSizeKB: number;
}

interface GpuMetrics {
  power: string;
  temp: string;
  vram: string;
  util: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TrainingPanel() {
  const { notify } = useNotification();

  const [status, setStatus]           = useState<TrainingStatus | null>(null);
  const [gpu, setGpu]                 = useState<GpuMetrics>({ power: "?", temp: "?", vram: "?", util: "?" });
  const [logs, setLogs]               = useState<string[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedTopics, setSelected] = useState<string[]>(["kripto_bot", "pine_script", "risk_yonetimi", "exchange_api", "backtesting"]);
  const [powerWatts, setPowerWatts]   = useState(250);
  const [applyingPower, setApplyingPower] = useState(false);
  const [activeMode, setActiveMode]   = useState<"train" | "generate" | "monitor">("train");
  const logRef = useRef<HTMLDivElement>(null);

  // ─── Fetch Status ──────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch("/api/training");
      const data = await res.json();
      setStatus(data.status);
      setGpu(data.gpu);
      setLogs(data.logs || []);
      setPowerWatts(data.status?.powerLimit ?? 250);
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 4000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // ─── Actions ──────────────────────────────────────────────────────────
  const post = async (body: object) => {
    const res  = await fetch("/api/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleStartTraining = async () => {
    const r = await post({ action: "start_training" });
    if (r.ok) notify(r.message, "success"); else notify(r.error, "error");
    fetchStatus();
  };

  const handleStopTraining = async () => {
    const r = await post({ action: "stop_training" });
    if (r.ok) notify(r.message, "success"); else notify(r.error, "error");
    fetchStatus();
  };

  const handleGenerate = async () => {
    if (selectedTopics.length === 0) { notify("En az bir konu seçin.", "warning"); return; }
    const r = await post({ action: "generate_dataset", topics: selectedTopics });
    if (r.ok) notify(r.message, "success"); else notify(r.error, "error");
    fetchStatus();
  };

  const handleStopGenerate = async () => {
    const r = await post({ action: "stop_generate" });
    if (r.ok) notify(r.message, "success");
    fetchStatus();
  };

  const handleStartMonitor = async () => {
    const r = await post({ action: "start_monitor" });
    if (r.ok) notify(r.message, "success"); else notify(r.error, "error");
  };

  const handleSetPower = async (w: number) => {
    setApplyingPower(true);
    const r = await post({ action: "set_power_limit", powerLimit: w });
    if (r.ok) notify(r.message, "success"); else notify(r.error ?? "GPU limit ayarlanamadı", "warning");
    setApplyingPower(false);
    fetchStatus();
  };

  const toggleTopic = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  // ─── Derived ──────────────────────────────────────────────────────────
  const duration = status?.elapsed
    ? `${Math.floor(status.elapsed / 3600)}s ${Math.floor((status.elapsed % 3600) / 60)}d ${status.elapsed % 60}sn`
    : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-white/30">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-violet-400" />
        <span className="text-sm font-mono uppercase tracking-widest">Sistem hazırlanıyor...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ─── GPU Metrics Bar ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: <Zap className="w-4 h-4" />, label: "GPU POWER", value: gpu.power, color: "text-orange-400" },
          { icon: <Thermometer className="w-4 h-4" />, label: "TEMP", value: gpu.temp, color: "text-red-400" },
          { icon: <MemoryStick className="w-4 h-4" />, label: "VRAM", value: gpu.vram, color: "text-cyan-400" },
          { icon: <Activity className="w-4 h-4" />, label: "GPU LOAD", value: gpu.util, color: "text-emerald-400" },
        ].map((m) => (
          <div key={m.label} className="bg-black/40 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 ${m.color}`}>{m.icon}</div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">{m.label}</p>
              <p className={`text-lg font-black font-mono ${m.color}`}>{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Status Banner ───────────────────────────────────────────────── */}
      {status?.isTraining && (
        <div className="flex items-center gap-4 px-6 py-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.6)]" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-violet-400 animate-ping opacity-40" />
          </div>
          <span className="text-sm font-black text-violet-300 uppercase tracking-widest">Model Eğitimi Aktif</span>
          <span className="ml-auto text-xs text-violet-400/60 font-mono">{duration}</span>
        </div>
      )}
      {status?.isGenerating && (
        <div className="flex items-center gap-4 px-6 py-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-cyan-400 animate-ping opacity-40" />
          </div>
          <span className="text-sm font-black text-cyan-300 uppercase tracking-widest">
            Dataset Üretiliyor ({status.lastTopic})
          </span>
          <span className="ml-auto text-xs text-cyan-400/60 font-mono">{status.datasetSizeKB} KB</span>
        </div>
      )}

      {/* ─── Mode Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[
          { id: "train" as const,    icon: <Brain className="w-3.5 h-3.5" />,      label: "Model Eğitimi",    color: "violet" },
          { id: "generate" as const, icon: <Database className="w-3.5 h-3.5" />,   label: "Dataset Üretimi",  color: "cyan" },
          { id: "monitor" as const,  icon: <BarChart3 className="w-3.5 h-3.5" />,  label: "GPU & Güç",        color: "orange" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMode(m.id)}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              activeMode === m.id
                ? `border-${m.color}-500/40 bg-${m.color}-500/10 text-${m.color}-300`
                : "border-white/5 bg-white/5 text-white/30 hover:text-white/60"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-black/30 border border-white/5 rounded-xl">
          <Database className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[10px] font-black text-white/30 font-mono uppercase">{status?.datasetSizeKB ?? 0} KB Dataset</span>
        </div>
      </div>

      {/* ─── Train Mode ──────────────────────────────────────────────────── */}
      {activeMode === "train" && (
        <div className="bg-black/40 border border-violet-500/20 rounded-[2rem] p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <Brain className="w-5 h-5 text-violet-400" />
                MEXCBRAIN Model Eğitimi
              </h3>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-1">
                PyTorch / RTX 3080 · mexc_brain.pt · uv run train.py
              </p>
            </div>
            {status?.isTraining ? (
              <button
                onClick={handleStopTraining}
                className="flex items-center gap-3 px-8 py-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-red-500/20 transition-all"
              >
                <Square className="w-4 h-4" />
                DURDUR
              </button>
            ) : (
              <button
                onClick={handleStartTraining}
                className="flex items-center gap-3 px-8 py-4 bg-violet-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-violet-400 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] transition-all"
              >
                <Play className="w-4 h-4" />
                EĞİTİMİ BAŞLAT
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Eğitim Süresi", value: duration, icon: <Clock className="w-3.5 h-3.5" /> },
              { label: "GPU Limiti", value: `${powerWatts}W`, icon: <Zap className="w-3.5 h-3.5" /> },
              { label: "Dataset", value: `${status?.datasetSizeKB ?? 0} KB`, icon: <BookOpen className="w-3.5 h-3.5" /> },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                <div className="text-violet-400">{s.icon}</div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">{s.label}</p>
                  <p className="text-sm font-black text-white font-mono">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-[10px] text-amber-300/60 font-mono">
              En kapsamlı eğitim için önce &quot;Dataset Üretimi&quot; sekmesinden tüm konuları üret, ardından model eğitimini başlat.
              Tavsiye edilen süre: <strong className="text-amber-300">24-48 saat</strong>
            </p>
          </div>
        </div>
      )}

      {/* ─── Generate Mode ───────────────────────────────────────────────── */}
      {activeMode === "generate" && (
        <div className="bg-black/40 border border-cyan-500/20 rounded-[2rem] p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                <FlaskConical className="w-5 h-5 text-cyan-400" />
                Gemma 4 Dataset Üretimi
              </h3>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-1">
                Gemma-4-26B (MoE) · {selectedTopics.length} konu seçili · Soru-Cevap Çiftleri
              </p>
            </div>
            {status?.isGenerating ? (
              <button
                onClick={handleStopGenerate}
                className="flex items-center gap-3 px-8 py-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-red-500/20 transition-all"
              >
                <Square className="w-4 h-4" />
                DURDUR
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-3 px-8 py-4 bg-cyan-500 text-black rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] transition-all"
              >
                <Download className="w-4 h-4" />
                ÜRETİMİ BAŞLAT
              </button>
            )}
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4">Eğitim Konuları</p>
            <div className="grid grid-cols-3 gap-2">
              {TRAINING_TOPICS.map((t) => {
                const active = selectedTopics.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTopic(t.id)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                      active
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/5 bg-white/3 text-white/30 hover:bg-white/5 hover:text-white/60"
                    }`}
                  >
                    <span className="text-base">{t.emoji}</span>
                    <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${active ? t.color : ""}`}>
                      {t.label}
                    </span>
                    {active && <CheckCircle2 className={`w-3 h-3 ml-auto ${t.color}`} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setSelected(TRAINING_TOPICS.map(t => t.id))}
              className="text-[10px] text-white/30 hover:text-white uppercase tracking-widest font-black transition-colors"
            >
              Tümünü Seç
            </button>
            <button
              onClick={() => setSelected([])}
              className="text-[10px] text-white/30 hover:text-red-400 uppercase tracking-widest font-black transition-colors"
            >
              Temizle
            </button>
          </div>

          <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
            <p className="text-[10px] text-cyan-300/60 font-mono">
              💡 Tüm konular seçildiğinde tahmini üretim süresi:{" "}
              <strong className="text-cyan-300">6-12 saat</strong> (API rate limit bağlı)
            </p>
          </div>
        </div>
      )}

      {/* ─── Monitor / Power Mode ────────────────────────────────────────── */}
      {activeMode === "monitor" && (
        <div className="bg-black/40 border border-orange-500/20 rounded-[2rem] p-8 space-y-6">
          <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
            <Cpu className="w-5 h-5 text-orange-400" />
            GPU Güç Yönetimi
          </h3>

          {/* Power Presets */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-4">Güç Modu</p>
            <div className="grid grid-cols-4 gap-3">
              {POWER_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleSetPower(p.watts)}
                  disabled={applyingPower}
                  className={`flex flex-col items-center justify-center p-5 rounded-2xl border transition-all ${
                    powerWatts === p.watts
                      ? p.color
                      : "border-white/5 bg-white/3 text-white/30 hover:bg-white/5"
                  } disabled:opacity-40`}
                >
                  <span className="text-xl font-black mb-1">{p.watts}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest">WATT</span>
                  <span className={`text-[10px] font-black mt-2 ${powerWatts === p.watts ? "" : "text-white/30"}`}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Özel Güç Limiti</p>
              <span className="text-sm font-black text-orange-400 font-mono">{powerWatts}W</span>
            </div>
            <input
              type="range"
              min={50}
              max={320}
              step={5}
              value={powerWatts}
              onChange={(e) => setPowerWatts(Number(e.target.value))}
              onMouseUp={() => handleSetPower(powerWatts)}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-[9px] text-white/20 font-mono mt-1">
              <span>50W</span><span>185W</span><span>320W</span>
            </div>
          </div>

          {/* Monitor Start */}
          <button
            onClick={handleStartMonitor}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-orange-500/20 transition-all"
          >
            <Settings2 className="w-4 h-4" />
            DONANIM MONİTOR BAŞLAT
          </button>
        </div>
      )}

      {/* ─── Live Log Terminal ───────────────────────────────────────────── */}
      <div className="bg-black/60 border border-white/5 rounded-[2rem] p-6">
        <div className="flex items-center gap-3 mb-4">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">TRAINING_LIVE_LOG</span>
          <div className={`ml-auto w-2 h-2 rounded-full ${(status?.isTraining || status?.isGenerating) ? "bg-emerald-400 animate-pulse" : "bg-white/10"}`} />
        </div>
        <div
          ref={logRef}
          className="h-52 overflow-y-auto cyber-scrollbar font-mono text-[11px] leading-relaxed space-y-0.5"
        >
          {logs.length === 0 ? (
            <p className="text-white/20">{">"} Henüz log yok. Eğitimi başlatın...</p>
          ) : logs.map((line, i) => (
            <p
              key={i}
              className={
                line.includes("✅") || line.includes("🏆") ? "text-emerald-400" :
                line.includes("❌") || line.includes("STDERR") ? "text-red-400" :
                line.includes("⚠️") || line.includes("Skip") ? "text-yellow-400" :
                line.includes("🚀") ? "text-violet-400" :
                "text-white/50"
              }
            >
              {line}
            </p>
          ))}
        </div>
      </div>

    </div>
  );
}
