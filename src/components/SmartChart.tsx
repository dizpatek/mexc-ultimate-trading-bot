"use client";

import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, IPriceLine, Time, MouseEventParams } from 'lightweight-charts';
import { fetchKlines } from '@/services/api';
import { Zap, Target, Info } from 'lucide-react';

interface SmartChartProps {
    symbol: string;
    buyPrice: number;
    tpPrice: number;
    slPrice: number;
    onPricesChange: (prices: { buy?: number; tp?: number; sl?: number }) => void;
    tpEnabled: boolean;
    slEnabled: boolean;
}

interface CandleData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

export const SmartChart: React.FC<SmartChartProps> = ({ 
    symbol,
    buyPrice,
    tpPrice,
    slPrice,
    onPricesChange,
    tpEnabled,
    slEnabled
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChartReady, setIsChartReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const triggerCoordSync = () => {
         setIsChartReady(prev => !prev);
         setTimeout(() => setIsChartReady(true), 50);
    };

    const focusOnPrices = () => {
        if (!chartRef.current || !seriesRef.current) return;
        console.log('[SmartChart] Focusing on price levels:', { buyPrice, tpPrice, slPrice });
        triggerCoordSync();
    };

    // Refs for price lines
    const buyLineRef = useRef<IPriceLine | null>(null);
    const tpLineRef = useRef<IPriceLine | null>(null);
    const slLineRef = useRef<IPriceLine | null>(null);

    // Dragging state
    const [draggingLine, setDraggingLine] = useState<'buy' | 'tp' | 'sl' | null>(null);

    // Coordinates for the drag buttons overlay
    const [lineCoords, setLineCoords] = useState<{ buy?: number; tp?: number; sl?: number }>({});

    // Initialize Chart
    useEffect(() => {
        console.log('[SmartChart] Main Init Effect for symbol:', symbol);
        let isMounted = true;
        
        // Failsafe: Ensure loading overlay clears even if API hangs
        const loadingTimeout = setTimeout(() => {
            if (isMounted) {
                console.log('[SmartChart] Failsafe: Force clearing loading state');
                setIsLoading(false);
            }
        }, 8000);

        const init = async () => {
            if (!chartContainerRef.current || !isMounted) {
                console.log('[SmartChart] Container not ready or unmounted');
                return;
            }

            // Cleanup any existing chart first to prevent collision
            if (chartRef.current) {
                try {
                    chartRef.current.remove();
                } catch (e) {
                    console.warn('[SmartChart] Cleanup warning:', e);
                }
                chartRef.current = null;
                seriesRef.current = null;
            }

            const container = chartContainerRef.current;
            const width = container.clientWidth || 800;

            try {
                setError(null);
                console.log(`[SmartChart] Initializing chart for ${symbol}`);
                
                const chartInstance = createChart(container, {
                    layout: {
                        background: { type: ColorType.Solid, color: 'transparent' },
                        textColor: '#94a3b8',
                    },
                    grid: {
                        vertLines: { color: 'rgba(30, 41, 59, 0.4)' },
                        horzLines: { color: 'rgba(30, 41, 59, 0.4)' },
                    },
                    width: width,
                    height: 450,
                    timeScale: { borderColor: '#1e293b', timeVisible: true },
                    rightPriceScale: { borderColor: '#1e293b' },
                });

                // v5 API - use addSeries with CandlestickSeries type
                const candlestickSeries = chartInstance.addSeries(CandlestickSeries, {
                    upColor: '#10b981',
                    downColor: '#f43f5e',
                    borderVisible: false,
                    wickUpColor: '#10b981',
                    wickDownColor: '#f43f5e',
                });

                chartRef.current = chartInstance;
                seriesRef.current = candlestickSeries;
                setIsChartReady(true);

                // Load Data
                const apiSymbol = symbol.replace('/', '');
                console.log(`[SmartChart] Fetching klines for ${apiSymbol}`);
                
                const data = await fetchKlines(apiSymbol, '1h');
                
                if (!isMounted) return;
                
                if (isMounted && data && data.length > 0) {
                    console.log(`[SmartChart] Data received: ${data.length} candles`);
                    
                    // Validate and filter data
                    const validData: CandleData[] = data.filter((d: CandleData) => 
                        d && 
                        d.time !== undefined && 
                        typeof d.open === 'number' &&
                        typeof d.high === 'number' &&
                        typeof d.low === 'number' &&
                        typeof d.close === 'number'
                    );
                    
                    if (validData.length > 0) {
                        candlestickSeries.setData(validData);
                        chartInstance.timeScale().fitContent();
                        console.log('[SmartChart] Chart data set successfully');
                        
                // Force initial coordinate sync after a short delay to allow rendering
                        setTimeout(() => {
                            if (isMounted) {
                                triggerCoordSync();
                            }
                        }, 100);

                        // Subscribe to changes to keep labels in sync
                        chartInstance.timeScale().subscribeVisibleLogicalRangeChange(() => {
                            if (isMounted) triggerCoordSync();
                        });
                    } else {
                        console.warn('[SmartChart] No valid data points after filtering');
                        setError('Grafik verisi geçersiz format');
                    }
                } else {
                    console.warn('[SmartChart] No data or empty response received');
                    setError('Grafik verisi alınamadı');
                }
            } catch (error) {
                console.error('[SmartChart] Init/Load failed:', error);
                setError(error instanceof Error ? error.message : 'Grafik yüklenemedi');
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    console.log('[SmartChart] Loading finished');
                }
            }
        };

        init();

        const handleResize = () => {
            if (isMounted && chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            isMounted = false;
            clearTimeout(loadingTimeout);
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                setIsChartReady(false);
                try {
                    chartRef.current.remove();
                } catch (e) {
                    console.warn('[SmartChart] Cleanup error:', e);
                }
                chartRef.current = null;
            }
        };
    }, [symbol]);

    // Update Price Lines and coordinates for buttons
    useEffect(() => {
        if (!seriesRef.current) return;
        const series = seriesRef.current;

        if (buyLineRef.current) {
            try { series.removePriceLine(buyLineRef.current); } catch (e) { console.warn('[SmartChart] Remove buy line error:', e); }
        }
        if (tpLineRef.current) {
            try { series.removePriceLine(tpLineRef.current); } catch (e) { console.warn('[SmartChart] Remove tp line error:', e); }
        }
        if (slLineRef.current) {
            try { series.removePriceLine(slLineRef.current); } catch (e) { console.warn('[SmartChart] Remove sl line error:', e); }
        }

        try {
            buyLineRef.current = series.createPriceLine({
                price: buyPrice,
                color: '#06b6d4',
                lineWidth: 2,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: 'Satın Al',
            });

            const updateCoords = () => {
                const buyPos = series.priceToCoordinate(buyPrice);
                const tpPos = tpEnabled ? series.priceToCoordinate(tpPrice) : null;
                const slPos = slEnabled ? series.priceToCoordinate(slPrice) : null;
                
                setLineCoords({
                    buy: buyPos ?? undefined,
                    tp: tpPos ?? undefined,
                    sl: slPos ?? undefined
                });
            };

            // Immediate update
            updateCoords();
            
            // Retry update after layout
            requestAnimationFrame(updateCoords);

            if (tpEnabled) {
                tpLineRef.current = series.createPriceLine({
                    price: tpPrice,
                    color: '#10b981',
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'Kar Al',
                });
            }

            if (slEnabled) {
                slLineRef.current = series.createPriceLine({
                    price: slPrice,
                    color: '#f43f5e',
                    lineWidth: 2,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'Zarar Durdur',
                });
            }
        } catch (e) {
            console.error('[SmartChart] Price line error:', e);
        }
    }, [isChartReady, buyPrice, tpPrice, slPrice, tpEnabled, slEnabled]);

    // Global Mouse Handlers
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;
        const chart = chartRef.current;
        const series = seriesRef.current;

        const handleMouseDown = (param: MouseEventParams) => {
            if (!param.point) return;
            
            const checkProximity = (targetPrice: number) => {
                const coord = series.priceToCoordinate(targetPrice);
                if (coord === null) return false;
                return Math.abs(param.point!.y - coord) < 25;
            };

            if (checkProximity(buyPrice)) setDraggingLine('buy');
            else if (tpEnabled && checkProximity(tpPrice)) setDraggingLine('tp');
            else if (slEnabled && checkProximity(slPrice)) setDraggingLine('sl');
        };

        const handleMouseMove = (param: MouseEventParams) => {
            if (draggingLine && param.point) {
                const price = series.coordinateToPrice(param.point.y);
                if (price !== null) {
                    const roundedPrice = Number(price.toFixed(6));
                    onPricesChange({ [draggingLine]: roundedPrice });
                }
            }

            const container = chartContainerRef.current;
            if (container && param.point) {
                const checkProximity = (targetPrice: number) => {
                    const coord = series.priceToCoordinate(targetPrice);
                    if (coord === null) return false;
                    return Math.abs(param.point!.y - coord) < 25;
                };

                const isOver = checkProximity(buyPrice) || 
                               (tpEnabled && checkProximity(tpPrice)) || 
                               (slEnabled && checkProximity(slPrice));
                
                container.style.cursor = isOver || draggingLine ? 'ns-resize' : 'crosshair';
            }
        };

        const handleMouseUp = () => setDraggingLine(null);

        chart.subscribeClick(handleMouseDown);
        chart.subscribeCrosshairMove(handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            chart.unsubscribeClick(handleMouseDown);
            chart.unsubscribeCrosshairMove(handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isChartReady, draggingLine, buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange]);

    return (
        <div className="w-full relative group/chart select-none">
            <div 
                ref={chartContainerRef}
                className="w-full h-[450px] bg-slate-950/20 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            />
            
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">PLANLAYICI YÜKLENİYOR...</span>
                        <button 
                            onClick={() => {
                                console.log('[SmartChart] Manual loading skip triggered');
                                setIsLoading(false);
                            }}
                            className="mt-4 px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all pointer-events-auto shadow-lg"
                        >
                            YÜKLENMİYOR MU? ATLANSIN
                        </button>
                    </div>
                </div>
            )}

            {/* Error Display */}
            {error && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20">
                    <div className="flex flex-col items-center gap-3 text-center p-4">
                        <div className="text-rose-400 text-sm font-bold">⚠️ {error}</div>
                        <button 
                            onClick={() => {
                                setError(null);
                                setIsLoading(true);
                                // Trigger re-render by changing a state
                                setTimeout(() => window.location.reload(), 100);
                            }}
                            className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                        >
                            Tekrar Dene
                        </button>
                    </div>
                </div>
            )}

            {/* Manual Sync / Focus HUD */}
            <div className="absolute top-16 right-4 z-30 flex flex-col gap-2 pointer-events-auto">
                <button 
                    onClick={focusOnPrices}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-black text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all backdrop-blur-xl group/focus shadow-lg"
                    title="Fiyat Seviyelerine Odakla"
                >
                    <Target className="w-3.5 h-3.5 group-hover/focus:scale-125 transition-transform" />
                    FİYATLARA ODAKLA
                </button>
            </div>

            {/* Price Line Buttons */}
            <div className="absolute inset-y-0 left-0 w-[400px] pointer-events-none overflow-hidden z-20">
                {/* Buy Line Button */}
                {lineCoords.buy !== undefined && (
                    <div 
                        className="absolute left-6 flex items-center transition-all duration-150 pointer-events-auto group/buy-btn cursor-ns-resize"
                        style={{ top: Math.max(20, Math.min(430, lineCoords.buy - 18)) }}
                        onMouseDown={(e) => {
                             e.preventDefault();
                             setDraggingLine('buy');
                        }}
                    >
                        <div className="flex items-center bg-[#06b6d4] rounded-lg border border-cyan-300 shadow-[0_0_25px_rgba(6,182,12,0.4)] group-hover/buy-btn:scale-110 transition-transform">
                            <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-950 uppercase tracking-tighter border-r border-slate-950/20">Satın Al</div>
                            <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-950 font-mono tracking-tighter">{buyPrice.toFixed(6)}</div>
                        </div>
                    </div>
                )}

                {/* TP Line Button */}
                {tpEnabled && lineCoords.tp !== undefined && (
                    <div 
                        className="absolute left-6 flex items-center transition-all duration-150 pointer-events-auto group/tp-btn cursor-ns-resize"
                        style={{ top: Math.max(20, Math.min(430, lineCoords.tp - 18)) }}
                        onMouseDown={(e) => {
                             e.preventDefault();
                             setDraggingLine('tp');
                        }}
                    >
                        <div className="flex items-center bg-[#10b981] rounded-lg border border-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.4)] group-hover/tp-btn:scale-110 transition-transform">
                            <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-950 uppercase tracking-tighter border-r border-slate-950/20">Kar Al</div>
                            <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-950 font-mono tracking-tighter">{tpPrice.toFixed(6)}</div>
                        </div>
                    </div>
                )}

                {/* SL Line Button */}
                {slEnabled && lineCoords.sl !== undefined && (
                    <div 
                        className="absolute left-6 flex items-center transition-all duration-150 pointer-events-auto group/sl-btn cursor-ns-resize"
                        style={{ top: Math.max(20, Math.min(430, lineCoords.sl - 18)) }}
                        onMouseDown={(e) => {
                             e.preventDefault();
                             setDraggingLine('sl');
                        }}
                    >
                        <div className="flex items-center bg-[#f43f5e] rounded-lg border border-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.4)] group-hover/sl-btn:scale-110 transition-transform">
                            <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-950 uppercase tracking-tighter border-r border-slate-950/20">Stop Loss</div>
                            <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-950 font-mono tracking-tighter">{slPrice.toFixed(6)}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Top Right HUD */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 pointer-events-none">
                <div className="bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${draggingLine ? 'bg-amber-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] italic">
                            {draggingLine ? 'SINYAL KALİBRASYON' : 'INTERAKTİF MATRİS MODÜLÜ'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Symbol Badge */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
                <div className="bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5 shadow-xl">
                    <span className="text-[11px] font-black text-cyan-400 uppercase tracking-widest">{symbol}</span>
                </div>
            </div>
        </div>
    );
};
