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
                <div className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-slate-900/90 border border-red-500/30 text-slate-300 rounded shadow-2xl backdrop-blur-md z-40">
                    <div className="flex items-start gap-2">
                        <div className="min-w-[16px] mt-0.5 text-red-500">
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] font-bold text-red-400 mb-0.5">Beyaz Ekran mı Görüyorsunuz?</p>
                            <p className="text-[9px] leading-relaxed opacity-80">
                                TradingView güvenlik gereği (X-Frame-Options) bu modu engelleyebilir. 
                                Çalışması için tarayıcınıza <b>&apos;Ignore X-Frame-Options&apos;</b> veya <b>&apos;Requestly&apos;</b> eklentisini kurup aktifleştirmeniz gerekir.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export const PortfolioChart = memo(TradingViewWidget);
