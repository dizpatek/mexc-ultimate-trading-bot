"use client";

import { TrendingUp, TrendingDown } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';

export const HoldingsTable = () => {
    const { data: holdings, isLoading, isError } = useHoldings();

    if (isLoading) {
        return (
            <div className="portfolio-container">
                <div className="table-header">
                    <div className="h-6 bg-muted rounded w-1/4 animate-pulse"></div>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="portfolio-container">
                <div className="table-header">
                    <h2 className="text-lg font-semibold">Your Holdings</h2>
                </div>
                <div className="p-6 text-center text-destructive">
                    Failed to load holdings
                </div>
            </div>
        );
    }

    if (!holdings || holdings.length === 0) {
        return (
            <div className="portfolio-container">
                <div className="table-header">
                    <h2 className="text-lg font-semibold">Your Holdings</h2>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                    No holdings found
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container">
            <div className="table-header">
                <h2 className="text-lg font-semibold">Your Holdings</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted">
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
                        {holdings.map((holding) => (
                            <tr key={holding.id} className="table-row">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 mr-3 flex-shrink-0">
                                            <img
                                                src={`https://api.iconify.design/cryptocurrency-color:${holding.symbol.toLowerCase()}.svg`}
                                                alt={holding.symbol}
                                                className="w-10 h-10 rounded-full"
                                                onError={(e) => {
                                                    // Fallback to generic icon if specific one fails
                                                    const target = e.currentTarget;
                                                    target.style.display = 'none';
                                                    target.nextElementSibling?.classList.remove('hidden');
                                                }}
                                            />
                                            <div className="bg-primary w-10 h-10 rounded-full flex items-center justify-center hidden">
                                                <span className="text-sm font-bold text-primary-foreground">{holding.symbol.substring(0, 2)}</span>
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
                                        <div className="w-24 bg-muted rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full ${holding.allocation > 50 ? 'bg-green-500' : holding.allocation > 20 ? 'bg-yellow-500' : 'bg-blue-500'}`}
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
                    <div className="text-sm text-muted-foreground">
                        Showing {holdings.length} assets
                    </div>
                    <div className="flex space-x-2">
                        <button className="btn-outline px-3 py-1.5 text-sm">
                            Previous
                        </button>
                        <button className="btn-primary px-3 py-1.5 text-sm">
                            1
                        </button>
                        <button className="btn-outline px-3 py-1.5 text-sm">
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
