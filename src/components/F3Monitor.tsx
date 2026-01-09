"use client";

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';

interface F3Signal {
    symbol: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    f3: number;
    f3Fibo: number;
    timestamp: string;
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];

export const F3Monitor = () => {
    const [signals, setSignals] = useState<Record<string, F3Signal>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedSymbols, setSelectedSymbols] = useState<string[]>(DEFAULT_SYMBOLS);

    const fetchF3Signals = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // Keep existing signals to avoid flashing
            const results: Record<string, F3Signal> = { ...signals };

            await Promise.all(
                selectedSymbols.map(async (symbol) => {
                    try {
                        const response = await api.get(`/indicators/f3?symbol=${symbol}&interval=1h`);
                        results[symbol] = response.data;
                    } catch (err) {
                        console.error(`Failed to fetch F3 for ${symbol}:`, err);
                        // We keep the old signal if fetch fails
                    }
                })
            );

            setSignals(results);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch F3 signals:', err);
            // Don't clear signals on error to prevent flashing
            setError(true);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchF3Signals(true);

        // Refresh every 60 seconds without full loading spinner
        const interval = setInterval(() => fetchF3Signals(false), 60000);
        return () => clearInterval(interval);
    }, [selectedSymbols]);

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">F3 Indicator Monitor</h2>
                        <p className="text-xs text-muted-foreground">Real-time trading signals</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchF3Signals(true)}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && Object.keys(signals).length === 0 ? (
                <div className="flex items-center justify-center py-12 text-destructive">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <span>Failed to load F3 signals</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedSymbols.map((symbol) => {
                        const signal = signals[symbol];

                        if (!signal) {
                            return (
                                <div key={symbol} className="border border-border rounded-lg p-4 animate-pulse">
                                    <div className="h-6 bg-muted rounded w-1/2 mb-3"></div>
                                    <div className="h-16 bg-muted rounded"></div>
                                </div>
                            );
                        }

                        const isPositive = signal.signal === 'BUY';
                        const isNegative = signal.signal === 'SELL';

                        return (
                            <div
                                key={symbol}
                                className={`border rounded-lg p-4 transition-all ${isPositive ? 'border-green-500/50 bg-green-500/5' :
                                        isNegative ? 'border-red-500/50 bg-red-500/5' :
                                            'border-border'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold">{symbol.replace('USDT', '/USDT')}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(signal.timestamp).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    {signal.signal !== 'NEUTRAL' && (
                                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isPositive ? 'bg-green-500/20 text-green-600' :
                                                'bg-red-500/20 text-red-600'
                                            }`}>
                                            {isPositive ? (
                                                <><TrendingUp className="w-3 h-3" /> BUY</>
                                            ) : (
                                                <><TrendingDown className="w-3 h-3" /> SELL</>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">F3:</span>
                                        <span className="font-mono">{signal.f3.toFixed(4)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">F3 Fibo:</span>
                                        <span className="font-mono">{signal.f3Fibo.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
