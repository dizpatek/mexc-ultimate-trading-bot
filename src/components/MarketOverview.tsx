"use client";

import React, { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Mock data for market overview - in a real app, this would come from an API
const marketData = [
    { symbol: 'BTC/USDT', price: 43256.78, change24h: 2.34, volume: 28967.45 },
    { symbol: 'ETH/USDT', price: 2345.67, change24h: 1.23, volume: 15789.34 },
    { symbol: 'BNB/USDT', price: 345.67, change24h: -0.56, volume: 12198.76 },
    { symbol: 'SOL/USDT', price: 98.76, change24h: 5.67, volume: 8765.43 },
    { symbol: 'ADA/USDT', price: 0.4567, change24h: -1.23, volume: 5432.10 },
];

export const MarketOverview = () => {
    const [timeframe, setTimeframe] = useState('24h');

    const timeframes = ['1h', '24h', '7d', '30d'];

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Market Overview</h2>
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
                            <th className="table-header">Pair</th>
                            <th className="table-header text-right">Price</th>
                            <th className="table-header text-right">24h Change</th>
                            <th className="table-header text-right">Volume</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {marketData.map((asset, index) => (
                            <tr key={index} className="table-row">
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="bg-primary w-10 h-10 rounded-full flex items-center justify-center mr-3">
                                            <span className="text-sm font-bold text-primary-foreground">{asset.symbol.substring(0, 2)}</span>
                                        </div>
                                        <div className="font-medium">{asset.symbol}</div>
                                    </div>
                                </td>

                                <td className="px-4 py-4 whitespace-nowrap text-right font-medium">
                                    ${asset.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: asset.price > 1 ? 2 : 4 })}
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

                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                    ${asset.volume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 text-center">
                <button className="text-sm text-primary hover:underline transition-colors font-medium">
                    View All Markets
                </button>
            </div>
        </div>
    );
};
