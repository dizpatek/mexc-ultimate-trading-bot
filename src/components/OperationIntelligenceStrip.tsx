"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Bot, TrendingUp, TrendingDown, Send, 
    Activity, Radar
} from 'lucide-react';
import { api, sendTradeSignal } from '@/services/api';
import type { TradeSignal } from '@/services/api';
import { useHoldings } from '@/hooks/usePortfolio';
import { cn } from '@/lib/utils';

interface Prediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
}

const TIMEFRAMES = [
    { label: '1S', value: '1h' },
    { label: '4S', value: '4h' },
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
];

interface OperationIntelligenceStripProps {
    activeSymbol: string;
    onSymbolSelect: (symbol: string) => void;
    onAssetDataUpdate: (data: { holding: number; usdt: number }) => void;
}

export const OperationIntelligenceStrip = ({ 
    activeSymbol, 
    onSymbolSelect, 
    onAssetDataUpdate 
}: OperationIntelligenceStripProps) => {
    const { data: holdings } = useHoldings();
    
    // AI Prediction State
    const [timeframe, setTimeframe] = useState('1h');
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    
    // Trade Form State
    const [signal, setSignal] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState('');
    const [usdt] = useState('');
    const [risk] = useState('1.0');
    const [tp, setTp] = useState('1.5, 2.0');
    const [sl, setSl] = useState('0.8');
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const assetBase = useMemo(() => activeSymbol.replace('USDT', ''), [activeSymbol]);

    // Filter real assets for selection
    const activeAssets = useMemo(() => {
        if (!holdings) return ['BTC', 'ETH', 'SOL'];
        const assets = holdings
            .filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC' && h.holding > 0)
            .map(h => h.symbol);
        return assets.length > 0 ? assets : ['BTC', 'ETH', 'SOL'];
    }, [holdings]);

    // Sync asset data to parent
    useEffect(() => {
        if (holdings) {
            const asset = holdings.find(h => h.symbol === assetBase);
            const usdtAccount = holdings.find(h => h.symbol === 'USDT' || h.symbol === 'USDC');
            onAssetDataUpdate({
                holding: asset?.holding || 0,
                usdt: usdtAccount?.holding || 0
            });
        }
    }, [holdings, assetBase, onAssetDataUpdate]);

    // Fetch AI Prediction
    const fetchPrediction = useCallback(async () => {
        // AI Fetch logic
        try {
            const res = await api.get(`/indicators/f4?symbol=${activeSymbol}&interval=${timeframe}`);
            if (res.data && !res.data.error) {
                const d = res.data;
                const rawSlope = (d.f4Slope * d.currentPrice) / 100;
                setPrediction({
                    symbol: d.symbol,
                    currentPrice: d.currentPrice,
                    predictedPrice: d.currentPrice + rawSlope,
                    trend: d.f4Slope > 0 ? 'UP' : d.f4Slope < 0 ? 'DOWN' : 'FLAT',
                    confidence: d.aiScore
                });
            }
        } catch (err) {
            console.error('AI Fetch error:', err);
        }
    }, [activeSymbol, timeframe]);

    useEffect(() => {
        fetchPrediction();
    }, [fetchPrediction]);

    // Handle Trade Submission
    const handleTradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsTradeLoading(true);
        setMessage(null);
        try {
            const pair = activeSymbol.includes('_') ? activeSymbol : activeSymbol.replace('USDT', '_USDT');
            const tradeSignal: TradeSignal = {
                signal,
                pair,
                secret: 'replace_with_strong_secret',
                amount: amount ? parseFloat(amount) : undefined,
                usdt: usdt ? parseFloat(usdt) : undefined,
                risk: risk ? parseFloat(risk) : undefined,
                tp: tp ? tp.split(',').map(s => parseFloat(s.trim())) : undefined,
                sl: sl ? sl.split(',').map(s => parseFloat(s.trim())) : undefined,
            };
            const response = await sendTradeSignal(tradeSignal);
            if (response?.success || response?.ok) {
                setMessage({ type: 'success', text: 'SIGNAL SENT' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'SEND FAILED' });
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'ERROR';
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsTradeLoading(false);
        }
    };

    return (
        <div className="w-full bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-800/50">
                
                {/* SECTION 1: AI PREDICTION (Left) */}
                <div className="lg:w-[40%] p-4 flex flex-col gap-3 relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                        <Radar className="w-24 h-24 text-cyan-500" />
                    </div>
                    
                    <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                            <Bot className="w-4 h-4 text-cyan-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/70">AI Intelligence Core</span>
                        </div>
                        <div className="flex gap-1 bg-slate-950/50 p-0.5 rounded-lg border border-white/5">
                            {TIMEFRAMES.map(tf => (
                                <button 
                                    key={tf.value}
                                    onClick={() => setTimeframe(tf.value)}
                                    className={cn(
                                        "px-2 py-1 text-[9px] font-black rounded transition-all",
                                        timeframe === tf.value ? "bg-white text-black" : "text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    {tf.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-end gap-6 z-10">
                        <div className="flex flex-col">
                            <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                                {assetBase}
                                {prediction && (
                                    prediction.trend === 'UP' ? 
                                    <TrendingUp className="w-5 h-5 text-emerald-500" /> : 
                                    <TrendingDown className="w-5 h-5 text-rose-500" />
                                )}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Spot Price</span>
                                <span className="text-xs font-mono font-black text-slate-300">${prediction?.currentPrice.toLocaleString() || '---'}</span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-end h-full">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Target Projection</span>
                                <span className={cn("text-xs font-mono font-black", prediction?.trend === 'UP' ? "text-emerald-400" : "text-rose-400")}>
                                    ${prediction?.predictedPrice.toLocaleString('en-US', {maximumFractionDigits: 2}) || '---'}
                                </span>
                            </div>
                            <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden flex border border-white/5">
                                <div 
                                    className={cn("h-full transition-all duration-1000", prediction?.confidence && prediction.confidence > 50 ? "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" : "bg-amber-500")}
                                    style={{ width: `${prediction?.confidence || 0}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[8px] font-bold text-slate-600 uppercase">Confidence</span>
                                <span className="text-[8px] font-mono font-black text-slate-400">{prediction?.confidence.toFixed(1) || 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: OPERATION CENTER (Right) */}
                <div className="lg:w-[60%] p-4 flex flex-col gap-3 relative">
                    <form onSubmit={handleTradeSubmit} className="flex flex-col h-full justify-between gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Tactical Execution Strip</span>
                            </div>
                            <div className="flex gap-2">
                                {activeAssets.slice(0, 5).map(asset => (
                                    <button
                                        key={asset}
                                        type="button"
                                        onClick={() => onSymbolSelect(`${asset}USDT`)}
                                        className={cn(
                                            "px-2 py-1 text-[9px] font-black rounded border transition-all",
                                            assetBase === asset ? "bg-cyan-500/20 border-cyan-500 text-cyan-400" : "bg-slate-900 border-white/5 text-slate-500"
                                        )}
                                    >
                                        {asset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-3 items-end">
                            {/* Buy/Sell Toggle */}
                            <div className="col-span-2 flex bg-slate-950 p-1 rounded-xl border border-white/5 h-10">
                                <button 
                                    type="button"
                                    onClick={() => setSignal('buy')}
                                    className={cn("flex-1 rounded-lg text-[9px] font-black uppercase transition-all", signal === 'buy' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "text-slate-600")}
                                >Buy</button>
                                <button 
                                    type="button"
                                    onClick={() => setSignal('sell')}
                                    className={cn("flex-1 rounded-lg text-[9px] font-black uppercase transition-all", signal === 'sell' ? "bg-rose-500 text-black shadow-lg shadow-rose-500/20" : "text-slate-600")}
                                >Sell</button>
                            </div>

                            {/* Amount Input */}
                            <div className="col-span-2 relative group-input">
                                <label className="absolute -top-4 left-1 text-[8px] font-black text-slate-600 uppercase">Amount</label>
                                <input 
                                    type="text" value={amount} onChange={e => setAmount(e.target.value)}
                                    className="w-full h-10 bg-slate-950 border border-white/5 rounded-xl px-3 text-xs font-black text-white outline-none focus:border-cyan-500/50 transition-all font-mono"
                                    placeholder="0.0"
                                />
                            </div>

                            {/* TP/SL Inputs */}
                            <div className="col-span-3 grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <label className="absolute -top-4 left-1 text-[8px] font-black text-emerald-500/50 uppercase tracking-tighter">Take Profit %</label>
                                    <input 
                                        type="text" value={tp} onChange={e => setTp(e.target.value)}
                                        className="w-full h-10 bg-slate-950 border border-emerald-500/10 rounded-xl px-2 text-[10px] font-black text-emerald-400 outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    />
                                </div>
                                <div className="relative">
                                    <label className="absolute -top-4 left-1 text-[8px] font-black text-rose-500/50 uppercase tracking-tighter">Stop Loss %</label>
                                    <input 
                                        type="text" value={sl} onChange={e => setSl(e.target.value)}
                                        className="w-full h-10 bg-slate-950 border border-rose-500/10 rounded-xl px-2 text-[10px] font-black text-rose-400 outline-none focus:border-rose-500/50 transition-all font-mono"
                                    />
                                </div>
                            </div>

                            {/* Send Signal Button */}
                            <div className="col-span-5 relative">
                                {message && (
                                    <div className={cn(
                                        "absolute -top-12 inset-x-0 p-2 rounded-lg border text-[9px] font-black uppercase text-center animate-in fade-in slide-in-from-bottom-2",
                                        message.type === 'success' ? "bg-emerald-500 text-black border-emerald-400" : "bg-rose-500 text-black border-rose-400"
                                    )}>
                                        {message.text}
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={isTradeLoading}
                                    className={cn(
                                        "w-full h-10 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                                        signal === 'buy' ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20" : "bg-rose-500 text-black shadow-lg shadow-rose-500/20",
                                        isTradeLoading && "opacity-50 cursor-wait"
                                    )}
                                >
                                    {isTradeLoading ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    EXECUTE {signal} SIGNAL
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
