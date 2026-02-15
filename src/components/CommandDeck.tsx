"use client";

import React, { useState } from 'react';
import { Power, AlertTriangle, ShieldCheck, Activity, Target, Zap, Waves, Cpu, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';

type BotState = 'SCANNING' | 'IDLE' | 'ENTRY_PENDING' | 'POSITION_ACTIVE';

interface Bot {
    id: string;
    pair: string;
    state: BotState;
    profit: string;
    runtime: string;
}

const PRESETS = {
    SCALP: { f4Length: 5, whaleMultiplier: 1.2, aiThreshold: 60 },
    SWING: { f4Length: 20, whaleMultiplier: 2.5, aiThreshold: 80 },
    SNIPER: { f4Length: 12, whaleMultiplier: 1.8, aiThreshold: 75 },
};

export const CommandDeck = () => {
    const [config, setConfig] = useState({
        f4Length: 10,
        whaleMultiplier: 1.8,
        aiThreshold: 65,
        autoTrade: false
    });

    const [activeBots] = useState<Bot[]>([
        { id: 'BOT-01', pair: 'BTC/USDT', state: 'SCANNING', profit: '+1.2%', runtime: '04:12:45' },
        { id: 'BOT-02', pair: 'ETH/USDT', state: 'POSITION_ACTIVE', profit: '+3.5%', runtime: '12:05:12' },
        { id: 'BOT-03', pair: 'SOL/USDT', state: 'IDLE', profit: '0.0%', runtime: '00:00:00' }
    ]);

    const applyPreset = (name: keyof typeof PRESETS) => {
        const preset = PRESETS[name];
        setConfig(prev => ({ ...prev, ...preset }));
    };

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
                            value={config.f4Length} 
                            min={5} max={50}
                            suffix=""
                            onChange={(val) => setConfig({ ...config, f4Length: val })}
                            color="cyan"
                        />

                        {/* Whale Multiplier */}
                        <CustomSlider 
                            label="Balina Tespiti (StdSap)" 
                            value={config.whaleMultiplier} 
                            min={1} max={5}
                            step={0.1}
                            suffix="x"
                            onChange={(val) => setConfig({ ...config, whaleMultiplier: val })}
                            color="indigo"
                        />

                        {/* AI Threshold */}
                        <CustomSlider 
                            label="YZ Güven Eşiği" 
                            value={config.aiThreshold} 
                            min={50} max={95}
                            suffix="%"
                            onChange={(val) => setConfig({ ...config, aiThreshold: val })}
                            color="purple"
                        />
                    </div>

                    {/* Master Switch */}
                     <div className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all duration-500 relative overflow-hidden group/switch",
                        config.autoTrade 
                            ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                            : 'bg-slate-900/40 border-slate-800'
                     )}>
                        {config.autoTrade && (
                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 animate-[scan_3s_linear_infinite]" />
                        )}
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                "p-3 rounded-xl transition-all duration-500",
                                config.autoTrade ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800 text-slate-500'
                            )}>
                                <Power className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-xs font-black text-white uppercase tracking-wider">OTOMATİK PİLOT</div>
                                <div className={cn(
                                    "text-[9px] font-bold uppercase mt-0.5",
                                    config.autoTrade ? 'text-emerald-400' : 'text-slate-500'
                                )}>
                                    {config.autoTrade ? 'AKTİF - SİSTEM ÇALIŞIYOR' : 'HAZIR - TETİKLEME BEKLENİYOR'}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setConfig({ ...config, autoTrade: !config.autoTrade })}
                            className={cn(
                                "relative z-10 px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                config.autoTrade 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20' 
                                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20'
                            )}
                        >
                            {config.autoTrade ? 'SİSTEMİ DURDUR' : 'SİSTEMİ BAŞLAT'}
                        </button>
                    </div>
                </div>

                {/* 2. Active Bots / Tactical Status */}
                <div className="flex flex-col">
                     <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Target className="w-3 h-3 text-rose-500" /> TAKTİKSEL BİRİMLER
                     </h4>
                     
                     <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                        {activeBots.map((bot) => (
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
                        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative">
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                            <AlertTriangle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            PANİK SATIŞ
                        </button>
                        <button className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest transition-all group overflow-hidden relative">
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
                            <ShieldCheck className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            SAVUNMA MODU
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
