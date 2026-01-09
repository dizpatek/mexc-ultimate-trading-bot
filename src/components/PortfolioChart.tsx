"use client";

import React, { useState } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, ComposedChart, Bar, Cell
} from 'recharts';

// Mock data with Value and Daily Change
const performanceData = [
    { date: '10:00', value: 10000, change: 0 },
    { date: '12:00', value: 10200, change: 200 },
    { date: '14:00', value: 10100, change: -100 },
    { date: '16:00', value: 10350, change: 250 },
    { date: '18:00', value: 10300, change: -50 },
    { date: '20:00', value: 10450, change: 150 },
    { date: '22:00', value: 10600, change: 150 },
    { date: '00:00', value: 10550, change: -50 },
    { date: '02:00', value: 10700, change: 150 },
    { date: '04:00', value: 10650, change: -50 },
    { date: '06:00', value: 10800, change: 150 },
    { date: '08:00', value: 10900, change: 100 },
];

export const PortfolioChart = () => {
    const [timeframe, setTimeframe] = useState('24S');

    const timeframes = ['24S', '7G', '30G', '90G'];

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-semibold">Portföy Performansı</h2>
                    <p className="text-xs text-muted-foreground">Değer ve Günlük Değişim</p>
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
                        data={performanceData}
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
                            tickFormatter={(value) => `$${value.toLocaleString()}`}
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
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
                        />

                        {/* Area for Total Value */}
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="value"
                            name="Toplam Değer"
                            stroke="hsl(var(--primary))"
                            fill="url(#colorValue)"
                            strokeWidth={2}
                        />

                        {/* Bars for Rise/Fall (Change) */}
                        <Bar yAxisId="right" dataKey="change" name="Değişim" barSize={10} radius={[2, 2, 0, 0]}>
                            {performanceData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.change >= 0 ? '#10B981' : '#EF4444'}
                                    fillOpacity={0.8}
                                />
                            ))}
                        </Bar>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
