"use client";

import { useEffect } from 'react';

interface TradingViewEmbedChartProps {
    symbol?: string;
    theme?: 'light' | 'dark';
    height?: number;
    showTotal3?: boolean;
}

declare global {
    interface Window {
        TradingView?: any;
    }
}

export const TradingViewEmbedChart = ({
    symbol = 'BTCUSDT',
    theme = 'dark',
    height = 500,
    showTotal3 = false
}: TradingViewEmbedChartProps) => {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
            if (window.TradingView) {
                new window.TradingView.widget({
                    width: '100%',
                    height: height,
                    symbol: showTotal3 ? 'CRYPTOCAP:TOTAL3' : `BINANCE:${symbol}`,
                    interval: 'D',
                    timezone: 'Etc/UTC',
                    theme: theme,
                    style: '1',
                    locale: 'en',
                    toolbar_bg: '#f1f3f6',
                    enable_publishing: false,
                    hide_side_toolbar: false,
                    allow_symbol_change: true,
                    container_id: 'tradingview-widget',
                    studies: [],
                    studies_overrides: {},
                    overrides: {
                        'paneProperties.background': theme === 'dark' ? '#131722' : '#ffffff',
                        'paneProperties.vertGridProperties.color': theme === 'dark' ? '#363c4e' : '#e0e3eb',
                        'paneProperties.horzGridProperties.color': theme === 'dark' ? '#363c4e' : '#e0e3eb',
                    },
                });
            }
        };
        document.body.appendChild(script);

        return () => {
            script.remove();
        };
    }, [symbol, theme, height]);

        return (
            <div className="w-full">
                <div id="tradingview-widget" style={{ height: `${height}px` }} />
                <div className="mt-2 text-xs text-muted-foreground text-center">
                    {showTotal3 ? 'TOTAL3 Chart (Top 3 Altcoins Index)' : `${symbol} Chart`}
                    {' • '}Custom Pine Script indicators must be added manually in TradingView
                </div>
            </div>
        );
};
