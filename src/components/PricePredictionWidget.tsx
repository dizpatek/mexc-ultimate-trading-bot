"use client";

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { TrendingUp, TrendingDown, Minus, Bot, Target } from 'lucide-react';
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
    const { data: holdings } = useHoldings();

    useEffect(() => {
        const fetchPrediction = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/indicators/prediction?symbol=${symbol}`);
                setPrediction(res.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrediction();
    }, [symbol]);

    return (
        <div className="stat-card flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    AI Price Forecast
                </h3>
                <select
                    className="bg-muted text-xs p-1 rounded border border-border"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                >
                    <option value="BTCUSDT">BTC</option>
                    <option value="ETHUSDT">ETH</option>
                    <option value="SOLUSDT">SOL</option>
                    <option value="BNBUSDT">BNB</option>
                    {holdings?.map(h => (
                        <option key={h.symbol} value={`${h.symbol}USDT`}>{h.symbol}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse">
                    Running Model...
                </div>
            ) : prediction ? (
                <div className="flex-1 flex flex-col justify-between">
                    <div>
                        <div className="text-sm text-muted-foreground mb-1">Target (1h)</div>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-bold font-mono">
                                ${prediction.predictedPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded mb-1 ${prediction.trend === 'UP' ? 'bg-green-500/10 text-green-500' :
                                    prediction.trend === 'DOWN' ? 'bg-red-500/10 text-red-500' :
                                        'bg-gray-500/10 text-gray-500'
                                }`}>
                                {prediction.trend === 'UP' ? 'BULLISH' : prediction.trend === 'DOWN' ? 'BEARISH' : 'NEUTRAL'}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Current: ${prediction.currentPrice.toLocaleString()}
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Confidence</span>
                            <span>{prediction.confidence.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                                className={`h-1.5 rounded-full transition-all duration-1000 ${prediction.confidence > 70 ? 'bg-green-500' :
                                        prediction.confidence > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                style={{ width: `${prediction.confidence}%` }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    No data available
                </div>
            )}
        </div>
    );
};
