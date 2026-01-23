"use client";

import { TrendingUp, TrendingDown, Wallet, RefreshCw, Activity } from 'lucide-react';
import { usePortfolioSummary, useHoldings } from '../hooks/usePortfolio';

export const PortfolioSummary = () => {
    const { data: summaryData, isLoading: summaryLoading, isError: summaryError } = usePortfolioSummary();
    const { data: holdings, isLoading: holdingsLoading } = useHoldings();

    const loading = summaryLoading || holdingsLoading;

    const filteredHoldings = holdings?.filter(h => h.value > 100 && h.symbol !== 'USDT' && h.symbol !== 'USDC') || [];

    const bestPerformer = filteredHoldings.length > 0
        ? filteredHoldings.reduce((best, current) =>
            (current.change24h > best.change24h) ? current : best
        )
        : null;

    const topGainer = filteredHoldings.length > 0
        ? filteredHoldings.reduce((top, current) =>
            (current.value > top.value) ? current : top
        )
        : null;

    // Use real data or show loading/error state
    const totalValue = summaryData?.totalValue || 0;
    const change24h = summaryData?.change24h || 0;
    const changePercentage = summaryData?.changePercentage || 0;
    const assets = summaryData?.assets || 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="portfolio-container p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Portfolio Value</h3>
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <div className="flex items-center mt-2">
                        {change24h >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                        )}
                        <span className={`text-sm font-medium ${change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)} ({changePercentage.toFixed(2)}%)
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">24h</span>
                    </div>
                    {loading && (
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse w-2/3"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="portfolio-container p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Assets</h3>
                    <RefreshCw className={`h-5 w-5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">{assets}</p>
                    <p className="text-sm text-muted-foreground mt-2">Active holdings</p>
                    {loading && (
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse w-1/3"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="portfolio-container p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Best Performer</h3>
                    <Activity className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">{bestPerformer?.symbol || 'N/A'}</p>
                    <div className="flex items-center mt-2">
                        {bestPerformer && bestPerformer.change24h !== undefined && bestPerformer.change24h >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        ) : bestPerformer && bestPerformer.change24h !== undefined ? (
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                        ) : null}
                        <span className={`text-sm font-medium ${bestPerformer?.change24h !== undefined && bestPerformer.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {bestPerformer && bestPerformer.change24h !== undefined ? `${bestPerformer.change24h >= 0 ? '+' : ''}${bestPerformer.change24h.toFixed(2)}%` : '-'}
                        </span>
                    </div>
                    {loading && (
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse w-1/2"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="portfolio-container p-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Top Holding</h3>
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">{topGainer?.symbol || 'N/A'}</p>
                    <div className="flex items-center mt-2">
                        <span className="text-sm font-medium text-muted-foreground">
                            ${topGainer?.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
                        </span>
                    </div>
                    {loading && (
                        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse w-1/4"></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
