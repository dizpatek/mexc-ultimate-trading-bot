"use client";

import { TrendingUp, TrendingDown, Wallet, RefreshCw } from 'lucide-react';
import { usePortfolioSummary } from '../hooks/usePortfolio';

export const PortfolioSummary = () => {
    const { data, isLoading, isError } = usePortfolioSummary();

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="portfolio-container p-6 animate-pulse">
                        <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                        <div className="h-8 bg-muted rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="portfolio-container p-6 col-span-full">
                    <div className="text-center text-destructive">
                        Failed to load portfolio summary
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const { totalValue, change24h, changePercentage, assets } = data;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Portfolio Value */}
            <div className="stat-card">
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
                </div>
            </div>

            {/* Assets Count */}
            <div className="stat-card">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Total Assets</h3>
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">{assets}</p>
                    <p className="text-sm text-muted-foreground mt-2">Active holdings</p>
                </div>
            </div>

            {/* Best Performer */}
            <div className="stat-card">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Best Performer</h3>
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">BTC</p>
                    <div className="flex items-center mt-2">
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-500">+5.24%</span>
                    </div>
                </div>
            </div>

            {/* Top Gainer */}
            <div className="stat-card">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Top Gainer</h3>
                </div>
                <div className="mt-4">
                    <p className="text-3xl font-bold">ETH</p>
                    <div className="flex items-center mt-2">
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                        <span className="text-sm font-medium text-green-500">+3.78%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
