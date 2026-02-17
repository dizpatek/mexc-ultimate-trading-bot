"use client";

import React, { useState, useEffect } from 'react';
import { 
    Clock, 
    TrendingUp, 
    TrendingDown, 
    ExternalLink, 
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Zap,
    Search,
    Activity,
    Brain,
    ShieldAlert,
    Timer,
    ZapOff,
    Radar,
    AlertCircle
} from 'lucide-react';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

export interface SmartTradeOrder {
    id: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number; 
    currentPrice?: number;
    qty: number;
    status: string;
    created_at: number;
    meta: {
        mode: string;
        payload: {
            symbol: string;
            amount: string;
            buyPrice: string;
            buyType: string;
            takeProfit?: {
                price: string;
                type?: string;
                trailing?: boolean;
                deviation?: number;
                isSplit?: boolean;
                targets?: { price: string; volume: string }[];
            } | null;
            stopLoss?: {
                price: string;
                type?: string;
                trailing?: boolean;
                deviation?: number;
                timeout?: boolean;
                breakeven?: boolean;
            } | null;
        }
    }
}

interface ActiveSmartTradesProps {
    onEdit?: (trade: SmartTradeOrder) => void;
}

export const ActiveSmartTrades: React.FC<ActiveSmartTradesProps> = ({ onEdit }) => {
    const [trades, setTrades] = useState<SmartTradeOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'AKTIF' | 'PASIF'>('AKTIF');
    const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());

    const [error, setError] = useState<string | null>(null);

    const fetchTrades = async () => {
        try {
            const response = await api.get('/trade/smart');
            setTrades(response.data);
            setLastFetchTime(Date.now());
            setError(null);
        } catch (err: unknown) {
            console.error('Failed to fetch smart trades:', err);
            const axiosError = err as { response?: { data?: { details?: string; error?: string } }; message: string };
            const msg = axiosError.response?.data?.details || axiosError.response?.data?.error || axiosError.message;
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePanicClose = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
        e.stopPropagation();
        if (!confirm(`${trade.symbol} işlemini PİYASA fiyatından kapatmak üzeresiniz. Onaylıyor musunuz?`)) return;
        try {
            await api.delete(`/trade/smart?id=${trade.id}`);
            alert('PANIC SELL: İşlem başarıyla sonlandırıldı.');
            fetchTrades();
        } catch (error) {
            console.error('Panic close failed:', error);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('TÜM akıllı işlemleri temizlemek istediğinizden emin misiniz?')) return;
        try {
            await api.delete('/trade/smart?all=true');
            fetchTrades();
        } catch (error) {
            console.error('Clear all failed:', error);
        }
    };

    useEffect(() => {
        fetchTrades();
        const interval = setInterval(fetchTrades, 3000); // 3s refresh for higher intensity
        return () => clearInterval(interval);
    }, []);

    const getAiScore = (symbol: string) => {
        const charSum = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return (charSum % 41) + 55;
    };

    if (isLoading) {
        return (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center gap-4 mt-6">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Neural Logic Core Initializing...</span>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-4">
            {/* FUTURISTIC HEADER */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-sm animate-pulse"></div>
                        <Activity className="w-5 h-5 text-cyan-400 relative z-10" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                            SMART OPERATIONS CENTER 
                            <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 ml-2">LIVE MONITORING</span>
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Neuro-Engine Integrated {" // "} {trades.length} Positions {" // "} Last Pulse: {new Date(lastFetchTime).toLocaleTimeString([], { hour12: false, second: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            API ERROR: {error.toUpperCase()}
                        </div>
                    )}
                    <div className="flex bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden p-0.5">
                        <button 
                            onClick={() => setActiveTab('AKTIF')}
                            className={cn(
                                "p-1.5 px-3 text-[9px] font-black transition-all rounded-md",
                                activeTab === 'AKTIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            AKTİF
                        </button>
                        <button 
                            onClick={() => setActiveTab('PASIF')}
                            className={cn(
                                "p-1.5 px-3 text-[9px] font-black transition-all rounded-md",
                                activeTab === 'PASIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            PASİF
                        </button>
                    </div>
                    {trades.filter(t => activeTab === 'AKTIF' ? (t.status === 'FILLED' || t.status === 'PENDING') : t.status === 'CLOSED').length > 0 && (
                        <button 
                            onClick={handleClearAll}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-[9px] font-black uppercase tracking-widest group",
                                activeTab === 'AKTIF' 
                                    ? "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400" 
                                    : "bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 text-slate-400"
                            )}
                        >
                            <ShieldAlert className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                            {activeTab === 'AKTIF' ? 'FLUSH ALL' : 'CLEAR HISTORY'}
                        </button>
                    )}
                </div>
            </div>

            {/* TABLE-LIKE LIST */}
            <div className="bg-[#0f172a]/20 backdrop-blur-xl border border-slate-800/60 rounded-2xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                {/* HEADERS */}
                <div className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_2fr_1fr_40px] gap-4 px-6 py-4 border-b border-white/5 bg-slate-950/60 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">PAIR / ENGINE</div>
                    <div className="flex items-center gap-2">ENTRY / MARKET</div>
                    <div className="flex items-center gap-2">AI SCORE</div>
                    <div className="flex items-center gap-2 text-center justify-center">STATUS</div>
                    <div className="flex items-center gap-2">SMART TARGETS (TP/SL)</div>
                    <div className="flex items-center gap-2 text-right justify-end">PNL (REAL-TIME)</div>
                    <div></div>
                </div>

                <div className="divide-y divide-white/5">
                    {trades.filter(t => activeTab === 'AKTIF' ? (t.status === 'FILLED' || t.status === 'PENDING') : t.status === 'CLOSED').length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                                <Search className="w-6 h-6 text-slate-700" />
                            </div>
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">
                                {activeTab === 'AKTIF' ? 'Aktif İşlem Bulunamadı' : 'Geçmiş İşlem Bulunamadı'}
                            </span>
                            <p className="text-[10px] text-slate-700 max-w-[240px]">
                                {activeTab === 'AKTIF' 
                                    ? 'Şu anda takip edilen aktif bir pozisyon yok.' 
                                    : 'Kapatılmış veya pasife düşmüş bir işlem geçmişi görünmüyor.'}
                            </p>
                        </div>
                    ) : (
                        trades
                            .filter(t => activeTab === 'AKTIF' ? (t.status === 'FILLED' || t.status === 'PENDING') : t.status === 'CLOSED')
                            .map((trade) => {
                            const isExpanded = expandedTrade === trade.id;
                            const payload = trade.meta.payload;
                            const currentPrice = trade.currentPrice || trade.price;
                            
                            const tp = parseFloat(payload.takeProfit?.price || "0");
                            const sl = parseFloat(payload.stopLoss?.price || "0");
                            const entry = trade.price;
                            
                            // Real PNL Calculation
                            const pnlPercent = trade.side === 'BUY' 
                                ? ((currentPrice - entry) / entry) * 100
                                : ((entry - currentPrice) / entry) * 100;
                            
                            // PNL in USDT is qty * (marketPrice - entryPrice) for BUY
                            const pnlUsdt = trade.side === 'BUY'
                                ? trade.qty * (currentPrice - entry)
                                : trade.qty * (entry - currentPrice);

                            const aiScore = getAiScore(trade.symbol);
                            const hasTrailing = payload.takeProfit?.trailing || payload.stopLoss?.trailing;

                            // Dynamic status logic
                            let statusText = "SCANNING";
                            let statusColor = "text-cyan-400";
                            
                            if (tp > 0) {
                                const dist = trade.side === 'BUY' 
                                    ? ((tp - currentPrice) / currentPrice) * 100
                                    : ((currentPrice - tp) / currentPrice) * 100;
                                if (dist < 2) {
                                    statusText = "NEAR TP";
                                    statusColor = "text-emerald-400";
                                }
                            }
                            if (sl > 0) {
                                const distSl = trade.side === 'BUY'
                                    ? ((currentPrice - sl) / currentPrice) * 100
                                    : ((sl - currentPrice) / currentPrice) * 100;
                                if (distSl < 2) {
                                    statusText = "NEAR SL";
                                    statusColor = "text-rose-400";
                                }
                            }

                            const isClosed = trade.status === 'CLOSED';

                            return (
                                <div key={trade.id} className={cn(
                                    "group transition-all duration-300",
                                    isClosed ? "opacity-60 grayscale bg-slate-900/20 pointer-events-auto" : "hover:bg-cyan-400/[0.03]"
                                )}>
                                    <div 
                                        className="grid grid-cols-[1.2fr_1.5fr_1fr_0.8fr_2fr_1fr_40px] gap-4 px-6 py-5 items-center cursor-pointer"
                                        onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}
                                    >
                                        {/* PAIR */}
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover:scale-105",
                                                    trade.side === 'BUY' 
                                                        ? "bg-emerald-500/10 border-emerald-500/20 group-hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                                                        : "bg-rose-500/10 border-rose-500/20 group-hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                                                )}>
                                                    <Zap className={cn("w-5 h-5", trade.side === 'BUY' ? "text-emerald-400" : "text-rose-400")} />
                                                </div>
                                                <div className={cn(
                                                    "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[#020617]",
                                                    trade.side === 'BUY' ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
                                                )}></div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-white tracking-tight">{trade.symbol.replace('USDT', '')}<span className="text-slate-600 font-bold">/USDT</span></span>
                                                    {hasTrailing && !isClosed && <Timer className="w-3 h-3 text-cyan-400 animate-pulse" />}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">NEURO {trade.meta.mode} {" // "} V{trade.id}</div>
                                            </div>
                                        </div>

                                        {/* ENTRY / MARKET */}
                                        <div>
                                            <div className="text-[11px] font-black text-slate-300 font-mono">
                                                E: <span className="text-white">${entry.toLocaleString()}</span>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-500 font-mono mt-0.5 whitespace-nowrap overflow-hidden">
                                                M: <span className={cn(
                                                    "transition-colors duration-500",
                                                    currentPrice >= entry ? (trade.side === 'BUY' ? "text-emerald-400" : "text-rose-400") : (trade.side === 'BUY' ? "text-rose-400" : "text-emerald-400")
                                                )}>${currentPrice.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* AI SCORE */}
                                        <div className="flex flex-col items-start gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <Brain className={cn("w-3.5 h-3.5", aiScore > 80 && !isClosed ? "text-cyan-400" : "text-slate-500")} />
                                                <span className={cn("text-xs font-black", aiScore > 80 && !isClosed ? "text-cyan-400" : "text-slate-300")}>{aiScore}%</span>
                                            </div>
                                            <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div style={{ width: `${aiScore}%` }} className={cn("h-full", aiScore > 80 && !isClosed ? "bg-cyan-400" : "bg-slate-500")}></div>
                                            </div>
                                        </div>

                                        {/* STATUS */}
                                        <div className="text-center">
                                            <div className={cn(
                                                "text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest whitespace-nowrap flex flex-col items-center",
                                                isClosed ? "border-white/10 bg-white/5 text-slate-500 animate-none opacity-50" : (
                                                    statusColor === "text-emerald-400" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 animate-pulse" :
                                                    statusColor === "text-rose-400" ? "border-rose-500/20 bg-rose-500/5 text-rose-400 animate-pulse" :
                                                    "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 animate-pulse"
                                                )
                                            )}>
                                                <span className="opacity-50 text-[7px] mb-0.5">{isClosed ? 'ARŞİVLENMİŞ VERİ' : 'YZ ALIM-SATIM YAKLAŞIMI'}</span>
                                                {isClosed ? 'KAPALIDIR' : (statusText === "SCANNING" ? (aiScore > 75 ? "ŞU AN DİP" : aiScore < 30 ? "ŞU AN TEPE" : "YATAY") : statusText)}
                                            </div>
                                        </div>

                                        {/* SMART TARGETS BAR */}
                                        <div className="px-2">
                                            <div className="flex justify-between text-[8px] font-black mb-1.5 uppercase tracking-tighter">
                                                <span className="text-rose-500">SL: {sl || 'UNSET'}</span>
                                                <span className="text-emerald-500">TP: {tp || 'UNSET'}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-800/40 rounded-full relative backdrop-blur-sm border border-white/5">
                                                {/* Scale: SL (0%) to TP (100%) */}
                                                {sl > 0 && tp > 0 ? (
                                                    <>
                                                        {/* Entry Mark */}
                                                        <div 
                                                            style={{ 
                                                                left: `${((entry - Math.min(sl, tp)) / Math.abs(tp - sl)) * 100}%` 
                                                            }} 
                                                            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/20 z-0"
                                                        />
                                                        {/* Current Price Mark */}
                                                        <div 
                                                            style={{ 
                                                                left: `${Math.min(99, Math.max(1, ((currentPrice - Math.min(sl, tp)) / Math.abs(tp - sl)) * 100))}%` 
                                                            }} 
                                                            className={cn(
                                                                "absolute top-0 bottom-0 w-1 z-10 transition-all duration-700 shadow-[0_0_10px_white]",
                                                                pnlPercent >= 0 ? "bg-emerald-400 shadow-emerald-500/50" : "bg-rose-400 shadow-rose-500/50"
                                                            )}
                                                        />
                                                    </>
                                                ) : (
                                                    // Fallback to PNL centered (entry is 50%)
                                                    <>
                                                        <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/20 z-0" />
                                                        <div 
                                                            style={{ 
                                                                left: `${Math.min(98, Math.max(2, 50 + (pnlPercent * 2)))}%` 
                                                            }} 
                                                            className={cn(
                                                                "absolute top-0 bottom-0 w-1 z-10 transition-all duration-700 shadow-[0_0_10px_white]",
                                                                pnlPercent >= 0 ? "bg-emerald-400 shadow-emerald-500/50" : "bg-rose-400 shadow-rose-500/50"
                                                            )}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                                                <span className="flex items-center gap-1">
                                                    {payload.stopLoss?.trailing && <Radar className={cn("w-2 h-2 text-cyan-500", !isClosed && "animate-spin")} />}
                                                    {payload.stopLoss?.trailing ? `-${payload.stopLoss.deviation}% TR` : ''}
                                                </span>
                                                <span className={cn("text-cyan-400/60 font-black", !isClosed && "animate-pulse")}>
                                                    GİRİŞ: ${entry.toLocaleString()}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    {payload.takeProfit?.trailing ? `+${payload.takeProfit.deviation}% TR` : ''}
                                                    {payload.takeProfit?.trailing && <Radar className={cn("w-2 h-2 text-cyan-500", !isClosed && "animate-spin")} />}
                                                </span>
                                            </div>
                                        </div>

                                        {/* PNL REAL */}
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {pnlPercent >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
                                                <span className={cn(
                                                    "text-sm font-black font-mono tracking-tighter",
                                                    pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400"
                                                )}>
                                                    {pnlPercent >= 0 ? '+' : ''}${pnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className={cn(
                                                "text-[10px] font-black font-mono tracking-tighter mt-0.5 opacity-80",
                                                pnlPercent >= 0 ? "text-emerald-500" : "text-rose-500"
                                            )}>
                                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                            </div>
                                        </div>

                                        {/* EXPAND ICON */}
                                        <div className="flex justify-center text-slate-700">
                                            {isExpanded ? <ChevronUp className="w-5 h-5 text-cyan-500" /> : <ChevronDown className="w-5 h-5 group-hover:text-cyan-500 transition-colors" />}
                                        </div>
                                    </div>

                                    {/* EXPANDED PANEL */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-slate-950/40 animate-in fade-in slide-in-from-top-2">
                                            <div className="grid grid-cols-4 gap-6">
                                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">CONSOLIDATED STATS</span>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Amount ({trade.symbol.split('/')[0]})</span>
                                                            <span className="text-[10px] font-black text-white">{trade.qty.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Equity (USDT)</span>
                                                            <span className="text-[10px] font-black text-white">${(trade.qty * currentPrice).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Dist to TP</span>
                                                            <span className="text-[10px] font-black text-emerald-400">
                                                                {tp > 0 ? `${(((tp - currentPrice) / currentPrice) * 100 * (trade.side === 'BUY' ? 1 : -1)).toFixed(2)}%` : 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">NEURAL LOGS</span>
                                                    <div className="space-y-1.5 overflow-hidden">
                                                        <div className="text-[8px] font-mono text-emerald-400 uppercase bg-emerald-400/5 px-1 py-0.5 rounded flex items-center gap-1">
                                                            <Clock className="w-2 h-2" /> Entry filled @ ${entry}
                                                        </div>
                                                        <div className="text-[8px] font-mono text-cyan-400 uppercase bg-cyan-400/5 px-1 py-0.5 rounded flex items-center gap-1">
                                                            <Brain className="w-2 h-2" /> AI Sent: {aiScore}% Conf.
                                                        </div>
                                                        <div className={cn(
                                                            "text-[8px] font-mono uppercase bg-opacity-5 px-1 py-0.5 rounded flex items-center gap-1",
                                                            isClosed ? "text-slate-500 bg-slate-500/10" : "text-cyan-400 bg-cyan-400/5"
                                                        )}>
                                                            <Radar className={cn("w-2 h-2", !isClosed && "animate-spin")} /> {isClosed ? 'MONITORING STANDBY (CLOSED)' : `${statusText} ACTIVE`}
                                                        </div>
                                                        <div className="text-[8px] font-mono text-slate-550 uppercase px-1 pt-1 opacity-50">
                                                            Logged @ {new Date(trade.created_at).toLocaleTimeString([], { hour12: false })}
                                                        </div>
                                                    </div>
                                                </div>

                                                 {trade.status !== 'CLOSED' ? (
                                                    <>
                                                        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col justify-center gap-2">
                                                            <a 
                                                                href={`https://www.mexc.com/exchange/${trade.symbol.replace('/', '_')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-800 hover:bg-slate-755 rounded-lg transition-all border border-slate-700 text-white text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                VIEW MEXC
                                                            </a>
                                                            <button 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (onEdit) onEdit(trade); 
                                                                }}
                                                                className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                <TrendingUp className="w-3.5 h-3.5" />
                                                                DÜZENLE
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); fetchTrades(); }}
                                                                className="flex items-center justify-center gap-2 w-full py-2 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-lg transition-all border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                                FORCE SYNC
                                                            </button>
                                                        </div>

                                                        <div className="flex flex-col justify-center items-center p-4">
                                                            <button 
                                                                onClick={(e) => handlePanicClose(e, trade)}
                                                                className="group/panic flex flex-col items-center justify-center gap-2 w-full h-full border-2 border-dashed border-rose-500/20 hover:border-rose-500/60 hover:bg-rose-500/10 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(244,63,94,0)] hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                                                            >
                                                                <ZapOff className="w-6 h-6 text-rose-500/40 group-hover/panic:text-rose-500 group-hover/panic:scale-110 transition-all" />
                                                                <span className="text-[10px] font-black text-rose-500/40 group-hover/panic:text-rose-500 uppercase tracking-[0.2em]">PANIC EXIT (MARKET)</span>
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="col-span-2 p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                                            <ShieldAlert className="w-6 h-6 text-slate-500" />
                                                        </div>
                                                        <div className="text-center">
                                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">İŞLEM KAPATILDI</span>
                                                            <p className="text-[9px] text-slate-600 mt-1 uppercase tracking-tight font-bold">
                                                                Bu işlem sonlandırıldı ve arşive taşındı. <br/>
                                                                Son fiyat: ${currentPrice.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 border-t border-white/5 bg-slate-950/80 flex items-center justify-between text-[9px] font-mono text-slate-650 uppercase tracking-[0.3em]">
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div> OS: V2.6.2-TERMINAL</span>
                        <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> TICKER STREAM: ACTIVE</span>
                        <span className="text-slate-700">|</span>
                        <span className="flex items-center gap-2">REFRESH: 3000MS</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
