"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { interpretTradingStatus, F4Data } from '@/lib/trading-logic';
import { useTradingSignals, MTF_INTERVALS } from '@/hooks/useTradingSignals';
import { useModuleTimeframe } from '@/context/TimeframeContext';

// --- Pure Helper Functions (Extracted to reduce Component God-Object antipattern) ---

export function calculateTradePnl(side: 'BUY' | 'SELL', mode: string, entry: number, currentPrice: number, qty: number) {
    const pnlPercent = (side === 'BUY' && mode !== 'COVER')
        ? ((currentPrice - entry) / entry) * 100
        : ((entry - currentPrice) / entry) * 100;
    
    const pnlUsdt = (side === 'BUY' && mode !== 'COVER')
        ? qty * (currentPrice - entry)
        : qty * (entry - currentPrice);

    return { pnlPercent, pnlUsdt };
}

export function calculateMtfVerdict(allTfs: { trend?: string; signal?: string | null; f4EarlyBuy?: boolean; f4ConfirmedBuy?: boolean; f4EarlySell?: boolean; f4ConfirmedSell?: boolean; aiScore?: number; }[]) {
    const bullCount = allTfs.filter(d => d && (d.trend === 'BULLISH' || d.signal === 'BUY' || d.f4EarlyBuy || d.f4ConfirmedBuy)).length;
    const bearCount = allTfs.filter(d => d && (d.trend === 'BEARISH' || d.signal === 'SELL' || d.f4EarlySell || d.f4ConfirmedSell)).length;
    const total = allTfs.length;
    const bullPct = total > 0 ? Math.round((bullCount / total) * 100) : 50;
    
    let verdictText = 'NÖTR';
    let verdictColor = 'text-amber-400';
    if (bullPct >= 70) { verdictText = 'GÜÇLÜ AL'; verdictColor = 'text-emerald-400'; }
    else if (bullPct >= 55) { verdictText = 'AL'; verdictColor = 'text-emerald-300'; }
    else if (bullPct <= 30) { verdictText = 'GÜÇLÜ SAT'; verdictColor = 'text-rose-400'; }
    else if (bullPct <= 45) { verdictText = 'SAT'; verdictColor = 'text-rose-300'; }

    const avgMtfScore = total > 0 ? Math.round(allTfs.reduce((sum, d) => sum + (d.aiScore || 0), 0) / total) : 0;

    return { bullCount, bearCount, total, bullPct, verdictText, verdictColor, avgMtfScore };
}

// --- Sub-components to reduce cognitive load ---

const StatusBadge = ({ meta, side, isClosed, timeframe, liveData, statusText, statusColor }: { meta: SmartTradeOrder['meta'], side: 'BUY' | 'SELL', isClosed: boolean, timeframe: string, liveData: F4Data | null, statusText: string, statusColor: string }) => {
    return (
        <div className="text-center group/status relative">
            {meta.monitorError && !isClosed && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[9px] px-2 py-1 rounded shadow-2xl z-50 whitespace-nowrap animate-bounce font-black border border-rose-400/50 flex items-center gap-1.5 min-w-[150px] justify-center">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{meta.monitorError === 'VOLATILITY_GAP_PROTECTION' ? 'OYNADAKLIK KORUMASI (BEKLE)' : `HATA: ${meta.monitorError.toUpperCase()}`}</span>
                </div>
            )}
            <div className={cn(
                "text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest whitespace-nowrap flex flex-col items-center transition-colors duration-500",
                meta.monitorError && !isClosed ? "border-rose-500 bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]" :
                isClosed ? "border-white/10 bg-white/5 text-slate-500 animate-none opacity-50" : (
                    statusColor === "text-emerald-400" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 animate-pulse" :
                    statusColor === "text-rose-400" ? "border-rose-500/20 bg-rose-500/5 text-rose-400 animate-pulse" :
                    statusColor === "text-amber-400" ? "border-amber-500/20 bg-amber-500/5 text-amber-400 animate-pulse" :
                    "border-cyan-500/20 bg-cyan-500/5 text-cyan-400 animate-pulse"
                )
            )}>
                <span className="opacity-50 text-[7px] mb-0.5">{isClosed ? 'ARŞİVLENMİŞ İŞLEM VERİSİ' : liveData ? `${timeframe.toUpperCase()} CANLI SİNYAL` : 'YZ ALIM-SATIM YAKLAŞIMI'}</span>
                {isClosed ? (side === 'SELL' ? 'SATIŞ TAMAM' : 'ALIM TAMAM') : (meta.monitorError ? 'ÇIKIŞ HATASI' : statusText)}
            </div>
        </div>
    );
};

