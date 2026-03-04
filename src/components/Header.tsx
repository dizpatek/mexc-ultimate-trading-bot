"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Settings,
    User,
    LogOut,
    BookOpen,
    ChevronUp,
    ChevronDown,
    Minus
} from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';
import { useAuth } from '@/hooks/useAuth';
import { getTradingModeSync } from '@/lib/trading-mode';
import { cn } from '@/lib/utils';
import { useTimeframe, TIMEFRAME_LABELS, type Timeframe } from '@/context/TimeframeContext';

const TF_ITEMS: { id: Timeframe; short: string }[] = [
    { id: '1m',  short: '1m' },
    { id: '15m', short: '15m' },
    { id: '1h',  short: '1h' },
    { id: '4h',  short: '4h' },
    { id: '1d',  short: '1d' },
    { id: '1w',  short: '1w' },
    { id: '1M',  short: '1M' },
];

const TimeframeBar = () => {
    const { timeframe, setTimeframe, locked, toggleLock } = useTimeframe();
    return (
        <div className="flex flex-col items-center gap-1 py-3 px-1.5 mt-auto">
            {/* Lock Switch */}
            <button
                onClick={toggleLock}
                title={locked ? "Kiliti Aç — Modüller bağımsız TF seçebilir" : "Kilitle — Tüm modüller bu TF'ye kilitlenir"}
                className={cn(
                    "w-11 h-6 rounded-full relative transition-all duration-500 mb-1 flex items-center border",
                    locked 
                        ? "bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                        : "bg-slate-800/60 border-slate-700/50"
                )}
            >
                <div className={cn(
                    "absolute w-4 h-4 rounded-full transition-all duration-300 flex items-center justify-center",
                    locked 
                        ? "left-[calc(100%-20px)] bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                        : "left-[2px] bg-slate-600"
                )}>
                    <span className="text-[7px]">{locked ? '🔒' : '🔓'}</span>
                </div>
            </button>
            <span className={cn(
                "text-[6px] font-black uppercase tracking-[0.2em] mb-1.5 transition-colors",
                locked ? "text-cyan-500/80" : "text-slate-600"
            )}>
                {locked ? "⏱ LOCK" : "⏱ FREE"}
            </span>
            {TF_ITEMS.map((tf) => {
                const isActive = timeframe === tf.id;
                return (
                    <button
                        key={tf.id}
                        onClick={() => setTimeframe(tf.id)}
                        title={TIMEFRAME_LABELS[tf.id]}
                        className={cn(
                            "w-11 h-8 flex items-center justify-center transition-all duration-300 relative group/tf",
                            "clip-hexagon",
                            isActive
                                ? "bg-gradient-to-br from-cyan-500/30 to-cyan-600/10 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.3),inset_0_0_8px_rgba(6,182,212,0.1)] scale-110"
                                : "bg-slate-800/40 text-slate-600 hover:text-cyan-400 hover:bg-slate-800/80 hover:scale-105"
                        )}
                    >
                        {/* Corner accents */}
                        <div className={cn(
                            "absolute top-0 left-0 w-1.5 h-[1px] transition-colors",
                            isActive ? "bg-cyan-400" : "bg-slate-700"
                        )} />
                        <div className={cn(
                            "absolute top-0 left-0 w-[1px] h-1.5 transition-colors",
                            isActive ? "bg-cyan-400" : "bg-slate-700"
                        )} />
                        <div className={cn(
                            "absolute bottom-0 right-0 w-1.5 h-[1px] transition-colors",
                            isActive ? "bg-cyan-400" : "bg-slate-700"
                        )} />
                        <div className={cn(
                            "absolute bottom-0 right-0 w-[1px] h-1.5 transition-colors",
                            isActive ? "bg-cyan-400" : "bg-slate-700"
                        )} />

                        <span className={cn(
                            "text-[9px] font-black font-mono tracking-tight relative z-10",
                            isActive && "drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]"
                        )}>
                            {tf.short}
                        </span>

                        {/* Active scan line */}
                        {isActive && (
                            <div className="absolute inset-0 overflow-hidden rounded-sm">
                                <div className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ top: '50%' }} />
                            </div>
                        )}

                        {/* Right edge glow */}
                        {isActive && (
                            <div className="absolute inset-y-0.5 -right-[2px] w-[2px] bg-cyan-400 rounded-l-full shadow-[0_0_8px_#22d3ee]" />
                        )}

                        {/* Tooltip */}
                        <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900/95 border border-cyan-500/20 rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover/tf:opacity-100 translate-x-2 group-hover/tf:translate-x-0 transition-all duration-200 z-50 backdrop-blur-sm">
                            <span className="text-[9px] font-bold text-cyan-300">{TIMEFRAME_LABELS[tf.id]}</span>
                        </div>
                    </button>
                );
            })}
        </div>
    );

};

interface HeaderProps {
    onOpenGuide?: () => void;
}

