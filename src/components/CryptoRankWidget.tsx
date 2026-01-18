"use client";

import { ExternalLink } from "lucide-react";

export const CryptoRankWidget = () => {
    return (
        <div className="portfolio-container flex flex-col h-[700px] w-full overflow-hidden relative bg-card">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="font-semibold flex items-center gap-2">
                    <img src="https://cryptorank.io/assets/images/logo/logo.svg" alt="CR" className="h-5" />
                    Market Watchlist
                </h3>
                <a
                    href="https://cryptorank.io/watchlist/4f7effbd40d4"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                    Open in CryptoRank <ExternalLink className="h-3 w-3" />
                </a>
            </div>
            <div className="flex-1 relative">
                <iframe
                    src="https://cryptorank.io/watchlist/4f7effbd40d4"
                    className="w-full h-full border-0 absolute inset-0"
                    title="CryptoRank Watchlist"
                    loading="lazy"
                    allow="clipboard-write; fullscreen"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
            </div>
        </div>
    );
};
