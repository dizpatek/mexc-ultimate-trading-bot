"use client";

import React, { useState } from 'react';
import { Send, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';
import { sendTradeSignal } from '../services/api';
import type { TradeSignal } from '../services/api';
import { cn } from '@/lib/utils';

interface TradeFormProps {
    selectedSymbol?: string;
    assetData?: { holding: number; usdt: number };
}

export const TradeForm = ({ selectedSymbol, assetData }: TradeFormProps) => {
    const [signal, setSignal] = useState<'buy' | 'sell'>('buy');
    const [pair, setPair] = useState('BTC_USDT');
    const [useAssets, setUseAssets] = useState(true);
    const [percentage, setPercentage] = useState(0);

    // Sync pair with dashboard selected symbol
    React.useEffect(() => {
        if (selectedSymbol) {
            // Convert BTCUSDT to BTC_USDT for the form/API
            let formatted = selectedSymbol;
            if (selectedSymbol.includes('USDT') && !selectedSymbol.includes('_')) {
                formatted = selectedSymbol.replace('USDT', '_USDT');
            }
            setPair(formatted);
        }
    }, [selectedSymbol]);

    const [amount, setAmount] = useState('');
    const [usdt, setUsdt] = useState('');
    const [risk, setRisk] = useState('');
    const [tp, setTp] = useState('');
    const [sl, setSl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Handle percentage slider change
    const handlePercentageChange = (pct: number) => {
        setPercentage(pct);
        if (signal === 'buy' && assetData?.usdt) {
            const calculatedUsdt = (assetData.usdt * pct) / 100;
            setUsdt(calculatedUsdt.toFixed(2));
            setAmount(''); // Clear manual amount if usdt is set via %
        } else if (signal === 'sell' && assetData?.holding) {
            const calculatedAmount = (assetData.holding * pct) / 100;
            setAmount(calculatedAmount.toFixed(4));
            setUsdt(''); // Clear manual usdt if amount is set via %
        }
    };

    const handleMaxAmount = () => {
        if (assetData?.holding) {
            setAmount(assetData.holding.toString());
            setPercentage(100);
        }
    };

    const handleMaxUsdt = () => {
        if (assetData?.usdt) {
            setUsdt(assetData.usdt.toString());
            setPercentage(100);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const tradeSignal: TradeSignal = {
                signal,
                pair,
                secret: 'replace_with_strong_secret'
            };

            if (amount) tradeSignal.amount = parseFloat(amount);
            if (usdt) tradeSignal.usdt = parseFloat(usdt);
            if (risk) tradeSignal.risk = parseFloat(risk);
            if (tp) tradeSignal.tp = tp.split(',').map(Number);
            if (sl) tradeSignal.sl = sl.split(',').map(Number);

            const response = await sendTradeSignal(tradeSignal);

            if (response && (response.success || response.ok)) {
                setMessage({ type: 'success', text: `Sinyal Gönderildi - ${signal.toUpperCase()}` });
                setAmount('');
                setUsdt('');
                setPercentage(0);
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Sinyal Gönderilemedi' });
                setTimeout(() => setMessage(null), 4000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: `Hata: ${(error as Error).message}` });
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4 relative overflow-hidden group">
            {/* Background Icon */}
            <div className="absolute -bottom-6 -right-6 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
                <Send className="w-48 h-48 text-cyan-500" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "p-1.5 rounded-lg border shadow-sm transition-all duration-500",
                        signal === 'buy' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                    )}>
                        {signal === 'buy' ? (
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Trade Signal
                        </h3>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">Matrix Operation Center</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">Varlıkları Kullan</span>
                    <button 
                        type="button"
                        onClick={() => setUseAssets(!useAssets)}
                        className={cn(
                            "w-7 h-4 rounded-full transition-all relative px-0.5",
                            useAssets ? "bg-cyan-500" : "bg-slate-800 border border-slate-700"
                        )}
                    >
                        <div className={cn(
                            "w-2.5 h-2.5 bg-white rounded-full transition-all shadow-sm",
                            useAssets ? "translate-x-3" : "translate-x-0"
                        )} />
                    </button>
                    {isLoading && <Activity className="w-3.5 h-3.5 animate-spin text-cyan-500 ml-1" />}
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3 relative z-10">
                {/* 1. Signal Type Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/50 border border-white/5 rounded-xl shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setSignal('buy');
                            setPercentage(0);
                        }}
                        className={cn(
                            "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            signal === 'buy' 
                                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20" 
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Buy
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setSignal('sell');
                            setPercentage(0);
                        }}
                        className={cn(
                            "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                            signal === 'sell' 
                                ? "bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/20" 
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        Sell
                    </button>
                </div>

                {/* 2. Pair Input */}
                <div className="space-y-1 shrink-0">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Symbol</label>
                        <Target className="w-2.5 h-2.5 text-slate-700" />
                    </div>
                    <input
                        type="text"
                        value={pair}
                        onChange={(e) => setPair(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700"
                        placeholder="e.g. BTC_USDT"
                    />
                </div>

                {/* 3. Amount & Value Grid */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Amount</label>
                            <button 
                                type="button"
                                onClick={handleMaxAmount}
                                className="text-[7px] font-black text-cyan-500 hover:text-cyan-400 uppercase tracking-tighter"
                            >
                                MAX: {assetData?.holding.toFixed(4) || '0'}
                            </button>
                        </div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => {
                                setAmount(e.target.value);
                                setPercentage(0); // Reset percentage on manual input
                            }}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700"
                            placeholder="0.00"
                            step="any"
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">USDT</label>
                            <button 
                                type="button"
                                onClick={handleMaxUsdt}
                                className="text-[7px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-tighter"
                            >
                                MAX: ${assetData?.usdt.toFixed(0) || '0'}
                            </button>
                        </div>
                        <input
                            type="number"
                            value={usdt}
                            onChange={(e) => {
                                setUsdt(e.target.value);
                                setPercentage(0); // Reset percentage on manual input
                            }}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700"
                            placeholder="0.00"
                            step="any"
                        />
                    </div>
                </div>

                {/* 3.5 Precision Slider */}
                <div className="space-y-2 py-1 px-1 shrink-0">
                    <div className="flex justify-between items-center text-[8px] font-black text-slate-500 uppercase tracking-widest">
                        <span>HASSAS AYAR (ORAN)</span>
                        <span className="text-cyan-400 font-mono text-[10px]">{percentage}%</span>
                    </div>
                    <div className="relative h-6 flex items-center">
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            step="1" 
                            value={percentage}
                            onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                            className="w-full accent-cyan-500 h-1.5 rounded-full cursor-pointer bg-slate-800 appearance-none outline-none"
                        />
                    </div>
                    <div className="flex justify-between text-[7px] font-bold text-slate-600 uppercase px-0.5">
                        <button type="button" onClick={() => handlePercentageChange(0)} className="hover:text-cyan-400">0%</button>
                        <button type="button" onClick={() => handlePercentageChange(25)} className="hover:text-cyan-400">25%</button>
                        <button type="button" onClick={() => handlePercentageChange(50)} className="hover:text-cyan-400">50%</button>
                        <button type="button" onClick={() => handlePercentageChange(75)} className="hover:text-cyan-400">75%</button>
                        <button type="button" onClick={() => handlePercentageChange(100)} className="hover:text-cyan-400">100%</button>
                    </div>
                </div>

                {/* 4. TP / SL / Risk Row */}
                <div className="grid grid-cols-3 gap-2 shrink-0">
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Risk%</label>
                        <input
                            type="number"
                            value={risk}
                            onChange={(e) => setRisk(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-black text-white outline-none focus:border-amber-500/50 transition-all"
                            placeholder="1.0"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">TP %</label>
                        <input
                            type="text"
                            value={tp}
                            onChange={(e) => setTp(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-black text-white outline-none focus:border-emerald-500/50 transition-all"
                            placeholder="1.5,2.0"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">SL %</label>
                        <input
                            type="text"
                            value={sl}
                            onChange={(e) => setSl(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-black text-white outline-none focus:border-rose-500/50 transition-all"
                            placeholder="0.8"
                        />
                    </div>
                </div>

                {/* Message Overlay - Absolute positioned to not move fields */}
                {message && (
                    <div className={cn(
                        "absolute bottom-20 inset-x-4 p-2.5 rounded-xl border text-[9px] font-black uppercase text-center animate-in fade-in slide-in-from-bottom-2 duration-300 z-50 shadow-2xl backdrop-blur-md",
                        message.type === 'success' ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-rose-500 text-slate-950 border-rose-400"
                    )}>
                        {message.text}
                    </div>
                )}

                {/* 5. Submit Button */}
                <div className="mt-auto pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                            "w-full py-4 rounded-xl text-xs font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group/btn shadow-lg active:scale-[0.98]",
                            signal === 'buy' 
                                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:shadow-emerald-500/40" 
                                : "bg-rose-500 text-slate-950 shadow-rose-500/20 hover:shadow-rose-500/40",
                            isLoading && "opacity-50 cursor-wait grayscale"
                        )}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                        <span className="relative z-10 flex items-center justify-center gap-3">
                            {isLoading ? (
                                <>
                                    <Activity className="w-4 h-4 animate-spin" />
                                    PROCESSING
                                </>
                            ) : (
                                <>
                                    {signal === 'buy' ? 'SEND BUY SIGNAL' : 'SEND SELL SIGNAL'}
                                    <TrendingUp className={cn("w-4 h-4 transition-transform group-hover/btn:translate-x-1", signal === 'sell' && "rotate-90")} />
                                </>
                            )}
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
};
