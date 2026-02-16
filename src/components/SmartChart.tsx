"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, IPriceLine, Time, MouseEventParams } from 'lightweight-charts';
import { fetchKlines } from '@/services/api';
import { Target } from 'lucide-react';

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

interface RawCandle {
    time: number | string;
    open: number | string;
    high: number | string;
    low: number | string;
    close: number | string;
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
    const ghostSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChartReady, setIsChartReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const triggerCoordSync = () => {
         setIsChartReady(prev => !prev);
         setTimeout(() => setIsChartReady(true), 50);
    };

    // Forces the chart to include all trade levels in the visible area
    const focusOnPrices = useCallback(() => {
        if (!chartRef.current || !seriesRef.current || !ghostSeriesRef.current) return;
        
        const b = propsRef.current.buyPrice;
        const t = propsRef.current.tpPrice;
        const s = propsRef.current.slPrice;
        const te = propsRef.current.tpEnabled;
        const se = propsRef.current.slEnabled;

        // Get current visible time range to place ghost points correctly
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange) {
            ghostSeriesRef.current.setData([
                { time: visibleRange.from as Time, value: b },
                { time: visibleRange.from as Time, value: te ? t : b },
                { time: visibleRange.from as Time, value: se ? s : b },
                { time: visibleRange.to as Time, value: b }
            ]);
        }

        chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        triggerCoordSync();
    }, []);

    // Refs for price lines
    const buyLineRef = useRef<IPriceLine | null>(null);
    const tpLineRef = useRef<IPriceLine | null>(null);
    const slLineRef = useRef<IPriceLine | null>(null);

    // Dragging state
    const [draggingLine, setDraggingLine] = useState<'buy' | 'tp' | 'sl' | null>(null);

    // Coordinates for the drag buttons overlay
    const [lineCoords, setLineCoords] = useState<{ buy?: number; tp?: number; sl?: number }>({});

    // Local prices for ultra-smooth dragging
    const [localPrices, setLocalPrices] = useState({ buy: buyPrice, tp: tpPrice, sl: slPrice });

    // Sync local prices when props change (but NOT when dragging)
    useEffect(() => {
        if (!draggingLine) {
            setLocalPrices({ buy: buyPrice, tp: tpPrice, sl: slPrice });
        }
    }, [buyPrice, tpPrice, slPrice, draggingLine]);

    const propsRef = useRef({ buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange });
    useEffect(() => {
        propsRef.current = { buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange };
    }, [buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange]);

    // Initialize Chart
    useEffect(() => {
        console.log('[SmartChart] Re-Initializing for symbol:', symbol);
        let isMounted = true;
        
        const init = async () => {
            if (!chartContainerRef.current || !isMounted) return;

            if (chartRef.current) {
                try { chartRef.current.remove(); } catch {}
                chartRef.current = null;
                seriesRef.current = null;
            }

            const container = chartContainerRef.current;
            const chartInstance = createChart(container, {
                layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
                grid: { vertLines: { color: 'rgba(30, 41, 59, 0.4)' }, horzLines: { color: 'rgba(30, 41, 59, 0.4)' } },
                width: container.clientWidth || 800,
                height: 450,
                timeScale: { borderColor: '#1e293b', timeVisible: true },
                rightPriceScale: { borderColor: '#1e293b', autoScale: true },
            });

            const candlestickSeries = chartInstance.addSeries(CandlestickSeries, {
                upColor: '#10b981', downColor: '#f43f5e', borderVisible: false,
                wickUpColor: '#10b981', wickDownColor: '#f43f5e',
            });

            // Ghost series used to expand price range
            const ghostSeries = chartInstance.addSeries(LineSeries, {
                color: 'transparent',
                lastValueVisible: false,
                priceLineVisible: false,
            });

            chartRef.current = chartInstance;
            seriesRef.current = candlestickSeries;
            ghostSeriesRef.current = ghostSeries;
            setIsChartReady(true);

            const apiSymbol = symbol.replace('/', '');
            try {
                const data = await fetchKlines(apiSymbol, '1h');
                if (isMounted && data && Array.isArray(data)) {
                    const validData: CandleData[] = (data as RawCandle[])
                        .filter((d): d is RawCandle => !!(d && d.time !== undefined))
                        .map(d => ({
                            time: d.time as Time,
                            open: Number(d.open),
                            high: Number(d.high),
                            low: Number(d.low),
                            close: Number(d.close),
                        }));
                    candlestickSeries.setData(validData);
                    chartInstance.timeScale().fitContent();
                    
                    // Initial framing
                    setTimeout(() => {
                        if (isMounted) focusOnPrices();
                    }, 300);

                    chartInstance.timeScale().subscribeVisibleLogicalRangeChange(() => {
                        if (isMounted) triggerCoordSync();
                    });
                }
            } catch {
                setError('Veri yüklenemedi');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const timer = setTimeout(init, 50);
        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (chartRef.current) chartRef.current.remove();
        };
    }, [symbol, focusOnPrices]);

    // Sync price lines and compute coordinates
    useEffect(() => {
        if (!seriesRef.current || !isChartReady) return;
        const series = seriesRef.current;

        const updateLine = (lineRef: React.MutableRefObject<IPriceLine | null>, price: number, color: string, title: string, enabled: boolean) => {
            if (!enabled) {
                if (lineRef.current) { series.removePriceLine(lineRef.current); lineRef.current = null; }
                return;
            }
            if (lineRef.current) lineRef.current.applyOptions({ price });
            else lineRef.current = series.createPriceLine({ price, color, lineWidth: 2, lineStyle: LineStyle.Solid, axisLabelVisible: true, title });
        };

        updateLine(buyLineRef, localPrices.buy, '#06b6d4', 'Satın Al', true);
        updateLine(tpLineRef, localPrices.tp, '#10b981', 'Kar Al', tpEnabled);
        updateLine(slLineRef, localPrices.sl, '#f43f5e', 'Stop Loss', slEnabled);

        const updateCoords = () => {
            setLineCoords({
                buy: series.priceToCoordinate(localPrices.buy) ?? undefined,
                tp: tpEnabled ? series.priceToCoordinate(localPrices.tp) ?? undefined : undefined,
                sl: slEnabled ? series.priceToCoordinate(localPrices.sl) ?? undefined : undefined
            });
        };

        updateCoords();
        requestAnimationFrame(updateCoords);
    }, [isChartReady, localPrices, tpEnabled, slEnabled]);

    // Optimize Dragging
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;
        const chart = chartRef.current;
        const series = seriesRef.current;

        const onMouseDown = (param: MouseEventParams) => {
            if (!param.point) return;
            const { buyPrice: b, tpPrice: t, slPrice: s, tpEnabled: te, slEnabled: se } = propsRef.current;
            const dist = (p: number) => Math.abs(param.point!.y - (series.priceToCoordinate(p) || 0));
            if (dist(b) < 30) setDraggingLine('buy');
            else if (te && dist(t) < 30) setDraggingLine('tp');
            else if (se && dist(s) < 30) setDraggingLine('sl');
        };

        const onMouseMove = (param: MouseEventParams) => {
            if (draggingLine && param.point) {
                const price = series.coordinateToPrice(param.point.y);
                if (price !== null) {
                    const rounded = Number(price.toFixed(6));
                    setLocalPrices(prev => ({ ...prev, [draggingLine]: rounded }));
                    propsRef.current.onPricesChange({ [draggingLine]: rounded });
                }
            }
            if (chartContainerRef.current && param.point) {
                const { buyPrice: b, tpPrice: t, slPrice: s, tpEnabled: te, slEnabled: se } = propsRef.current;
                const dist = (p: number) => Math.abs(param.point!.y - (series.priceToCoordinate(p) || 0));
                const over = dist(b) < 30 || (te && dist(t) < 30) || (se && dist(s) < 30);
                chartContainerRef.current.style.cursor = over || draggingLine ? 'ns-resize' : 'crosshair';
            }
        };

        chart.subscribeClick(onMouseDown);
        chart.subscribeCrosshairMove(onMouseMove);
        const onMouseUp = () => setDraggingLine(null);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            chart.unsubscribeClick(onMouseDown);
            chart.unsubscribeCrosshairMove(onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isChartReady, draggingLine]);

    return (
        <div className="w-full relative group/chart select-none">
            <div ref={chartContainerRef} className="w-full h-[450px] bg-slate-950/20 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" />
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">Matrix Senkronizasyon...</span>
                    </div>
                </div>
            )}

            {error && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20 text-rose-400 font-bold uppercase tracking-widest text-[10px]">
                    ⚠️ {error}
                </div>
            )}

            <div className="absolute top-16 right-4 z-30 pointer-events-auto">
                <button onClick={focusOnPrices} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-[10px] font-black text-cyan-400 hover:bg-cyan-400/20 transition-all backdrop-blur-xl group/focus shadow-lg">
                    <Target className="w-3.5 h-3.5 group-hover/focus:scale-125 transition-transform" />
                    ODAKLA
                </button>
            </div>

            <div className="absolute inset-y-0 left-0 w-[450px] pointer-events-none overflow-hidden z-20">
                {Object.entries(lineCoords).map(([key, coord]) => {
                    if (coord === undefined) return null;
                    const label = key === 'buy' ? 'Satın Al' : key === 'tp' ? 'Kar Al' : 'Stop Loss';
                    const color = key === 'buy' ? 'bg-[#06b6d4]' : key === 'tp' ? 'bg-[#10b981]' : 'bg-[#f43f5e]';
                    const bdColor = key === 'buy' ? 'border-cyan-300' : key === 'tp' ? 'border-emerald-300' : 'border-rose-300';
                    const price = localPrices[key as keyof typeof localPrices];

                    return (
                        <div key={key} className="absolute left-6 flex items-center transition-all duration-150 pointer-events-auto" style={{ top: Math.max(20, Math.min(430, coord - 18)) }}>
                            <div 
                                onMouseDown={(e) => { e.preventDefault(); setDraggingLine(key as 'buy' | 'tp' | 'sl'); }}
                                className={`flex items-center ${color} rounded-lg border ${bdColor} shadow-xl cursor-ns-resize hover:scale-105 transition-transform active:scale-95`}
                            >
                                <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-950 uppercase border-r border-slate-950/20">{label}</div>
                                <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-950 font-mono tracking-tighter">{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{symbol}</span>
                </div>
            </div>
        </div>
    );
};
