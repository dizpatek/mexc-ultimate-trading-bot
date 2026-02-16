"use client";

import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, ShieldCheck, Activity, Target, Zap, Waves, Cpu, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHoldings } from '@/hooks/usePortfolio';

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
        if (!confirm('TÜM VARLIKLARI USDT\'YE ÇEVİRMEK İSTEDİĞİNİZDEN EMİN MİSİNİZ?')) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/bot/emergency/panic', { method: 'POST' });
            const data = await res.json();
            alert(data.message || 'Panic sell işlemi tamamlandı');
            refetchHoldings();
        } catch (err) {
            console.error('Panic sell failed:', err);
            alert('Panic sell başarısız oldu');
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
        .filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC' && h.holding > 0)
        .map(h => ({
            id: `UNIT-${h.symbol}`,
            pair: `${h.symbol}/USDT`,
            state: 'POSITION_ACTIVE' as BotState,
            profit: h.change24h > 0 ? `+${h.change24h.toFixed(2)}%` : `${h.change24h.toFixed(2)}%`,
            runtime: 'CANLI'
        }));

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
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">MATRIX V3 ÇEVRİMİÇİ</span>
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

            <div className="p-4 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                {/* 1. Matrix Configuration */}
                <div className="space-y-6">
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
                            label="YZ Güven Eşiği" 
                            value={config.ai_threshold} 
                            min={50} max={95}
                            suffix="%"
                            onChange={(val) => saveConfig({ ai_threshold: val })}
                            color="purple"
                        />

                        {/* Timeframe Selection */}
                        <div className="space-y-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" /> Hesaplama Periyodu
                             </span>
                             <div className="grid grid-cols-4 gap-2">
                                {['15m', '30m', '1h', '4h'].map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => saveConfig({ timeframe: tf })}
                                        className={cn(
                                            "py-1.5 rounded-lg text-[10px] font-black border transition-all",
                                            config.timeframe === tf 
                                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" 
                                                : "bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        {tf.toUpperCase()}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>

                    {/* Master Switch */}
                     <div className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-500 relative overflow-hidden group/switch",
                        config.auto_trade 
                            ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
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
                     
                     <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {activeBots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2 border border-dashed border-slate-700 rounded-xl">
                                <Activity className="w-8 h-8" />
                                <span className="text-[10px] font-bold uppercase">AKTARIM BEKLENİYOR</span>
                            </div>
                        ) : activeBots.map((bot) => (
                            <div 
                                key={bot.id} 
                                className="group/bot flex items-center justify-between p-3 bg-slate-900/30 border border-white/5 rounded-xl hover:bg-slate-800/40 hover:border-white/10 transition-all relative overflow-hidden"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center border transition-all",
                                            bot.state === 'SCANNING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                                            bot.state === 'POSITION_ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                                            'bg-slate-800/50 border-slate-700 text-slate-500'
                                        )}>
                                            {bot.state === 'SCANNING' ? <Waves className="w-5 h-5 animate-pulse" /> :
                                             bot.state === 'POSITION_ACTIVE' ? <Activity className="w-5 h-5" /> :
                                             <Crosshair className="w-5 h-5" />}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white">{bot.pair}</span>
                                            <span className="text-[9px] font-mono text-slate-600 font-bold">{bot.id}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={cn(
                                                "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                                                bot.state === 'SCANNING' ? 'bg-amber-500/20 text-amber-500' :
                                                bot.state === 'POSITION_ACTIVE' ? 'bg-emerald-500/20 text-emerald-500' :
                                                'bg-slate-800 text-slate-500'
                                            )}>
                                                {bot.state === 'SCANNING' ? 'TARANIYOR' : 
                                                 bot.state === 'POSITION_ACTIVE' ? 'POZİSYONDA' : 
                                                 'BEKLEMEDE'}
                                            </span>
                                            <span className="text-[9px] font-mono text-slate-500">{bot.runtime}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="text-right">
                                    <div className={cn(
                                        "text-sm font-black font-mono tracking-tighter",
                                        bot.profit.startsWith('+') ? 'text-emerald-400' : bot.profit === '0.0%' ? 'text-slate-500' : 'text-rose-400'
                                    )}>
                                        {bot.profit}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-600 uppercase">GÜNCEL PNL</div>
                                </div>
                            </div>
                        ))}
                     </div>

                     {/* Override Controls */}
                     <div className="grid grid-cols-2 gap-3 mt-6">
                        <button 
                            disabled={isActionLoading}
                            onClick={handlePanicSell}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative"
                        >
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                            <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            PANİK SATIŞ
                        </button>
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
