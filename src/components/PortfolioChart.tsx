"use client";

import { useEffect, memo } from 'react';

declare global {
    interface Window {
        TradingView?: any;
    }
}

function TradingViewWidget() {
    const containerId = 'tv-widget-portfolio-chart';

    useEffect(() => {
        let script: HTMLScriptElement | null = null;
        
        const initWidget = () => {
             if (typeof window.TradingView !== 'undefined') {
                new window.TradingView.widget({
                    autosize: true,
                    symbol: "MEXC:BTCUSDT",
                    interval: "60",
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "tr",
                    toolbar_bg: "#f1f3f6",
                    enable_publishing: true, 
                    allow_symbol_change: true,
                    container_id: containerId,
                    hide_side_toolbar: false,
                    save_image: true,
                    details: true,
                    hotlist: true,
                    calendar: true,
                    show_popup_button: true,
                    popup_width: "1000",
                    popup_height: "650",
                    withdateranges: true,
                    studies: [
                        "RSI@tv-basicstudies",
                        "MACD@tv-basicstudies",
                        "StochasticRSI@tv-basicstudies"
                    ],
                    // These overrides help make it look more 'native' and often trigger the standard header
                    overrides: {
                        "paneProperties.background": "#020617",
                        "paneProperties.vertGridProperties.color": "#1e293b",
                        "paneProperties.horzGridProperties.color": "#1e293b",
                        "scalesProperties.textColor": "#94a3b8",
                        "mainSeriesProperties.candleStyle.upColor": "#10b981",
                        "mainSeriesProperties.candleStyle.downColor": "#f43f5e",
                        "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
                        "mainSeriesProperties.candleStyle.borderDownColor": "#f43f5e",
                        "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
                        "mainSeriesProperties.candleStyle.wickDownColor": "#f43f5e"
                    }
                });
             }
        };

        if (!document.getElementById('tv-widget-script')) {
            script = document.createElement('script');
            script.id = 'tv-widget-script';
            script.src = 'https://s3.tradingview.com/tv.js';
            script.async = true;
            script.onload = initWidget;
            document.head.appendChild(script);
        } else {
            // Script already exists or loading, wait a bit or direct init
            if (window.TradingView) {
                initWidget();
            } else {
                // Poll for it
                const checkInterval = setInterval(() => {
                    if (window.TradingView) {
                        clearInterval(checkInterval);
                        initWidget();
                    }
                }, 100);
                // Cleanup interval if component unmounts quickly
                return () => clearInterval(checkInterval);
            }
        }
    }, []);

    const openProChart = () => {
        window.open('https://www.tradingview.com/chart/?symbol=MEXC:BTCUSDT', '_blank');
    };

    return (
        <div className="h-full w-full relative z-0 group">
            <div id={containerId} className="h-full w-full" />
            
            {/* Custom Overlay Button for Account Access - Always Visible */}
            <button 
                onClick={openProChart}
                className="absolute top-14 right-4 z-50 bg-[#2962FF] hover:bg-[#1E53E5] text-white text-[11px] font-semibold px-3 py-1.5 rounded shadow-lg flex items-center gap-1.5 transition-colors border border-white/10"
                title="TradingView Hesabını Aç"
            >
                <span>Pro Hesaba Git</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </button>
        </div>
    );
}

export const PortfolioChart = memo(TradingViewWidget);
