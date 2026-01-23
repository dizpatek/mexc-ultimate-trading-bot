"use client";

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown, Shield } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';
import { useMexcWebSocket } from '../hooks/useMexcWebSocket';
import { TrailingStopModal } from './TrailingStopModal';
import { AssetDetailModal } from './AssetDetailModal';

export const HoldingsTable = () => {
    const { data: holdings, isLoading, isError } = useHoldings();

    // States
    const [selectedHolding, setSelectedHolding] = React.useState<any>(null); // For Trailing Stop
    const [viewAsset, setViewAsset] = React.useState<string | null>(null);   // For Chart/Detail Modal

    // Subscribe to real-time prices
    const symbols = useMemo(() => holdings?.map(h => `${h.symbol}USDT`) || [], [holdings]);
    const { tickerData, isConnected } = useMexcWebSocket(symbols);

    const displayHoldings = useMemo(() => {
        if (!holdings) return [];
        return holdings.map(h => {
            const wsData = tickerData[`${h.symbol}USDT`];
            if (wsData) {
                const newPrice = parseFloat(wsData.p);
                return {
                    ...h,
                    price: newPrice,
                    value: h.holding * newPrice
                    // Note: 24h change isn't available in trade stream, keeping static
                };
            }
            return h;
        });
    }, [holdings, tickerData]);

    const loading = isLoading;

    // Sorting state
    const [sortField, setSortField] = React.useState<string>('value');
    const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('desc');


    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const fieldMap: Record<string, string> = {
        'Asset': 'symbol',
        'Price': 'price',
        '24h Change': 'change24h',
        'Holding': 'holding',
        'Value': 'value',
        'Allocation': 'allocation'
    };

    const sortedHoldings = [...displayHoldings].sort((a, b) => {
        const key = fieldMap[sortField] || sortField;
        const aValue = (a as any)[key];
        const bValue = (b as any)[key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }

        return sortDirection === 'asc'
            ? (aValue as number) - (bValue as number)
            : (bValue as number) - (aValue as number);
    });

    return (
        <div className="portfolio-container">
            <div className="table-header">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Your Holdings</h2>
                    {loading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
                            Loading...
                        </div>
                    ) : isConnected ? (
                        <div className="flex items-center gap-2 text-xs text-green-500 font-medium animate-pulse">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            Live Updates
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                            Static Data
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50">
                        <tr>
                            {['Asset', 'Price', '24h Change', 'Holding', 'Value', 'Allocation', 'Actions'].map((header) => (
                                <th
                                    key={header}
                                    className={`table-header cursor-pointer hover:bg-muted transition-colors ${header !== 'Asset' ? 'text-right' : ''}`}
                                    onClick={() => header !== 'Actions' && handleSort(header)}
                                >
                                    <div className={`flex items-center gap-1 ${header !== 'Asset' ? 'justify-end' : ''}`}>
                                        {header}
                                        {sortField === header && header !== 'Actions' && (
                                            sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {sortedHoldings.map((holding) => (
                            <tr key={holding.id} className="table-row">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div
                                        className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => setViewAsset(`${holding.symbol}USDT`)}
                                    >
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

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button
                                        onClick={() => setSelectedHolding(holding)}
                                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-blue-500"
                                        title="Set Trailing Stop"
                                    >
                                        <Shield className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedHolding && (
                <TrailingStopModal
                    isOpen={!!selectedHolding}
                    onClose={() => setSelectedHolding(null)}
                    symbol={`${selectedHolding.symbol}USDT`}
                    quantity={selectedHolding.holding}
                    currentPrice={selectedHolding.price}
                />
            )}

            {viewAsset && (
                <AssetDetailModal
                    isOpen={!!viewAsset}
                    onClose={() => setViewAsset(null)}
                    symbol={viewAsset}
                />
            )}

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
