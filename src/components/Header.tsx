"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
    LayoutDashboard,
    Settings,
    User,
    LogOut,
    BookOpen
} from 'lucide-react';
import { MatrixLogo } from './MatrixLogo';
import { useAuth } from '@/hooks/useAuth';
import { getTradingModeSync } from '@/lib/mexc-wrapper';
import { cn } from '@/lib/utils';

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
