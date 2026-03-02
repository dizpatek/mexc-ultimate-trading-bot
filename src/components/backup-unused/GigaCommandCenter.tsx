"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Brain, Cpu, Activity, Globe, Fish, BarChart2, Zap,
    Power, AlertTriangle, ShieldCheck, Target, RefreshCw,
    TrendingUp, TrendingDown, Layers, RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHoldings } from "@/hooks/usePortfolio";
import { fetchGlobalMarketData } from "@/lib/market-data";
import { api } from "@/services/api";
import { normalizeSymbol } from "@/lib/symbol-utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface V5Indicator { name: string; value: string; state: string; color: "green" | "red" | "gray" | "orange"; }
interface ConfBreakdown { techScore: number; momentumScore: number; volumeScore: number; trendScore: number; marketScore: number; timingScore: number; totalScore: number; status: string; }
interface V5Signal {
    confluenceScore: number;
    confluenceBreakdown: ConfBreakdown;
    prediction: { upProb: number; downProb: number; text: string; direction: "UP" | "DOWN" | "FLAT"; };
    systemDecision: "GO_LONG" | "GO_SHORT" | "WAIT";
    deathRisk: boolean;
    marketRegime: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
    trend: "BULLISH" | "BEARISH" | "NEUTRAL";
    v5Indicators: V5Indicator[];
    adm: { bias: string; classification: number; evidence: string; };
    vpa: { netPressure: number; state: string; };
    momentumState: string;
    mtfConsensus: string;
    mtfBullCount: number;
    volatilityRegime: string;
    zScoreValue: number;
    whaleDetected: boolean;
    whaleSignalText: string;
    capitalPhase: string;
    capitalFlowText: string;
    regimePrediction: string;
    swingTrend: string;
}
interface BotConfig { f4_length: number; whale_multiplier: number; ai_threshold: number; auto_trade: boolean; defense_mode: boolean; timeframe: string; }
interface ScanResult { symbol: string; exchange: string; close: number; change: number; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const PRESETS = {
    SKALP: { f4_length: 5, whale_multiplier: 1.2, ai_threshold: 60 },
    SWING: { f4_length: 20, whale_multiplier: 2.5, ai_threshold: 80 },
    KESKİN: { f4_length: 12, whale_multiplier: 1.8, ai_threshold: 75 },
};

const sc = (s: number) => s >= 70 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-rose-400";
const sb = (s: number) => s >= 70 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-rose-500";
const ic = (c: V5Indicator["color"]) => ({ green: "bg-emerald-500", red: "bg-rose-500", orange: "bg-amber-500", gray: "bg-slate-600" })[c];

const MiniBar = ({ value, color = "bg-cyan-500", label }: { value: number; color?: string; label?: string }) => (
    <div>
        {label && <div className="flex justify-between text-base text-slate-500 mb-2 font-black uppercase tracking-wider"><span>{label}</span><span className="font-mono">{value.toFixed(0)}</span></div>}
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700 shadow-[0_0_10px_currentColor]", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        </div>
    </div>
);

const SH = ({ icon, title, color = "text-slate-400" }: { icon: React.ReactNode; title: string; color?: string }) => (
    <div className={cn("flex items-center gap-3 mb-5 pb-2 border-b border-slate-800/50 text-base font-black tracking-[0.15em] uppercase", color)}>
        <span className="w-6 h-6 shrink-0 opacity-80">{icon}</span>{title}
    </div>
);

const Row = ({ label, value, cls = "text-slate-300" }: { label: string; value: React.ReactNode; cls?: string }) => (
    <div className="flex items-center justify-between text-base py-2 border-b border-white/5 last:border-0 gap-2">
        <span className="text-slate-500 shrink-0 font-black uppercase tracking-tight">{label}</span>
        <span className={cn("font-mono font-black text-right truncate ml-1", cls)}>{value}</span>
    </div>
);

const SliderField = ({ label, value, min, max, step = 1, suffix = "", onChange, color }: {
    label: string; value: number; min: number; max: number; step?: number; suffix?: string;
    onChange: (v: number) => void; color: "cyan" | "indigo" | "purple" | "amber";
}) => {
    const pct = ((value - min) / (max - min)) * 100;
    const bg = { cyan: "bg-cyan-500", indigo: "bg-indigo-500", purple: "bg-purple-500", amber: "bg-amber-500" }[color];
    const tx = { cyan: "text-cyan-400", indigo: "text-indigo-400", purple: "text-purple-400", amber: "text-amber-400" }[color];
    return (
        <div className="space-y-2.5">
            <div className="flex justify-between items-end">
                <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{label}</span>
                <span className={cn("text-xl font-black font-mono", tx)}>{value}{suffix}</span>
            </div>
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className={cn("absolute inset-y-0 left-0 transition-all duration-300", bg)} style={{ width: `${pct}%` }} />
                <input type="range" min={min} max={max} step={step} value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface SmartTradeData {
    id: string | number;
    symbol: string;
    status: 'PENDING' | 'FILLED' | 'CANCELLED' | string;
    meta?: {
        payload?: {
            buyPrice?: number;
            takeProfit?: { price: number };
            stopLoss?: { price: number };
        }
    };
}

export const GigaCommandCenter = () => {
    const { data: holdings, refetch: refetchHoldings } = useHoldings();
    const [signal, setSignal] = useState<V5Signal | null>(null);
    const [btcDom, setBtcDom] = useState(0); const [usdtDom, setUsdtDom] = useState(0); const [othersDom, setOthersDom] = useState(0);
    const [config, setConfig] = useState<BotConfig>({ f4_length: 10, whale_multiplier: 1.8, ai_threshold: 65, auto_trade: false, defense_mode: false, timeframe: "1h" });
    const [smartTrades, setSmartTrades] = useState<SmartTradeData[]>([]);
    const [scanResults, setScanResults] = useState<ScanResult[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isPanicActive, setIsPanicActive] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("isPanicActive") === "true";
        }
        return false;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("isPanicActive", String(isPanicActive));
        }
    }, [isPanicActive]);

    const [isActionLoading, setIsActionLoading] = useState(false);
    const [pendingReset, setPendingReset] = useState(false);
    const [activeTab, setActiveTab] = useState<"intelligence" | "command">("intelligence");
    const [loading, setLoading] = useState(true);

    // ── Data fetching ─────────────────────────────────────────────────────────
    const fetchSignal = useCallback(async () => {
        try {
            const tf = config.timeframe || "4h";
            const [r1, mkt, stRes] = await Promise.all([
                api.get(`/indicators/f4?symbol=BTCUSDT&interval=${tf}`).then(r => r.data),
                fetchGlobalMarketData().catch(() => null),
                api.get("/trade/smart").then(r => r.data)
            ]);
            
            if (r1 && !r1.error) setSignal(r1);
            if (mkt) { setBtcDom(mkt.btcd?.value ?? 0); setUsdtDom(mkt.usdtd?.value ?? 0); setOthersDom(mkt.othersd?.value ?? 0); }
            if (Array.isArray(stRes)) setSmartTrades(stRes);
        } catch { /* silent */ }
        setLoading(false);
    }, [config.timeframe]);

    useEffect(() => {
        const init = async () => { await fetchSignal(); };
        init();
        const id = setInterval(fetchSignal, 30000);
        return () => clearInterval(id);
    }, [fetchSignal]);

    useEffect(() => {
        api.get("/bot/config").then(r => r.data).then(d => { if (d && !d.error) setConfig(d); }).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchScan = async () => {
            setIsScanning(true);
            try {
                const r = await api.get("/market/scan?exchange=BINANCE&type=gainers");
                const d = r.data;
                if (Array.isArray(d)) setScanResults(d.slice(0, 5));
            } catch { /* silent */ }
            setIsScanning(false);
        };
        fetchScan();
        const id = setInterval(fetchScan, 30000);
        return () => clearInterval(id);
    }, []);

    const saveConfig = useCallback(async (updates: Partial<BotConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
        try { await api.post("/bot/config", updates); } catch { /* silent */ }
    }, []);

    const handlePanicSell = async () => {
        setIsActionLoading(true);
        console.log("[GigaCommandCenter] Initiating Panic Sell request...");
        try { 
            const res = await api.post("/panic/sell-all").then(r => r.data); 
            console.log("[GigaCommandCenter] Panic Sell Response:", res);
            if (res.success) {
                alert(`PANİK SATIŞ TAMAMLANDI: ${res.results.length} varlık satıldı. Toplam: ${res.totalUsdtValue.toFixed(2)} USDT`);
                setIsPanicActive(true); // Toggle to Buy Back mode
                refetchHoldings(); 
            } else {
                alert(`Sistem Hatası: ${res.message || 'Satış yapılamadı'}`);
            }
        } catch (err: unknown) { 
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("[GigaCommandCenter] Panic Sell Error:", err);
            alert(`Bağlantı Hatası: ${errorMessage || 'Sunucuya ulaşılamadı'}`);
        }
        setIsActionLoading(false);
    };

    const handleResetSimulator = async () => {
        setIsActionLoading(true);
        setPendingReset(false);
        console.log("[GigaCommandCenter] Resetting Simulator (Deep Wipe)...");
        try {
            const res = await api.post("/portfolio/reset-simulator").then(r => r.data);
            if (res.success) {
                alert("SİMÜLATÖR SIFIRLANDI: $100,000 USDT bakiye yüklendi.");
                setIsPanicActive(false); 
                window.dispatchEvent(new Event('portfolioReset'));
                refetchHoldings();
            } else {
                alert(`Hata: ${res.error || res.message || 'Sıfırlanamadı'}`);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('[GigaCommandCenter] Reset error:', err);
            alert(`Bağlantı Hatası: ${errorMessage || 'Sunucuya ulaşılamadı'}`);
        } finally {
            setIsActionLoading(false);
            setPendingReset(false);
        }
    };

    const handlePanicBuy = async () => {
        setIsActionLoading(true);
        console.log("[GigaCommandCenter] Initiating Panic Buy request...");
        try { 
            const res = await api.post("/panic/buy-back").then(r => r.data); 
            console.log("[GigaCommandCenter] Panic Buy Response:", res);
            if (res.success) {
                alert(`PANİK ALIM (GERİ AL) TAMAMLANDI: ${res.results.length} varlık geri alındı. Harcanan: ${res.totalSpent.toFixed(2)} USDT`);
                setIsPanicActive(false); // Revert to Sell mode
                refetchHoldings(); 
            } else {
                alert(`Hata: ${res.message || 'Alım yapılamadı'}`);
            }
        } catch (err: unknown) { 
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error("[GigaCommandCenter] Panic Buy Error:", err);
            alert(`Bağlantı Hatası: ${errorMessage || 'Sunucuya ulaşılamadı'}`);
        }
        setIsActionLoading(false);
    };

    // ── Derived values ────────────────────────────────────────────────────────
    const score = signal?.confluenceScore ?? 0;
    const upProb = signal?.prediction?.upProb ?? 50;
    const downProb = signal?.prediction?.downProb ?? 50;
    const sysDecision = signal?.systemDecision ?? "WAIT";
    const sysText = sysDecision === "GO_LONG" ? "LONG AÇ ✅" : sysDecision === "GO_SHORT" ? "SHORT AÇ 🔻" : "BEKLE ⏸";
    const sysCls = sysDecision === "GO_LONG" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
        : sysDecision === "GO_SHORT" ? "text-rose-400 border-rose-500/30 bg-rose-500/5 shadow-[0_0_20px_rgba(244,63,94,0.1)]"
        : "text-slate-500 border-slate-700/30 bg-slate-900/20";

    const combinedBots = useMemo(() => {
        const hBots = (holdings || [])
            .filter(h => h.holding > 0)
            .map((h, idx) => {
                const isStable = h.symbol === 'USDT' || h.symbol === 'USDC';
                return { 
                    id: `HOLD-${h.symbol}`, 
                    pair: isStable ? h.symbol : normalizeSymbol(h.symbol), 
                    value: h.holding, 
                    profit: isStable ? 'STABLE' : (h.change24h >= 0 ? `+${h.change24h.toFixed(2)}%` : `${h.change24h.toFixed(2)}%`), 
                    status: 'FILLED', 
                    idx 
                };
            });

        const sBots = (smartTrades || [])
            .filter(t => t.status === 'PENDING' || t.status === 'FILLED')
            .map((t, idx) => ({ id: `SMART-${t.id}`, pair: t.symbol, profit: t.status === 'PENDING' ? 'PUSHING...' : 'PROTECT...', status: t.status, idx: idx + hBots.length }));

        return [...hBots, ...sBots];
    }, [holdings, smartTrades]);

    return (
        <div className="flex flex-col bg-[#020617]/90 backdrop-blur-xl border border-slate-800/60 rounded-xl overflow-hidden shadow-2xl relative">
            {/* Grid BG */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.08)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-30" />

            {/* ── HEADER ── */}
            <div className="relative z-10 flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-950/50">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/20">
                        <Brain className="w-6 h-6 text-cyan-400 animate-pulse" />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white uppercase tracking-[0.25em]">GIGA KOMUTA MERKEZİ</div>
                        <div className="text-xs text-slate-500 font-black tracking-[0.3em] mt-0.5">MATRIX V5 ENGINE • REAL-TIME</div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                        <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" /></span>
                        <span className="text-xs text-emerald-400 font-bold uppercase">CANLI</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Tab Switcher */}
                    <div className="flex bg-slate-950 rounded-xl border border-slate-800 p-0.5">
                        {([["intelligence", "🧠 İSTİHBARAT"], ["command", "⚙️ KOMUTA"]] as const).map(([tab, label]) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={cn("px-5 py-2 text-sm font-black uppercase rounded-lg transition-all",
                                    activeTab === tab ? "bg-cyan-500 text-slate-950 shadow-lg" : "text-slate-600 hover:text-slate-300"
                                )}>{label}</button>
                        ))}
                    </div>
                    {/* Timeframe Selector (Pilot Locked) */}
                    <div className={cn(
                        "flex bg-slate-950 rounded-xl border p-0.5 ml-2 transition-all duration-500",
                        config.auto_trade ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20" : "border-slate-800"
                    )}>
                        {["1m", "5m", "15m", "1h", "4h", "1d"].map((tf) => (
                            <button key={tf} 
                                onClick={() => !config.auto_trade && saveConfig({ timeframe: tf })}
                                disabled={config.auto_trade}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-black uppercase rounded-lg transition-all relative group",
                                    config.timeframe === tf 
                                        ? (config.auto_trade ? "bg-amber-500 text-slate-950 shadow-lg" : "bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.4)]")
                                        : (config.auto_trade ? "text-slate-700 pointer-events-none" : "text-slate-600 hover:text-slate-300")
                                )}
                            >
                                {tf}
                                {config.auto_trade && config.timeframe === tf && (
                                    <ShieldCheck className="w-3 h-3 absolute -top-1 -right-1 text-amber-600 bg-slate-950 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>

                    <button onClick={() => fetchSignal()} className="p-2.5 text-slate-600 hover:text-cyan-400 transition-colors rounded-xl hover:bg-slate-800/50 ml-1">
                        <RefreshCw className={cn("w-5 h-5", loading && "animate-spin text-cyan-400")} />
                    </button>
                    {/* PRESET BUTTONS */}
                    <div className="flex gap-1.5">
                        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(p => (
                            <button key={p} onClick={() => saveConfig(PRESETS[p])}
                                className="px-4 py-2.5 rounded-lg border border-slate-800 bg-slate-900/50 text-sm font-black text-slate-500 hover:text-white hover:border-slate-600 transition-all uppercase tracking-widest">
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── MAKER TAKER FLOW EXTERNAL FEED (16:4) ── */}
            <div className="relative w-full border-b border-slate-800/60 bg-slate-950/40 overflow-hidden" style={{ aspectRatio: '16/4' }}>
                <iframe 
                    src="https://makertakerflow.vercel.app/" 
                    className="w-full h-full border-none opacity-90 hover:opacity-100 transition-opacity duration-500"
                    title="Maker Taker Flow"
                />
                
                {/* HUD Overlay for Iframe */}
                <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                    <div className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">External Intelligence Link // MTF</span>
                </div>
                
                {/* Scanlines Effect */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,146,0.02))] bg-[size:100%_4px,3px_100%] z-10 opacity-30"></div>
            </div>

            {/* ══════════ INTELLIGENCE TAB ══════════ */}
            {activeTab === "intelligence" && (
                <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 divide-x divide-slate-800/40 min-h-[260px]">

                    {/* COL 1: 🧠 GIGA AI SKOR */}
                    <div className="p-3 space-y-3">
                        <SH icon={<Brain size={14} />} title="GIGA AI" color="text-cyan-400" />
                        <div className="flex flex-col items-center py-4">
                            <div className={cn("text-7xl font-black font-mono leading-none tracking-tighter", sc(score))}>{score.toFixed(0)}</div>
                            <div className="text-sm text-slate-500 font-black tracking-[0.3em] mt-2">/ 100 SKOR</div>
                            <div className="w-full mt-4"><MiniBar value={score} color={sb(score)} /></div>
                        </div>
                        <Row label="Confluence" value={`${score.toFixed(0)}/100`} cls={sc(score)} />
                        <Row label="Tahmin" value={signal?.prediction?.text ?? "—"} cls={upProb >= 60 ? "text-emerald-400" : downProb >= 60 ? "text-rose-400" : "text-slate-400"} />
                        <div className={cn("mt-4 w-full text-center py-4 rounded-xl border text-base font-black tracking-widest shadow-xl", sysCls)}>
                            {sysText}
                        </div>
                        {signal?.confluenceBreakdown && (
                            <div className="space-y-1 pt-1">
                                <MiniBar value={signal.confluenceBreakdown.techScore} color="bg-cyan-500" label="Teknik" />
                                <MiniBar value={signal.confluenceBreakdown.momentumScore} color="bg-violet-500" label="Momentum" />
                                <MiniBar value={signal.confluenceBreakdown.volumeScore} color="bg-amber-500" label="Hacim" />
                                <MiniBar value={signal.confluenceBreakdown.trendScore} color="bg-emerald-500" label="Trend" />
                            </div>
                        )}
                    </div>

                    {/* COL 2: 🔬 İLERİ ANALİZ */}
                    <div className="p-3 space-y-2">
                        <SH icon={<Activity size={14} />} title="İleri Analiz" color="text-violet-400" />
                        <Row label="ADM Z-Drift" value={`${signal?.adm?.bias ?? "—"} (${signal?.adm?.evidence ?? "YOK"})`}
                            cls={(signal?.adm?.classification ?? 0) > 0 ? "text-emerald-400" : (signal?.adm?.classification ?? 0) < 0 ? "text-rose-400" : "text-slate-400"} />
                        <Row label="VPA Net" value={`${(signal?.vpa?.netPressure ?? 0).toFixed(1)}%`}
                            cls={(signal?.vpa?.netPressure ?? 0) > 0 ? "text-emerald-400" : "text-rose-400"} />
                        <Row label="VPA Durum" value={signal?.vpa?.state ?? "—"} cls="text-cyan-300" />
                        <div className="pt-1 space-y-1 border-t border-slate-800/40 mt-1">
                            <Row label="Yapı (SMC)" value={signal?.swingTrend === "BULLISH" ? "Boğa 📈" : signal?.swingTrend === "BEARISH" ? "Ayı 📉" : "Nötr ➡️"}
                                cls={signal?.swingTrend === "BULLISH" ? "text-emerald-400" : signal?.swingTrend === "BEARISH" ? "text-rose-400" : "text-slate-400"} />
                            <Row label="Momentum" value={signal?.momentumState ?? "—"} cls="text-amber-300" />
                        </div>
                    </div>

                    {/* COL 3: 📊 V5 İNDİKATÖRLER */}
                    <div className="p-3 space-y-2">
                        <SH icon={<BarChart2 size={16} />} title="V5 İndikatörler" color="text-emerald-400" />
                        <div className="flex gap-2 mb-3">
                            {(signal?.v5Indicators ?? []).map((ind, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1.5" title={`${ind.name}: ${ind.state} (${ind.value})`}>
                                    <span className={cn("w-full h-5 rounded-md shadow-sm transition-all hover:scale-105", ic(ind.color))} />
                                    <span className="text-[11px] font-black text-slate-600 w-full text-center truncate tracking-tighter">{ind.name.slice(0, 3)}</span>
                                </div>
                            ))}
                        </div>
                        {(signal?.v5Indicators ?? []).map(ind => (
                            <div key={ind.name} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-sm", ic(ind.color))} />
                                    <span className="text-slate-500 font-bold">{ind.name}</span>
                                </div>
                                <span className={cn("font-black text-sm tracking-tight", { green: "text-emerald-400", red: "text-rose-400", orange: "text-amber-400", gray: "text-slate-500" }[ind.color])}>{ind.state}</span>
                            </div>
                        ))}
                        {(!signal?.v5Indicators?.length) && <div className="text-slate-600 text-xs text-center py-4">VERİ BEKLENİYOR...</div>}
                    </div>

                    {/* COL 4: 🌐 PİYASA */}
                    <div className="p-3 space-y-3">
                        <SH icon={<Globe size={14} />} title="Piyasa" color="text-blue-400" />
                        {[
                            { label: "BTC.DOM", val: btcDom || signal?.confluenceBreakdown?.marketScore || 58, color: "bg-amber-500" },
                            { label: "USDT.DOM", val: usdtDom || 4, color: "bg-cyan-500" },
                            { label: "OTHERS.D", val: othersDom || signal?.confluenceBreakdown?.techScore || 12, color: "bg-rose-500" },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="space-y-1.5">
                                <div className="flex justify-between text-sm font-black">
                                    <span className="text-slate-600 uppercase tracking-widest">{label}</span>
                                    <span className="font-mono text-slate-300">{val.toFixed(1)}%</span>
                                </div>
                                <MiniBar value={val} color={color} />
                            </div>
                        ))}
                        <Row label="Rejim" value={signal?.marketRegime === "RISK_ON" ? "LONG ✅" : signal?.marketRegime === "RISK_OFF" ? "SHORT 🔴" : "NÖTR"} cls={signal?.marketRegime === "RISK_ON" ? "text-emerald-400" : signal?.marketRegime === "RISK_OFF" ? "text-rose-400" : "text-slate-400"} />
                        <Row label="Sermaye" value={signal?.capitalFlowText ?? "—"} cls="text-cyan-300" />
                        <Row label="Tahmin" value={signal?.regimePrediction?.replace(/_/g, " ") ?? "—"} cls="text-amber-300" />
                    </div>

                    {/* COL 5: 🐋 WHALE */}
                    <div className="p-3 space-y-2">
                        <SH icon={<Fish size={16} />} title="Whale Engine" color="text-teal-400" />
                        <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-black mb-4 shadow-inner overflow-hidden",
                            signal?.whaleDetected ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-slate-800/30 border-slate-700/20 text-slate-700"
                        )}>
                            <Fish className={cn("w-5 h-5 shrink-0 transition-transform duration-500", signal?.whaleDetected && "scale-110 animate-pulse")} />
                            <span className="truncate">{signal?.whaleDetected ? signal.whaleSignalText || "WHALE TESPİT EDİLDİ 🐳" : "Aktivite Yok"}</span>
                        </div>
                        <Row label="MTF Uzlaşı" value={signal?.mtfConsensus ?? "—"} cls={(signal?.mtfBullCount ?? 0) >= 4 ? "text-emerald-400" : (signal?.mtfBullCount ?? 0) <= 1 ? "text-rose-400" : "text-amber-400"} />
                        <div className="flex gap-1.5 my-2">
                            {[...Array(5)].map((_, i) => <div key={i} className={cn("flex-1 h-2 rounded-sm shadow-sm", i < (signal?.mtfBullCount ?? 0) ? "bg-emerald-500" : "bg-slate-700")} />)}
                        </div>
                        <Row label="Vol Rejim" value={signal?.volatilityRegime ?? "NORMAL"} cls={signal?.volatilityRegime === "SQUEEZE" ? "text-purple-400 animate-pulse" : "text-slate-400"} />
                        <Row label="Z-Skor" value={(signal?.zScoreValue ?? 0).toFixed(2)} cls={Math.abs(signal?.zScoreValue ?? 0) > 2 ? "text-rose-400" : "text-emerald-400"} />
                        {signal?.deathRisk && <div className="mt-5 w-full py-4 bg-rose-500/15 border border-rose-500/30 rounded-xl text-center text-sm font-black text-rose-400 animate-pulse shadow-rose-500/10 shadow-lg">🛑 KILL SWITCH AKTİF</div>}
                    </div>

                    {/* COL 6: ⚙️ MÜHENDİSLİK */}
                    <div className="p-3 space-y-3">
                        <SH icon={<Cpu size={16} />} title="Mühendislik" color="text-purple-400" />
                        <div className="p-4 bg-slate-900/40 border border-slate-700/20 rounded-xl text-center shadow-inner">
                            <div className="text-sm text-slate-600 font-black uppercase tracking-[0.2em] mb-2">BAŞARI ORANI</div>
                            <div className={cn("text-5xl font-black font-mono tracking-tighter", sc(score))}>%{score.toFixed(0)}</div>
                            <div className="mt-3"><MiniBar value={score} color={sb(score)} /></div>
                        </div>
                        <div className="flex gap-2 mt-3">
                            <div className="flex-1 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center">
                                <div className="text-xs text-slate-600 font-black uppercase tracking-widest">YUKARI</div>
                                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">{upProb.toFixed(0)}%</div>
                            </div>
                            <div className="flex-1 py-3 bg-rose-500/5 border border-rose-500/10 rounded-xl text-center">
                                <div className="text-xs text-slate-600 font-black uppercase tracking-widest">AŞAĞI</div>
                                <div className="text-xl font-black text-rose-400 font-mono mt-0.5">{downProb.toFixed(0)}%</div>
                            </div>
                        </div>
                        <div className={cn("w-full text-center py-4 rounded-xl border text-base font-black shadow-lg", sysCls)}>{sysText}</div>
                        <Row label="KILL SW" value={signal?.deathRisk ? "AKTİF 🛑" : "OK ✅"} cls={signal?.deathRisk ? "text-rose-400 animate-pulse" : "text-emerald-400"} />
                        <Row label="ENGINE" value="V5 AKTIF ✅" cls="text-emerald-400" />
                    </div>
                </div>
            )}

            {/* ══════════ COMMAND TAB ══════════ */}
            {activeTab === "command" && (
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-0 divide-x divide-slate-800/40 min-h-[260px]">

                    {/* COL 1: MOTOR YAPILANDIRMASI */}
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-2.5 mb-4 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                            <Zap className="w-4 h-4 text-amber-500" />MOTOR AYARLARI
                        </div>
                        <SliderField label="F4 Hassasiyeti" value={config.f4_length} min={5} max={50} onChange={(v) => saveConfig({ f4_length: v })} color="cyan" />
                        <SliderField label="Balina Çarpanı" value={config.whale_multiplier} min={1} max={5} step={0.1} suffix="x" onChange={(v) => saveConfig({ whale_multiplier: v })} color="indigo" />
                        <SliderField label="AI Güven Eşiği" value={config.ai_threshold} min={50} max={95} suffix="%" onChange={(v) => saveConfig({ ai_threshold: v })} color="purple" />

                        {/* Piyasa Radarı */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-cyan-400" />Piyasa Radarı
                                </span>
                                {isScanning && <span className="text-xs text-cyan-400 animate-pulse font-black uppercase tracking-tighter">TARANIYOR...</span>}
                            </div>
                            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2.5 min-h-[100px] shadow-inner">
                                {scanResults.length === 0
                                    ? <div className="text-center text-xs text-slate-700 font-bold py-6 uppercase tracking-widest">Veri Bekleniyor</div>
                                    : scanResults.map(r => (
                                        <div key={r.symbol} className="flex justify-between items-center px-4 py-2 bg-white/5 rounded-lg text-sm border border-white/5 transition-all hover:bg-white/10">
                                            <span className="font-black text-white tracking-tight">{r.symbol.replace("BINANCE:", "").replace("USDT", "")}</span>
                                            <span className={cn("font-black font-mono", r.change > 0 ? "text-emerald-400" : "text-rose-400")}>
                                                {r.change > 0 ? "+" : ""}{r.change?.toFixed(2)}%
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>

                    {/* COL 2: TAKTİKSEL BİRİMLER */}
                    <div className="p-4 flex flex-col">
                        <div className="flex items-center gap-2.5 mb-5 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                            <Target className="w-4 h-4 text-rose-500" />TAKTİKSEL BİRİMLER
                        </div>
                        <div className="grid grid-cols-3 gap-2 flex-1 content-start">
                            {combinedBots.length === 0
                                ? <div className="col-span-3 flex items-center justify-center h-40 border-2 border-dashed border-slate-800 rounded-2xl text-xs font-black text-slate-700 uppercase tracking-[0.25em]">Aktif Pozisyon Yok</div>
                                : combinedBots.map(bot => (
                                    <div key={bot.id} className={cn(
                                        "relative aspect-square flex flex-col p-4 bg-slate-950/40 border-2 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 group",
                                        bot.status === 'PENDING' ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500" :
                                        (bot.profit.startsWith("+") ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/50" : "border-rose-500/20 bg-rose-500/5 hover:border-rose-500/50")
                                    )}>
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] text-slate-700 font-black font-mono uppercase tracking-tighter">{bot.status}</span>
                                            {bot.status === 'PENDING' && <Zap className="w-3 h-3 text-amber-500 animate-pulse" />}
                                        </div>
                                        <div className="flex-1 flex items-center justify-center">
                                            <span className="text-lg font-black text-white tracking-tighter group-hover:scale-110 transition-transform leading-none">{bot.pair.split("/")[0]}</span>
                                        </div>
                                        <div className={cn("text-xs font-black font-mono text-center border-t border-white/5 pt-2.5 mt-1",
                                            bot.status === 'PENDING' ? "text-amber-400" :
                                            (bot.profit.startsWith("+") ? "text-emerald-400" : "text-rose-400")
                                        )}>{bot.profit}</div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* COL 3: KONTROLLAR */}
                    <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-2.5 mb-2 text-sm font-black text-slate-400 uppercase tracking-[0.2em]">
                            <Layers className="w-4 h-4 text-indigo-500" />SİSTEM KONTROLÜ
                        </div>

                        {/* Otomatik Pilot */}
                        <div className={cn("flex items-center justify-between p-3 rounded-xl border transition-all duration-500 relative overflow-hidden",
                            config.auto_trade ? "bg-emerald-500/5 border-emerald-500/30" : "bg-slate-900/40 border-slate-800"
                        )}>
                            {config.auto_trade && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 animate-pulse" />}
                            <div className="flex items-center gap-4 relative z-10">
                                <div className={cn("p-3.5 rounded-xl transition-all", config.auto_trade ? "bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "bg-slate-800")}>
                                    <Power className={cn("w-6 h-6", config.auto_trade ? "text-slate-950" : "text-slate-500")} />
                                </div>
                                <div>
                                    <div className="text-base font-black text-white uppercase tracking-wider">OTOMATİK PİLOT</div>
                                    <div className={cn("text-sm font-black uppercase tracking-[0.2em] mt-0.5", config.auto_trade ? "text-emerald-400" : "text-slate-600")}>
                                        {config.auto_trade ? "AKTİF ✅" : "HAZIR"}
                                    </div>
                                </div>
                            </div>
                            <button disabled={isActionLoading} onClick={() => saveConfig({ auto_trade: !config.auto_trade })}
                                className={cn("relative z-10 px-6 py-3 rounded-xl text-base font-black uppercase transition-all shadow-xl active:scale-95",
                                    config.auto_trade ? "bg-rose-500/10 text-rose-400 border-2 border-rose-500/30 hover:bg-rose-500/20"
                                        : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/30"
                                )}>{config.auto_trade ? "DURDUR" : "BAŞLAT"}</button>
                        </div>

                        {/* Emergency Toggle */}
                        <div className="grid grid-cols-2 gap-3">
                            {!isPanicActive ? (
                                <button disabled={isActionLoading} onClick={handlePanicSell}
                                    className="col-span-2 flex items-center justify-center gap-3 px-4 py-4 bg-rose-500/10 border-2 border-rose-500/40 rounded-xl hover:bg-rose-500/20 text-rose-400 text-sm font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 group/panic">
                                    <AlertTriangle className="w-6 h-6 group-hover/panic:animate-bounce" />
                                    PANİK SAT (ACİL DURUM)
                                </button>
                            ) : (
                                <button disabled={isActionLoading} onClick={handlePanicBuy}
                                    className="col-span-2 flex items-center justify-center gap-3 px-4 py-4 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl hover:bg-emerald-500/20 text-emerald-400 text-sm font-black uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95 group/buy">
                                    <RefreshCw className="w-6 h-6 group-hover/buy:animate-spin" />
                                    PİYASAYA DÖN (GERİ AL)
                                </button>
                            )}
                            <div className="col-span-2 relative">
                                {!pendingReset ? (
                                    <button 
                                        onClick={() => setPendingReset(true)}
                                        disabled={isActionLoading}
                                        className="w-full py-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 transition-all flex items-center justify-center gap-2 group"
                                        title="Simülatörü Sıfırla"
                                    >
                                        <RotateCcw className={`w-4 h-4 ${isActionLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                                        <span className="text-xs font-black uppercase tracking-widest">{isActionLoading ? 'SIFIRLANIYOR...' : 'SİMÜLATÖRÜ SIFIRLA'}</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 p-3 bg-slate-900 border border-amber-500/30 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                        <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest mr-2 leading-none">TÜM VERİLER SİLİNECEK?</span>
                                        <div className="flex gap-1.5 ml-auto">
                                            <button 
                                                onClick={handleResetSimulator}
                                                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase transition-all shadow-lg active:scale-95"
                                            >
                                                SIFIRLA ✓
                                            </button>
                                            <button 
                                                onClick={() => setPendingReset(false)}
                                                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase transition-all active:scale-95"
                                            >
                                                İPTAL ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button disabled={isActionLoading} onClick={() => saveConfig({ defense_mode: !config.defense_mode })}
                            className={cn("flex items-center justify-center gap-3 px-4 py-3.5 border-2 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all shadow-lg active:scale-95",
                                config.defense_mode ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)]"
                                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                            )}>
                            <ShieldCheck className={cn("w-5 h-5", config.defense_mode && "animate-pulse")} />
                            {config.defense_mode ? "SAVUNMA AKTİF ✅" : "SAVUNMA MODUNU ETKİNLEŞTİR"}
                        </button>

                        {/* Status mini-panel */}
                        <div className="mt-auto space-y-2.5 p-4 bg-slate-900/40 rounded-xl border border-slate-800/50 shadow-inner">
                            <div className="text-xs font-black text-slate-600 uppercase tracking-[0.25em] mb-3">CANLI SİNYAL (BTC 4H)</div>
                            <Row label="AI Skor" value={`${score.toFixed(0)}/100`} cls={sc(score)} />
                            <Row label="Karar" value={sysText} cls={sysDecision === "GO_LONG" ? "text-emerald-400" : sysDecision === "GO_SHORT" ? "text-rose-400" : "text-slate-400"} />
                            <Row label="Trend" value={signal?.trend ?? "—"} cls={signal?.trend === "BULLISH" ? "text-emerald-400" : signal?.trend === "BEARISH" ? "text-rose-400" : "text-slate-400"} />
                            <Row label="MTF" value={signal?.mtfConsensus ?? "—"} cls="text-cyan-300" />
                        </div>
                    </div>
                </div>
            )}

            {/* ── BOTTOM STATUS BAR ── */}
            <div className="relative z-10 flex items-center justify-between px-5 py-4 border-t border-slate-800/40 bg-slate-950/50 text-sm font-black text-slate-600 font-mono uppercase tracking-[0.25em]">
                <div className="flex items-center gap-6">
                    <span className={cn("flex items-center gap-2", signal?.systemDecision === "GO_LONG" ? "text-emerald-500" : signal?.systemDecision === "GO_SHORT" ? "text-rose-500" : "text-slate-600")}>
                        {signal?.systemDecision === "GO_LONG" ? <TrendingUp className="w-5 h-5 shadow-[0_0_10px_rgba(16,185,129,0.3)]" /> : signal?.systemDecision === "GO_SHORT" ? <TrendingDown className="w-5 h-5 shadow-[0_0_10px_rgba(244,63,94,0.3)]" /> : null}
                        {sysText}
                    </span>
                    <span className="opacity-30">•</span>
                    <span className="text-slate-500">BTC 4H</span>
                    <span className="opacity-30">•</span>
                    <span className={sc(score)}>SKOR: {score.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2">KILL SW: {signal?.deathRisk ? <span className="text-rose-400 animate-pulse">🛑 AKTİF</span> : <span className="text-emerald-400">✅ OK</span>}</span>
                    <span className="opacity-30">•</span>
                    <span className="text-slate-500">MATRIX V5 ENGINE</span>
                </div>
            </div>
        </div>
    );
};
