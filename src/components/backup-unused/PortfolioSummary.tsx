"use client";

import { TrendingUp, TrendingDown, Wallet, RefreshCw, Activity } from 'lucide-react';
import { usePortfolioSummary, useHoldings } from '../hooks/usePortfolio';
import { useEffect } from 'react';

export const PortfolioSummary = () => {
    useEffect(() => {
        fetch('/api/portfolio/summary?debug=PortfolioSummary_VERIFIED_MOUNT').catch(() => {});
    }, []);
    const { data: summaryData, isLoading: summaryLoading } = usePortfolioSummary();
    const { data: holdings, isLoading: holdingsLoading } = useHoldings();

    const loading = summaryLoading || holdingsLoading;

    const filteredHoldings = holdings?.filter(h => h.value > 100 && h.symbol !== 'USDT' && h.symbol !== 'USDC') || [];

    const bestPerformer = filteredHoldings.length > 0
        ? filteredHoldings.reduce((best, current) =>
            (current.change24h > best.change24h) ? current : best
        )
        : null;

    const topGainer = filteredHoldings.length > 0
        ? filteredHoldings.reduce((top, current) =>
            (current.value > top.value) ? current : top
        )
        : null;

    // Use real data or show loading/error state
    const totalValue = summaryData?.totalValue || 0;
    const change24h = summaryData?.change24h || 0;
    const changePercentage = summaryData?.changePercentage || 0;
    const assets = summaryData?.assets || 0;

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full h-full items-center">
            {/* 1. Total Value */}
            <div className="flex flex-col gap-1 p-2 border-r border-white/5 last:border-0">
                <div className="flex items-center gap-2 text-slate-400">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">PORTFÖY DEĞERİ</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xl lg:text-2xl font-black font-mono text-white tracking-tight">
                        ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {change24h >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-emerald-400" />
                        ) : (
                            <TrendingDown className="h-3 w-3 text-rose-400" />
                        )}
                        <span className={`text-xs font-bold font-mono ${change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)} ({changePercentage.toFixed(2)}%)
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">24S</span>
                    </div>
                </div>
            </div>

            {/* 2. Assets */}
            <div className="flex flex-col gap-1 p-2 border-r border-white/5 last:border-0 hidden md:flex">
                <div className="flex items-center gap-2 text-slate-400">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">AKTİF VARLIKLAR</span>
                </div>
                <div className="flex items-center gap-2">
                     <span className="text-2xl font-black font-mono text-cyan-400">{assets}</span>
                     <span className="text-[10px] text-slate-500 uppercase">POZİSYON</span>
                </div>
            </div>

            {/* 3. Best Performer */}
            <div className="flex flex-col gap-1 p-2 border-r border-white/5 last:border-0 hidden lg:flex">
                <div className="flex items-center gap-2 text-slate-400">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">EN ÇOK KAZANDIRAN</span>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{bestPerformer?.symbol || 'N/A'}</span>
                        <span className={`text-sm font-bold font-mono ${bestPerformer?.change24h !== undefined && bestPerformer.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {bestPerformer && bestPerformer.change24h !== undefined ? `${bestPerformer.change24h >= 0 ? '+' : ''}${bestPerformer.change24h.toFixed(2)}%` : '-'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 4. Top Holding */}
            <div className="flex flex-col gap-1 p-2 hidden lg:flex">
                <div className="flex items-center gap-2 text-slate-400">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">EN BÜYÜK VARLIK</span>
                </div>
                 <div className="flex flex-col">
                    <span className="text-lg font-bold text-white">{topGainer?.symbol || 'N/A'}</span>
                    <span className="text-xs font-mono text-slate-300">
                         ${topGainer?.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                    </span>
                 </div>
            </div>
        </div>
    );
};