export const Header = ({ }: HeaderProps) => {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mode, setMode] = useState<'test' | 'production'>('test');

    useEffect(() => {
        const updateMode = () => setMode(getTradingModeSync());
        updateMode();
        
        window.addEventListener('tradingModeChanged', updateMode);
        return () => window.removeEventListener('tradingModeChanged', updateMode);
    }, []);

    const isDashboard = pathname === '/';
    const isSettings = pathname === '/settings';

    return (
        <aside className="sticky top-0 h-screen w-16 bg-[#020617]/80 backdrop-blur-xl border-r border-slate-800 shadow-xl flex flex-col z-50">
            {/* LOGO SECTION */}
            <div className="py-6 flex flex-col items-center">
                <Link href="/" className="relative group">
                    <div className="absolute inset-0 bg-cyan-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="bg-slate-900 border border-slate-700 p-1.5 rounded-xl relative z-10 group-hover:border-cyan-500/50 transition-colors">
                        <MatrixLogo size={32} />
                    </div>
                </Link>
            </div>

            {/* NAV SECTION */}
            <nav className="flex-1 px-2 space-y-6 mt-8 flex flex-col items-center">
                <Link
                    href="/"
                    title="MISSION CONTROL"
                    className={`p-3 rounded-xl transition-all relative group ${isDashboard 
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                        }`}
                >
                    <LayoutDashboard className="w-5 h-5 shadow-sm group-hover:scale-110 transition-transform" />
                    {isDashboard && (
                        <div className="absolute inset-y-2 -left-[1px] w-[3px] bg-cyan-400 rounded-r-full shadow-[0_0_10px_#22d3ee]" />
                    )}
                </Link>
                
                <Link
                    href="/settings"
                    title="SYSTEM CONFIG"
                    className={`p-3 rounded-xl transition-all relative group ${isSettings 
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.2)]' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                        }`}
                >
                    <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                    {isSettings && (
                        <div className="absolute inset-y-2 -left-[1px] w-[3px] bg-indigo-400 rounded-r-full shadow-[0_0_10px_#818cf8]" />
                    )}
                </Link>

                <Link
                    href="/guide"
                    title="OPERATIONAL MANUAL"
                    className={`p-3 rounded-xl transition-all relative group ${pathname === '/guide' 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
                        : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 border border-transparent'
                        }`}
                >
                    <BookOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {pathname === '/guide' && (
                        <div className="absolute inset-y-2 -left-[1px] w-[3px] bg-emerald-400 rounded-r-full shadow-[0_0_10px_#34d399]" />
                    )}
                </Link>
            </nav>

            {/* SCROLL NAVIGATION SECTION */}
            <div className="flex flex-col items-center gap-3 py-4 border-t border-b border-slate-800/30 my-4 bg-slate-900/20">
                <button
                    onClick={() => {
                        const main = document.querySelector('main');
                        if (main) {
                            main.scrollTo({ top: 0, behavior: 'smooth' });
                        } else {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                    title="SCROLL TO TOP"
                    className="p-2 rounded-lg text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all group/sc"
                >
                    <ChevronUp className="w-5 h-5 group-hover/sc:-translate-y-0.5 transition-transform" />
                </button>
                
                <button
                    onClick={() => {
                        const main = document.querySelector('main');
                        if (main) {
                            const height = main.scrollHeight;
                            main.scrollTo({ top: height / 2, behavior: 'smooth' });
                        } else {
                            const height = document.documentElement.scrollHeight;
                            window.scrollTo({ top: height / 2, behavior: 'smooth' });
                        }
                    }}
                    title="SCROLL TO MIDDLE"
                    className="p-2 rounded-lg text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all group/sc"
                >
                    <Minus className="w-5 h-5 group-hover/sc:scale-125 transition-transform" />
                </button>

                <button
                    onClick={() => {
                        const main = document.querySelector('main');
                        if (main) {
                            main.scrollTo({ top: main.scrollHeight, behavior: 'smooth' });
                        } else {
                            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
                        }
                    }}
                    title="SCROLL TO BOTTOM"
                    className="p-2 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all group/sc"
                >
                    <ChevronDown className="w-5 h-5 group-hover/sc:translate-y-0.5 transition-transform" />
                </button>
            </div>

            {/* TIMEFRAME SELECTOR */}
            <TimeframeBar />

            {/* USER & STATUS SECTION (BOTTOM) */}
            <div className="py-6 border-t border-slate-800/50 space-y-6 flex flex-col items-center">
                {/* Status Indicator Dot */}
                <div title={mode === 'production' ? 'LIVE FEED' : 'SIMULATION'}
                    className={cn("w-3 h-3 rounded-full shadow-lg", 
                    mode === 'production' ? 'bg-rose-500 animate-pulse shadow-rose-500/50' : 'bg-indigo-500 shadow-indigo-500/50')}>
                </div>

                <div className="relative group/user">
                    <button className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-400" />
                    </button>

                    {/* Left Popover Logout */}
                    <div className="absolute bottom-0 left-full ml-3 w-48 bg-[#0f172a] border border-slate-800 rounded-xl p-1 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all shadow-2xl z-50">
                        <div className="px-3 py-2 border-b border-slate-800 mb-1">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Commander</p>
                            <p className="text-xs font-bold text-slate-300 truncate font-mono">{user?.email?.split('@')[0] || 'GUEST'}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors font-mono"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            ABORT SESSION
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
};
