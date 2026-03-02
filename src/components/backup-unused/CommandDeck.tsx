"use client";

import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, ShieldCheck, Activity, Target, Zap, Cpu, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHoldings } from '@/hooks/usePortfolio';
import { api } from '@/services/api';

type BotState = 'SCANNING' | 'IDLE' | 'ENTRY_PENDING' | 'POSITION_ACTIVE';

interface BotConfig {
    f4_length: number;
    whale_multiplier: number;
    ai_threshold: number;
    auto_trade: boolean;
    defense_mode: boolean;
    timeframe: string;
}

const PRESETS = {
    SCALP: { f4Length: 5, whaleMultiplier: 1.2, aiThreshold: 60 },
    SWING: { f4Length: 20, whaleMultiplier: 2.5, aiThreshold: 80 },
    SNIPER: { f4Length: 12, whaleMultiplier: 1.8, aiThreshold: 75 },
};

export const CommandDeck = () => {
    const { data: holdings, refetch: refetchHoldings } = useHoldings();
    const [config, setConfig] = useState<BotConfig>({
        f4_length: 10,
        whale_multiplier: 1.8,
        ai_threshold: 65,
        auto_trade: false,
        defense_mode: false,
        timeframe: '1h'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);

    interface ScanResult {
        symbol: string;
        exchange: string;
        close: number;
        change: number;
    }

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

    // 1. Load Initial Config
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await fetch('/api/bot/config');
                const data = await res.json();
                if (data && !data.error) {
                    setConfig(data);
                }
            } catch (err) {
                console.error('Config load error:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadConfig();
    }, []);

    // 1b. Market Radar Fetching
    useEffect(() => {
        const fetchScan = async () => {
            setIsScanning(true);
            try {
                const res = await fetch('/api/market/scan?exchange=BINANCE&type=gainers');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setScanResults(data.slice(0, 5));
                }
            } catch (err) {
                console.error('Scan error:', err);
            } finally {
                setIsScanning(false);
            }
        };
        fetchScan();
        const intervalId = setInterval(fetchScan, 30000);
        return () => clearInterval(intervalId);
    }, []);

    // 2. Save Config Helper
    const saveConfig = async (updates: Partial<BotConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig); // Optimistic update
        try {
            await fetch('/api/bot/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        } catch (err) {
            console.error('Config save error:', err);
        }
    };

    // 3. Emergency Actions
    const handlePanicSell = async () => {
        setIsActionLoading(true);
        console.log("[CommandDeck] Initiating Panic Sell request...");
        try {
            const res = await api.post("/panic/sell-all").then(r => r.data);
            if (res.success) {
                alert(`PANİK SATIŞ TAMAMLANDI: ${res.results.length} varlık satıldı. Toplam: ${res.totalUsdtValue.toFixed(2)} USDT`);
                setIsPanicActive(true);
                refetchHoldings();
            } else {
                alert(`Hata: ${res.message || 'Satış yapılamadı'}`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Sunucuya ulaşılamadı';
            console.error('[CommandDeck] Panic sell error:', err);
            alert(`Bağlantı Hatası: ${msg}`);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handlePanicBuy = async () => {
        setIsActionLoading(true);
        console.log("[CommandDeck] Initiating Panic Buy request...");
        try { 
            const res = await api.post("/panic/buy-back").then(r => r.data); 
            console.log("[CommandDeck] Panic Buy Response:", res);
            if (res.success) {
                alert(`PANİK ALIM (GERİ AL) TAMAMLANDI: ${res.results.length} varlık geri alındı. Harcanan: ${res.totalSpent.toFixed(2)} USDT`);
                setIsPanicActive(false);
                refetchHoldings(); 
            } else {
                alert(`Hata: ${res.message || 'Alım yapılamadı'}`);
            }
        } catch (err: unknown) { 
            const msg = err instanceof Error ? err.message : 'Sunucuya ulaşılamadı';
            console.error("[CommandDeck] Panic Buy Error:", err);
            alert(`Bağlantı Hatası: ${msg}`);
        } finally {
            setIsActionLoading(false);
        }
    };

    const applyPreset = (name: keyof typeof PRESETS) => {
        const preset = PRESETS[name];
        saveConfig({
            f4_length: preset.f4Length,
            whale_multiplier: preset.whaleMultiplier,
            ai_threshold: preset.aiThreshold
        });
    };

    // 4. Derive Active Bots from holdings
    const activeBots = (holdings || [])
        .filter(h => h.holding > 0)
        .map(h => {
            const isStable = h.symbol === 'USDT' || h.symbol === 'USDC';
            return {
                id: `UNIT-${h.symbol}`,
                pair: isStable ? h.symbol : h.symbol, // Use the symbol directly as it already has "/USDT"
                state: 'POSITION_ACTIVE' as BotState,
                profit: isStable ? 'STABLE' : (h.change24h > 0 ? `+${h.change24h.toFixed(2)}%` : `${h.change24h.toFixed(2)}%`),
                runtime: 'CANLI'
            };
        });

    if (isLoading) return <div className="p-10 text-center animate-pulse text-slate-500 font-mono">KOMUTA SİSTEMİ BAŞLATILIYOR...</div>;

    return (
        <div className="flex flex-col h-full bg-[#020617]/80 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative group/deck">
            {/* Holographic Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.1)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
            
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-950/50 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <Cpu className="w-4 h-4 text-indigo-400 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">KOMUTA PANELİ</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">MATRIX V5 ÇEVRİMİÇİ</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    {(['SCALP', 'SWING', 'SNIPER'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => applyPreset(p)}
                            className="px-2 py-1 rounded border border-white/5 bg-white/5 text-[9px] font-black text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all uppercase tracking-tighter"
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 overflow-hidden">
                {/* 1. Matrix Configuration */}
                <div className="space-y-6 flex flex-col">
                    <div className="flex items-center justify-between">
                         <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Zap className="w-3 h-3 text-amber-500" /> MOTOR YAPILANDIRMASI
                         </h4>
                    </div>
                    
                    <div className="space-y-5">
                        {/* F4 Length */}
                        <CustomSlider 
                            label="F4 Uzunluğu (Hassasiyet)" 
                            value={config.f4_length} 
                            min={5} max={50}
                            suffix=""
                            onChange={(val) => saveConfig({ f4_length: val })}
                            color="cyan"
                        />

                        {/* Whale Multiplier */}
                        <CustomSlider 
                            label="Balina Tespiti (StdSap)" 
                            value={config.whale_multiplier} 
                            min={1} max={5}
                            step={0.1}
                            suffix="x"
                            onChange={(val) => saveConfig({ whale_multiplier: val })}
                            color="indigo"
                        />

                        {/* AI Threshold */}
                        <CustomSlider 
                            label="V5 Güven Eşiği (Confluence)" 
                            value={config.ai_threshold} 
                            min={50} max={95}
                            suffix="%"
                            onChange={(val) => saveConfig({ ai_threshold: val })}
                            color="purple"
                        />
                    </div>

                    {/* Market Radar (New) */}
                    <div className="space-y-2 flex-1">
                         <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" /> Piyasa Radarı (Binance)
                             </span>
                             {isScanning && <span className="text-[8px] text-cyan-500 animate-pulse font-mono tracking-tighter">TARANIYOR...</span>}
                         </div>
                         <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2 min-h-[100px] flex flex-col gap-1.5">
                            {scanResults.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">Veri Bekleniyor</div>
                            ) : scanResults.map(res => (
                                <div key={res.symbol} className="flex items-center justify-between px-2 py-1 bg-white/5 rounded border border-white/5 hover:border-white/10 transition-all">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-white">{res.symbol.replace('BINANCE:', '').replace('USDT', '')}</span>
                                        <span className="text-[8px] text-slate-500 font-bold">{res.exchange}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] font-mono text-slate-400">${res.close?.toFixed(4)}</span>
                                        <span className={cn("text-[9px] font-black", res.change > 0 ? "text-emerald-400" : "text-rose-400")}>
                                            {res.change > 0 ? '+' : ''}{res.change?.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>

                    {/* Master Switch */}
                     <div className={cn(
                        "mt-auto flex items-center justify-between p-4 rounded-xl border transition-all duration-500 relative overflow-hidden group/switch",
                        config.auto_trade 
                            ? 'bg-emerald-500/5 border-emerald-500/30' 
                            : 'bg-slate-900/40 border-slate-800'
                     )}>

                        {config.auto_trade && (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 animate-[scan_3s_linear_infinite]" />
                        )}
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                "p-3 rounded-xl transition-all duration-500",
                                config.auto_trade ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-500'
                            )}>
                                <Power className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-white uppercase tracking-wider">OTOMATİK PİLOT</div>
                                <div className={cn(
                                    "text-[9px] font-bold uppercase mt-0.5",
                                    config.auto_trade ? 'text-emerald-400' : 'text-slate-500'
                                )}>
                                    {config.auto_trade ? 'AKTİF - SİSTEM ÇALIŞIYOR' : 'HAZIR - TETİKLEME BEKLENİYOR'}
                                </div>
                            </div>
                        </div>
                        <button 
                            disabled={isActionLoading}
                            onClick={() => saveConfig({ auto_trade: !config.auto_trade })}
                            className={cn(
                                "relative z-10 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                config.auto_trade 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20' 
                                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20',
                                isActionLoading && 'opacity-50 cursor-not-allowed'
                            )}
                        >
                            {config.auto_trade ? 'SİSTEMİ DURDUR' : 'SİSTEMİ BAŞLAT'}
                        </button>
                    </div>
                </div>

                {/* 2. Active Bots / Tactical Status */}
                <div className="flex flex-col">
                     <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Target className="w-3 h-3 text-rose-500" /> TAKTİKSEL BİRİMLER
                     </h4>
                     
                     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 flex-1 overflow-y-auto pr-1 content-start">
                        {activeBots.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center h-full min-h-[140px] opacity-30 gap-2 border border-dashed border-slate-700 rounded-xl bg-slate-900/40">
                                <Activity className="w-8 h-8" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">AKTARIM BEKLENİYOR</span>
                            </div>
                        ) : activeBots.map((bot, idx) => (
                            <div 
                                key={bot.id} 
                                className={cn(
                                    "group/bot relative aspect-square flex flex-col p-2.5 bg-slate-950/40 border transition-all duration-300 overflow-hidden rounded-lg",
                                    bot.profit.startsWith('+') 
                                        ? "border-emerald-500/20 hover:border-emerald-500/40 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]" 
                                        : "border-rose-500/20 hover:border-rose-500/40 shadow-[inset_0_0_15px_rgba(244,63,94,0.05)]"
                                )}
                            >
                                {/* Glow on hover */}
                                <div className={cn(
                                    "absolute inset-0 opacity-0 group-hover/bot:opacity-10 transition-opacity",
                                    bot.profit.startsWith('+') ? "bg-emerald-500" : "bg-rose-500"
                                )} />

                                {/* Atomic Number Style Index */}
                                <div className="flex justify-between items-start relative z-10">
                                    <span className="text-[8px] font-black font-mono text-slate-600 leading-none">{idx + 1}</span>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        bot.state === 'POSITION_ACTIVE' ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-slate-700"
                                    )} />
                                </div>

                                {/* Symbol (The Element) */}
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10">
                                    <span className="text-[13px] font-black text-white tracking-widest drop-shadow-lg">{bot.pair.split('/')[0]}</span>
                                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5 truncate max-w-full">{bot.id.split('-')[1]}</span>
                                </div>

                                {/* Profit (The Details) */}
                                <div className="mt-auto pt-1.5 border-t border-white/5 relative z-10">
                                    <div className={cn(
                                        "text-[10px] font-black font-mono text-center tracking-tighter",
                                        bot.profit.startsWith('+') ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {bot.profit}
                                    </div>
                                </div>

                                {/* Periodic Table Cell Border Accent */}
                                <div className={cn(
                                    "absolute top-0 right-0 w-4 h-4 border-t border-r opacity-30",
                                    bot.profit.startsWith('+') ? "border-emerald-500" : "border-rose-500"
                                )} />
                            </div>
                        ))}
                     </div>

                     {/* Override Controls */}
                     <div className="grid grid-cols-2 gap-3 mt-6">
                        {!isPanicActive ? (
                            <button 
                                disabled={isActionLoading}
                                onClick={handlePanicSell}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative"
                            >
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                                <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                PANİK SATIŞ
                            </button>
                        ) : (
                            <button 
                                disabled={isActionLoading}
                                onClick={handlePanicBuy}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative"
                            >
                                <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                                <RefreshCw className="w-4 h-4 group-hover:animate-spin" />
                                GERİ AL
                            </button>
                        )}
                        <button 
                            disabled={isActionLoading}
                            onClick={() => saveConfig({ defense_mode: !config.defense_mode })}
                            className={cn(
                                "flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative",
                                config.defense_mode 
                                    ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                            )}
                        >
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                            <ShieldCheck className={cn("w-4 h-4 group-hover:scale-110 transition-transform", config.defense_mode && "animate-pulse")} />
                            {config.defense_mode ? "SAVUNMA AKTİF" : "SAVUNMA MODU"}
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
};

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    onChange: (val: number) => void;
    color: 'cyan' | 'indigo' | 'purple' | 'amber';
}

const CustomSlider = ({ label, value, min, max, step = 1, suffix, onChange, color }: SliderProps) => {
    const percentage = ((value - min) / (max - min)) * 100;
    
    const colorMap = {
        cyan: 'bg-cyan-500',
        indigo: 'bg-indigo-500',
        purple: 'bg-purple-500',
        amber: 'bg-amber-500'
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className={cn("text-sm font-black font-mono tracking-tighter", `text-${color}-400`)}>{value}</span>
                    <span className="text-[10px] text-slate-600 font-bold uppercase">{suffix}</span>
                </div>
            </div>
            <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden group/slider">
                <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)]", colorMap[color])}
                    style={{ width: `${percentage}%` }}
                />
                <input 
                    type="range" 
                    min={min} max={max} step={step}
                    value={value} 
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
            </div>
        </div>
    );
};