const TradeProgressBar = ({ trade, entry, currentPrice, sl, tp, pnlPercent, pnlUsdt, isProfit, trailingTpDev, trailingSlDev, isTtpActive, isTslActive }: { trade: SmartTradeOrder; entry: number; currentPrice: number; sl: number; tp: number; pnlPercent: number; pnlUsdt: number; isProfit: boolean; trailingTpDev?: number; trailingSlDev?: number; isTtpActive?: boolean; isTslActive?: boolean }) => {
    const formatPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 10 ? p.toFixed(3) : p.toFixed(2);
    const slPct = entry > 0 ? ((sl - entry) / entry * 100 * (trade.side === 'BUY' ? 1 : -1)) : 0;
    const tpPct = entry > 0 ? ((tp - entry) / entry * 100 * (trade.side === 'BUY' ? 1 : -1)) : 0;

    const meta = trade.meta;
    const highestPrice = Math.max(Number(meta.highestPrice) || entry, currentPrice);
    const lowestPrice = Math.min(Number(meta.lowestPrice) || entry, currentPrice);

    let displaySl = sl;
    let displayTp = tp;
    
    // TSL Dynamic Logic
    if (isTslActive && trailingSlDev !== undefined) {
        const slDistance = Math.abs(slPct) + Math.abs(trailingSlDev);
        if (trade.side === 'BUY') {
            displaySl = Math.max(sl, highestPrice * (1 - slDistance / 100));
        } else {
            displaySl = Math.min(sl, lowestPrice * (1 + slDistance / 100));
        }
    }

    // TTP Dynamic Logic
    let passedTpPercent = 0;
    if (isTtpActive && trailingTpDev !== undefined) {
        if (trade.side === 'BUY') {
            displayTp = Math.max(tp, highestPrice * (1 - Math.abs(trailingTpDev) / 100));
            passedTpPercent = currentPrice > tp ? ((currentPrice - tp) / entry) * 100 : 0;
        } else {
            displayTp = Math.min(tp, lowestPrice * (1 + Math.abs(trailingTpDev) / 100));
            passedTpPercent = currentPrice < tp ? ((tp - currentPrice) / entry) * 100 : 0;
        }
    }

    const dynSlPct = entry > 0 ? ((displaySl - entry) / entry * 100 * (trade.side === 'BUY' ? 1 : -1)) : 0;
    const dynTpPct = entry > 0 ? ((displayTp - entry) / entry * 100 * (trade.side === 'BUY' ? 1 : -1)) : 0;

    return (
        <div className="px-1.5 py-1 flex flex-col gap-0.5">
            {/* SL / TP header row — compact single line */}
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter leading-none">
                <span className="text-rose-500 flex items-center gap-1">
                    SL:{sl > 0 ? formatPrice(displaySl) : '--'}
                    {sl > 0 && <span className="text-rose-500/60 font-bold">({dynSlPct >= 0 ? '+' : ''}{dynSlPct.toFixed(1)}%)</span>}
                    {isTslActive && trailingSlDev !== undefined && <span className="text-rose-400 bg-rose-500/15 px-1 rounded text-[8px] animate-pulse">TSL Aktif</span>}
                </span>
                <span className="text-emerald-500 flex items-center gap-1">
                    {isTtpActive && trailingTpDev !== undefined && <span className="text-emerald-400 bg-emerald-500/15 px-1 rounded text-[8px] animate-pulse">TTP (+{passedTpPercent.toFixed(1)}%)</span>}
                    {tp > 0 && <span className="text-emerald-500/60 font-bold">({dynTpPct >= 0 ? '+' : ''}{dynTpPct.toFixed(1)}%)</span>}
                    TP:{tp > 0 ? formatPrice(displayTp) : '--'}
                </span>
            </div>

            {/* Progress bar track */}
            <div className="h-1.5 w-full bg-slate-800/50 rounded-full relative border border-white/5 mt-1 mb-3">
                {sl > 0 && tp > 0 ? (() => {
                    const minP = Math.min(sl, displaySl, tp, displayTp, entry, currentPrice);
                    const maxP = Math.max(sl, displaySl, tp, displayTp, entry, currentPrice);
                    const padding = (maxP - minP) * 0.05;
                    const paddedMinP = minP - padding;
                    const paddedMaxP = maxP + padding;
                    const range = paddedMaxP - paddedMinP;
                    if (range <= 0) return null;
                    const getPos = (p: number) => Math.min(100, Math.max(0, ((p - paddedMinP) / range) * 100));
                    
                    const entryPos = getPos(entry);
                    const currentPos = getPos(currentPrice);
                    const slPos = getPos(sl);
                    const dynSlPos = getPos(displaySl);
                    const tpPos = getPos(tp);
                    const dynTpPos = getPos(displayTp);
                    
                    const stringStart = Math.min(entryPos, currentPos);
                    const stringWidth = Math.abs(currentPos - entryPos);

                    return (
                        <>
                            {/* Original SL marker (faded) */}
                            <div style={{ left: `${slPos}%` }} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-rose-500/30 z-10" />
                            {/* Dynamic SL marker */}
                            <div style={{ left: `${dynSlPos}%` }} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-rose-500/80 z-10 shadow-[0_0_4px_rgba(244,63,94,0.5)]" />
                            
                            {/* Original TP marker */}
                            <div style={{ left: `${tpPos}%` }} className={cn("absolute top-1/2 -translate-y-1/2 w-0.5 z-10", isTtpActive ? "h-2 bg-emerald-500/30" : "h-2.5 bg-emerald-500/60")} />
                            {/* Dynamic TTP marker */}
                            {isTtpActive && <div style={{ left: `${dynTpPos}%` }} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-emerald-400 z-10 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />}
                            
                            {/* Entry marker */}
                            <div style={{ left: `${entryPos}%` }} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-amber-400/50 z-10" />
                            {/* Entry label — below the bar */}
                            <div style={{ left: `${Math.min(85, Math.max(15, entryPos))}%` }} className="absolute top-[calc(100%+3px)] -translate-x-1/2 text-[8px] font-black text-amber-500/80 whitespace-nowrap z-30">
                                E:${formatPrice(entry)}
                            </div>
                            {/* PNL fill line */}
                            <div style={{ left: `${stringStart}%`, width: `${stringWidth}%` }} className={cn("absolute top-1/2 -translate-y-1/2 h-0.5 z-0 opacity-60", isProfit ? "bg-emerald-500" : "bg-rose-500")} />
                            {/* Current price thumb */}
                            <div style={{ left: `${currentPos}%` }} className={cn("absolute top-0 bottom-0 w-1.5 rounded-full z-20 transition-all duration-700 cursor-help group/thumb", isProfit ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]")}>
                                {/* Hover tooltip */}
                                <div className={cn("absolute -top-[50px] left-1/2 -translate-x-1/2 px-1.5 py-1 rounded text-[9px] font-black whitespace-nowrap transition-all opacity-0 group-hover/thumb:opacity-100 scale-90 group-hover/thumb:scale-100 shadow-xl z-50", isProfit ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
                                    ${currentPrice.toLocaleString()} | {isProfit ? '+' : ''}{pnlUsdt.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} ({pnlPercent.toFixed(2)}%)
                                </div>
                                {/* Price label above bar */}
                                <div className={cn("absolute -top-[28px] left-1/2 -translate-x-1/2 text-[8px] font-black whitespace-nowrap z-40", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                    ${formatPrice(currentPrice)}
                                </div>
                            </div>
                        </>
                    );
                })() : (
                    (() => {
                        const entryPos = 50;
                        const currentPos = Math.min(95, Math.max(5, 50 + (pnlPercent * 2)));
                        const stringStart = Math.min(entryPos, currentPos);
                        const stringWidth = Math.abs(currentPos - entryPos);
                        
                        return (
                            <>
                                <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-white/40 z-10" />
                                <div style={{ left: `${stringStart}%`, width: `${stringWidth}%` }} className={cn("absolute top-1/2 -translate-y-1/2 h-0.5 z-0 opacity-60", isProfit ? "bg-emerald-500" : "bg-rose-500")} />
                                <div style={{ left: `${currentPos}%` }} className={cn("absolute top-0 bottom-0 w-1.5 rounded-full z-20 transition-all duration-700 group/thumb-fb", isProfit ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]")}>
                                    <div className={cn("absolute -top-[28px] left-1/2 -translate-x-1/2 text-[8px] font-black whitespace-nowrap z-40", isProfit ? "text-emerald-400" : "text-rose-400")}>
                                        ${formatPrice(currentPrice)}
                                    </div>
                                </div>
                            </>
                        );
                    })()
                )}
            </div>
        </div>
    );
};

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
        lastAiScore?: number | string;
        smartTrade?: boolean;
        dca?: boolean;
        monitorError?: string;
        exitPrice?: number | string;
        exitResult?: { price: string; orderId: string };
        entryReason?: string;
        entryResult?: { price: string; orderId: string };
        exitReason?: string;
        closedAt?: number | string;
        filledAt?: number | string;
        highestPrice?: number;
        lowestPrice?: number;
        activeStopLoss?: number;
        activeTakeProfit?: number;
        payload: {
            symbol: string;
            amount: string;
            buyPrice: string;
            buyType: string;
            trailingBuy?: boolean;
            trailingBuyDev?: number;
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
                timeoutSeconds?: number;
                 breakeven?: boolean;
            } | null;
        }
    };
}

interface ActiveSmartTradesProps {
    onEdit?: (trade: SmartTradeOrder) => void;
    onNewTrade?: () => void;
}

export const ActiveSmartTrades: React.FC<ActiveSmartTradesProps> = ({ onEdit, onNewTrade }) => {
    const [trades, setTrades] = useState<SmartTradeOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedTrade, setExpandedTrade] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'AKTIF' | 'PASIF'>('AKTIF');
    const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
    const [isSectionExpanded, setIsSectionExpanded] = useState(true);

    const [error, setError] = useState<string | null>(null);
    const [clearingAction, setClearingAction] = useState<'active' | 'passive' | null>(null);
    const [pendingClear, setPendingClear] = useState<'active' | 'passive' | null>(null);

    const { 
        mtfData, 
        loadingMtf, 
        failedMtf,
        liveSignals, 
        fetchMtfAnalysis, 
        fetchMultipleMtfAnalysis,
        fetchLiveSignals 
    } = useTradingSignals();
    
    const [timeframe] = useModuleTimeframe('4h');

    const fetchTrades = async () => {
        try {
            const response = await api.get('/trade/smart');
            setTrades(response.data);
            setLastFetchTime(Date.now());
            setError(null);
        } catch (err: unknown) {
            let msg = 'Unknown error occurred';
            let status = 500;
            
            if (err && typeof err === 'object' && 'response' in err) {
                // Axios error
                const axiosError = err as { response?: { status?: number; data?: { details?: string; error?: string; message?: string; stack?: string } }; message: string };
                status = axiosError.response?.status || 500;
                
                // Prefer 'details', then 'error', then 'message', then generic.
                const start = axiosError.response?.data?.details || axiosError.response?.data?.error || axiosError.response?.data?.message || axiosError.message;
                const stack = axiosError.response?.data?.stack;
                msg = stack ? `${start} \n\nServer Stack:\n${stack}` : start;

                if (status === 400 || status === 401) {
                    console.warn('[SmartTrade] Config Warning:', start);
                } else {
                    console.error('Failed to fetch smart trades:', err);
                }
            } else if (err instanceof Error) {
                msg = err.message;
                console.error('Failed to fetch smart trades:', err);
            }
            
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePanicClose = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
        e.stopPropagation();
        try {
            await api.delete(`/trade/smart?id=${trade.id}`);
            fetchTrades();
        } catch (error) {
            console.error('Panic close failed:', error);
        }
    };

    const handleSilentClose = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
        e.stopPropagation();
        try {
            await api.delete(`/trade/smart?id=${trade.id}&silent=true`);
            fetchTrades();
        } catch (error) {
            console.error('Silent close failed:', error);
        }
    };

    const handleFlashOpen = async (e: React.MouseEvent, trade: SmartTradeOrder) => {
        e.stopPropagation();
        if (!confirm(`FLASH OPEN: ${trade.symbol} anlık piyasa fiyatından hemen işleme girecek. Devam et?`)) return;
        
        try {
            // Disable trailing buy and force immediate execution at market price
            await api.put(`/trade/smart?id=${trade.id}`, {
                trailingBuy: false,
                forceExecute: true
            });
            fetchTrades();
        } catch (error) {
            console.error('Flash open failed:', error);
        }
    };

    const handleClearAll = async (type: 'active' | 'passive') => {
        console.log('[ClearAll] Executing:', type);
        setClearingAction(type);
        setPendingClear(null);

        try {
            let result;
            if (type === 'active') {
                result = await api.delete('/trade/smart?all=true');
            } else {
                result = await api.delete('/trade/smart?clearHistory=true');
            }
            console.log('[ClearAll] Success:', result.data);
            await new Promise(r => setTimeout(r, 500));
            await fetchTrades();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
                ? (err as { response?: { data?: { error?: string; details?: string; message?: string } } }).response?.data?.error || 
                  (err as { response?: { data?: { details?: string } } }).response?.data?.details || 
                  'Bilinmeyen sunucu hatası'
                : err instanceof Error ? err.message : String(err);
            console.error('Clear all failed:', msg);
            alert(`İŞLEM BAŞARISIZ: ${msg}`);
        } finally {
            setClearingAction(null);
        }
    };

    useEffect(() => {
        fetchTrades();
        const interval = setInterval(fetchTrades, 2000);
        return () => clearInterval(interval);
    }, []);

    const triggerDataSync = useCallback(() => {
        if (trades.length === 0) return;
        
        const activeTrades = trades.filter(t => t.status !== 'CLOSED');
        if (activeTrades.length === 0) return;

        const activeSymbols = [...new Set(activeTrades.map(t => t.symbol.replace('/', '')))];
        fetchLiveSignals(activeSymbols, timeframe);

        // MTF verisi yüklenmemiş ve hata almamış aktif işlemler için otomatik yükleme yap (Batch)
        const missingMtfTrades = activeTrades
            .filter(trade => !mtfData[trade.id] && !loadingMtf[trade.id] && !failedMtf[trade.id])
            .map(t => ({ id: t.id, symbol: t.symbol.replace('/', '') }));
            
        if (missingMtfTrades.length > 0) {
            if (fetchMultipleMtfAnalysis) {
               fetchMultipleMtfAnalysis(missingMtfTrades);
            } else {
               missingMtfTrades.forEach(t => fetchMtfAnalysis(t.id, t.symbol));
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trades, timeframe, mtfData, loadingMtf, failedMtf]);

    // Canlı sinyalleri 30 saniyede bir güncelle
    useEffect(() => {
        triggerDataSync();
        const signalInterval = setInterval(triggerDataSync, 30000); // 30s refresh for AI signals
        return () => clearInterval(signalInterval);
    }, [triggerDataSync]);

    // Yeni işlem eklendiğinde veya MTF verisi eksik olduğunda hızlıca tetikle
    useEffect(() => {
        const hasMissingMtf = trades.some(t => t.status !== 'CLOSED' && !mtfData[t.id] && !loadingMtf[t.id] && !failedMtf[t.id]);
        if (hasMissingMtf) {
            triggerDataSync();
        }
    }, [trades, mtfData, loadingMtf, failedMtf, triggerDataSync]);

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
            <div className="flex items-center justify-between px-2 cursor-pointer group" onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-sm animate-pulse"></div>
                        <Activity className="w-5 h-5 text-cyan-400 relative z-10" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-2 group-hover:text-cyan-400 transition-colors">
                            ActiveSmartTrades 
                            {isSectionExpanded ? <ChevronUp className="w-4 h-4 ml-1 text-slate-500" /> : <ChevronDown className="w-4 h-4 ml-1 text-slate-500" />}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Neuro-Engine Integrated {" // "} {trades.length} Positions {" // "} Last Pulse: {new Date(lastFetchTime).toLocaleTimeString([], { hour12: false, second: '2-digit' })}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {error && (
                        error.includes('API keys') ? (
                            <div 
                                onClick={() => window.location.href = '/settings'}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse cursor-pointer hover:bg-yellow-500/20 transition-colors"
                            >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                CONFIGURATION REQUIRED: CLICK TO FIX KEYS
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-pulse">
                                <AlertCircle className="w-3.5 h-3.5" />
                                API ERROR: {error.toUpperCase()}
                            </div>
                        )
                    )}
                    <div className="flex bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden p-0.5">
                        <button 
                            onClick={onNewTrade}
                            className="p-2 px-3 text-[10px] font-black transition-all rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 flex items-center gap-1.5 mr-1"
                            title="YENİ İŞLEM OLUŞTUR"
                        >
                            <Zap className="w-3 h-3" />
                            NEW TRADE
                        </button>
                        <button 
                            onClick={() => setActiveTab('AKTIF')}
                            className={cn(
                                "p-2 px-4 text-xs font-black transition-all rounded-md",
                                activeTab === 'AKTIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            AKTİF
                        </button>
                        <button 
                            onClick={() => setActiveTab('PASIF')}
                            className={cn(
                                "p-2 px-4 text-xs font-black transition-all rounded-md",
                                activeTab === 'PASIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            PASİF
                        </button>
                    </div>
                    {trades.filter(t => activeTab === 'AKTIF' ? (t.status === 'FILLED' || t.status === 'PENDING') : t.status === 'CLOSED').length > 0 && (
                        <div className="flex items-center gap-2 relative">
                            <button 
                                onClick={(e) => { e.stopPropagation(); console.log('[UI] Button clicked, setting pendingClear'); setPendingClear(activeTab === 'AKTIF' ? 'active' : 'passive'); }}
                                disabled={clearingAction !== null || pendingClear !== null}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest group",
                                    (clearingAction !== null || pendingClear !== null) ? "opacity-50 cursor-not-allowed" : "",
                                    activeTab === 'AKTIF' 
                                        ? "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400" 
                                        : "bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 text-slate-400"
                                )}
                                title={activeTab === 'AKTIF' ? "TÜM AKTİF POZİSYONLARI KAPAT VE SAT" : "İŞLEM GEÇMİŞİNİ TEMİZLE"}
                                id={activeTab === 'AKTIF' ? "flush-all-btn" : "clear-history-btn"}
                            >
                                {clearingAction !== null ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ShieldAlert className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                )}
                                {clearingAction !== null ? 'İŞLENİYOR...' : (activeTab === 'AKTIF' ? 'FLUSH ALL' : 'CLEAR HISTORY')}
                            </button>
                            {/* Inline Confirmation Panel */}
                            {pendingClear !== null && (
                                <div className="absolute right-0 top-full mt-2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap">
                                    <span className="text-[10px] font-black text-rose-300 uppercase tracking-wider mr-2">
                                        {pendingClear === 'active' ? 'TÜM POZİSYONLAR SATILACAK!' : 'GEÇMİŞ SİLİNECEK!'}
                                    </span>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleClearAll(pendingClear); }}
                                        className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors shadow-lg"
                                    >
                                        ONAYLA ✓
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setPendingClear(null); }}
                                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-black uppercase tracking-wider transition-colors"
                                    >
                                        İPTAL ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* TABLE-LIKE LIST (ACCORDION EFFECT) */}
            <div className={cn("transition-all duration-500 overflow-hidden", isSectionExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0")}>
                <div className="bg-[#0f172a]/20 backdrop-blur-xl border border-slate-800/60 rounded-2xl overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                    {/* HEADERS */}
                    <div className="grid grid-cols-[0.7fr_0.8fr_0.5fr_0.6fr_2fr_1.4fr_0.7fr_0.7fr_28px] gap-1.5 px-3 py-2.5 border-b border-white/5 bg-slate-950/60 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                    <div className="flex items-center justify-center gap-1">PAIR</div>
                    <div className="flex items-center justify-center gap-1">ENTRY / MKT</div>
                    <div className="flex items-center justify-center gap-1">LIVE AI</div>
                    <div className="flex items-center justify-center gap-1">STATUS</div>
                    <div className="flex items-center justify-center gap-1">SMART TARGETS</div>
                    <div className="flex items-center justify-center gap-1">MTF ANALYSIS</div>
                    <div className="flex items-center justify-center gap-1">MTF SIGNAL</div>
                    <div className="flex items-center justify-center gap-1">PNL</div>
                    <div></div>
                </div>

                <div className="divide-y divide-white/5">
                    {trades.filter(t => activeTab === 'AKTIF' ? (t.status === 'FILLED' || t.status === 'PENDING') : t.status === 'CLOSED').length === 0 ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                                <Search className="w-6 h-6 text-slate-700" />
                            </div>
                            <span className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                                {activeTab === 'AKTIF' ? 'Aktif İşlem Bulunamadı' : 'Geçmiş İşlem Bulunamadı'}
                            </span>
                            <p className="text-xs text-slate-700 max-w-[240px]">
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
                            const isClosed = trade.status === 'CLOSED';
                            const meta = trade.meta;
                            const exitPriceNum = meta.exitPrice ? parseFloat(String(meta.exitPrice)) : (meta.exitResult?.price ? parseFloat(String(meta.exitResult.price)) : 0);
                            
                            // For closed trades, use the exitPriceNum. For active, use ticker currentPrice or fallback to entry.
                            const currentPrice = isClosed ? (exitPriceNum || trade.price) : (trade.currentPrice || trade.price);
                            
                            const payloadTp = parseFloat(payload?.takeProfit?.price || "0");
                            const payloadSl = parseFloat(payload?.stopLoss?.price || "0");
                            
                            // Use calculated trailing prices from monitor if available
                            const tp = meta.activeTakeProfit || payloadTp;
                            const sl = meta.activeStopLoss || payloadSl;
                            
                            const entry = trade.price;
                            
                            // Real PNL Calculation
                            const { pnlPercent, pnlUsdt } = calculateTradePnl(trade.side, meta.mode, entry, currentPrice, trade.qty);

                             const aiScoreStatic = meta.lastAiScore ? Number(meta.lastAiScore) : 0;
                             const hasTrailing = payload.takeProfit?.trailing || payload.stopLoss?.trailing;
 
                             // Live trailing status
                             const isBuyDir = trade.side === 'BUY';
                             const isTtpActive = tp > 0 && payload.takeProfit?.trailing && !isClosed && (isBuyDir ? currentPrice >= tp : currentPrice <= tp);
                             const isTslActive = sl > 0 && payload.stopLoss?.trailing && !isClosed && (isBuyDir ? currentPrice <= sl : currentPrice >= sl);
 
                             // CANLI sinyal verisinden AI Score ve STATUS — Shared Lib kullanılıyor
                             const symNorm = trade.symbol.replace('/', '');
                             const liveData = liveSignals[symNorm] || null;

                             const { statusText, statusColor, liveAiScore: aiScore } = interpretTradingStatus(
                                 liveData,
                                 isClosed,
                                 trade.side,
                                 currentPrice,
                                 tp,
                                 sl,
                                 aiScoreStatic
                             );


                            // Label logic
                            let opLabel = "STANDARD TRADE";
                            if (meta.smartTrade) opLabel = "SMART TRADE";
                            else if (meta.mode === 'TRADE') opLabel = "STANDARD BUY";
                            else if (meta.mode === 'COVER') opLabel = "STANDARD SELL";
                            else if (meta.dca) opLabel = "DCA BOT";

                            const isBuyExit = trade.side === 'BUY' && isClosed;
                            const isSellExit = trade.side === 'SELL' && isClosed;

                            // MTF Verdict Calculation
                            const mtfResults = mtfData[trade.id] || {};
                            const allTfs = MTF_INTERVALS.map(tf => mtfResults[tf]).filter(Boolean);
                            const { bullCount, bearCount, bullPct, verdictText, verdictColor, avgMtfScore } = calculateMtfVerdict(allTfs);

                            return (

                                <div key={trade.id} className={cn(
                                    "group transition-all duration-300",
                                    !isClosed && "hover:bg-cyan-400/[0.03]",
                                    isBuyExit && "bg-emerald-500/5 opacity-80 border-l-2 border-emerald-500/20",
                                    isSellExit && "bg-rose-500/5 opacity-80 border-l-2 border-rose-500/20"
                                )}>
                                    <div 
                                        className="grid grid-cols-[0.7fr_0.8fr_0.5fr_0.6fr_2fr_1.4fr_0.7fr_0.7fr_28px] gap-1.5 px-3 py-2 items-center cursor-pointer"
                                        onClick={() => {
                                            const next = isExpanded ? null : trade.id;
                                            setExpandedTrade(next);
                                            if (next !== null && !mtfData[trade.id]) {
                                                fetchMtfAnalysis(trade.id, trade.symbol.replace('/', ''));
                                            }
                                        }}

                                    >
                                        {/* PAIR */}
                                        <div className="flex items-center gap-3 justify-center w-full">
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
                                                <div className="text-xs font-black uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded-sm text-[10px]",
                                                        opLabel === "SMART TRADE" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" :
                                                        opLabel === "DCA BOT" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                                                        "bg-slate-800 text-slate-400 border border-white/5"
                                                    )}>
                                                        {opLabel}
                                                    </span>
                                                    <span className="text-slate-600 font-bold">V{trade.id}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ENTRY / MARKET */}
                                        <div className="flex flex-col items-center justify-center w-full min-w-0">
                                            <div className="text-xs font-black text-slate-300 font-mono whitespace-nowrap">
                                                E: <span className="text-white font-black">${entry.toLocaleString()}</span>
                                            </div>
                                            <div className="text-xs font-bold text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                                                {isClosed ? 'X:' : 'M:'} <span className={cn(
                                                    "transition-colors duration-500 font-black",
                                                    currentPrice >= entry ? (trade.side === 'BUY' ? "text-emerald-400" : "text-rose-400") : (trade.side === 'BUY' ? "text-rose-400" : "text-emerald-400")
                                                )}>${currentPrice.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* AI SCORE — CANLI 4H */}
                                        <div className="flex flex-col items-center justify-center gap-1 w-full">
                                            <div className="flex items-center gap-1.5">
                                                <Brain className={cn("w-4 h-4", liveData ? (aiScore >= 60 ? "text-emerald-400" : aiScore <= 35 ? "text-rose-400" : "text-cyan-400") : "text-slate-500")} />
                                                <span className={cn("text-sm font-black", liveData ? (aiScore >= 60 ? "text-emerald-400" : aiScore <= 35 ? "text-rose-400" : "text-cyan-300") : "text-slate-300")}>
                                                    {aiScore > 0 ? `${aiScore}%` : 'SİNYAL...'}
                                                </span>
                                                {liveData && <span className="text-[8px] text-slate-600 font-bold px-1 bg-slate-800/50 rounded">{timeframe.toUpperCase()}</span>}
                                            </div>
                                            <div className="w-16 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-white/5">
                                                <div style={{ width: `${aiScore}%` }} className={cn("h-full transition-all duration-700", aiScore >= 60 ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : aiScore <= 35 ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-cyan-400")}></div>
                                            </div>

                                            {(!isClosed && (isTtpActive || isTslActive)) && (
                                                <div className="flex flex-col gap-1 w-full mt-1.5">
                                                    {isTtpActive && (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] whitespace-nowrap">
                                                            TTP AKTİF 🚀 <Radar className="w-2.5 h-2.5 animate-spin drop-shadow-[0_0_5px_rgba(16,185,129,0.8)] ml-auto" />
                                                        </span>
                                                    )}
                                                    {isTslActive && (
                                                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)] whitespace-nowrap">
                                                            TSL AKTİF 🚨 <Radar className="w-2.5 h-2.5 animate-spin drop-shadow-[0_0_5px_rgba(244,63,94,0.8)] ml-auto" />
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>


                                        {/* STATUS — CANLI SİNYAL */}
                                        <div className="flex justify-center w-full">
                                            <StatusBadge 
                                                meta={meta} 
                                                side={trade.side}
                                                isClosed={isClosed} 
                                                timeframe={timeframe} 
                                                liveData={liveData} 
                                                statusText={statusText} 
                                                statusColor={statusColor} 
                                            />
                                        </div>

                                        {/* SMART TARGETS BAR */}
                                        <div className="flex flex-col justify-center w-full min-w-0">
                                            <TradeProgressBar 
                                                trade={trade} 
                                                entry={entry} 
                                                currentPrice={currentPrice} 
                                                sl={sl} 
                                                tp={tp} 
                                                pnlPercent={pnlPercent} 
                                                pnlUsdt={pnlUsdt} 
                                                isProfit={pnlPercent >= 0}
                                                trailingTpDev={payload.takeProfit?.deviation}
                                                trailingSlDev={payload.stopLoss?.deviation}
                                                isTtpActive={!!isTtpActive}
                                                isTslActive={!!isTslActive}
                                            />
                                            {/* Compact feature badges */}
                                            {!isClosed && (payload.trailingBuy || payload.takeProfit?.trailing || payload.stopLoss?.trailing || payload.stopLoss?.timeout || payload.stopLoss?.breakeven) && (
                                                <div className="flex items-center gap-1 px-1.5 flex-wrap">
                                                    {payload.trailingBuy && (
                                                        <span className="px-1 py-0.5 rounded text-[8px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                            {payload.trailingBuyDev ? `TBY ${payload.trailingBuyDev}%` : 'TBY'}
                                                        </span>
                                                    )}
                                                    {payload.takeProfit?.trailing && (
                                                        <span className="px-1 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            {payload.takeProfit.deviation ? `TTP ${payload.takeProfit.deviation}%` : 'TTP'}
                                                        </span>
                                                    )}
                                                    {payload.stopLoss?.trailing && (
                                                        <span className="px-1 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                            {payload.stopLoss.deviation ? `TSL ${Math.abs(payload.stopLoss.deviation)}%` : 'TSL'}
                                                        </span>
                                                    )}
                                                    {payload.stopLoss?.timeout && (
                                                        <span className="px-1 py-0.5 rounded text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">⏱{payload.stopLoss.timeoutSeconds || 10}s</span>
                                                    )}
                                                    {payload.stopLoss?.breakeven && (
                                                        <span className="px-1 py-0.5 rounded text-[8px] font-black bg-violet-500/10 text-violet-400 border border-violet-500/20">BE✓</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* YENİ SÜTUN 1: MTF ANALYSIS (COMPACT) */}
                                        <div className="flex items-center justify-center gap-1 overflow-hidden w-full" onClick={(e) => { e.stopPropagation(); fetchMtfAnalysis(trade.id, trade.symbol.replace('/', '')); }}>
                                            {loadingMtf[trade.id] && !mtfData[trade.id] ? (
                                                <div className="w-full text-center text-[11px] text-slate-500 font-bold animate-pulse">ANALİZ EDİLİYOR...</div>
                                            ) : (!mtfData[trade.id] && failedMtf[trade.id]) ? (
                                                <div className="w-full text-center text-[11px] text-rose-500/70 font-bold cursor-pointer hover:text-rose-400">YENİDEN DENEMEK İÇİN TIKLA</div>
                                            ) : !mtfData[trade.id] ? (
                                                <div className="w-full text-center text-[11px] text-slate-600 font-bold cursor-pointer hover:text-cyan-400">YÜKLENİYOR...</div>
                                            ) : (
                                                MTF_INTERVALS.map(tf => {
                                                    const d = mtfData[trade.id]?.[tf];
                                                    if (!d) return null;
                                                    
                                                    const hasBuySignal = d.f4ConfirmedBuy || d.f4EarlyBuy;
                                                    const hasSellSignal = d.f4ConfirmedSell || d.f4EarlySell;

                                                    const tfColor = hasBuySignal ? "bg-emerald-500/10 border-emerald-500/20" : hasSellSignal ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-800/10 border-slate-700/30";
                                                    const textColor = hasBuySignal ? "text-emerald-400" : hasSellSignal ? "text-rose-400" : "text-slate-500";
                                                    const tfVerdict = hasBuySignal ? "AL" : hasSellSignal ? "SAT" : "NÖTR";
                                                    
                                                    return (
                                                        <div key={tf} className={`flex-1 flex flex-col items-center gap-2 py-2.5 px-1.5 border rounded ${tfColor} hover:scale-105 transition-transform`}>
                                                            <div className="flex flex-col items-center justify-center w-full">
                                                                <span className="text-[13px] font-black text-white leading-none">{tf}</span>
                                                                <span className={`text-[12px] font-black mt-1.5 ${textColor} leading-none ${hasBuySignal || hasSellSignal ? 'animate-pulse' : ''}`}>{tfVerdict}</span>
                                                            </div>
                                                            <div className="w-full px-2 h-1 flex-1 max-w-[28px] mt-1">
                                                                <div className="w-full h-full bg-slate-800 rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full ${d.aiScore >= 60 ? 'bg-emerald-500' : d.aiScore <= 35 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, d.aiScore)}%` }} />
                                                                </div>
                                                            </div>
                                                            {/* F4 Signali */}
                                                            <div className="w-full flex items-center justify-center mt-1.5">
                                                                <span className="text-[11px] font-black leading-none opacity-100 text-center">
                                                                    {d.f4ConfirmedBuy ? <span className="text-emerald-400">✅F4</span> : d.f4EarlyBuy ? <span className="text-emerald-300">🔔F4</span> : d.f4ConfirmedSell ? <span className="text-rose-400">❌F4</span> : d.f4EarlySell ? <span className="text-rose-300">🔕F4</span> : d.whaleDetected ? <span title={d.whaleStatus}>🐋</span> : <span className="text-slate-500/50">-</span>}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {/* YENİ SÜTUN 2: MTF VERDICT */}
                                        <div className="flex flex-col items-center justify-center border-l border-white/5 overflow-hidden w-full">
                                            {mtfData[trade.id] ? (
                                                <div className="flex flex-col items-center gap-1.5 w-full text-center" onClick={(e) => { e.stopPropagation(); fetchMtfAnalysis(trade.id, trade.symbol.replace('/', '')); }}>
                                                    <div className="flex items-center gap-1.5 scale-110">
                                                        <TrendingUp className={cn("w-4 h-4", (verdictText === 'AL' || verdictText === 'GÜÇLÜ AL') ? "text-emerald-400" : verdictText === 'NÖTR' ? "text-slate-500" : "text-rose-400")} />
                                                        <span className={`text-[12px] font-black tracking-widest leading-none ${verdictColor}`}>{verdictText}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5 shadow-inner min-w-[60px]" title={`Ortalama Skor: ${avgMtfScore}%`}>
                                                        <div className={`h-full transition-all duration-1000 ${bullPct >= 55 ? 'bg-emerald-500' : bullPct <= 45 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${bullPct}%` }} />
                                                    </div>

                                                    <div className="flex items-center gap-1 bg-slate-900/50 px-1.5 py-1 rounded border border-white/5 shadow-inner">
                                                        <span className="text-[10px] font-black text-emerald-500">{bullCount} BOĞA</span>
                                                        <span className="text-[8px] text-slate-600 opacity-50">|</span>
                                                        <span className="text-[10px] font-black text-rose-500">{bearCount} AYI</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); fetchMtfAnalysis(trade.id, trade.symbol.replace('/', '')); }} className="text-[10px] font-black text-cyan-500 uppercase px-3 py-1.5 bg-cyan-500/10 rounded border border-cyan-500/20 hover:bg-cyan-500/20 transition-all animate-pulse">
                                                    YÜKLE
                                                </button>
                                            )}
                                        </div>


                                        {/* PNL REAL */}
                                        <div className="text-center flex flex-col items-center justify-center w-full">
                                            <div className="flex items-center justify-center gap-1">
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
                                        <div className="flex justify-center text-slate-700 mx-auto">
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-cyan-500" /> : <ChevronDown className="w-4 h-4 group-hover:text-cyan-500 transition-colors" />}
                                        </div>
                                    </div>

                                    {/* EXPANDED PANEL (SADECE CONSOLIDATED STATS VE NEURAL LOGS) */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-slate-950/40 animate-in fade-in slide-in-from-top-2">
                                            <div className="grid grid-cols-4 gap-6">
                                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl relative overflow-hidden">
                                                     <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">KONSOLİDE İSTATİSTİKLER</span>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Miktar ({trade.symbol.split('/')[0]})</span>
                                                            <span className="text-xs font-black text-white">{trade.qty.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Varlık (USDT)</span>
                                                            <span className="text-xs font-black text-white">${(trade.qty * currentPrice).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">TP Uzaklığı</span>
                                                            <span className="text-xs font-black text-emerald-400">
                                                                {tp > 0 ? `${(((tp - currentPrice) / currentPrice) * 100 * (trade.side === 'BUY' ? 1 : -1)).toFixed(2)}%` : 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
                                                     <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] block mb-3">SİSTEM DENETİM GÜNLÜĞÜ</span>
                                                    <div className="space-y-1.5 overflow-hidden">
                                                        <div className="text-[10px] font-mono text-emerald-400 uppercase bg-emerald-400/5 px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/10">
                                                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                                            <Clock className="w-2.5 h-2.5" /> Giriş: ${entry} @ {meta.filledAt ? new Date(meta.filledAt).toLocaleTimeString([], { hour12: false }) : 'BAŞLANGIÇ'}
                                                        </div>
                                                        {meta.entryReason && (
                                                            <div className="text-[10px] font-mono text-cyan-500/70 uppercase px-2 py-0.5 ml-4 border-l border-white/5">
                                                                ↳ Sebep: {meta.entryReason}
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-400/5 px-2 py-1 rounded flex items-center gap-1 border border-cyan-500/10">
                                                            <Brain className="w-2.5 h-2.5" /> AI Skoru: {aiScore}% Peak Güven
                                                        </div>
                                                        
                                                        {isClosed ? (
                                                            <div className="text-[10px] font-mono text-rose-400 uppercase bg-rose-400/5 px-2 py-1 rounded flex items-center gap-1 border border-rose-500/10 mt-2">
                                                                <ZapOff className="w-2.5 h-2.5" /> 
                                                                SİSTEM DIŞI: {meta.exitReason || 'SİSTEM_KAPATILDI'}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] font-mono text-cyan-400 uppercase bg-cyan-400/10 px-2 py-1 rounded flex items-center gap-1 border border-cyan-500/20 animate-pulse">
                                                                <Radar className="w-2.5 h-2.5 animate-spin" /> {statusText} AKTİF
                                                            </div>
                                                        )}
                                                        
                                                        <div className="text-[10px] font-mono text-slate-600 uppercase px-1 pt-1 opacity-50 flex justify-between items-center">
                                                            <span>Oluşturma: {new Date(trade.created_at).toLocaleTimeString([], { hour12: false })}</span>
                                                            {isClosed && meta.closedAt && <span>Kapanış: {new Date(meta.closedAt).toLocaleTimeString([], { hour12: false })}</span>}
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
                                                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-755 rounded-lg transition-all border border-slate-700 text-white text-xs font-black uppercase tracking-widest"
                                                            >
                                                                <ExternalLink className="w-4 h-4" />
                                                                MEXC GÖRÜNTÜLE
                                                            </a>
                                                            <button 
                                                                 onClick={(e) => { 
                                                                     e.stopPropagation(); 
                                                                     if (onEdit) onEdit(trade); 
                                                                 }}
                                                                 className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest"
                                                             >
                                                                 <TrendingUp className="w-4 h-4" />
                                                                 DÜZENLE
                                                             </button>
                                                             {trade.status === 'PENDING' && payload.trailingBuy && (
                                                                 <button 
                                                                     onClick={(e) => handleFlashOpen(e, trade)}
                                                                     className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest animate-pulse"
                                                                     title="TBY beklemeden hemen piyasa fiyatından işleme gir"
                                                                 >
                                                                     <Zap className="w-4 h-4" />
                                                                     FLASH OPEN
                                                                 </button>
                                                             )}
                                                             <button
                                                                 onClick={(e) => { e.stopPropagation(); fetchTrades(); }}
                                                                 className="flex items-center justify-center gap-2 w-full py-2.5 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-lg transition-all border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-widest"
                                                                 title="Verileri sunucudan yeniden yükle"
                                                                 aria-label="Force Sync"
                                                             >
                                                                 <RefreshCw className="w-4 h-4" />
                                                                 HIZLI SENK
                                                             </button>
                                                        </div>

                                                        <div className="flex flex-col gap-3 p-4">
                                                            <button 
                                                                onClick={(e) => handlePanicClose(e, trade)}
                                                                className="group/panic flex flex-col items-center justify-center gap-2 w-full h-[90px] border-2 border-dashed border-rose-500/20 hover:border-rose-500/60 hover:bg-rose-500/10 rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(244,63,94,0)] hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]"
                                                            >
                                                                <ZapOff className="w-7 h-7 text-rose-500/40 group-hover/panic:text-rose-500 group-hover/panic:scale-110 transition-all" />
                                                                 <span className="text-xs font-black text-rose-500/40 group-hover/panic:text-rose-500 uppercase tracking-[0.2em]">PANİK ÇIKIŞ (PİYASA SATIŞ)</span>
                                                            </button>

                                                             <button 
                                                                 onClick={(e) => handleSilentClose(e, trade)}
                                                                 className="group/silent flex flex-col items-center justify-center gap-2 w-full h-[60px] border border-slate-800 hover:border-slate-700 hover:bg-white/5 rounded-2xl transition-all duration-300"
                                                                 title="İşlemi kapatmadan sadece listeden kaldır"
                                                                 aria-label="Sessiz Arşiv"
                                                             >
                                                                 <div className="flex items-center gap-2">
                                                                     <RefreshCw className="w-4 h-4 text-slate-500 group-hover/silent:text-slate-300 group-hover/silent:rotate-180 transition-all duration-700" />
                                                                     <span className="text-xs font-black text-slate-500 group-hover/silent:text-slate-300 uppercase tracking-[0.2em]">CLOSE ORDER (SESSİZ ARŞİV)</span>
                                                                 </div>
                                                             </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="col-span-2 p-5 bg-slate-950/60 border border-slate-800/50 rounded-2xl relative overflow-hidden group/audit">
                                                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover/audit:opacity-10 transition-opacity">
                                                            <ShieldAlert className="w-24 h-24 text-cyan-500" />
                                                        </div>
                                                        
                                                        <div className="flex flex-col gap-4 relative z-10">
                                                            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                                                                <div className="w-10 h-10 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center">
                                                                    <ShieldAlert className="w-5 h-5 text-slate-400" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">KAPANIŞ DENETİM KAYDI</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">POZİSYON TAMAMLANDI VE ARŞİVLENDİ</span>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">KAPANIŞ TETİKLEYİCİ</span>
                                                                    <span className={cn(
                                                                        "text-[11px] font-black uppercase",
                                                                        meta.exitReason?.startsWith('MANUAL') ? "text-amber-400" : "text-emerald-400"
                                                                    )}>
                                                                        {meta.exitReason?.startsWith('MANUAL') ? '● KULLANICI KOMUTU (MANUEL)' : '● MATRIX AI MONİTÖR'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">ANA SEBEP</span>
                                                                    <span className="text-[11px] font-black text-white uppercase truncate" title={meta.exitReason}>
                                                                        {meta.exitReason ? (
                                                                            meta.exitReason === 'MANUAL_PANIC_EXIT' ? 'PANİK SATIŞ TETİKLENDİ' :
                                                                            meta.exitReason === 'MANUAL_SILENT_EXIT' ? 'SESSİZ ARŞİV (POZİSYON KORUNDU)' :
                                                                            meta.exitReason.replace(/ HIT$/, '').replace('TRAILING TP', 'TTP').replace('TRAILING SL', 'TSL').replace('TRAILING BUY', 'TBY')
                                                                        ) : 'BİLİNMEYEN_SİSTEM_ÇIKIŞI'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">SON ÇIKIŞ FİYATI</span>
                                                                    <span className="text-[11px] font-black text-white font-mono">
                                                                        ${currentPrice.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">KAPANIŞ ZAMANI</span>
                                                                    <span className="text-[11px] font-black text-slate-300 font-mono">
                                                                        {meta.closedAt ? new Date(meta.closedAt).toLocaleString([], { hour12: false }) : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                                                                <div className="flex justify-between items-center bg-slate-900/40 px-3 py-2 rounded-lg border border-white/5">
                                                                    <span className="text-[9px] font-black text-slate-500 uppercase">MEXC Emir ID</span>
                                                                    <span className="text-[10px] font-mono text-cyan-500/80">
                                                                        {meta.exitResult?.orderId || 'INTERNAL_LIQUIDATION'}
                                                                    </span>
                                                                </div>
                                                                <div className="bg-emerald-500/5 px-3 py-2 rounded-lg border border-emerald-500/10 flex justify-between items-center">
                                                                    <span className="text-[9px] font-black text-emerald-500/70 uppercase">Toplam Sonuç (PNL)</span>
                                                                    <span className={cn("text-[11px] font-black font-mono", pnlPercent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                                                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}% | ${pnlUsdt.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
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
                <div className="px-6 py-4 border-t border-white/5 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-650 uppercase tracking-[0.3em]">
                    <div className="flex items-center gap-6">
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div> VERSİYON: V2.6.2-TERMİNAL</span>
                        <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> VERİ AKIŞI: AKTİF</span>
                        <span className="text-slate-700">|</span>
                        <span className="flex items-center gap-2">YENİLEME: 500MS</span>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
};
