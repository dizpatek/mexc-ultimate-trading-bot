"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries, LineSeries, HistogramSeries, BaselineSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, IPriceLine, Time, MouseEventParams, LogicalRange } from 'lightweight-charts';
import { fetchKlines } from '@/services/api';
import { Target } from 'lucide-react';
import { AssetIcon } from '@/components/AssetIcon';
import { core } from '@/services/ApiCore';
import { cn } from '@/lib/utils';
import type { Holding } from '@/services/api';


interface SmartChartProps {
    symbol: string;
    buyPrice: number;
    tpPrice: number;
    slPrice: number;
    onPricesChange: (prices: { buy?: number; tp?: number; sl?: number }) => void;
    tpEnabled: boolean;
    slEnabled: boolean;
    trailingBuy: boolean;
    onTrailingBuyChange: (v: boolean) => void;
    trailingSl: boolean;
    onTrailingSlChange: (v: boolean) => void;
    trailingTp: boolean;
    onTrailingTpChange: (v: boolean) => void;
    currentMarketPrice?: number;
    onMarketPriceUpdate?: (price: number) => void;
    mode?: 'TRADE' | 'COVER';
    // Trailing deviation values for visual display
    trailingBuyDev?: number;
    trailingTpDev?: number;
    trailingSlDev?: number;
    assets?: Holding[];
    onAssetChange?: (asset: Holding) => void;
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
    volume?: number | string;
}

const TIMEFRAMES = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '30m', value: '30m' },
    { label: '1h', value: '1h' },
    { label: '4h', value: '4h' },
    { label: '12h', value: '12h' },
    { label: '1d', value: '1d' },
    { label: '1w', value: '1w' },
];

const TIMEFRAME_SECONDS: Record<string, number> = {
    '1m': 60,
    '3m': 180,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '2h': 7200,
    '4h': 14400,
    '8h': 28800,
    '12h': 43200,
    '1d': 86400,
    '1w': 604800,
};

