"use client";

import { useEffect, useRef, memo } from 'react';

function TotalMarketChart() {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Check if script is already there to prevent duplicates (React Strict Mode double render)
        if (container.current.querySelector('script')) return;

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "autosize": true,
            "symbol": "CRYPTOCAP:TOTAL3",
            "interval": "D",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "support_host": "https://www.tradingview.com"
        });

        container.current.appendChild(script);
    }, []);

    return (
        <div className="portfolio-container p-1 h-[500px] w-full relative overflow-hidden">
            <div className="tradingview-widget-container h-full w-full" ref={container}>
                <div className="tradingview-widget-container__widget h-full w-full"></div>
                <div className="tradingview-widget-copyright text-xs text-center text-muted-foreground mt-1">
                    <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
                        <span className="text-primary hover:underline">Track all markets on TradingView</span>
                    </a>
                </div>
            </div>
        </div>
    );
}

export default memo(TotalMarketChart);
