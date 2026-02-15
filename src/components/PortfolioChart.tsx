"use client";

import { useEffect, useState, memo } from 'react';
import { Activity, Globe } from 'lucide-react';

declare global {
    interface Window {
        TradingView?: any;
    }
}

function TradingViewWidget() {
    const containerId = 'tv-widget-portfolio-chart';
    const [isWebMode, setIsWebMode] = useState(false); // Widget vs Direct Web Embed

    useEffect(() => {
        if (isWebMode) return; // Don't init widget script in Web Mode

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
            if (window.TradingView) {
                initWidget();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.TradingView) {
                        clearInterval(checkInterval);
                        initWidget();
                    }
                }, 100);
                return () => clearInterval(checkInterval);
            }
        }
    }, [isWebMode]);

    const openProChart = () => {
        window.open('https://www.tradingview.com/chart/?symbol=MEXC:BTCUSDT', '_blank');
    };

    return (
        <div className="h-full w-full relative z-0 group">
            {isWebMode ? (
                <iframe 
                    src="https://www.tradingview.com/chart/?symbol=MEXC:BTCUSDT&theme=dark"
                    className="w-full h-full border-0"
                    allowFullScreen
                    title="TradingView Pro Web"
                />
            ) : (
                <div id={containerId} className="h-full w-full" />
            )}
            
            {/* Control Panel */}
            <div className="absolute top-14 right-4 z-50 flex flex-col gap-2">
                <button 
                    onClick={() => setIsWebMode(!isWebMode)}
                    className={`text-[10px] font-bold px-3 py-1.5 rounded shadow-lg flex items-center justify-center gap-1.5 transition-all border ${isWebMode ? 'bg-purple-600 text-white border-purple-400' : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}`}
                    title={isWebMode ? "Widget Moduna Dön" : "Tam Web Arayüzünü Dene (Deneysel)"}
                >
                    {isWebMode ? (
                        <>
                            <Activity className="w-3 h-3" />
                            <span>Widget Modu</span>
                        </>
                    ) : (
                        <>
                            <Globe className="w-3 h-3" />
                            <span>Web Modu</span>
                        </>
                    )}
                </button>

                {!isWebMode && (
                    <button 
                        onClick={openProChart}
                        className="bg-[#2962FF] hover:bg-[#1E53E5] text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-lg flex items-center justify-center gap-1.5 transition-colors border border-white/10"
                        title="TradingView Hesabını Yeni Sekmede Aç"
                    >
                        <span>Pro Hesaba Git</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </button>
                )}
            </div>
            
            {isWebMode && (
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-[8px] text-white/50 rounded pointer-events-none">
                    Deneysel Web Modu
                </div>
            )}
        </div>
    );
}

export const PortfolioChart = memo(TradingViewWidget);
