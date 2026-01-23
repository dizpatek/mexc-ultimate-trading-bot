"use client";

import React, { useState, useEffect } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, ComposedChart, Bar, Cell
} from 'recharts';

interface PortfolioHistoryData {
    date: string;
    totalValue: number;
    totalAssets: number;
}

interface ChartDataPoint {
    date: string;
    value: number;
    change: number;
}

const timeframeMap: Record<string, number> = {
    '24S': 1,   // Last 24 hours (1 day)
    '7D': 7,    // Last 7 days
    '30D': 30,  // Last 30 days
    '90D': 90,  // Last 90 days
};

export const PortfolioChart = () => {
    const [timeframe, setTimeframe] = useState('7D');
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const timeframes = ['24S', '7D', '30D', '90D'];

    const fetchPortfolioHistory = async () => {
        setLoading(true);
        setError(null);

        try {
            const days = timeframeMap[timeframe] || 7;
            const response = await fetch(`/api/portfolio/history?days=${days}`);

            if (!response.ok) {
                throw new Error('Failed to fetch portfolio history');
            }

            const data: PortfolioHistoryData[] = await response.json();

            if (!data || data.length === 0) {
                // If no data available, show message
                setChartData([]);
                setError('No historical data available yet');
                return;
            }

            // Transform data to chart format
            const transformed: ChartDataPoint[] = data.map((item, index) => {
                const prevValue = index > 0 ? data[index - 1].totalValue : item.totalValue;
                const change = item.totalValue - prevValue;

                // Format date based on timeframe
                let dateLabel = '';
                const date = new Date(item.date);

                if (timeframe === '24S') {
                    dateLabel = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                } else if (timeframe === '7D') {
                    dateLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
                } else if (timeframe === '30D') {
                    dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                    dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }

                return {
                    date: dateLabel,
                    value: item.totalValue,
                    change: change,
                };
            });

            setChartData(transformed);
        } catch (err: any) {
            console.error('Error fetching portfolio history:', err);
            setError(err.message || 'Failed to load portfolio data');
            setChartData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPortfolioHistory();

        // Auto-refresh every 5 minutes
        const interval = setInterval(fetchPortfolioHistory, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [timeframe]);

    if (loading) {
        return (
            <div className="portfolio-container p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-semibold">Portfolio Performance</h2>
                        <p className="text-xs text-muted-foreground">Value and daily change</p>
                    </div>
                </div>
                <div className="h-80 flex items-center justify-center">
                    <div className="animate-pulse text-muted-foreground">Loading chart data...</div>
                </div>
            </div>
        );
    }

    if (error || chartData.length === 0) {
        return (
            <div className="portfolio-container p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-lg font-semibold">Portfolio Performance</h2>
                        <p className="text-xs text-muted-foreground">Value and daily change</p>
                    </div>
                    <div className="flex space-x-1 bg-secondary/30 p-1 rounded-lg">
                        {timeframes.map((frame) => (
                            <button
                                key={frame}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeframe === frame
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }`}
                                onClick={() => setTimeframe(frame)}
                            >
                                {frame}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-80 flex items-center justify-center border border-dashed border-border rounded-lg">
                    <div className="text-center">
                        <p className="text-muted-foreground mb-2">📊 No historical data available</p>
                        <p className="text-xs text-muted-foreground">
                            Portfolio snapshots will be created automatically over time
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-semibold">Portfolio Performance</h2>
                    <p className="text-xs text-muted-foreground">Real historical value and changes</p>
                </div>
                <div className="flex space-x-1 bg-secondary/30 p-1 rounded-lg">
                    {timeframes.map((frame) => (
                        <button
                            key={frame}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeframe === frame
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                }`}
                            onClick={() => setTimeframe(frame)}
                        >
                            {frame}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 0,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(value) => `${value > 0 ? '+' : ''}$${(value / 1000).toFixed(1)}k`}
                            tickLine={false}
                            axisLine={false}
                            hide
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '0.5rem',
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: any, name: any) => {
                                const numValue = Number(value) ?? 0;
                                const strName = String(name || '');
                                if (strName === 'Total Value') {
                                    return [`$${numValue.toLocaleString()}`, strName];
                                }
                                return [`${numValue >= 0 ? '+' : ''}$${numValue.toLocaleString()}`, strName];
                            }}
                        />

                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="value"
                            name="Total Value"
                            stroke="hsl(var(--primary))"
                            fill="url(#colorValue)"
                            strokeWidth={2}
                        />

                        <Bar yAxisId="right" dataKey="change" name="Change" barSize={8} radius={[2, 2, 0, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.change >= 0 ? '#10B981' : '#EF4444'}
                                    fillOpacity={0.7}
                                />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
