"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Bot, Send, 
    Activity, Wallet,
    BarChart3,
    Newspaper
} from 'lucide-react';
import { api, sendTradeSignal } from '@/services/api';
import { useHoldings, usePortfolioSummary } from '@/hooks/usePortfolio';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment-analyzer';
import { cn } from '@/lib/utils';
import axios from 'axios';

interface Prediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
}

interface UnifiedControlStripProps {
    activeSymbol: string;
    onSymbolSelect: (symbol: string) => void;
    onAssetDataUpdate: (data: { holding: number; usdt: number }) => void;
    symbols?: { proName: string; title: string }[];
}

const TickerTape = ({ symbols }: { symbols: { proName: string; title: string }[] }) => {
    const config = useMemo(() => ({
        symbols: symbols.length > 0 ? symbols : [
            { proName: "BINANCE:BTCUSDT", title: "BTC/USDT" },
            { proName: "BINANCE:ETHUSDT", title: "ETH/USDT" }
        ],
        showSymbolLogo: true,
        colorTheme: "dark",
        isTransparent: true,
        displayMode: "regular",
        locale: "en"
    }), [symbols]);

    const encodedConfig = encodeURIComponent(JSON.stringify(config));

    return (
        <div className="w-full h-[26px] border-b border-white/5 bg-black/20 overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <iframe
                    src={`https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#${encodedConfig}`}
                    style={{ 
                        width: '100%', 
                        height: '44px', // Target standard TV height
                        border: 'none',
                        transform: 'scale(0.6)', // Scale down to fit ~26px
                        transformOrigin: 'center',
                        pointerEvents: 'auto'
                    }}
                    title="Ticker Tape"
                />
            </div>
        </div>
    );
};

