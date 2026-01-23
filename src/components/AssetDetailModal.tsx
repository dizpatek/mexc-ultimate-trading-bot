"use client";

import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { TradeForm } from './TradeForm'; // Reusing existing TradeForm but contextual

interface AssetDetailModalProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
}

export const AssetDetailModal = ({ symbol, isOpen, onClose }: AssetDetailModalProps) => {
    if (!isOpen) return null;

    // Remove USDT suffix for TradingView widget if needed, but usually it works
    const tvSymbol = `MEXC:${symbol}`;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-background border border-border rounded-xl w-full max-w-5xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{symbol}</h2>
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">Spot</span>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

                    {/* Left: TradingView Chart */}
                    <div className="flex-1 bg-black relative border-r border-border min-h-[400px]">
                        <iframe
                            className="absolute inset-0 w-full h-full"
                            src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${tvSymbol}&interval=60&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC`}
                            allowFullScreen
                        ></iframe>
                    </div>

                    {/* Right: Trade & Info */}
                    <div className="w-full lg:w-[350px] flex flex-col bg-card overflow-y-auto">

                        {/* Quick Stats (Placeholder - could be real websocket data) */}
                        <div className="p-4 grid grid-cols-2 gap-4 border-b border-border">
                            <div>
                                <div className="text-xs text-muted-foreground">24h High</div>
                                <div className="font-mono">---</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">24h Low</div>
                                <div className="font-mono">---</div>
                            </div>
                        </div>

                        {/* Trade Form */}
                        <div className="flex-1 p-4">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Quick Trade
                            </h3>
                            {/* We can embed the simplified trade form here */}
                            <div className="bg-muted/30 p-2 rounded-lg text-center text-sm text-muted-foreground mb-4">
                                Use the main dashboard for full trading features.
                                <br />
                                (Quick trade integration coming soon)
                            </div>

                            <a
                                href={`https://www.mexc.com/exchange/${symbol.replace('USDT', '_USDT')}`}
                                target="_blank"
                                className="btn-primary block text-center w-full py-2 rounded-lg"
                            >
                                Open in MEXC
                            </a>
                        </div>

                        {/* Strategy Info */}
                        <div className="p-4 border-t border-border">
                            <h4 className="text-sm font-semibold mb-2">F4 Strategy Status</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Structure</span>
                                    <span className="text-green-500 font-bold">BULLISH</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Momentum</span>
                                    <span className="text-yellow-500">NEUTRAL</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
