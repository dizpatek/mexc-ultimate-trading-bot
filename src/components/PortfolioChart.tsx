"use client";

import React, { useState } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Mock data for portfolio performance - in a real app, this would come from an API
const performanceData = [
    { date: 'Jan 1', value: 10000 },
    { date: 'Jan 5', value: 12000 },
    { date: 'Jan 10', value: 11500 },
    { date: 'Jan 15', value: 13000 },
    { date: 'Jan 20', value: 12500 },
    { date: 'Jan 25', value: 14000 },
    { date: 'Jan 30', value: 13500 },
    { date: 'Feb 1', value: 15000 },
    { date: 'Feb 5', value: 14500 },
    { date: 'Feb 10', value: 16000 },
    { date: 'Feb 15', value: 15500 },
    { date: 'Feb 20', value: 17000 },
    { date: 'Feb 25', value: 16500 },
    { date: 'Mar 1', value: 18000 },
];

export const PortfolioChart = () => {
    const [timeframe, setTimeframe] = useState('1M');

    const timeframes = ['1D', '1W', '1M', '3M', '1Y', 'All'];

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Portfolio Performance</h2>
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

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={performanceData}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                            dataKey="date"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                        />
                        <YAxis
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                borderColor: 'hsl(var(--border))',
                                borderRadius: '0.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                            }}
                            formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Value']}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            fill="url(#colorUv)"
                            strokeWidth={2}
                        />
                        <defs>
                            <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
