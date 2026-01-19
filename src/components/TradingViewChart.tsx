"use client";

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, Time } from 'lightweight-charts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';

interface ChartData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

export const TradingViewChart = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<IChartApi | null>(null);
    const seriesInstanceRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('1d');
    const [marketStats, setMarketStats] = useState({
        marketCap: 0,
        change24h: 0
    });

    const handleTimeframeChange = (tf: string) => {
        setTimeframe(tf);
        localStorage.setItem('chart_timeframe', tf);
    };

    const fetchMarketData = async () => {
        try {
            const response = await axios.get('/api/market/overview');
            if (response.data && response.data.length > 0 && !response.data.error) {
                const topCoins = response.data.slice(0, 20);
                const totalMarketCap = topCoins.reduce((sum: number, coin: any) => sum + (coin.marketCap || 0), 0);
                const avgChange = topCoins.reduce((sum: number, coin: any) => sum + (coin.change24h || 0), 0) / topCoins.length;

                setMarketStats({
                    marketCap: totalMarketCap,
                    change24h: avgChange
                });
            }
        } catch (error) {
            console.error('Failed to fetch market data:', error);
        }
    };

    const generateData = () => {
        const data: ChartData[] = [];
        let time = Math.floor(new Date('2024-01-01').getTime() / 1000);
        let value = 500000000000;

        for (let i = 0; i < 400; i++) {
            const change = (Math.random() - 0.48) * 3000000000;
            value += change;
            const open = value;
            const high = value + Math.random() * 5000000000;
            const low = value - Math.random() * 5000000000;
            const close = open + (Math.random() - 0.5) * 6000000000;

            data.push({
                time: time as Time,
                open,
                high,
                low,
                close,
            });
            time += 86400;
        }
        return data;
    };

    useEffect(() => {
        fetchMarketData();
        const interval = setInterval(fetchMarketData, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        const timeoutId = setTimeout(() => {
            try {
                const chart = createChart(container, {
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: '#d1d5db',
                    },
                    grid: {
                        vertLines: { color: 'rgba(42, 46, 57, 0.1)' },
                        horzLines: { color: 'rgba(42, 46, 57, 0.1)' },
                    },
                    width: container.clientWidth || 800,
                    height: 400,
                    crosshair: {
                        mode: CrosshairMode.Normal,
                    },
                    timeScale: {
                        borderColor: '#485c7b',
                    },
                });

                const series = (chart as any).addCandlestickSeries({
                    upColor: '#22c55e',
                    downColor: '#ef4444',
                    borderVisible: false,
                    wickUpColor: '#22c55e',
                    wickDownColor: '#ef4444',
                });

                const data = generateData();
                series.setData(data);

                chartInstanceRef.current = chart;
                seriesInstanceRef.current = series;
                setIsLoading(false);

                const handleResize = () => {
                    if (container) {
                        chart.applyOptions({ width: container.clientWidth });
                    }
                };

                window.addEventListener('resize', handleResize);

                return () => {
                    window.removeEventListener('resize', handleResize);
                    if (chartInstanceRef.current) {
                        chartInstanceRef.current.remove();
                        chartInstanceRef.current = null;
                    }
                };
            } catch (error) {
                console.error('Chart initialization error:', error);
                setIsLoading(false);
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <div className="portfolio-container p-6">


            <div className="relative h-[400px] w-full border border-border/50 rounded-lg overflow-hidden">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
                    </div>
                )}
                <div ref={chartContainerRef} className="w-full h-full" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center">
                TOTAL3 Chart (Top 3 Altcoins Index) - Data is simulated for demonstration
            </div>
        </div>
    );
};
