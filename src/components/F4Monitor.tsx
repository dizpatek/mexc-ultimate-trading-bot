"use client";

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertCircle, Zap, Target } from 'lucide-react';

interface F4Data {
    symbol: string;
    interval: string;
    timestamp: number;
    currentPrice: number;
    f4: number;
    f4Fibo: number;
    f4Signal: 'BUY' | 'SELL' | 'NEUTRAL';
    smcStructure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    wt1: number;
    wt2: number;
    wtStatus: string;
    confluenceScore: number;
    actionRecommendation: 'LONG' | 'SHORT' | 'WAIT';
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

export function F4Monitor() {
    const [signals, setSignals] = useState<Record<string, F4Data>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedInterval, setSelectedInterval] = useState('1h');

    const fetchF4Signals = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        setError(null);

        try {
            const results: Record<string, F4Data> = {};

            for (const symbol of DEFAULT_SYMBOLS) {
                const response = await fetch(`/api/indicators/f4?symbol=${symbol}&interval=${selectedInterval}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch F4 for ${symbol}`);
                }

                const data = await response.json();
                results[symbol] = data;
            }

            setSignals(results);
        } catch (err: any) {
            console.error('Error fetching F4 signals:', err);
            setError(err.message || 'Failed to load F4 signals');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchF4Signals();

        // Auto-refresh every 60 seconds
        const interval = setInterval(() => fetchF4Signals(false), 60000);
        return () => clearInterval(interval);
    }, [selectedInterval]);

    const getSignalColor = (signal: string) => {
        if (signal === 'BUY') return 'text-green-500';
        if (signal === 'SELL') return 'text-red-500';
        return 'text-gray-500';
    };

    const getActionColor = (action: string) => {
        if (action === 'LONG') return 'bg-green-500/20 text-green-400 border-green-500/50';
        if (action === 'SHORT') return 'bg-red-500/20 text-red-400 border-red-500/50';
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    };

    const getConfluenceColor = (score: number) => {
        if (score >= 70) return 'text-green-500';
        if (score >= 40) return 'text-yellow-500';
        return 'text-red-500';
    };

    if (loading && Object.keys(signals).length === 0) {
        return (
            <div className="portfolio-container p-6">
                <div className="flex items-center justify-center h-64">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (error && Object.keys(signals).length === 0) {
        return (
            <div className="portfolio-container p-6">
                <div className="flex items-center justify-center h-64 text-red-500">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        F4 Smart Money Indicator
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Advanced technical analysis with SMC + WaveTrend confluence
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        value={selectedInterval}
                        onChange={(e) => setSelectedInterval(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-secondary/30 border border-border rounded-md"
                    >
                        <option value="15m">15m</option>
                        <option value="1h">1h</option>
                        <option value="4h">4h</option>
                        <option value="1d">1d</option>
                    </select>
                    <button
                        onClick={() => fetchF4Signals()}
                        disabled={loading}
                        className="p-2 hover:bg-secondary/50 rounded-md transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {DEFAULT_SYMBOLS.map((symbol) => {
                    const signal = signals[symbol];

                    if (!signal) {
                        return (
                            <div key={symbol} className="bg-secondary/30 rounded-lg p-4">
                                <div className="animate-pulse">
                                    <div className="h-4 bg-secondary rounded w-3/4 mb-2"></div>
                                    <div className="h-8 bg-secondary rounded w-1/2"></div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={symbol} className="bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/50 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-sm font-semibold">{symbol.replace('USDT', '/USDT')}</h3>
                                    <p className="text-xs text-muted-foreground">
                                        ${signal.currentPrice.toFixed(2)}
                                    </p>
                                </div>
                                <div className={`text-xs font-medium ${getSignalColor(signal.f4Signal)}`}>
                                    {signal.f4Signal}
                                </div>
                            </div>

                            <div className="space-y-2 mb-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">SMC:</span>
                                    <span className={signal.smcStructure === 'BULLISH' ? 'text-green-500' : signal.smcStructure === 'BEARISH' ? 'text-red-500' : 'text-gray-500'}>
                                        {signal.smcStructure}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Wave:</span>
                                    <span>{signal.wtStatus.replace('_', ' ')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Confluence:</span>
                                    <span className={`font-medium ${getConfluenceColor(signal.confluenceScore)}`}>
                                        {signal.confluenceScore}%
                                    </span>
                                </div>
                            </div>

                            <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-medium ${getActionColor(signal.actionRecommendation)}`}>
                                {signal.actionRecommendation === 'LONG' && <TrendingUp className="h-4 w-4" />}
                                {signal.actionRecommendation === 'SHORT' && <TrendingDown className="h-4 w-4" />}
                                {signal.actionRecommendation === 'WAIT' && <Target className="h-4 w-4" />}
                                <span>{signal.actionRecommendation}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 p-3 bg-secondary/20 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                    <strong>F4 Indicator:</strong> Advanced multi-timeframe analysis combining Smart Money Concepts (SMC) structure,
                    WaveTrend momentum, and Fibonacci-based trend confirmation for high-probability trade setups.
                </p>
            </div>
        </div>
    );
}
