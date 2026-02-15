"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Settings,
    User,
    LogOut,
    Zap,
    Activity,
    Beaker,
    BookOpen
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getTradingMode } from '@/lib/mexc-wrapper';



interface HeaderProps {
    onOpenGuide?: () => void;
}

export const Header = ({ onOpenGuide }: HeaderProps) => {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [mode, setMode] = useState<'test' | 'production'>('test');

    useEffect(() => {
        const updateMode = () => setMode(getTradingMode());
        updateMode();
        
        window.addEventListener('tradingModeChanged', updateMode);
        return () => window.removeEventListener('tradingModeChanged', updateMode);
    }, []);

    const isDashboard = pathname === '/';
    const isSettings = pathname === '/settings';

    return (
        <header className="sticky top-0 z-50 w-full bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800 shadow-lg shadow-black/20">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                
                {/* LOGO SECTION */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="bg-slate-900 border border-slate-700 p-1.5 rounded-lg relative z-10 group-hover:border-cyan-500/50 transition-colors">
                            <Zap className="w-5 h-5 text-cyan-400 fill-cyan-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tighter leading-none text-slate-200 font-mono">MEXC <span className="text-cyan-400">HORIZON</span></h1>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5">Quantum Interface</p>
                    </div>
                </Link>

                {/* NAV SECTION */}
                <nav className="hidden md:flex items-center gap-2 bg-slate-900/50 p-1 rounded-full border border-slate-800/50 backdrop-blur-md">
                    <Link
                        href="/"
                        className={`flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold transition-all ${isDashboard 
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        MISSION CONTROL
                    </Link>
                    <Link
                        href="/settings"
                        className={`flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold transition-all ${isSettings 
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        SYSTEM CONFIG
                    </Link>

                    {/* GUIDE BUTTON */}
                    <button
                        onClick={onOpenGuide}
                        className="flex items-center gap-2 px-5 py-1.5 rounded-full text-xs font-bold transition-all text-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-500/20 border border-transparent"
                    >
                        <BookOpen className="w-3.5 h-3.5" />
                        KILAVUZ
                    </button>
                </nav>

                {/* USER SECTION */}
                <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <div className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded border text-[9px] font-black tracking-widest uppercase font-mono ${mode === 'production'
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-500'
                            : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-400'
                        }`}>
                        {mode === 'production' ? <Activity className="w-3 h-3 animate-pulse" /> : <Beaker className="w-3 h-3" />}
                        {mode === 'production' ? 'LIVE FEED' : 'SIMULATION'}
                    </div>

                    <div className="h-8 w-[1px] bg-slate-800 hidden sm:block mx-1" />

                    <div className="flex items-center gap-3 pl-2 group">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold leading-none text-slate-300 font-mono">{user?.email?.split('@')[0] || 'COMMANDER'}</p>
                            <p className="text-[9px] font-bold text-emerald-500/70 uppercase mt-0.5 tracking-wider">LEVEL 1 ACCESS</p>
                        </div>
                        <div className="relative group/user">
                            <button className="h-9 w-9 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition-all flex items-center justify-center">
                                <User className="w-4 h-4 text-slate-400" />
                            </button>

                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#0f172a] border border-slate-800 rounded-lg p-1 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all shadow-xl z-50">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/30 rounded transition-colors font-mono"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    ABORT SESSION
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

