"use client";

import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useRecentTrades } from '../hooks/usePortfolio';

export const RecentTrades = () => {
    const { data: trades, isLoading, isError } = useRecentTrades();

    const displayTrades = trades || [];
    const loading = isLoading;

    return (
        <div className="portfolio-container">
            <div className="table-header">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Recent Trades</h2>
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
                        {displayTrades.map((trade) => (
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
                                    <span suppressHydrationWarning className="text-xs">
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
                        Showing {displayTrades.length} recent trades
                    </div>
                    <button className="flex items-center gap-1 text-sm text-primary hover:underline transition-colors">
                        View All Trades
                        <ArrowRight className="h-3 w-3" />
                    </button>
                </div>
            </div>
        </div>
    );
};
