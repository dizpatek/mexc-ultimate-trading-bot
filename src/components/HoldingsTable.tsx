"use client";

import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';

export const HoldingsTable = () => {
    const { data: holdings, isLoading, isError } = useHoldings();

    const mockHoldings = [
        { id: 1, symbol: 'BTC', name: 'Bitcoin', price: 92500.00, change24h: 2.15, holding: 0.4865, value: 45000.00, allocation: 36.0 },
        { id: 2, symbol: 'ETH', name: 'Ethereum', price: 3250.00, change24h: -1.24, holding: 12.5, value: 40625.00, allocation: 32.5 },
        { id: 3, symbol: 'SOL', name: 'Solana', price: 185.00, change24h: 5.67, holding: 150, value: 27750.00, allocation: 22.2 },
        { id: 4, symbol: 'BNB', name: 'BNB', price: 680.00, change24h: 1.45, holding: 18, value: 12240.00, allocation: 9.8 },
        { id: 5, symbol: 'ADA', name: 'Cardano', price: 0.85, change24h: -2.31, holding: 500, value: 425.00, allocation: 0.3 },
    ];

    const displayHoldings = holdings || mockHoldings;
    const loading = isLoading;

    return (
        <div className="portfolio-container">
            <div className="table-header">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Your Holdings</h2>
                    {loading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                            Live
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="table-header">Asset</th>
                            <th className="table-header text-right">Price</th>
                            <th className="table-header text-right">24h Change</th>
                            <th className="table-header text-right">Holding</th>
                            <th className="table-header text-right">Value</th>
                            <th className="table-header text-right">Allocation</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {displayHoldings.map((holding) => (
                            <tr key={holding.id} className="table-row">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 mr-3 flex-shrink-0">
                                            <img
                                                src={`https://api.iconify.design/cryptocurrency-color:${holding.symbol.toLowerCase()}.svg`}
                                                alt={holding.symbol}
                                                className={`w-10 h-10 rounded-full transition-all ${loading ? 'animate-pulse' : ''}`}
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    target.style.display = 'none';
                                                    target.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="bg-primary/20 w-10 h-10 rounded-full flex items-center justify-center hidden">
                                                <span className="text-sm font-bold text-primary">{holding.symbol.substring(0, 2)}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{holding.symbol}</div>
                                            <div className="text-sm text-muted-foreground">{holding.name}</div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    ${holding.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <div className={`flex items-center justify-end ${holding.change24h >= 0 ? 'trend-up' : 'trend-down'}`}>
                                        {holding.change24h >= 0 ? (
                                            <TrendingUp className="h-4 w-4 mr-1" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4 mr-1" />
                                        )}
                                        <span className="font-medium">
                                            {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                                        </span>
                                    </div>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    {holding.holding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    ${holding.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <div className="flex items-center justify-end">
                                        <span className="mr-2">{holding.allocation.toFixed(1)}%</span>
                                        <div className="w-24 bg-muted rounded-full h-2.5 overflow-hidden">
                                            <div
                                                className={`h-2.5 rounded-full transition-all ${holding.allocation > 50 ? 'bg-green-500' : holding.allocation > 20 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                                                style={{ width: `${Math.min(holding.allocation, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm text-muted-foreground">
                            Total: ${displayHoldings.reduce((sum, h) => sum + h.value, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <button className="btn-outline px-3 py-1.5 text-sm opacity-50 cursor-not-allowed">
                            Previous
                        </button>
                        <button className="btn-primary px-3 py-1.5 text-sm">
                            1
                        </button>
                        <button className="btn-outline px-3 py-1.5 text-sm opacity-50 cursor-not-allowed">
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
