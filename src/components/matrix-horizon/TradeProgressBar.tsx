import React from 'react';
import { SmartTradeOrder } from '../ActiveSmartTrades';
import { cn } from '@/lib/utils';

interface TradeProgressBarProps {
    trade: SmartTradeOrder;
    entry: number;
    currentPrice: number;
    sl: number;
    tp: number;
    pnlPercent: number;
    pnlUsdt: number;
    isProfit: boolean;
    trailingTpDev?: number;
    trailingSlDev?: number;
    isTtpActive?: boolean;
    isTslActive?: boolean;
}

export const TradeProgressBar: React.FC<TradeProgressBarProps> = ({ trade, entry, currentPrice, sl, tp, pnlPercent, pnlUsdt, isProfit, trailingTpDev, trailingSlDev, isTtpActive, isTslActive }) => {
    const formatPrice = (p: number) => p < 1 ? p.toFixed(4) : p < 10 ? p.toFixed(3) : p.toFixed(2);
    const slPct = entry > 0 ? ((sl - entry) / entry * 100 * (trade.side === 'BUY' ? 1 : -1)) : 0;

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
