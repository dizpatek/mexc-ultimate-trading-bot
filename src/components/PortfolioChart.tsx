"use client";

import React, { useState } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Area, ComposedChart, Bar, Cell
} from 'recharts';

const performanceData = [
    { date: '10:00', value: 120000, change: 0 },
    { date: '12:00', value: 122500, change: 2500 },
    { date: '14:00', value: 121800, change: -700 },
    { date: '16:00', value: 124000, change: 2200 },
    { date: '18:00', value: 123500, change: -500 },
    { date: '20:00', value: 124800, change: 1300 },
    { date: '22:00', value: 125500, change: 700 },
    { date: '00:00', value: 125200, change: -300 },
    { date: '02:00', value: 125800, change: 600 },
    { date: '04:00', value: 125400, change: -400 },
    { date: '06:00', value: 126000, change: 600 },
    { date: '08:00', value: 125900, change: -100 },
];

const timeframeData: Record<string, typeof performanceData> = {
    '24S': performanceData,
    '7D': [
        { date: 'Mon', value: 115000, change: 0 },
        { date: 'Tue', value: 117500, change: 2500 },
        { date: 'Wed', value: 116800, change: -700 },
        { date: 'Thu', value: 119000, change: 2200 },
        { date: 'Fri', value: 118500, change: -500 },
        { date: 'Sat', value: 120000, change: 1500 },
        { date: 'Sun', value: 125900, change: 5900 },
    ],
    '30D': [
        { date: 'Week 1', value: 110000, change: 0 },
        { date: 'Week 2', value: 112000, change: 2000 },
        { date: 'Week 3', value: 115000, change: 3000 },
        { date: 'Week 4', value: 125900, change: 10900 },
    ],
    '90D': [
        { date: 'Month 1', value: 100000, change: 0 },
        { date: 'Month 2', value: 108000, change: 8000 },
        { date: 'Month 3', value: 125900, change: 17900 },
    ],
};

export const PortfolioChart = () => {
    const [timeframe, setTimeframe] = useState('24S');

    const timeframes = ['24S', '7D', '30D', '90D'];
    const currentData = timeframeData[timeframe] || performanceData;

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

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={currentData}
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
                            {currentData.map((entry, index) => (
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
