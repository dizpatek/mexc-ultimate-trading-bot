"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, TrendingUp, Zap } from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';

interface HologramVisualProps {
    type: 'overview' | 'architecture' | 'trailing' | 'engine' | 'settings' | 'defense' | 'strategy' | 'routine' | 'whale' | 'regime' | 'smc' | 'radar' | 'killswitch' | 'decay' | 'bayesian' | 'bridge' | 'trailing_buy' | 'trailing_sell' | 'ai_score' | 'stop_loss' | 'breakeven' | 'wick_protection' | 'panic' | 'test_mode' | 'ob' | 'volatility' | 'zscore' | 'capital' | 'fvg' | 'alarms' | 'scalp' | 'swing' | 'performance' | 'limit' | 'market' | 'split_tp' | 'timeout' | 'tech_panel' | 'decision' | 'simulator';
    className?: string;
}

export const HologramVisual: React.FC<HologramVisualProps> = ({ type, className }) => {
    return (
        <div className={cn("relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/20 bg-slate-950/50 flex items-center justify-center group/visual", className)}>
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-10" style={{ 
                backgroundImage: `linear-gradient(rgba(34, 211, 238, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.2) 1px, transparent 1px)`,
                backgroundSize: '20px 20px'
            }} />

            {/* Visual Logic based on Type */}
            {type === 'overview' && (
                <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
                    <div className="absolute inset-4 border-2 border-blue-500/40 rounded-full animate-spin duration-[4s]" />
                    <div className="absolute inset-8 border-2 border-cyan-400 rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 bg-cyan-400 rounded-sm shadow-[0_0_15px_#22d3ee] animate-pulse" />
                    </div>
                </div>
            )}

            {type === 'whale' && (
                <div className="relative w-48 h-32 flex items-center justify-center">
                    <svg viewBox="0 0 100 60" className="w-full h-full text-cyan-500/40">
                        {/* Whale Body */}
                        <path 
                            d="M 10 30 Q 15 10 50 10 Q 85 10 90 30 Q 85 50 50 50 Q 15 50 10 30" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1" 
                            className="animate-pulse"
                        />
                        {/* Radar Pulses */}
                        <circle cx="50" cy="30" r="5" fill="currentColor">
                            <animate attributeName="r" from="5" to="40" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                        </circle>
                    </svg>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        <div className="px-2 py-0.5 rounded bg-cyan-500/20 text-[8px] font-black text-cyan-400 border border-cyan-500/30">WHALE_DETECTED</div>
                    </div>
                </div>
            )}

            {type === 'regime' && (
                <div className="relative w-48 h-32 flex items-center justify-center">
                    <div className="relative w-24 h-24 border-b-2 border-white/10 rounded-full">
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-10 bg-cyan-500 origin-bottom transition-transform duration-1000 rotate-[45deg]" />
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-black text-emerald-400">RISK_ON</div>
                        <div className="absolute top-1/2 -right-12 -translate-y-1/2 text-[10px] font-black text-rose-500">RISK_OFF</div>
                    </div>
                    {/* Acceleration Arrows */}
                    <div className="absolute top-4 right-8 flex flex-col gap-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400 animate-bounce" />
                        <TrendingUp className="w-4 h-4 text-emerald-400 opacity-50" />
                    </div>
                </div>
            )}

            {type === 'smc' && (
                <div className="w-3/4 h-1/2 relative flex items-center justify-center">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        {/* Price Action Steps */}
                        <path d="M 0 80 L 40 40 L 80 60 L 120 20 L 160 40 L 200 10" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
                        {/* BOS Label */}
                        <line x1="120" y1="20" x2="160" y2="20" stroke="#10b981" strokeWidth="2" strokeDasharray="4 2" />
                        <text x="130" y="15" fill="#10b981" fontSize="8" fontWeight="bold">BOS</text>
                        {/* OB Area */}
                        <rect x="70" y="55" width="20" height="10" fill="#22d3ee" opacity="0.2" className="animate-pulse" />
                        <text x="72" y="75" fill="#22d3ee" fontSize="8" fontWeight="bold">OB</text>
                    </svg>
                </div>
            )}

            {type === 'radar' && (
                <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-4 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-8 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-transparent to-transparent rounded-full animate-spin duration-[3s]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <span className="text-[10px] font-black text-cyan-400">BTC</span>
                        <div className="w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]" />
                    </div>
                </div>
            )}

            {type === 'killswitch' && (
                <div className="relative group/ks">
                    <div className="w-20 h-20 border-4 border-rose-500/20 rounded-full flex items-center justify-center">
                        <Zap className="w-10 h-10 text-rose-500 animate-pulse" />
                    </div>
                    <div className="absolute -inset-4 border border-rose-500/10 rounded-full group-hover/ks:animate-ping" />
                    <div className="mt-4 text-[8px] font-black text-rose-500 uppercase tracking-widest text-center">SYSTEM_FATIGUE</div>
                </div>
            )}

            {type === 'decay' && (
                <div className="w-1/2 h-4 bg-slate-900 border border-white/10 rounded-full overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-transparent w-full transition-all duration-[5s] ease-linear" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] font-black text-white/50 tracking-tighter uppercase">Signal_Freshness_Decaying</span>
                    </div>
                </div>
            )}

            {type === 'bayesian' && (
                <div className="w-2/3 h-1/2 flex items-end gap-1 px-4">
                    {[3, 5, 8, 12, 18, 14, 10, 6, 4].map((h, i) => (
                        <div key={i} className="flex-1 bg-cyan-500/30 border-t border-cyan-400/50 rounded-t-sm" style={{ height: `${h * 4}%` }}>
                            {i === 4 && <div className="w-full h-full bg-cyan-400 animate-pulse" />}
                        </div>
                    ))}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-black text-cyan-400">P(Success | Signals)</div>
                </div>
            )}

            {type === 'bridge' && (
                <div className="relative">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center">
                            <MatrixLogo size={24} glow={false} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="w-12 h-1 bg-cyan-400/20 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-cyan-400 animate-dash-h" />
                            </div>
                            <div className="w-12 h-1 bg-blue-400/20 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-blue-400 animate-dash-h-reverse" />
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-blue-500/30 flex items-center justify-center opacity-50">
                            <div className="w-6 h-6 border-2 border-blue-400/30 rounded-full" />
                        </div>
                    </div>
                    <div className="mt-4 text-[8px] font-black text-cyan-400 uppercase tracking-widest text-center">BRIDGE_CONNECTION_ESTABLISHED</div>
                </div>
            )}

            {type === 'architecture' && (
                <div className="flex flex-col gap-1 w-2/3 h-2/3 items-center justify-center">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full border border-cyan-500/20 rounded-md bg-cyan-500/5 py-1 px-2 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                            <div className="w-8 h-1 bg-cyan-500/30 rounded-full" />
                            <div className="w-2 h-2 rounded-full bg-cyan-400/40" />
                        </div>
                    ))}
                </div>
            )}

            {type === 'trailing' && (
                <div className="w-3/4 h-1/2 relative">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 200 100">
                        <path 
                            d="M 0 80 Q 50 10 100 80 T 200 20" 
                            fill="none" 
                            stroke="rgba(34, 211, 238, 0.4)" 
                            strokeWidth="2" 
                            strokeDasharray="5,5"
                        />
                        <path 
                            d="M 0 90 Q 50 20 100 90 T 200 30" 
                            fill="none" 
                            stroke="#22d3ee" 
                            strokeWidth="3"
                            className="animate-dash"
                        />
                        <circle cx="100" cy="90" r="4" fill="#10b981" className="shadow-lg">
                            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
                        </circle>
                    </svg>
                </div>
            )}

            {type === 'engine' && (
                <div className="relative text-center">
                    <div className="text-4xl font-black text-cyan-400 mb-2 font-mono tabular-nums">
                        89%
                    </div>
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Confidence Level</div>
                    <div className="mt-4 flex gap-1 justify-center">
                        {[...Array(10)].map((_, i) => (
                            <div key={i} className={cn("w-1 h-4 rounded-full transition-all duration-500", i < 8 ? "bg-cyan-500 shadow-[0_0_5px_#22d3ee]" : "bg-white/10")} style={{ transitionDelay: `${i * 50}ms` }} />
                        ))}
                    </div>
                </div>
            )}

            {type === 'settings' && (
                <div className="flex flex-col gap-3 w-1/2">
                    <div className="h-2 w-full bg-cyan-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 w-[70%] shadow-[0_0_10px_#22d3ee] animate-pulse" />
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/10">
                        <div className="w-8 h-2 bg-blue-500/30 rounded-full" />
                        <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    </div>
                    <div className="h-2 w-full bg-cyan-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 w-[45%] shadow-[0_0_10px_#22d3ee]" />
                    </div>
                </div>
            )}

            {type === 'defense' && (
                <div className="relative">
                    <Shield className="w-16 h-16 text-cyan-400 absolute inset-0 opacity-20 blur-md scale-125" />
                    <Shield className="w-16 h-16 text-cyan-400 relative z-10 animate-pulse" />
                    <div className="absolute -inset-8 border border-cyan-500/20 rounded-full animate-spin duration-[10s]" />
                </div>
            )}

            {type === 'strategy' && (
                <div className="flex flex-col gap-4 w-3/4">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500 to-transparent" />
                    </div>
                    <div className="flex items-center gap-3 ml-6 opacity-60">
                        <div className="w-2 h-2 rounded-sm border border-blue-500" />
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-500 to-transparent" />
                    </div>
                    <div className="flex items-center gap-3 ml-12 opacity-40">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500 to-transparent" />
                    </div>
                </div>
            )}

            {type === 'trailing_buy' && (
                <div className="w-3/4 h-1/2 relative">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        <path d="M 0 20 L 50 60 L 80 40 L 120 80 L 150 70" fill="none" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="2" strokeDasharray="5,5" />
                        <path d="M 150 70 L 180 40" stroke="#10b981" strokeWidth="3" className="animate-dash" strokeDasharray="100" />
                        <circle cx="150" cy="70" r="4" fill="#06b6d4" className="animate-pulse" />
                        <text x="140" y="85" fill="#06b6d4" fontSize="8" fontWeight="bold">BUY_POINT</text>
                    </svg>
                </div>
            )}

            {type === 'trailing_sell' && (
                <div className="w-3/4 h-1/2 relative">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        <path d="M 0 80 L 50 40 L 80 60 L 120 20 L 150 30" fill="none" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="2" strokeDasharray="5,5" />
                        <path d="M 150 30 L 180 60" stroke="#f43f5e" strokeWidth="3" className="animate-dash" strokeDasharray="100" />
                        <circle cx="150" cy="30" r="4" fill="#f43f5e" className="animate-pulse" />
                        <text x="140" y="25" fill="#f43f5e" fontSize="8" fontWeight="bold">SELL_POINT</text>
                    </svg>
                </div>
            )}

            {type === 'ai_score' && (
                <div className="relative text-center">
                    <div className="text-5xl font-black text-emerald-400 mb-2 font-mono italic">
                        94.2
                    </div>
                    <div className="text-[10px] font-bold text-cyan-500/50 uppercase tracking-[0.3em]">AI_TRUST_SCORE</div>
                    <div className="mt-6 flex gap-1 justify-center">
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className={cn("w-1.5 h-6 rounded-full transition-all duration-500", i < 14 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-white/10")} />
                        ))}
                    </div>
                </div>
            )}

            {type === 'stop_loss' && (
                <div className="w-3/4 h-1/2 relative flex flex-col justify-center gap-4">
                    <div className="w-full h-[1px] bg-white/10 relative">
                        <div className="absolute top-[-10px] left-0 text-[8px] font-bold text-white/50">ENTRY_OR_CURRENT</div>
                    </div>
                    <div className="w-full h-[2px] bg-rose-500/50 relative shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                        <div className="absolute top-[-15px] right-0 px-2 py-1 bg-rose-500 rounded text-[8px] font-black text-white animate-bounce">STOP_LOSS_TRAILED</div>
                    </div>
                </div>
            )}

            {type === 'breakeven' && (
                <div className="w-3/4 h-1/2 relative flex flex-col justify-center gap-4">
                    <div className="w-full h-[2px] bg-cyan-500/50 relative shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                        <div className="absolute top-[-15px] left-1/4 px-2 py-1 bg-cyan-500 rounded text-[8px] font-black text-white">BREAKEVEN_PROTECTION</div>
                        <div className="absolute top-1/2 left-0 w-full h-[30px] bg-cyan-500/10 pointer-events-none" />
                    </div>
                </div>
            )}

            {type === 'wick_protection' && (
                <div className="w-3/4 h-1/2 relative">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        <path d="M 50 50 L 50 90" stroke="#f43f5e" strokeWidth="2" />
                        <rect x="40" y="30" width="20" height="40" fill="#f43f5e" opacity="0.4" />
                        <path d="M 50 10 L 50 30" stroke="#f43f5e" strokeWidth="2" />
                        <circle cx="50" cy="90" r="12" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4,2" className="animate-spin" style={{ animationDuration: '3s' }} />
                        <text x="70" y="95" fill="#22d3ee" fontSize="8" fontWeight="bold">WICK_FILTERED</text>
                    </svg>
                </div>
            )}

            {type === 'panic' && (
                <div className="relative group/panic-visual">
                    <div className="w-24 h-24 rounded-full border-4 border-rose-500/20 flex items-center justify-center p-2">
                        <div className="w-full h-full rounded-full bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.6)] flex items-center justify-center animate-pulse">
                            <span className="text-white font-black italic tracking-tighter text-xl">PANIC</span>
                        </div>
                    </div>
                </div>
            )}

            {type === 'test_mode' && (
                <div className="relative text-center">
                    <div className="text-4xl font-black text-amber-400 mb-2 font-mono">
                        $100,000.00
                    </div>
                    <div className="text-[8px] font-bold text-amber-500/50 uppercase tracking-[0.4em]">SIMULATION_BALANCE</div>
                    <div className="mt-4 px-4 py-2 border border-amber-500/20 bg-amber-500/5 rounded text-[10px] font-black text-amber-400 italic">DEMO ENVIRONMENT ACTIVE</div>
                </div>
            )}

            {type === 'ob' && (
                <div className="w-3/4 h-1/2 relative">
                    <div className="absolute top-0 left-0 w-full h-8 bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                        <span className="text-[10px] font-black text-rose-500">BEARISH_OB_ZONE</span>
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-12 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                        <span className="text-[10px] font-black text-emerald-500">BULLISH_OB_REACTION</span>
                    </div>
                </div>
            )}

            {type === 'fvg' && (
                <div className="w-3/4 h-1/2 relative flex flex-col gap-1 overflow-hidden">
                    <div className="h-4 w-full bg-slate-800 rounded-t border border-white/5 opacity-50" />
                    <div className="h-16 w-full bg-cyan-500/10 border-x-2 border-cyan-500/30 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black text-cyan-400 z-10">FAIR_VALUE_GAP // FLOW_ACTIVE</span>
                        </div>
                        {/* Flow Particles */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent w-full h-full animate-flow-r" />
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="absolute h-px bg-cyan-400/40 w-12 animate-particle-r" style={{ top: `${20 * i + 10}%`, left: '-50px', animationDelay: `${i * 0.5}s` }} />
                        ))}
                    </div>
                    <div className="h-4 w-full bg-slate-800 rounded-b border border-white/5 opacity-50" />
                </div>
            )}

            {type === 'volatility' && (
                <div className="w-3/4 h-1/2 flex items-center justify-center">
                    <svg viewBox="0 0 200 100" className="w-full h-full text-cyan-400">
                        <path d="M 0 50 Q 25 10 50 50 T 100 50 T 150 50 T 200 50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100">
                            <animate attributeName="stroke-dashoffset" from="200" to="0" dur="2s" repeatCount="indefinite" />
                        </path>
                    </svg>
                </div>
            )}

            {type === 'zscore' && (
                <div className="w-3/4 h-1/2 flex flex-col justify-center items-center gap-6">
                    <div className="w-full h-[1px] bg-white/20 relative">
                        <div className="absolute top-[-20px] left-0 text-[8px] font-bold text-cyan-500">+3σ (EXTREME)</div>
                        <div className="absolute bottom-[-20px] left-0 text-[8px] font-bold text-rose-500">-3σ (EXTREME)</div>
                        <div className="absolute left-1/2 -top-2 w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_20px_#22d3ee] animate-pulse" />
                    </div>
                </div>
            )}

            {type === 'capital' && (
                <div className="w-full h-full relative flex flex-col items-center justify-center p-6">
                    <div className="relative w-48 h-48">
                        {/* Rotating Ring */}
                        <div className="absolute inset-0 border-2 border-dashed border-cyan-500/20 rounded-full animate-spin duration-[20s]" />
                        {/* Sectors */}
                        {[
                            { label: 'AI', rot: 0, color: 'text-purple-400', bg: 'bg-purple-500/20' },
                            { label: 'MEME', rot: 90, color: 'text-amber-400', bg: 'bg-amber-500/20' },
                            { label: 'AI', rot: 180, color: 'text-blue-400', bg: 'bg-blue-500/20' },
                            { label: 'DePIN', rot: 270, color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
                        ].map((sector, i) => (
                            <div key={i} className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${sector.rot}deg)` }}>
                                <div className="absolute top-0 flex flex-col items-center -translate-y-4" style={{ transform: `rotate(${-sector.rot}deg)` }}>
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 shadow-lg", sector.bg)}>
                                        <span className={cn("text-[8px] font-black", sector.color)}>{sector.label}</span>
                                    </div>
                                    <div className="w-px h-8 bg-gradient-to-t from-cyan-500/50 to-transparent mt-1" />
                                </div>
                            </div>
                        ))}
                        {/* Central Hub */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-slate-900 border border-cyan-500/30 flex items-center justify-center group-hover/visual:scale-110 transition-transform">
                                <div className="w-8 h-8 rounded-full bg-cyan-500/20 animate-pulse flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-4 text-[8px] font-black text-cyan-500/50 tracking-[0.4em] uppercase">Sector_Rotation_Tracking</div>
                </div>
            )}

            {type === 'performance' && (
                <div className="relative text-center w-full h-full flex flex-col items-center justify-center">
                    <div className="absolute top-4 right-4 text-[6px] font-mono text-emerald-500/50 text-right uppercase">
                        Protocol_V4.0 // Secured<br />
                        Asset_Protection: ON
                    </div>
                    <div className="text-5xl font-black text-emerald-400 mb-1 font-mono italic tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                        +42.5%
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-emerald-500/5 px-3 py-1 rounded-full border border-emerald-500/20">PROFIT_SNAPSHOT_YTD</div>
                    <svg viewBox="0 0 100 30" className="w-48 h-12 text-emerald-500 mt-4 filter drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                        <path d="M 0 30 L 10 28 L 20 22 L 30 25 L 40 18 L 50 20 L 60 12 L 70 15 L 80 5 L 90 8 L 100 0" fill="none" stroke="currentColor" strokeWidth="2" className="animate-path" strokeDasharray="200" />
                        <circle cx="100" cy="0" r="3" fill="currentColor" className="animate-ping" />
                    </svg>
                    <div className="mt-8 grid grid-cols-3 gap-4 w-2/3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500/40 w-full animate-shimmer" style={{ animationDelay: `${i * 0.2}s` }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {type === 'alarms' && (
                <div className="relative w-64 h-48 flex items-center justify-center">
                    <div className="absolute inset-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-500/10">
                            {[0, 45, 90, 135, 180, 225, 270, 315].map(r => (
                                <line key={r} x1="50" y1="50" x2={50 + 40 * Math.cos(r * Math.PI / 180)} y2={50 + 40 * Math.sin(r * Math.PI / 180)} stroke="currentColor" strokeWidth="0.5" />
                            ))}
                            <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                        </svg>
                    </div>
                    <div className="relative w-16 h-16 bg-slate-900 border border-cyan-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full" />
                        <Zap className="w-8 h-8 text-cyan-400" />
                    </div>
                    {/* Active Alerts */}
                    <div className="absolute top-4 left-4 p-2 bg-slate-900/80 border border-white/10 rounded-lg backdrop-blur-sm scale-75 border-l-2 border-l-emerald-400">
                        <div className="text-[6px] text-emerald-400 font-bold uppercase">Whale_Buy // Confirmed</div>
                        <div className="text-[5px] text-slate-500">BTCUSDT // 1H // +85%</div>
                    </div>
                    <div className="absolute bottom-4 right-4 p-2 bg-slate-900/80 border border-white/10 rounded-lg backdrop-blur-sm scale-75 border-l-2 border-l-rose-400">
                        <div className="text-[6px] text-rose-400 font-bold uppercase">Volatility_Squeeze</div>
                        <div className="text-[5px] text-slate-500">SOLUSDT // 15M // SENSE</div>
                    </div>
                </div>
            )}

            {type === 'scalp' && (
                <div className="w-full h-full relative p-8 flex items-center justify-center">
                    <div className="absolute top-4 left-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                        <span className="text-[8px] font-black text-emerald-400 tracking-tighter uppercase">LTF_Scalping_Active // 15m</span>
                    </div>
                    <svg viewBox="0 0 200 100" className="w-full h-2/3">
                        <path d="M 0 80 L 10 75 L 20 78 L 30 60 L 40 65 L 50 40 L 60 45 L 70 20 L 80 25 L 90 10 L 100 15 L 110 5 L 120 10 L 130 5 L 140 15" fill="none" stroke="#10b981" strokeWidth="2" className="animate-path" strokeDasharray="300" />
                        <circle cx="140" cy="15" r="3" fill="#10b981">
                            <animate attributeName="r" values="3;5;3" dur="0.8s" repeatCount="indefinite" />
                        </circle>
                        <line x1="0" y1="50" x2="200" y2="50" stroke="white" opacity="0.05" strokeDasharray="2,2" />
                    </svg>
                </div>
            )}

            {type === 'swing' && (
                <div className="w-full h-full relative p-8 flex items-center justify-center">
                    <div className="absolute top-4 left-6 flex items-center gap-2">
                        <div className="w-2 h-2 rounded bg-cyan-500 shadow-[0_0_8px_#22d3ee]" />
                        <span className="text-[8px] font-black text-cyan-400 tracking-tighter uppercase">HTF_Swing_Strategy // 4H</span>
                    </div>
                    <svg viewBox="0 0 200 100" className="w-full h-2/3">
                        <path d="M 0 90 Q 50 10 100 60 T 200 20" fill="none" stroke="#06b6d4" strokeWidth="3" opacity="0.5" className="animate-path" strokeDasharray="500" />
                        <path d="M 0 90 Q 50 10 100 60 T 200 20" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,2" className="opacity-30" />
                        <rect x="40" y="20" width="30" height="4" fill="#06b6d4" opacity="0.2" className="animate-pulse" />
                        <rect x="150" y="40" width="30" height="4" fill="#f43f5e" opacity="0.2" />
                    </svg>
                </div>
            )}

            {type === 'limit' && (
                <div className="w-2/3 h-2/3 flex flex-col gap-4 justify-center">
                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] border-b border-white/5 pb-2">Order_Book_Gateway</div>
                    <div className="flex gap-1.5 h-32 items-end">
                        {[15, 25, 45, 75, 20, 15, 60, 40, 30, 10].map((h, i) => (
                            <div key={i} className={cn("flex-1 rounded-t-sm transition-all duration-500", i < 4 ? "bg-emerald-500/20" : "bg-rose-500/20")} style={{ height: `${h}%` }}>
                                {i === 3 && <div className="w-full h-full bg-emerald-500/40 animate-pulse border-t border-emerald-400" />}
                                {i === 6 && <div className="w-full h-full bg-rose-500/40 animate-pulse border-t border-rose-400" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {type === 'market' && (
                <div className="relative w-64 h-16 flex items-center">
                    <div className="absolute inset-0 bg-slate-900/50 rounded-xl border border-white/5 backdrop-blur-sm" />
                    <div className="relative w-full h-1 bg-white/5 mx-4 rounded-full overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-scan-x" />
                    </div>
                    <Zap className="absolute right-6 w-5 h-5 text-emerald-400 animate-pulse" />
                    <div className="absolute left-6 text-[8px] font-black text-cyan-500/50 uppercase">Flash_Execution</div>
                </div>
            )}

            {type === 'split_tp' && (
                <div className="flex items-center gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex flex-col items-center gap-3">
                            <div className={cn("w-14 h-14 rounded-2xl border-2 flex items-center justify-center bg-slate-900 shadow-xl", i === 1 ? "border-emerald-500/50 shadow-emerald-500/10" : "border-white/10 opacity-50")}>
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] font-black text-emerald-400">TP{i}</span>
                                    <span className="text-[6px] text-slate-500 font-bold">{(100/3*i).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="w-px h-4 bg-gradient-to-b from-white/10 to-transparent" />
                        </div>
                    ))}
                </div>
            )}

            {type === 'timeout' && (
                <div className="relative w-32 h-32">
                    <svg viewBox="0 0 100 100" className="w-full h-full rotate-[-90deg]">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f43f5e" strokeWidth="4" strokeDasharray="251" strokeDashoffset="60" className="animate-timer-ring shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-rose-500 font-mono tracking-tighter">45<span className="text-xs opacity-50 ml-0.5">s</span></span>
                        <span className="text-[6px] text-slate-500 font-bold uppercase tracking-widest mt-1">Execution_TTL</span>
                    </div>
                </div>
            )}

            {type === 'tech_panel' && (
                <div className="w-4/5 h-3/4 grid grid-cols-2 gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-slate-950 border border-cyan-500/10 rounded-xl relative overflow-hidden p-2">
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-500/20 animate-scan-y" />
                            <div className="space-y-1.5">
                                <div className="w-1/2 h-1 bg-cyan-500/30 rounded-full" />
                                <div className="w-full h-1 bg-white/5 rounded-full" />
                                <div className="flex gap-1">
                                    <div className="flex-1 h-3 bg-emerald-500/10 rounded flex items-center justify-center">
                                        <div className="w-1/2 h-0.5 bg-emerald-500/30 rounded-full animate-pulse" />
                                    </div>
                                    <div className="flex-1 h-3 bg-blue-500/10 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {type === 'decision' && (
                <div className="relative w-64 h-48 flex items-center justify-center">
                    {/* Neural Net Hub */}
                    <div className="absolute inset-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                            {[
                                { x: 20, y: 20, l: 'Whale' }, { x: 80, y: 20, l: 'AI' },
                                { x: 20, y: 80, l: 'SMC' }, { x: 80, y: 80, l: 'Regime' }
                            ].map((p, i) => (
                                <g key={i}>
                                    <line x1={p.x} y1={p.y} x2="50" y2="50" stroke="#10b981" strokeWidth="0.5" strokeDasharray="2,2" className="animate-pulse" />
                                    <circle cx={p.x} cy={p.y} r="3" fill="#06b6d4" className="shadow-[0_0_5px_#06b6d4]" />
                                    <text x={p.x} y={p.y + (p.y > 50 ? 8 : -5)} fill="#64748b" fontSize="4" fontWeight="bold" textAnchor="middle">{p.l}</text>
                                </g>
                            ))}
                        </svg>
                    </div>
                    <div className="w-24 h-24 rounded-3xl border-2 border-emerald-500/40 flex flex-col items-center justify-center bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.2)] backdrop-blur-md group-hover/visual:scale-105 transition-transform duration-500">
                        <Shield className="w-10 h-10 text-emerald-500 mb-2 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-400 tracking-tighter italic">CONSENSUS_GO</span>
                    </div>
                </div>
            )}

            {type === 'simulator' && (
                <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                    <div className="absolute top-4 text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Monte_Carlo_Simulation</div>
                    <div className="relative w-64 h-32">
                        <svg viewBox="0 0 200 100" className="w-full h-full">
                            {[...Array(8)].map((_, i) => (
                                <path 
                                    key={i} 
                                    d={`M 0 50 Q 50 ${10 + i * 12} 100 50 T 200 ${30 + i * 6}`} 
                                    fill="none" 
                                    stroke={i % 2 === 0 ? "#10b981" : "#f43f5e"} 
                                    strokeWidth="0.5" 
                                    opacity={0.2} 
                                    className="animate-path"
                                    strokeDasharray="400"
                                />
                            ))}
                            <line x1="0" y1="50" x2="200" y2="50" stroke="white" opacity="0.1" strokeDasharray="3,3" />
                        </svg>
                    </div>
                    <div className="flex gap-2 mt-4">
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce" />
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <div className="mt-4 px-3 py-1 bg-white/5 border border-white/10 rounded flex gap-4">
                        <div className="flex flex-col">
                            <span className="text-[6px] text-slate-500 uppercase font-black">Success_Rate</span>
                            <span className="text-[10px] text-emerald-400 font-mono">84.2%</span>
                        </div>
                        <div className="w-px h-full bg-white/5" />
                        <div className="flex flex-col">
                            <span className="text-[6px] text-slate-500 uppercase font-black">Avg_Profit</span>
                            <span className="text-[10px] text-emerald-400 font-mono">+12.4%</span>
                        </div>
                    </div>
                </div>
            )}

            {type === 'routine' && (
                <div className="relative w-32 h-32">
                    <div className="absolute inset-0 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-4 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-8 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-transparent to-transparent rounded-full animate-spin duration-[2s]" />
                    <div className="absolute top-4 left-8 w-1 h-1 bg-cyan-400 rounded-full animate-pulse shadow-sm" />
                    <div className="absolute bottom-8 right-10 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-sm" style={{ animationDelay: '1s' }} />
                </div>
            )}

            {/* Corner Decorative HUD */}
            <div className="absolute top-4 left-4 text-[6px] font-mono text-cyan-500/50 uppercase leading-none">
                Data_Visualizer // Active<br />
                Protocol_V4.0
            </div>
            
            <style jsx>{`
                @keyframes scan-y {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
                .animate-scan-y {
                    animation: scan-y 3s infinite linear;
                }
                @keyframes scan-x {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-scan-x {
                    animation: scan-x 1.5s infinite linear;
                }
                @keyframes flow-r {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-flow-r {
                    animation: flow-r 3s infinite linear;
                }
                @keyframes particle-r {
                    0% { transform: translateX(0); opacity: 0; }
                    20% { opacity: 1; }
                    80% { opacity: 1; }
                    100% { transform: translateX(300px); opacity: 0; }
                }
                .animate-particle-r {
                    animation: particle-r 2s infinite linear;
                }
                @keyframes dash {
                    to { stroke-dashoffset: -100; }
                }
                .animate-dash {
                    stroke-dasharray: 100;
                    animation: dash 5s linear infinite;
                }
                @keyframes path {
                    to { stroke-dashoffset: 0; }
                }
                .animate-path {
                    stroke-dashoffset: 200;
                    animation: path 3s forwards ease-in-out;
                }
                @keyframes shimmer {
                    0% { transform: translateX(-100%); opacity: 0.2; }
                    50% { opacity: 0.5; }
                    100% { transform: translateX(100%); opacity: 0.2; }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite linear;
                }
                @keyframes timer-ring {
                    from { stroke-dashoffset: 283; }
                    to { stroke-dashoffset: 0; }
                }
                .animate-timer-ring {
                    animation: timer-ring 30s linear infinite;
                }
                @keyframes dash-h {
                    to { transform: translateX(100%); }
                }
                .animate-dash-h {
                    animation: dash-h 2s infinite linear;
                }
                @keyframes dash-h-reverse {
                    to { transform: translateX(-100%); }
                }
                .animate-dash-h-reverse {
                    animation: dash-h-reverse 2s infinite linear;
                }
                @keyframes reverse-spin {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }
                .animate-reverse-spin {
                    animation: reverse-spin 10s linear infinite;
                }
            `}</style>
        </div>
    );
};