export const SmartChart: React.FC<SmartChartProps> = ({ 
    symbol,
    buyPrice,
    tpPrice,
    slPrice,
    onPricesChange,
    tpEnabled,
    slEnabled,
    trailingBuy,
    onTrailingBuyChange,
    trailingSl,
    onTrailingSlChange,
    trailingTp,
    onTrailingTpChange,
    currentMarketPrice: externalMarketPrice,
    onMarketPriceUpdate,
    mode = 'TRADE',
    trailingBuyDev = 1.0,
    trailingTpDev = -1.0,
    trailingSlDev = -1.0,
    assets = [],
    onAssetChange,
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const ghostSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<boolean>(false);
    const [isChartReady, setIsChartReady] = useState(false);
    const [lastClose, setLastClose] = useState(0);
    const lastCandleRef = useRef<CandleData | null>(null);
    const allKlinesRef = useRef<CandleData[]>([]);
    const allVolumeRef = useRef<{ time: Time; value: number; color: string }[]>([]);
    const isHistoryLoadingRef = useRef(false);
    const [timeframe, setTimeframe] = useState('1h');
    const isUpdatingOverlaysRef = useRef(false);



    // The "current price" is the last close price from the data, or the external one
    const currentPrice = externalMarketPrice || lastClose;

    const lastSyncTimeRef = useRef(0);
    const triggerCoordSync = useCallback(() => {
        const now = Date.now();
        if (now - lastSyncTimeRef.current < 50) return; // Throttle to 50ms
        lastSyncTimeRef.current = now;
    }, []);

    // Forces the chart to include all trade levels in the visible area
    const focusOnPrices = useCallback(() => {
        if (!chartRef.current || !seriesRef.current || !ghostSeriesRef.current) return;
        
        const b = propsRef.current.buyPrice;
        const t = propsRef.current.tpPrice;
        const s = propsRef.current.slPrice;
        const te = propsRef.current.tpEnabled;
        const se = propsRef.current.slEnabled;

        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (visibleRange && ghostSeriesRef.current) {
            const timeFrom = Number(visibleRange.from);
            const timeTo = Number(visibleRange.to);
            
            if (!isNaN(timeFrom) && !isNaN(timeTo)) {
                const timestamp1 = timeFrom;
                const timestamp2 = timeFrom + (timeTo - timeFrom) / 2;
                const timestamp3 = timeTo;

                ghostSeriesRef.current.setData([
                    { time: timestamp1 as Time, value: Math.min(b, te ? t : b, se ? s : b) * 0.999 },
                    { time: timestamp2 as Time, value: Math.max(b, te ? t : b, se ? s : b) * 1.001 },
                    { time: timestamp3 as Time, value: b }
                ]);
            }
        }

        if (chartRef.current) {
            chartRef.current.priceScale('right').applyOptions({ autoScale: true });
        }
    }, []);

    // Refs for price lines
    const currentPriceLineRef = useRef<IPriceLine | null>(null);
    const tpFillRef = useRef<ISeriesApi<"Baseline"> | null>(null);
    const slFillRef = useRef<ISeriesApi<"Baseline"> | null>(null);

    // Dragging state
    const [draggingLine, setDraggingLine] = useState<'buy' | 'tp' | 'sl' | null>(null);

    // Coordinates for the drag buttons overlay
    const [lineCoords, setLineCoords] = useState<{ buy?: number; tp?: number; sl?: number }>({});

    // Local prices for ultra-smooth dragging
    const [localPrices, setLocalPrices] = useState({ buy: Number(buyPrice), tp: Number(tpPrice), sl: slPrice ? Number(slPrice) : 0 });
    const localPricesRef = useRef(localPrices);
    useEffect(() => { localPricesRef.current = localPrices; }, [localPrices]);

    // Sync local prices when props change (but NOT when dragging)
    useEffect(() => {
        if (!draggingLine) {
            setLocalPrices(prev => {
                const b = Number(buyPrice);
                const t = Number(tpPrice);
                const s = slPrice ? Number(slPrice) : 0;
                if (prev.buy === b && prev.tp === t && prev.sl === s) return prev;
                return { buy: b, tp: t, sl: s };
            });
        }
    }, [buyPrice, tpPrice, slPrice, draggingLine]);

    const propsRef = useRef({ buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange });
    useEffect(() => {
        propsRef.current = { buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange };
    }, [buyPrice, tpPrice, slPrice, tpEnabled, slEnabled, onPricesChange]);

    // Initialize Chart Instance (Once)
    useEffect(() => {
        if (!chartContainerRef.current) return;
        
        const container = chartContainerRef.current;
        const chartInstance = createChart(container, {
            layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
            grid: { vertLines: { color: 'rgba(30, 41, 59, 0.3)' }, horzLines: { color: 'rgba(30, 41, 59, 0.3)' } },
            width: container.clientWidth || 800,
            height: 500,
            timeScale: { borderColor: '#1e293b', timeVisible: true },
            rightPriceScale: { borderColor: '#1e293b', autoScale: true },
            crosshair: {
                horzLine: { color: 'rgba(6, 182, 212, 0.3)', labelBackgroundColor: '#06b6d4' },
                vertLine: { color: 'rgba(6, 182, 212, 0.3)', labelBackgroundColor: '#06b6d4' },
            },
        });

        const candlestickSeries = chartInstance.addSeries(CandlestickSeries, {
            upColor: '#10b981', downColor: '#f43f5e', borderVisible: false,
            wickUpColor: '#10b981', wickDownColor: '#f43f5e',
        });

        const volumeSeries = chartInstance.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chartInstance.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        const ghostSeries = chartInstance.addSeries(LineSeries, {
            color: 'transparent',
            lastValueVisible: false,
            priceLineVisible: false,
        });

        chartRef.current = chartInstance;
        seriesRef.current = candlestickSeries;
        ghostSeriesRef.current = ghostSeries;
        volumeSeriesRef.current = volumeSeries;
        setIsChartReady(true);

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                seriesRef.current = null;
                ghostSeriesRef.current = null;
                volumeSeriesRef.current = null;
                setIsChartReady(false);
            }
        };
    }, []);

    // Reset data refs and state when symbol or timeframe changes to prevent data "ghosting"
    useEffect(() => {
        allKlinesRef.current = [];
        allVolumeRef.current = [];
        lastCandleRef.current = null;
        setLastClose(0);
        if (seriesRef.current) seriesRef.current.setData([]);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);
    }, [symbol, timeframe]);

    // Data Fetching & Sync (on symbol/timeframe change or interval)
    useEffect(() => {
        if (!isChartReady || !seriesRef.current || !volumeSeriesRef.current) return;
        
        let isMounted = true;
        
        const updateSeriesData = (newKlines: CandleData[], newVolume: { time: Time; value: number; color: string }[], mode: 'reset' | 'update' | 'prepend' = 'reset') => {
            if (!seriesRef.current || !volumeSeriesRef.current || !isChartReady) return;
            
            const toSeconds = (t: Time): number => {
                if (typeof t === 'number') return t;
                if (typeof t === 'string') return Number(t);
                if (t && typeof t === 'object' && 'timestamp' in t) return (t as { timestamp: number }).timestamp;
                return 0;
            };

            const sanitize = <T extends { time: Time }>(data: T[]): T[] => {
                return data.filter(d => {
                    const t = toSeconds(d.time);
                    return !isNaN(t) && t > 0;
                }).map(d => ({
                    ...d,
                    time: toSeconds(d.time) as Time
                }));
            };

            const cleanKlines = sanitize(newKlines);
            const cleanVolume = sanitize(newVolume);

            if (mode === 'reset' || allKlinesRef.current.length === 0) {
                 // Full Reset Mode
                cleanKlines.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));
                cleanVolume.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));

                allKlinesRef.current = cleanKlines;
                allVolumeRef.current = cleanVolume;
                seriesRef.current.setData(cleanKlines);
                volumeSeriesRef.current.setData(cleanVolume);
            } else if (mode === 'prepend') {
                // Prepend Mode (for history)
                const firstKnownTime = allKlinesRef.current.length > 0 
                    ? toSeconds(allKlinesRef.current[0].time) 
                    : Infinity;

                const olderKlines = cleanKlines.filter(k => toSeconds(k.time) < firstKnownTime);
                const olderVolume = cleanVolume.filter(v => toSeconds(v.time) < firstKnownTime);

                if (olderKlines.length > 0) {
                    allKlinesRef.current = [...olderKlines, ...allKlinesRef.current];
                    allVolumeRef.current = [...olderVolume, ...allVolumeRef.current];
                    seriesRef.current.setData(allKlinesRef.current);
                    volumeSeriesRef.current.setData(allVolumeRef.current);
                }
            } else {
                // Smart Update Mode (Merge API data into existing ref)
                const klineMap = new Map<number, CandleData>(allKlinesRef.current.map(k => [toSeconds(k.time), k]));
                const volMap = new Map<number, { time: Time; value: number; color: string }>(
                    allVolumeRef.current.map(v => [toSeconds(v.time), v])
                );

                const hasSignificantChange = (a: number, b: number) => Math.abs(a - b) > 0.00000001;
                let hasHistoricalChange = false;
                const lastExistingTime = allKlinesRef.current.length > 0 ? toSeconds(allKlinesRef.current[allKlinesRef.current.length - 1].time) : 0;

                cleanKlines.forEach(k => {
                    const t = toSeconds(k.time);
                    const existing = klineMap.get(t);
                    if (!existing || hasSignificantChange(existing.close, k.close) || hasSignificantChange(existing.high, k.high) || hasSignificantChange(existing.low, k.low)) {
                        klineMap.set(t, k);
                        if (t < lastExistingTime) hasHistoricalChange = true;
                    }
                });

                cleanVolume.forEach(v => {
                    const t = toSeconds(v.time);
                    const existing = volMap.get(t);
                    if (!existing || Math.abs(existing.value - v.value) > 0.1) {
                        volMap.set(t, v);
                        if (t < lastExistingTime) hasHistoricalChange = true;
                    }
                });

                allKlinesRef.current = Array.from(klineMap.values()).sort((a, b) => toSeconds(a.time) - toSeconds(b.time));
                allVolumeRef.current = Array.from(volMap.values()).sort((a, b) => toSeconds(a.time) - toSeconds(b.time));

                if (hasHistoricalChange) {
                    // Must use setData if older candles were updated
                    seriesRef.current.setData(allKlinesRef.current);
                    volumeSeriesRef.current.setData(allVolumeRef.current);
                } else {
                    // Only update candles at or after the current tip
                    cleanKlines.filter(k => toSeconds(k.time) >= lastExistingTime)
                              .sort((a, b) => toSeconds(a.time) - toSeconds(b.time))
                              .forEach(k => seriesRef.current?.update(k));
                    
                    cleanVolume.filter(v => toSeconds(v.time) >= lastExistingTime)
                               .sort((a, b) => toSeconds(a.time) - toSeconds(b.time))
                               .forEach(v => volumeSeriesRef.current?.update(v));
                }
            }

            if (allKlinesRef.current.length > 0) {
                lastCandleRef.current = allKlinesRef.current[allKlinesRef.current.length - 1];
            }
        };

        const fetchData = async (shouldFocus = false) => {
            if (shouldFocus) {
                setIsLoading(true);
                setError(null);
            }
            setSyncError(false);
            const apiSymbol = symbol.replace('/', '');
            
            try {
                const data = await fetchKlines(apiSymbol, timeframe);
                if (!isMounted) return;

                if (!data || !Array.isArray(data) || data.length === 0) {
                    setError(`Veri bulunamadı: ${apiSymbol}`);
                    return;
                }

                const validData: CandleData[] = (data as RawCandle[])
                    .filter((d): d is RawCandle => !!(d && d.time !== undefined))
                    .map(d => ({
                        time: d.time as Time,
                        open: Number(d.open),
                        high: Number(d.high),
                        low: Number(d.low),
                        close: Number(d.close),
                    }));
                
                const volumeData = (data as RawCandle[])
                    .filter((d): d is RawCandle => !!(d && d.time !== undefined && d.volume !== undefined))
                    .map(d => ({
                        time: d.time as Time,
                        value: Number(d.volume || 0),
                        color: Number(d.close) >= Number(d.open) ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)',
                    }));

                // Use 'reset' for initial load/focus, 'update' for background polling
                updateSeriesData(validData, volumeData, shouldFocus ? 'reset' : 'update');

                if (allKlinesRef.current.length > 0) {
                    const latest = allKlinesRef.current[allKlinesRef.current.length - 1];
                    const price = latest.close;
                    if (price > 0) {
                        setLastClose(price);
                        if (onMarketPriceUpdate) onMarketPriceUpdate(price);
                        if (shouldFocus) focusOnPrices();
                    }
                }
            } catch (err) {
                console.error('[SmartChart] Data error:', err);
                if (isMounted) {
                    // Only show blocking error if we HAVE NO DATA YET
                    if (allKlinesRef.current.length === 0) {
                        setError(`Bağlantı hatası: ${apiSymbol}`);
                    } else {
                        // Background sync failed, show subtle warning instead
                        setSyncError(true);
                        // Reset sync error after some time to avoid permanent warning
                        setTimeout(() => setSyncError(false), 5000);
                    }
                }
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const fetchHistory = async () => {
            if (isHistoryLoadingRef.current || allKlinesRef.current.length === 0) return;
            isHistoryLoadingRef.current = true;
            setHistoryLoading(true);

            const apiSymbol = symbol.replace('/', '');
            const firstCandle = allKlinesRef.current[0];
            const endTime = (firstCandle.time as number) * 1000 - 1; // 1ms before first candle

            try {
                const data = await fetchKlines(apiSymbol, timeframe, 500, undefined, endTime);
                if (!isMounted) return;

                if (data && Array.isArray(data) && data.length > 0) {
                    const historicalKlines: CandleData[] = (data as RawCandle[])
                        .filter((d): d is RawCandle => !!(d && d.time !== undefined))
                        .map(d => ({
                            time: d.time as Time,
                            open: Number(d.open),
                            high: Number(d.high),
                            low: Number(d.low),
                            close: Number(d.close),
                        }));
                    
                    const historicalVolume = (data as RawCandle[])
                        .filter((d): d is RawCandle => !!(d && d.time !== undefined && d.volume !== undefined))
                        .map(d => ({
                            time: d.time as Time,
                            value: Number(d.volume || 0),
                            color: Number(d.close) >= Number(d.open) ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)',
                        }));

                    updateSeriesData(historicalKlines, historicalVolume, 'prepend');
                }
            } catch (err) {
                console.error('[SmartChart] History fetch error:', err);
            } finally {
                isHistoryLoadingRef.current = false;
                setHistoryLoading(false);
            }
        };

        // Subscription for visible range changes (coordinates and history loading)
        let rangeListener: ((range: LogicalRange | null) => void) | null = null;
        if (chartRef.current) {
            rangeListener = (range: LogicalRange | null) => {
                if (isMounted) triggerCoordSync();
                if (range && range.from < 10) {
                    fetchHistory();
                }
            };
            chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(rangeListener);
        }

        fetchData(true); // Initial/Symbol change load: Focus
        const refreshInterval = setInterval(() => fetchData(false), 5000); // Faster background refresh (5s)

        // Real-time pulse from MarketKernel
        const formattedSym = symbol.replace('/', '');
        core.market.setSymbols([formattedSym]);
        const unsubscribeMarket = core.market.subscribe((updates) => {
            const update = updates[formattedSym];
            if (update && seriesRef.current && isMounted) {
                const candlestickSeries = seriesRef.current;
                const price = Number(update.price);
                if (price > 0) {
                    setLastClose(price);
                    if (onMarketPriceUpdate) onMarketPriceUpdate(price);
                }

                // Update the very last candle visually
                const candlestickSeconds = TIMEFRAME_SECONDS[timeframe] || 3600;
                const nowTotalSeconds = Math.floor(Date.now() / 1000);
                
                // Determine currentBarTime robustly: 
                // We use the ideal alignment based on clock, BUT we respect the last known candle's offset
                // (crucial for timeframes like 1w which might not start on Unix epoch boundaries)
                const lastKnownTime = allKlinesRef.current.length > 0 
                    ? Number(allKlinesRef.current[allKlinesRef.current.length - 1].time) 
                    : 0;
                
                let currentBarTime: number;
                if (lastKnownTime > 0) {
                    const offset = lastKnownTime % candlestickSeconds;
                    const ideal = Math.floor((nowTotalSeconds - offset) / candlestickSeconds) * candlestickSeconds + offset;
                    currentBarTime = Math.max(ideal, lastKnownTime);
                } else {
                    currentBarTime = Math.floor(nowTotalSeconds / candlestickSeconds) * candlestickSeconds;
                }

                const lastCandle = lastCandleRef.current;
                
                if (isMounted) {
                    if (lastCandle && Number(lastCandle.time) === currentBarTime) {
                        // Update existing bar
                        const updatedCandle = {
                            ...lastCandle,
                            close: price,
                            high: Math.max(lastCandle.high, price),
                            low: Math.min(lastCandle.low, price),
                        };
                        candlestickSeries.update(updatedCandle);
                        lastCandleRef.current = updatedCandle;
                        
                        // Sync internal ref
                        if (allKlinesRef.current.length > 0 && Number(allKlinesRef.current[allKlinesRef.current.length-1].time) === currentBarTime) {
                            allKlinesRef.current[allKlinesRef.current.length - 1] = updatedCandle;
                        }
                    } else if (!lastCandle || currentBarTime > Number(lastCandle.time)) {
                        // Create NEW bar born from pulses
                        const newBar = {
                            time: currentBarTime as Time,
                            open: price,
                            high: price,
                            low: price,
                            close: price,
                        };
                        candlestickSeries.update(newBar);
                        lastCandleRef.current = newBar;
                        
                        // Append to internal ref without duplicates
                        allKlinesRef.current = [
                            ...allKlinesRef.current.filter(k => Number(k.time) < currentBarTime), 
                            newBar
                        ];
                    }
                }
            }
        });

        return () => {
            isMounted = false;
            clearInterval(refreshInterval);
            unsubscribeMarket();
            if (chartRef.current && rangeListener) {
                chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(rangeListener);
            }
        };
    }, [isChartReady, symbol, timeframe, onMarketPriceUpdate, focusOnPrices, triggerCoordSync]);

    // Unified Chart Update Function (Zones + Coords)
    const refreshChartOverlays = useCallback(() => {
        if (!chartRef.current || !seriesRef.current || !isChartReady || isUpdatingOverlaysRef.current) return;
        
        isUpdatingOverlaysRef.current = true;
        try {
            const series = seriesRef.current;
            const chart = chartRef.current;
            const buy = localPricesRef.current.buy;
            const tp = localPricesRef.current.tp;
            const sl = localPricesRef.current.sl;
            
            if (typeof buy !== 'number' || isNaN(buy)) return;

            // 1. Sync Labels (React side)
            const buyCoord = series.priceToCoordinate(buy);
            const tpCoord = (tpEnabled && typeof tp === 'number') ? series.priceToCoordinate(tp) : null;
            const slCoord = (slEnabled && typeof sl === 'number') ? series.priceToCoordinate(sl) : null;

            const newCoords = {
                buy: buyCoord ?? undefined,
                tp: tpCoord ?? undefined,
                sl: slCoord ?? undefined
            };
            setLineCoords(prev => {
                if (prev.buy === newCoords.buy && prev.tp === newCoords.tp && prev.sl === newCoords.sl) return prev;
                return newCoords;
            });

            // 2. Sync Background Zones (Chart side)
            const timeScale = chart.timeScale();
            const range = timeScale.getVisibleRange();
            if (range && range.from && range.to) {
                // Stabilization: conversion logic for numeric and object timestamps
                const toSecs = (t: Time): number => {
                    if (typeof t === 'number') return t;
                    if (t && typeof t === 'object' && 'timestamp' in t) return (t as { timestamp: number }).timestamp;
                    return 0;
                };

                const fromNum = toSecs(range.from);
                const toNum = toSecs(range.to);
                
                if (isNaN(fromNum) || isNaN(toNum) || fromNum === 0) return;

                const tStart = (fromNum - 10000) as Time;
                const tEnd = (toNum + 10000) as Time;

                if (tpFillRef.current && tpEnabled) {
                    tpFillRef.current.applyOptions({ baseValue: { type: 'price', price: buy } });
                    tpFillRef.current.setData([{ time: tStart, value: tp }, { time: tEnd, value: tp }]);
                }
                if (slFillRef.current && slEnabled) {
                    slFillRef.current.applyOptions({ baseValue: { type: 'price', price: buy } });
                    slFillRef.current.setData([{ time: tStart, value: sl }, { time: tEnd, value: sl }]);
                }
            }
        } finally {
            isUpdatingOverlaysRef.current = false;
        }
    }, [isChartReady, tpEnabled, slEnabled]);

    // Subscriptions for timescale changes to keep overlays in sync
    useEffect(() => {
        if (!isChartReady || !chartRef.current) return;
        const chart = chartRef.current;
        const handleScaleChange = () => refreshChartOverlays();
        chart.timeScale().subscribeVisibleLogicalRangeChange(handleScaleChange);
        return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleScaleChange);
    }, [isChartReady, refreshChartOverlays]);

    // Update markers and trigger overlay refresh on price changes
    useEffect(() => {
        if (!seriesRef.current || !isChartReady) return;
        const series = seriesRef.current;

        const updateMarkerLine = (lineRef: React.MutableRefObject<IPriceLine | null>, price: number, color: string, title: string, enabled: boolean, style: number = LineStyle.Solid) => {
            if (!enabled || price <= 0) {
                if (lineRef.current) { series.removePriceLine(lineRef.current); lineRef.current = null; }
                return;
            }
            if (lineRef.current) {
                lineRef.current.applyOptions({ price, color, lineStyle: style, title });
            } else {
                lineRef.current = series.createPriceLine({ price, color, lineWidth: 2, lineStyle: style, axisLabelVisible: true, title });
            }
        };

        // Current market price marker
        updateMarkerLine(currentPriceLineRef, currentPrice, '#fbbf24', 'Fiyat', true, LineStyle.Dashed);

        // Manage Profit/Risk Area Series Lifecycle
        const chart = chartRef.current!;
        if (tpEnabled && localPrices.tp > localPrices.buy) {
            if (!tpFillRef.current) {
                tpFillRef.current = chart.addSeries(BaselineSeries, {
                    baseValue: { type: 'price', price: localPrices.buy },
                    topFillColor1: 'rgba(16, 185, 129, 0.15)', topFillColor2: 'rgba(16, 185, 129, 0.05)',
                    bottomFillColor1: 'transparent', bottomFillColor2: 'transparent',
                    lineVisible: false, lastValueVisible: false, priceLineVisible: false, autoscaleInfoProvider: () => null
                });
            }
        } else if (tpFillRef.current) {
            chart.removeSeries(tpFillRef.current);
            tpFillRef.current = null;
        }

        if (slEnabled && localPrices.sl < localPrices.buy) {
            if (!slFillRef.current) {
                slFillRef.current = chart.addSeries(BaselineSeries, {
                    baseValue: { type: 'price', price: localPrices.buy },
                    topFillColor1: 'transparent', topFillColor2: 'transparent',
                    bottomFillColor1: 'rgba(244, 63, 94, 0.15)', bottomFillColor2: 'rgba(244, 63, 94, 0.05)',
                    lineVisible: false, lastValueVisible: false, priceLineVisible: false, autoscaleInfoProvider: () => null
                });
            }
        } else if (slFillRef.current) {
            chart.removeSeries(slFillRef.current);
            slFillRef.current = null;
        }

        refreshChartOverlays();
    }, [isChartReady, tpEnabled, slEnabled, currentPrice, localPrices.buy, localPrices.tp, localPrices.sl, refreshChartOverlays]);

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

        const isProcessing = { current: false };
        const onMouseMove = (param: MouseEventParams) => {
            if (!chartRef.current || !seriesRef.current || allKlinesRef.current.length === 0) return;
            if (isProcessing.current) return;
            isProcessing.current = true;

            try {
                if (draggingLine && param.point) {
                    const series = seriesRef.current;
                    const price = series.coordinateToPrice(param.point.y);
                    if (price !== null) {
                        const rounded = Number(price.toFixed(6));
                        
                        // 1. Immediate Ref sync for next frame
                        localPricesRef.current = { ...localPricesRef.current, [draggingLine]: rounded };
                        
                        // 2. Parent Sync
                        propsRef.current.onPricesChange({ [draggingLine]: rounded });
                    }
                }
                
                if (chartContainerRef.current && param.point && allKlinesRef.current.length > 0) {
                    const series = seriesRef.current;
                    const { buyPrice: b, tpPrice: t, slPrice: s, tpEnabled: te, slEnabled: se } = propsRef.current;
                    const buyY = series.priceToCoordinate(Number(b)) || -100;
                    const tpY = te ? (series.priceToCoordinate(Number(t)) || -100) : -100;
                    const slY = se ? (series.priceToCoordinate(Number(s)) || -100) : -100;
                    
                    const distY = (y: number) => Math.abs(param.point!.y - y);
                    const over = distY(buyY) < 30 || distY(tpY) < 30 || distY(slY) < 30;
                    chartContainerRef.current.style.cursor = over || draggingLine ? 'ns-resize' : 'crosshair';
                }
            } finally {
                isProcessing.current = false;
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

    // Helper: % distance from current price
    const pctFromCurrent = (price: number) => {
        if (currentPrice <= 0) return 0;
        return ((price / currentPrice) - 1) * 100;
    };

    return (
        <div className="w-full space-y-4 select-none">
            {/* Chart Header: Price and Timeframe */}
            <div className="flex items-end justify-between px-1">
                {/* Current Price Indicator */}
                <div className="flex items-center gap-6">
                    {currentPrice > 0 ? (
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-800/50">
                            <div className="relative group/asset">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-500/20 to-transparent rounded-full blur-md opacity-0 group-hover/asset:opacity-100 transition-opacity duration-500" />
                                <AssetIcon symbol={symbol} size={42} className="relative z-10 shadow-2xl" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{symbol}</span>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                                    <span className="text-base font-black text-amber-400 font-mono">
                                        {currentPrice > 0 
                                            ? (currentPrice < 1 ? currentPrice.toFixed(4) : currentPrice < 100 ? currentPrice.toFixed(2) : currentPrice.toFixed(0))
                                            : '---'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[42px] flex items-center pr-6 border-r border-slate-800/50">
                            <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}

                    {/* Active Assets Horizontal Scroll */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[50vw]">
                        {assets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => onAssetChange?.(asset)}
                                className={cn(
                                    "flex items-center gap-3 p-1.5 pr-4 rounded-xl border transition-all relative group h-[44px] min-w-fit",
                                    symbol.split('/')[0] === asset.symbol 
                                        ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]" 
                                        : "bg-slate-900/40 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50"
                                )}
                            >
                                <div className="relative">
                                    <AssetIcon symbol={asset.symbol} size={28} />
                                    {symbol.startsWith(asset.symbol) && (
                                        <div className="absolute -top-1 -right-1">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-start">
                                    <div className="text-[10px] font-black text-white leading-none mb-1">{asset.symbol}</div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{asset.holding.toFixed(asset.holding < 1 ? 4 : 2)}</span>
                                        <span className="text-[9px] font-black text-emerald-400 font-mono group-hover:block hidden">${asset.price.toLocaleString()}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeframe Selector Moved Outside */}
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Zaman Dilimi</span>
                    <div className="flex gap-1 p-1 bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-xl">
                        {TIMEFRAMES.map((tf) => (
                            <button
                                key={tf.value}
                                onClick={() => setTimeframe(tf.value)}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                    timeframe === tf.value
                                        ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                                        : 'text-slate-500 hover:text-white hover:bg-slate-800'
                                )}
                            >
                                {tf.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="relative group/chart">

            <div ref={chartContainerRef} className="w-full h-[500px] bg-slate-950/20 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl" />
            {syncError && allKlinesRef.current.length > 0 && (
                <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-rose-500/20 border border-rose-500/40 backdrop-blur-md rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Senkronizasyon Sorunu</span>
                </div>
            )}

            {isLoading && !error && (
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

            {historyLoading && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 backdrop-blur-md rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-tighter">Geçmiş Yükleniyor...</span>
                </div>
            )}





            {/* Enhanced Price Labels with trailing toggles and % */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {Object.entries(lineCoords).map(([key, coord]) => {
                    if (coord === undefined) return null;
                    
                    let label = '';
                    if (key === 'buy') label = mode === 'TRADE' ? 'Giriş (Al)' : 'Giriş (Sat)';
                    else if (key === 'tp') label = 'Hedef';
                    else label = 'Stop';
                    
                    // Append trailing indicator suffix with deviation
                    if (key === 'buy' && trailingBuy) label += ` ⟐TB ${trailingBuyDev.toFixed(1)}%`;
                    else if (key === 'tp' && trailingTp) label += ` ⟐TTP ${Math.abs(trailingTpDev).toFixed(1)}%`;
                    else if (key === 'sl' && trailingSl) label += ` ⟐TSL ${Math.abs(trailingSlDev).toFixed(1)}%`;

                    const bgColor = key === 'buy' ? 'bg-cyan-500' : key === 'tp' ? 'bg-emerald-500' : 'bg-rose-500';
                    const bgGlow = key === 'buy' ? 'shadow-cyan-500/30' : key === 'tp' ? 'shadow-emerald-500/30' : 'shadow-rose-500/30';
                    const lineColor = key === 'buy' ? 'border-cyan-500/40' : key === 'tp' ? 'border-emerald-500/40' : 'border-rose-500/40';
                    const price = localPrices[key as keyof typeof localPrices];
                    const pctDist = pctFromCurrent(price);
                    const isTrailing = key === 'buy' ? trailingBuy : key === 'tp' ? trailingTp : trailingSl;
                    const onToggleTrailing = key === 'buy' ? onTrailingBuyChange : key === 'tp' ? onTrailingTpChange : onTrailingSlChange;

                    return (
                        <div key={key} className="absolute inset-x-0 transition-all duration-150" style={{ top: Math.max(20, Math.min(480, coord)) }}>
                            {/* Full-width dashed horizontal line */}
                            <div className={`absolute left-0 right-0 border-t border-dashed ${lineColor}`} style={{ top: 0 }} />
                            
                            <div className="absolute left-4 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
                                {/* Drag Handle + Label */}
                                <div 
                                    onMouseDown={(e) => { e.preventDefault(); setDraggingLine(key as 'buy' | 'tp' | 'sl'); }}
                                    className={`flex items-center ${bgColor} rounded-lg shadow-xl ${bgGlow} cursor-ns-resize hover:scale-105 transition-transform active:scale-95`}
                                >
                                    <div className="px-2 py-1 text-[9px] font-black text-white/90 uppercase border-r border-white/20">{label}</div>
                                    <div className="px-2 py-1 text-[10px] font-bold text-white font-mono tracking-tighter">{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                                </div>

                                {/* % Distance Badge */}
                                <div className={`px-1.5 py-1 rounded-md text-[8px] font-black font-mono shadow-lg backdrop-blur-md ${pctDist >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                    {pctDist >= 0 ? '+' : ''}{pctDist.toFixed(2)}%
                                </div>

                                {/* Trailing Toggle Micro-Button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onToggleTrailing(!isTrailing); }}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isTrailing 
                                            ? 'border-cyan-400 bg-cyan-400' 
                                            : 'border-slate-600 bg-slate-900/80 hover:border-slate-500'
                                    }`}
                                    title={`Trailing ${label}`}
                                >
                                    <span className={`text-[7px] font-black ${isTrailing ? 'text-slate-950' : 'text-slate-400'}`}>T</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>


            </div>

            {/* Chart Footer: Focus Button */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={focusOnPrices} 
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/50 text-[10px] font-black text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400/30 transition-all backdrop-blur-md group/focus"
                    >
                        <Target className="w-4 h-4 group-hover/focus:scale-125 transition-transform" />
                        ODAKLA (FİYATA HIZALA)
                    </button>

                </div>
                
                <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2 pr-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    Matrix Pro Trading Engine v3.0
                </div>
            </div>
        </div>
    );
};