export const UnifiedControlStrip = ({ 
    activeSymbol, 
    onSymbolSelect, 
    onAssetDataUpdate,
    symbols = []
}: UnifiedControlStripProps) => {
    // ... rest of state stays the same ...
    const { data: holdings } = useHoldings();
    const { data: summaryData } = usePortfolioSummary();
    const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [timeframe, setTimeframe] = useState('1h');
    const [signal, setSignal] = useState<'buy' | 'sell'>('buy');
    const [amount, setAmount] = useState('');
    const [risk, setRisk] = useState('1.0');
    const [tp, setTp] = useState('1.5, 2.0');
    const [sl, setSl] = useState('0.8');
    const [isTradeLoading, setIsTradeLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    const assetBase = useMemo(() => activeSymbol.replace('USDT', ''), [activeSymbol]);

    // FETCH LOGIC... (skipping for brevity in search but keeping in replacement)
    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
                const news = res.data.Data || [];
                setSentiment(analyzeSentiment(news.map((item: { title: string }) => item.title)));
            } catch { /* News fetch failure - silent */ }
        };
        fetchSentiment();
    }, []);

    const fetchPrediction = useCallback(async () => {
        try {
            const res = await api.get(`/indicators/f4?symbol=${activeSymbol}&interval=${timeframe}`);
            if (res.data && !res.data.error) {
                const d = res.data;
                setPrediction({
                    symbol: d.symbol, currentPrice: d.currentPrice,
                    predictedPrice: d.currentPrice + ((d.f4Slope * d.currentPrice) / 100),
                    trend: d.f4Slope > 0 ? 'UP' : d.f4Slope < 0 ? 'DOWN' : 'FLAT',
                    confidence: d.aiScore
                });
            }
        } catch { /* Prediction fetch failure - silent */ }
    }, [activeSymbol, timeframe]);

    useEffect(() => { fetchPrediction(); }, [fetchPrediction]);

    useEffect(() => {
        if (holdings) {
            const asset = holdings.find(h => h.symbol === assetBase);
            const usdtAccount = holdings.find(h => h.symbol === 'USDT' || h.symbol === 'USDC');
            onAssetDataUpdate({ holding: asset?.holding || 0, usdt: usdtAccount?.holding || 0 });
        }
    }, [holdings, assetBase, onAssetDataUpdate]);

    const handleTradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsTradeLoading(true);
        setMessage(null);
        try {
            const pair = activeSymbol.includes('_') ? activeSymbol : activeSymbol.replace('USDT', '_USDT');
            const response = await sendTradeSignal({
                signal, pair, secret: 'replace_with_strong_secret',
                amount: amount ? parseFloat(amount) : undefined,
                risk: risk ? parseFloat(risk) : undefined,
                tp: tp ? tp.split(',').map(s => parseFloat(s.trim())) : undefined,
                sl: sl ? sl.split(',').map(s => parseFloat(s.trim())) : undefined,
            });
            if (response?.success || response?.ok) { setMessage({ type: 'success', text: 'EXECUTED' }); setTimeout(() => setMessage(null), 3000); }
            else setMessage({ type: 'error', text: 'FAILED' });
        } catch { setMessage({ type: 'error', text: 'ERR' }); }
        finally { setIsTradeLoading(false); }
    };

    const rotation = sentiment ? (sentiment.score / 100) * 90 : 0;

    return (
        <aside className="sticky top-0 h-screen w-64 bg-slate-900/40 backdrop-blur-2xl border-l border-white/5 flex flex-col shadow-2xl relative z-40">
            {/* 1. TICKER TAPE INTEGRATION */}
            <TickerTape symbols={symbols} />

            <div className="flex-1 overflow-y-auto no-scrollbar py-4 flex flex-col gap-6 divide-y divide-white/5">
                
                {/* 1. PORTFOLIO SUMMARY */}
                <div className="px-5 flex flex-col gap-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-500 mb-0.5">
                            <Wallet className="w-3 h-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest whitespace-nowrap">NET VARLIK</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-white font-mono tracking-tighter">
                                ${summaryData?.totalValue.toLocaleString() || '---'}
                            </span>
                            <span className={cn("text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-black/40", (summaryData?.change24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                                {(summaryData?.changePercentage || 0) >= 0 ? '+' : ''}{summaryData?.changePercentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                        <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-3 h-3 text-cyan-500" />
                                <span className="text-[8px] text-slate-500 uppercase font-black">VARLIK</span>
                            </div>
                            <span className="text-xs font-black text-slate-300">{summaryData?.assets || 0}</span>
                        </div>
                    </div>
                </div>

                {/* 2. SENTIMENT & AI SCORE */}
                <div className="px-5 pt-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-0.5">
                                <Newspaper className="w-3 h-3 text-amber-500" />
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">YZ DUYARLI</span>
                            </div>
                            <span className={cn("text-sm font-black uppercase tracking-tight", (sentiment?.score || 0) >= 20 ? "text-emerald-400" : (sentiment?.score || 0) <= -20 ? "text-rose-400" : "text-amber-400")}>
                                {sentiment?.label || 'BELİRSİZ'}
                            </span>
                        </div>
                        <div className="relative w-12 h-6 overflow-hidden shrink-0">
                            <div className="absolute top-0 left-0 w-full h-full bg-slate-800/50 rounded-t-full" />
                            <div className={cn("absolute top-0 left-0 w-full h-full rounded-t-full origin-bottom transition-all duration-1000", (sentiment?.score || 0) > 0 ? "bg-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]")}
                                style={{ transform: `rotate(${rotation}deg)` }} />
                            <div className="absolute bottom-0 left-1/2 w-[1.5px] h-6 bg-white origin-bottom -translate-x-1/2 shadow-lg" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }} />
                        </div>
                    </div>

                    {/* AI Prediction Block */}
                    <div className="bg-black/40 rounded-xl border border-white/10 p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <Bot className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-black text-white tracking-widest uppercase">{assetBase}</span>
                            </div>
                        </div>
                        
                        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 w-full">
                            {['15m', '1h', '4h', '1d'].map(tf => (
                                <button key={tf} onClick={() => setTimeframe(tf)}
                                    className={cn("flex-1 py-1 text-[8px] font-black rounded uppercase transition-all", timeframe === tf ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-slate-300")}>
                                    {tf}
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-between items-end border-b border-white/5 pb-1.5">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">ANLIK</span>
                                <span className="text-[10px] font-mono font-bold text-slate-400">${prediction?.currentPrice.toLocaleString() || '---'}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[7px] font-black text-slate-400/60 uppercase tracking-widest">HEDEF</span>
                                <span className={cn("text-sm font-mono font-black filter drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]", prediction?.trend === 'UP' ? "text-emerald-400" : "text-rose-400")}>
                                    ${prediction?.predictedPrice.toLocaleString('en-US', {maximumFractionDigits: 1}) || '---'}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[7px] font-black tracking-widest">
                                <span className="text-slate-500 uppercase">GÜVEN</span>
                                <span className="text-cyan-400 font-mono">{prediction?.confidence || 0}%</span>
                            </div>
                            <div className="relative h-1.5 bg-slate-950 rounded-full border border-white/10 overflow-hidden shadow-inner">
                                <div className={cn("h-full transition-all duration-1000", (prediction?.confidence || 0) > 75 ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : (prediction?.confidence || 0) > 45 ? "bg-gradient-to-r from-cyan-600 to-cyan-400" : "bg-gradient-to-r from-rose-600 to-rose-400")}
                                    style={{ width: `${prediction?.confidence || 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. EXECUTION PANEL */}
                <div className="px-5 pt-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2.5">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">HIZLI SEÇİM</span>
                        <div className="flex flex-wrap gap-1.5">
                            {['BTC', 'ETH', 'SOL', 'KAS'].map(asset => (
                                <button key={asset} type="button" onClick={() => onSymbolSelect(`${asset}USDT`)}
                                    className={cn("flex-1 min-w-[50px] py-1.5 text-[9px] font-black rounded-lg border transition-all uppercase tracking-tight", 
                                        assetBase === asset ? "bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,185,129,0.2)]" : "bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/20 hover:text-slate-300")}>
                                    {asset}
                                </button>
                            ))}
                        </div>
                    </div>

                    <form onSubmit={handleTradeSubmit} className="flex flex-col gap-4">
                        <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 h-10 w-full">
                            <button type="button" onClick={() => setSignal('buy')} className={cn("flex-1 rounded-lg text-[10px] font-black uppercase transition-all", signal === 'buy' ? "bg-emerald-500 text-black shadow-lg" : "text-slate-600 hover:text-slate-400")}>AL</button>
                            <button type="button" onClick={() => setSignal('sell')} className={cn("flex-1 rounded-lg text-[10px] font-black uppercase transition-all", signal === 'sell' ? "bg-rose-500 text-black shadow-lg" : "text-slate-600 hover:text-slate-400")}>SAT</button>
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <span className="absolute -top-1.5 left-3 px-1.5 bg-slate-900 text-[7px] font-black text-slate-500 uppercase tracking-widest z-10">MİKTAR</span>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} 
                                    className="w-full h-11 bg-slate-950 border border-white/10 rounded-xl px-4 text-sm font-black text-white outline-none placeholder:text-slate-800 shadow-inner" 
                                    placeholder="0.00" />
                                <button type="button" onClick={() => {
                                    const holds = holdings?.find(h => h.symbol === (signal === 'buy' ? 'USDT' : assetBase))?.holding || 0;
                                    setAmount(holds.toString());
                                }} className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500 hover:text-black transition-all uppercase">MAX</button>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="relative">
                                    <span className="absolute -top-1.5 left-2 px-1 bg-slate-900 text-[6px] font-black text-amber-500/60 uppercase z-10">RISK%</span>
                                    <input type="number" value={risk} onChange={e => setRisk(e.target.value)} 
                                        className="w-full h-10 bg-slate-950 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-400 px-2 outline-none text-center shadow-inner" />
                                </div>
                                <div className="relative">
                                    <span className="absolute -top-1.5 left-2 px-1 bg-slate-900 text-[6px] font-black text-emerald-500/60 uppercase z-10">TP%</span>
                                    <input type="text" value={tp} onChange={e => setTp(e.target.value)} className="w-full h-10 bg-slate-950 border border-emerald-500/20 rounded-xl px-2 text-[10px] font-black text-emerald-400 outline-none text-center" />
                                </div>
                                <div className="relative">
                                    <span className="absolute -top-1.5 left-2 px-1 bg-slate-900 text-[6px] font-black text-rose-500/60 uppercase z-10">SL%</span>
                                    <input type="text" value={sl} onChange={e => setSl(e.target.value)} className="w-full h-10 bg-slate-950 border border-rose-500/20 rounded-xl px-2 text-[10px] font-black text-rose-400 outline-none text-center" />
                                </div>
                            </div>
                        </div>

                        <div className="relative group pt-2">
                            {message && <div className={cn("absolute -top-4 left-0 right-0 py-1.5 rounded-lg bg-slate-950 border text-[8px] font-black uppercase text-center shadow-2xl z-20 transition-all animate-in fade-in zoom-in slide-in-from-bottom-2", message.type === 'success' ? "border-emerald-500 text-emerald-400" : "border-rose-500 text-rose-400")}>{message.text === 'EXECUTED' ? 'BAŞARILI' : message.text === 'FAILED' ? 'HATA' : message.text}</div>}
                            <button type="submit" disabled={isTradeLoading} className={cn("w-full h-12 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-95 group/btn", signal === 'buy' ? "bg-emerald-500 text-black shadow-emerald-500/30 hover:bg-emerald-400" : "bg-rose-500 text-black shadow-rose-500/30 hover:bg-rose-400", isTradeLoading && "opacity-50 grayscale cursor-not-allowed")}>
                                {isTradeLoading ? <Activity className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />}
                                {signal === 'buy' ? 'ALIM' : 'SATIM'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </aside>
    );
};
