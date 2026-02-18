"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

interface HologramVisualProps {
    type: 'overview' | 'architecture' | 'trailing' | 'engine' | 'settings' | 'defense' | 'strategy' | 'routine';
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

            {type === 'architecture' && (
                <div className="flex gap-4 w-2/3 h-1/2">
                    <div className="w-4 border-2 border-cyan-500/30 rounded-md bg-cyan-500/5 h-full" />
                    <div className="flex-1 border-2 border-blue-500/40 rounded-md bg-blue-500/5 h-full relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 animate-scan-y" />
                    </div>
                    <div className="w-12 border-2 border-cyan-500/30 rounded-md bg-cyan-500/5 h-full" />
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

            {type === 'routine' && (
                <div className="relative w-32 h-32">
                    {/* Radar Circles */}
                    <div className="absolute inset-0 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-4 border border-cyan-500/10 rounded-full" />
                    <div className="absolute inset-8 border border-cyan-500/10 rounded-full" />
                    
                    {/* Rotating Scanner */}
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 via-transparent to-transparent rounded-full animate-spin duration-[2s]" />
                    
                    {/* Target Markers */}
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
                @keyframes dash {
                    to { stroke-dashoffset: -100; }
                }
                .animate-dash {
                    stroke-dasharray: 100;
                    animation: dash 5s linear infinite;
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
