"use client";

import React, { useState } from 'react';
import { Send, TrendingUp, TrendingDown, Target, DollarSign, Activity } from 'lucide-react';
import { sendTradeSignal } from '../services/api';
import type { TradeSignal } from '../services/api';
import { cn } from '@/lib/utils';

interface TradeFormProps {
    selectedSymbol?: string;
}

export const TradeForm = ({ selectedSymbol }: TradeFormProps) => {
    const [signal, setSignal] = useState<'buy' | 'sell'>('buy');
    const [pair, setPair] = useState('BTC_USDT');

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
                setMessage({ type: 'success', text: `Sinyal başarıyla gönderildi` });
                setAmount('');
                setUsdt('');
                setRisk('');
                setTp('');
                setSl('');
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Sinyal gönderimi başarısız' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: `Hata: ${(error as Error).message}` });
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
                            Send Trade Signal
                        </h3>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">Operation Center</p>
                    </div>
                </div>
                
                {isLoading && <Activity className="w-3.5 h-3.5 animate-spin text-cyan-500" />}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3 relative z-10">
                {/* 1. Signal Type Toggle */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/50 border border-white/5 rounded-xl shrink-0">
                    <button
                        type="button"
                        onClick={() => setSignal('buy')}
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
                        onClick={() => setSignal('sell')}
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
                            <Activity className="w-2.5 h-2.5 text-slate-700" />
                        </div>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700"
                            placeholder="0.00"
                            step="any"
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">USDT</label>
                            <DollarSign className="w-2.5 h-2.5 text-slate-700" />
                        </div>
                        <input
                            type="number"
                            value={usdt}
                            onChange={(e) => setUsdt(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-700"
                            placeholder="0.00"
                            step="any"
                        />
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
                        "absolute top-0 inset-x-0 p-2 rounded-lg border text-[9px] font-black uppercase text-center animate-in fade-in slide-in-from-top-2 duration-300",
                        message.type === 'success' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/30 text-rose-400"
                    )}>
                        {message.text}
                    </div>
                )}

                {/* 5. Submit Button */}
                <div className="mt-auto">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                            "w-full py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn",
                            signal === 'buy' 
                                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20" 
                                : "bg-rose-500 text-slate-950 shadow-rose-500/20",
                            isLoading && "opacity-50 cursor-wait"
                        )}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            {isLoading ? "Sending..." : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    Send Signal
                                </>
                            )}
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
};
