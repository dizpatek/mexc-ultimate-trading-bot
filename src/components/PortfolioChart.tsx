"use client";

import { useEffect, useRef, memo } from 'react';

function TradingViewWidget() {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Clean up previous scripts if any
        const existingScript = container.current.querySelector('script');
        if (existingScript) existingScript.remove();

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        // Advanced Configuration - "OAuth Level" Features
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": "MEXC:BTCUSDT",
            "interval": "60",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "tr",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "calendar": true,
            "support_host": "https://www.tradingview.com",
            "hide_side_toolbar": false, // Enable drawing tools
            "details": true, // Show detailed info
            "hotlist": true, // Show hotlist
            "withdateranges": true,
            "save_image": true,
            "studies": [
                "RSI@tv-basicstudies",
                "MACD@tv-basicstudies",
                "StochasticRSI@tv-basicstudies"
            ],
            "show_popup_button": true,
            "popup_width": "1000",
            "popup_height": "650"
        });
        container.current.appendChild(script);
    }, []);

    return (
        <div className="tradingview-widget-container h-full w-full" ref={container}>
            <div className="tradingview-widget-container__widget h-full w-full"></div>
        </div>
    );
}

export const PortfolioChart = memo(TradingViewWidget);
