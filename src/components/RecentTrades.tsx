"use client";

import { TrendingUp, TrendingDown } from 'lucide-react';
import { useRecentTrades } from '../hooks/usePortfolio';

export const RecentTrades = () => {
    const { data: trades, isLoading, isError } = useRecentTrades();

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
                    <h2 className="text-lg font-semibold">Recent Trades</h2>
                </div>
                <div className="p-6 text-center text-destructive">
                    Failed to load recent trades
                </div>
            </div>
        );
    }

    if (!trades || trades.length === 0) {
        return (
            <div className="portfolio-container">
                <div className="table-header">
                    <h2 className="text-lg font-semibold">Recent Trades</h2>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                    No recent trades found
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container">
            <div className="table-header">
                <h2 className="text-lg font-semibold">Recent Trades</h2>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted">
                        <tr>
                            <th className="table-header">Pair</th>
                            <th className="table-header">Type</th>
                            <th className="table-header text-right">Price</th>
                            <th className="table-header text-right">Amount</th>
                            <th className="table-header text-right">Total</th>
                            <th className="table-header">Time</th>
                            <th className="table-header">Status</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {trades.map((trade) => (
                            <tr key={trade.id} className="table-row">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {trade.symbol}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`badge ${trade.type === 'buy'
                                        ? 'badge-success'
                                        : 'badge-error'
                                        }`}>
                                        {trade.type === 'buy' ? (
                                            <TrendingUp className="h-3 w-3 mr-1" />
                                        ) : (
                                            <TrendingDown className="h-3 w-3 mr-1" />
                                        )}
                                        {trade.type.toUpperCase()}
                                    </span>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    ${trade.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    {trade.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    ${trade.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span suppressHydrationWarning>
                                        {new Date(trade.time).toLocaleString()}
                                    </span>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`badge ${trade.status === 'completed'
                                        ? 'badge-success'
                                        : trade.status === 'pending'
                                            ? 'badge-warning'
                                            : 'badge-error'
                                        }`}>
                                        {trade.status.charAt(0).toUpperCase() + trade.status.slice(1)}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-lg">
                <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                        Showing {trades.length} recent trades
                    </div>
                    <button className="text-sm text-primary hover:underline transition-colors">
                        View All Trades
                    </button>
                </div>
            </div>
        </div>
    );
};
