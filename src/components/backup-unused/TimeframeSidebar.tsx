"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { useTimeframe, TIMEFRAME_LABELS, type Timeframe } from '@/context/TimeframeContext';
import { Clock, ChevronRight } from 'lucide-react';

const TIMEFRAMES: { id: Timeframe; short: string }[] = [
    { id: '1m',  short: '1D' },
    { id: '15m', short: '15D' },
    { id: '1h',  short: '1S' },
    { id: '4h',  short: '4S' },
    { id: '1d',  short: '1G' },
    { id: '1w',  short: '1H' },
    { id: '1M',  short: '1A' },
];

export const TimeframeSidebar = () => {
    const { timeframe, setTimeframe } = useTimeframe();

    return (
        <div className="flex flex-col items-center w-12 min-w-[48px] bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/60 py-4 gap-1 shrink-0 select-none z-30">
            
            {/* Label */}
            <div className="flex flex-col items-center gap-1.5 mb-3 pb-3 border-b border-slate-800/50 w-full">
                <Clock className="w-3.5 h-3.5 text-cyan-500/80" />
                <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.15em] leading-none">TF</span>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex flex-col items-center gap-0.5 flex-1">
                {TIMEFRAMES.map((tf) => {
                    const isActive = timeframe === tf.id;
                    return (
                        <button
                            key={tf.id}
                            onClick={() => setTimeframe(tf.id)}
                            title={TIMEFRAME_LABELS[tf.id]}
                            className={cn(
                                "relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 group",
                                isActive
                                    ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-110"
                                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                            )}
                        >
                            <span className={cn(
                                "text-[10px] font-black font-mono tracking-tight",
                                isActive && "drop-shadow-lg"
                            )}>
                                {tf.short}
                            </span>

                            {/* Active Indicator */}
                            {isActive && (
                                <ChevronRight className="absolute -right-1 w-3 h-3 text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)]" />
                            )}

                            {/* Tooltip */}
                            <div className={cn(
                                "absolute left-full ml-2 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg whitespace-nowrap pointer-events-none transition-all duration-200",
                                "opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 z-50"
                            )}>
                                <span className="text-[9px] font-bold text-slate-300">{TIMEFRAME_LABELS[tf.id]}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Bottom Active Indicator Text */}
            <div className="mt-auto pt-3 border-t border-slate-800/50 w-full flex flex-col items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
                <span className="text-[8px] font-black text-cyan-400 font-mono">{timeframe.toUpperCase()}</span>
            </div>
        </div>
    );
};
