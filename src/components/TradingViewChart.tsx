"use client";

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { api } from '@/services/api';

export const TradingViewChart = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('1d'); // 1h, 4h, 1d

    // Mock data generator for TOTAL3 if API not available
    // In real app, we would fetch from CryptoCompare or CoinGecko charts
    const generateData = () => {
        const data = [];
        let time = new Date('2025-01-01').getTime() / 1000;
        let value = 400000000000; // 400B start

        for (let i = 0; i < 300; i++) {
            const change = (Math.random() - 0.48) * 5000000000; // Slight upward trend
            value += change;
            const open = value;
            const high = value + Math.random() * 2000000000;
            const low = value - Math.random() * 2000000000;
            const close = open + (Math.random() - 0.5) * 3000000000;

            data.push({
                time: time as any,
                open: open,
                high: high,
                low: low,
                close: close,
            });
            time += 86400; // 1 day
        }
        return data;
    };

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.1)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.1)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            timeScale: {
                borderColor: '#485c7b',
            },
        });

        const candlestickSeries = (chart as any).addCandlestickSeries({
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        // Load drawings from local storage
        const savedDrawings = localStorage.getItem('tv-drawings');
        if (savedDrawings) {
            // Restore drawings logic here (complex with lightweight-charts custom implementation)
            // For now lightweight charts doesn't support drawings natively like TV library
            // We would need to implement custom overlay or use the full TV widget
        }

        const data = generateData();
        candlestickSeries.setData(data);

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;
        setIsLoading(false);

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">TOTAL3 (Crypto Market Cap Ex-BTC/ETH)</h2>
                    <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">Beta</span>
                </div>
                <div className="flex gap-2">
                    {['1h', '4h', '1d'].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-xs rounded transition-colors ${timeframe === tf ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                                }`}
                        >
                            {tf.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative h-[400px] w-full border border-border/50 rounded-lg overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
                    </div>
                )}
                <div ref={chartContainerRef} className="w-full h-full" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
                Chart data is simulated for demonstration. Access to TradingView Advanced Charts requires license.
            </div>
        </div>
    );
};
