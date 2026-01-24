"use client";

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { TrendingUp, TrendingDown, Minus, Bot, Target, RefreshCw } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';

interface Prediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
    forecastTime: number;
}

export const PricePredictionWidget = () => {
    const [symbol, setSymbol] = useState('BTCUSDT');
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { data: holdings } = useHoldings();

    const fetchPrediction = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/indicators/prediction?symbol=${symbol}`);
            if (res.data && res.data.predictedPrice) {
                setPrediction(res.data);
            } else {
                setError('No forecast available');
            }
        } catch (error: any) {
            console.error('Prediction error:', error);
            setError('Model sync failed');
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchPrediction();
    }, [fetchPrediction]);

    return (
        <div className="stat-card flex flex-col min-h-[250px] relative overflow-hidden group">
            {/* Background Icon */}
            <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Bot className="w-32 h-32" />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <Bot className="w-4 h-4 text-primary" />
                    AI Price Forecast
                </h3>
                <div className="flex items-center gap-2">
                    {loading && <RefreshCw className="w-3 h-3 animate-spin text-primary" />}
                    <select
                        className="bg-white/5 text-[10px] font-bold p-1 rounded border border-white/10 outline-none focus:border-primary/50 transition-colors"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        disabled={loading}
                    >
                        <option value="BTCUSDT">BTC</option>
                        <option value="ETHUSDT">ETH</option>
                        <option value="SOLUSDT">SOL</option>
                        <option value="BNBUSDT">BNB</option>
                        {holdings?.filter(h => h.symbol !== 'USDT').map(h => (
                            <option key={h.symbol} value={`${h.symbol}USDT`}>{h.symbol}</option>
                        ))}
                    </select>
                </div>
            </div>

            {error ? (
                <div className="flex-1 flex flex-col items-center justify-center text-red-500/50 text-xs italic space-y-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{error}</span>
                    <button onClick={fetchPrediction} className="text-primary underline">Retry</button>
                </div>
            ) : loading && !prediction ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                    <div className="h-2 w-24 bg-white/5 rounded animate-pulse" />
                    <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
                    <div className="h-2 w-32 bg-white/5 rounded animate-pulse" />
                </div>
            ) : prediction ? (
                <div className="flex-1 flex flex-col justify-between relative z-10">
                    <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                            Current Price vs 1h Target
                        </div>
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-3xl font-bold font-mono tracking-tighter">
                                    ${prediction.predictedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                                    SPOT: ${prediction.currentPrice.toLocaleString()}
                                </div>
                            </div>
                            <div className={`flex flex-col items-center p-2 rounded-xl border ${prediction.trend === 'UP'
                                    ? 'bg-green-500/10 border-green-500/20 text-green-500'
                                    : 'bg-red-500/10 border-red-500/20 text-red-500'
                                }`}>
                                {prediction.trend === 'UP' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                <span className="text-[10px] font-bold mt-1 uppercase">{prediction.trend}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex justify-between text-[10px] font-bold mb-1 uppercase text-muted-foreground">
                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Model Confidence</span>
                            <span>{prediction.confidence.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1 relative overflow-hidden">
                            <div
                                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${prediction.confidence > 70 ? 'bg-green-500' :
                                        prediction.confidence > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${prediction.confidence}%` }}
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

// Supporting Icons
import { AlertTriangle } from 'lucide-react';
