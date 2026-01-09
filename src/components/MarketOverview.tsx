"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';

interface MarketAsset {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    volume: number;
    rank?: number;
    marketCap?: number;
}

export const MarketOverview = () => {
    const [marketData, setMarketData] = useState<MarketAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [timeframe, setTimeframe] = useState('24h');

    const fetchMarketData = async () => {
        try {
            const response = await api.get('/market/overview');
            setMarketData(response.data);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch market data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarketData();

        // Refresh every 30 seconds
        const interval = setInterval(fetchMarketData, 30000);
        return () => clearInterval(interval);
    }, []);

    const timeframes = ['1h', '24h', '7d', '30d'];

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">Market Overview</h2>
                    <button
                        onClick={fetchMarketData}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="flex space-x-2">
                    {timeframes.map((frame) => (
                        <button
                            key={frame}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${timeframe === frame
                                ? 'btn-primary'
                                : 'btn-outline'
                                }`}
                            onClick={() => setTimeframe(frame)}
                        >
                            {frame}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="table-header">Rank</th>
                            <th className="table-header">Pair</th>
                            <th className="table-header text-right">Price</th>
                            <th className="table-header text-right">24h Change</th>
                            <th className="table-header text-right">Volume (24h)</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {loading && marketData.length === 0 ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="table-row">
                                    <td colSpan={5} className="px-4 py-4">
                                        <div className="h-10 bg-muted rounded animate-pulse"></div>
                                    </td>
                                </tr>
                            ))
                        ) : error ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-destructive">
                                    Failed to load market data
                                </td>
                            </tr>
                        ) : (
                            marketData.map((asset, index) => (
                                <tr key={index} className="table-row">
                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            #{asset.rank || index + 1}
                                        </span>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <img
                                                src={`https://assets.coincap.io/assets/icons/${asset.symbol.split('/')[0].toLowerCase()}@2x.png`}
                                                alt={asset.symbol}
                                                className="w-8 h-8 rounded-full mr-3"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="bg-primary w-8 h-8 rounded-full flex items-center justify-center mr-3 hidden">
                                                <span className="text-xs font-bold text-primary-foreground">
                                                    {asset.symbol.substring(0, 2)}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium">{asset.symbol}</div>
                                                <div className="text-xs text-muted-foreground">{asset.name}</div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right font-medium">
                                        ${asset.price.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: asset.price > 1 ? 2 : 6
                                        })}
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                        <div className={`flex items-center justify-end ${asset.change24h >= 0 ? 'trend-up' : 'trend-down'}`}>
                                            {asset.change24h >= 0 ? (
                                                <TrendingUp className="h-4 w-4 mr-1" />
                                            ) : (
                                                <TrendingDown className="h-4 w-4 mr-1" />
                                            )}
                                            <span className="font-medium">
                                                {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        ${asset.volume.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                            notation: 'compact',
                                            compactDisplay: 'short'
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 text-center">
                <a
                    href="https://cryptorank.io"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    Powered by CryptoRank
                </a>
            </div>
        </div>
    );
};
