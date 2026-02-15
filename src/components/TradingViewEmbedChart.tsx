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
        // Check if script already exists
        const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');

        const initWidget = () => {
            if (window.TradingView) {
                // Clear previous widget if exists
                const container = document.getElementById('tradingview-widget');
                if (container) {
                    container.innerHTML = '';
                }

                new window.TradingView.widget({
                    width: '100%',
                    height: height,
                    symbol: showTotal3 ? 'CRYPTOCAP:TOTAL3' : `MEXC:${symbol}`,
                    interval: '60',
                    timezone: 'Etc/UTC',
                    theme: theme,
                    style: '1',
                    locale: 'tr',
                    toolbar_bg: '#f1f3f6',
                    enable_publishing: false,
                    hide_side_toolbar: false,
                    allow_symbol_change: true,
                    save_image: true,
                    container_id: 'tradingview-widget',
                    details: true,
                    hotlist: true,
                    calendar: true,
                    withdateranges: true,
                    autosize: true,
                    studies: [
                        "RSI@tv-basicstudies",
                        "MACD@tv-basicstudies"
                    ],
                    studies_overrides: {},
                    overrides: {
                        'paneProperties.background': theme === 'dark' ? '#020617' : '#ffffff',
                        'paneProperties.vertGridProperties.color': theme === 'dark' ? '#1e293b' : '#e0e3eb',
                        'paneProperties.horzGridProperties.color': theme === 'dark' ? '#1e293b' : '#e0e3eb',
                        'scalesProperties.textColor': theme === 'dark' ? '#94a3b8' : '#333',
                        'mainSeriesProperties.candleStyle.upColor': '#10b981',
                        'mainSeriesProperties.candleStyle.downColor': '#f43f5e',
                        'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
                        'mainSeriesProperties.candleStyle.borderDownColor': '#f43f5e',
                        'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
                        'mainSeriesProperties.candleStyle.wickDownColor': '#f43f5e',
                    },
                });
            }
        };

        if (existingScript) {
            // Script already loaded, just init widget
            initWidget();
        } else {
            // Load script first
            const script = document.createElement('script');
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = initWidget;
            document.head.appendChild(script);
        }

        // Cleanup function
        return () => {
            const container = document.getElementById('tradingview-widget');
            if (container) {
                container.innerHTML = '';
            }
        };
    }, [symbol, theme, height, showTotal3]);

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
