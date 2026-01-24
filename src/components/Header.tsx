"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Settings,
    Bell,
    User,
    LogOut,
    Zap,
    ChevronDown,
    Activity
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const Header = () => {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const isDashboard = pathname === '/';
    const isSettings = pathname === '/settings';

    return (
        <header className="sticky top-0 z-50 w-full bg-background/60 backdrop-blur-xl border-b border-white/5">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">

                {/* LOGO SECTION */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                        <Zap className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold tracking-tighter leading-none">MEXC <span className="text-primary">ULTIMATE</span></h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">AI Quant Station</p>
                    </div>
                </Link>

                {/* NAV SECTION */}
                <nav className="hidden md:flex items-center bg-white/5 p-1.5 rounded-2xl border border-white/5">
                    <Link
                        href="/"
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${isDashboard ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                    </Link>
                    <Link
                        href="/settings"
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${isSettings ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </Link>
                </nav>

                {/* USER SECTION */}
                <div className="flex items-center gap-4">
                    <button className="hidden sm:flex relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors group">
                        <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background animate-pulse" />
                    </button>

                    <div className="h-8 w-[1px] bg-white/10 hidden sm:block mx-1" />

                    <div className="flex items-center gap-3 pl-2 group">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold leading-none">{user?.email?.split('@')[0] || 'Trader'}</p>
                            <div className="flex items-center justify-end gap-1 mt-1">
                                <Activity className="w-3 h-3 text-green-500" />
                                <p className="text-[10px] font-bold text-green-500 uppercase">Live</p>
                            </div>
                        </div>
                        <div className="relative group/user">
                            <button className="h-11 w-11 rounded-xl bg-gradient-to-tr from-primary to-blue-500 p-0.5 shadow-lg shadow-primary/10">
                                <div className="h-full w-full bg-background rounded-[10px] flex items-center justify-center">
                                    <User className="w-5 h-5 text-primary" />
                                </div>
                            </button>

                            {/* Dropdown Placeholder (Functional Logout Only) */}
                            <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-white/10 rounded-2xl p-2 opacity-0 invisible group-hover/user:opacity-100 group-hover/user:visible transition-all shadow-2xl z-50">
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </header>
    );
};
