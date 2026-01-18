"use client";

import { useEffect, useRef, memo } from 'react';
import { ExternalLink, AlertCircle } from "lucide-react";

const CryptoRankWidget = () => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!container.current) return;

        // Prevent duplicate scripts
        if (container.current.querySelector('script')) return;

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "width": "100%",
            "height": "100%",
            "defaultColumn": "overview",
            "screener_type": "crypto_mkt",
            "displayCurrency": "USD",
            "colorTheme": "dark",
            "locale": "en",
            "isTransparent": true
        });

        container.current.appendChild(script);
    }, []);

    return (
        <div className="portfolio-container flex flex-col h-[700px] w-full overflow-hidden relative bg-card">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Market Scanner</h3>
                    <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        CryptoRank blocks embedding, using TradingView Scanner instead.
                    </span>
                </div>
                <a
                    href="https://cryptorank.io/watchlist/4f7effbd40d4"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary flex items-center gap-2 text-xs py-1.5 px-3"
                >
                    Open My CryptoRank Watchlist <ExternalLink className="h-3 w-3" />
                </a>
            </div>

            <div className="flex-1 w-full h-full bg-background relative" ref={container}>
                <div className="tradingview-widget-container__widget h-full w-full"></div>
            </div>
        </div>
    );
};

export default memo(CryptoRankWidget);
