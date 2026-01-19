"use client";

import { useEffect, useState, memo } from 'react';
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import axios from 'axios';

interface CryptoRankAsset {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    change7d: number;
    change30d: number;
    change90d: number;
    volume: number;
    rank: number;
    marketCap: number;
    circulatingSupply: number;
    totalSupply: number;
    circulatingSupplyPercent: number;
}

const CryptoRankWidget = () => {
    const [data, setData] = useState<CryptoRankAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            const response = await axios.get('/api/market/overview');
            
            if (response.data && Array.isArray(response.data)) {
                const mappedData = response.data.map((coin: any, index: number) => ({
                    symbol: coin.symbol,
                    name: coin.name || coin.symbol,
                    price: coin.price,
                    change24h: coin.change24h || 0,
                    change7d: coin.change7d || 0,
                    change30d: coin.change30d || 0,
                    change90d: coin.change90d || 0,
                    volume: coin.volume,
                    rank: coin.rank || index + 1,
                    marketCap: coin.marketCap || 0,
                    circulatingSupply: coin.circulatingSupply || 0,
                    totalSupply: coin.totalSupply || 0,
                    circulatingSupplyPercent: coin.circulatingSupplyPercent || 0
                }));
                setData(mappedData);
                setError(false);
            } else if (response.data.error) {
                console.error('API returned error:', response.data.error);
                setError(true);
            } else {
                setData([]);
                setError(false);
            }
        } catch (err) {
            console.error('Failed to fetch market data:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="portfolio-container flex flex-col min-h-[500px] w-full bg-card">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Market Scanner</h3>
                    <span className="text-xs text-muted-foreground">CryptoRank Live Data</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 hover:bg-muted rounded-full transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <a
                        href="https://cryptorank.io/watchlist/4f7effbd40d4"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3"
                    >
                        Open CryptoRank <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full">
                    <thead className="bg-muted sticky top-0">
                        <tr>
                            <th className="table-header">Rank</th>
                            <th className="table-header">Asset</th>
                            <th className="table-header text-right">Price</th>
                            <th className="table-header text-right">Market Cap</th>
                            <th className="table-header text-right">Circ. Supply (%)</th>
                            <th className="table-header text-right">Total Supply</th>
                            <th className="table-header text-right">Chg (3M)</th>
                            <th className="table-header text-right">Chg (30D)</th>
                            <th className="table-header text-right">Chg (7D)</th>
                            <th className="table-header text-right">Chg (24H)</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {loading && data.length === 0 ? (
                            [...Array(10)].map((_, i) => (
                                <tr key={i} className="table-row">
                                    <td colSpan={10} className="px-4 py-4">
                                        <div className="h-10 bg-muted rounded animate-pulse"></div>
                                    </td>
                                </tr>
                            ))
                        ) : error ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-destructive">
                                    Failed to load market data. Click refresh to try again.
                                </td>
                            </tr>
                        ) : (
                            data.map((asset) => (
                                <tr key={asset.symbol} className="table-row">
                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                        <span className="text-sm font-medium text-muted-foreground">
                                            #{asset.rank}
                                        </span>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="bg-primary w-8 h-8 rounded-full flex items-center justify-center mr-3">
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

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        {asset.marketCap > 0 ? `$${asset.marketCap.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                            notation: 'compact',
                                            compactDisplay: 'short'
                                        })}` : 'N/A'}
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        {asset.circulatingSupplyPercent > 0 ? `${asset.circulatingSupplyPercent.toFixed(2)}%` : 'N/A'}
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        {asset.totalSupply > 0 ? asset.totalSupply.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0,
                                            notation: 'compact',
                                            compactDisplay: 'short'
                                        }) : 'N/A'}
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        <span className={asset.change90d >= 0 ? 'trend-up' : 'trend-down'}>
                                            {asset.change90d >= 0 ? '+' : ''}{asset.change90d.toFixed(2)}%
                                        </span>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        <span className={asset.change30d >= 0 ? 'trend-up' : 'trend-down'}>
                                            {asset.change30d >= 0 ? '+' : ''}{asset.change30d.toFixed(2)}%
                                        </span>
                                    </td>

                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                                        <span className={asset.change7d >= 0 ? 'trend-up' : 'trend-down'}>
                                            {asset.change7d >= 0 ? '+' : ''}{asset.change7d.toFixed(2)}%
                                        </span>
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
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default memo(CryptoRankWidget);
