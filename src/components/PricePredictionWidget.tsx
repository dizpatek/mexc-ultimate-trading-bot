"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/services/api';
import { TrendingUp, TrendingDown, Bot, Target, RefreshCw, AlertTriangle } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';

interface Prediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
    forecastTime: number;
}

const TIMEFRAMES = [
    { label: '1S', value: '1h' },
    { label: '4S', value: '4h' },
    { label: '12S', value: '12h' },
    { label: '1G', value: '1d' },
    { label: '3G', value: '3d' },
    { label: '1H', value: '1w' },
];

export const PricePredictionWidget = () => {
    const { data: holdings, isLoading: isHoldingsLoading } = useHoldings();
    const [symbol, setSymbol] = useState('');
    const [timeframe, setTimeframe] = useState('1h');
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter real assets from holdings
    const activeAssets = useMemo(() => {
        if (!holdings) return [];
        return holdings
            .filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC')
            .map(h => h.symbol);
    }, [holdings]);

    // Set initial symbol once holdings are loaded
    useEffect(() => {
        if (!isHoldingsLoading && !symbol) {
            if (activeAssets.length > 0) {
                setSymbol(`${activeAssets[0]}USDT`);
            } else {
                setSymbol('BTCUSDT');
            }
        }
    }, [isHoldingsLoading, activeAssets, symbol]);

    const fetchPrediction = useCallback(async () => {
        if (!symbol) return;
        setLoading(true);
        setError(null);
        try {
            // Use Matrix V3 Engine for prediction
            const res = await api.get(`/indicators/f4?symbol=${symbol}&interval=${timeframe}`);
            
            if (res.data && !res.data.error) {
                const d = res.data;
                
                // Calculate Price Target based on F4 Trend Slope
                // Slope is percentage change per bar
                const rawSlope = (d.f4Slope * d.currentPrice) / 100;
                
                // Forecast distance (bars) based on timeframe
                const projectionBars = 1; 
                const predictedPrice = d.currentPrice + (rawSlope * projectionBars);
                
                // Trend
                const trend = d.f4Slope > 0 ? 'UP' : d.f4Slope < 0 ? 'DOWN' : 'FLAT';
                
                const predictionData: Prediction = {
                    symbol: d.symbol,
                    currentPrice: d.currentPrice,
                    predictedPrice: predictedPrice,
                    trend: trend,
                    confidence: d.aiScore, // Use AI Score directly
                    forecastTime: Date.now() + (projectionBars * 60 * 60 * 1000) // Approx
                };

                setPrediction(predictionData);
            } else {
                setError('Matrix V3 Verisi Alınamadı');
            }
        } catch (error: unknown) {
            console.error('Prediction error:', error instanceof Error ? error.message : String(error));
            setError('Bağlantı Hatası');
        } finally {
            setLoading(false);
        }
    }, [symbol, timeframe]);

    useEffect(() => {
        fetchPrediction();
    }, [fetchPrediction]);

    return (
        <div className="stat-card flex flex-col h-full min-h-[350px] relative overflow-hidden group p-5 gap-5">
            {/* Background Icon */}
            <div className="absolute -bottom-8 -right-8 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none">
                <Bot className="w-56 h-56" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between relative z-10 shrink-0">
                <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-slate-400">
                    <Bot className="w-4 h-4 text-primary" />
                    YZ FİYAT TAHMİNİ
                </h3>
                {(loading || isHoldingsLoading) && <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />}
            </div>

            {/* 1. Coin Selection (Scrollable Row) */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide relative z-10 shrink-0">
                {isHoldingsLoading ? (
                    // Button skeletons
                    [1, 2, 3].map(i => (
                        <div key={i} className="px-8 py-4 bg-white/5 rounded animate-pulse border border-white/5" />
                    ))
                ) : activeAssets.length > 0 ? (
                    activeAssets.map((asset) => (
                        <button
                            key={asset}
                            onClick={() => setSymbol(`${asset}USDT`)}
                            className={`
                                px-4 py-2 rounded text-xs font-bold transition-all border whitespace-nowrap
                                ${symbol === `${asset}USDT` 
                                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' 
                                    : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                                }
                            `}
                        >
                            {asset}
                        </button>
                    ))
                ) : (
                    // Default assets if NO holdings at all
                    ['BTC', 'ETH', 'SOL'].map((asset: string) => (
                        <button
                            key={asset}
                            onClick={() => setSymbol(`${asset}USDT`)}
                            className={`
                                px-4 py-2 rounded text-xs font-bold transition-all border whitespace-nowrap
                                ${symbol === `${asset}USDT` 
                                    ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' 
                                    : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10'
                                }
                            `}
                        >
                            {asset}
                        </button>
                    ))
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col relative z-10 justify-between">
                {error ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-rose-500/50 text-[10px] italic space-y-2">
                        <AlertTriangle className="w-6 h-6 opacity-50" />
                        <span>{error}</span>
                        <button onClick={fetchPrediction} className="text-primary hover:text-primary/80 underline decoration-dotted">Tekrar Dene</button>
                    </div>
                ) : loading && !prediction ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <div className="h-2 w-24 bg-white/5 rounded animate-pulse" />
                        <div className="h-10 w-32 bg-white/5 rounded animate-pulse" />
                        <div className="h-2 w-40 bg-white/5 rounded animate-pulse" />
                    </div>
                ) : prediction ? (
                    <div className="flex flex-col gap-6 h-full">
                        {/* Selected Asset Header */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-3xl font-black text-white tracking-tight">{symbol.replace('USDT','')}</h2>
                             {/* Trend Badge */}
                            <div className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-md shadow-sm
                                ${prediction.trend === 'UP'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                }
                            `}>
                                {prediction.trend === 'UP' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    {prediction.trend === 'UP' ? 'YÜKSELİŞ' : 'DÜŞÜŞ'}
                                </span>
                            </div>
                        </div>

                        {/* Split Price View */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Left: Current Price */}
                            <div className="flex flex-col p-4 rounded-2xl bg-slate-900/40 border border-white/5">
                                <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">ANLIK FİYAT</span>
                                <span className="text-3xl lg:text-4xl font-black font-mono tracking-tighter text-white">
                                    ${prediction.currentPrice.toLocaleString()}
                                </span>
                            </div>

                            {/* Right: Predicted Price */}
                            <div className={`flex flex-col p-4 rounded-2xl border ${prediction.trend === 'UP' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                                <span className={`text-[10px] font-bold uppercase mb-1 ${prediction.trend === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {TIMEFRAMES.find(t => t.value === timeframe)?.label} HEDEF
                                </span>
                                <span className={`text-3xl lg:text-4xl font-black font-mono tracking-tighter ${prediction.trend === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    ${prediction.predictedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                            </div>
                        </div>

                        {/* Confidence & Time Selector */}
                        <div className="flex items-end justify-between mt-auto pt-4 border-t border-white/5">
                            {/* Confidence */}
                            <div className="flex flex-col gap-2 w-1/3">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-500">
                                    <Target className="w-3 h-3" />
                                    <span>Model Güveni</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                prediction.confidence > 75 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' :
                                                prediction.confidence > 45 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${prediction.confidence}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-mono font-bold text-white">{prediction.confidence.toFixed(1)}%</span>
                                </div>
                            </div>

                            {/* Time Selector */}
                             <div className="grid grid-cols-6 gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-white/10">
                                {TIMEFRAMES.map((tf) => (
                                    <button
                                        key={tf.value}
                                        onClick={() => setTimeframe(tf.value)}
                                        className={`
                                            w-8 h-7 flex items-center justify-center text-[9px] font-bold rounded-lg transition-all
                                            ${timeframe === tf.value
                                                ? 'bg-white text-black shadow-lg scale-105'
                                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        {tf.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};
