import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, type IChartApi, type ISeriesApi, type Time, CrosshairMode } from "lightweight-charts";
import { DataService } from "./data";

interface ViewportState {
    startTime: number;
    endTime: number;
}

interface TradeData {
    T: number;
    p: number;
    q: number;
    side: number;
}

interface CandleData {
    time: Time;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface VolumeData {
    time: Time;
    value: number;
    color: string;
    customValues: { buyVol: number; sellVol: number };
}

interface MarkerData {
    time: Time;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'circle' | 'arrowUp' | 'arrowDown';
    text: string;
    size: number;
    priceValue: number;
}

interface Props {
    dataService: DataService;
    aggregated: boolean;
    syncViewport: ViewportState | null;
    onVisibleTimeRangeChanged: (start: number, end: number, isUserInteraction?: boolean) => void;
}

export const LightweightChartEngine: React.FC<Props> = ({ dataService, syncViewport, onVisibleTimeRangeChanged }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const markersContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const lastSyncViewportRef = useRef<ViewportState | null>(null);
    const lastAppliedViewportRef = useRef<ViewportState | null>(null);
    
    // Using proper candlestick series for TradingView look
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

    const formatData = (trades: TradeData[], threshold: number) => {
        if (!trades || trades.length === 0) return { candles: [] as CandleData[], volumes: [] as VolumeData[], markers: [] as MarkerData[] };
        
        // Ensure chronological
        const sorted = [...trades].sort((a, b) => a.T - b.T);
        
        const candlesMap = new Map<number, CandleData>();
        const volumesMap = new Map<number, VolumeData>();
        const markersMap = new Map<number, MarkerData>();

        // 1-second candles for native-like feel
        const BUCKET_SECONDS = 1; 
        const labelThreshold = Math.max(threshold, 25000);

        for (const t of sorted) {
            // Validate timestamps to avoid NaN breaking the chart
            if (typeof t.T !== 'number' || isNaN(t.T)) continue;

            const timeS = Math.floor(t.T / 1000); // Seconds
            const bucketKey = Math.floor(timeS / BUCKET_SECONDS) * BUCKET_SECONDS; // Snap to bucket

            const price = t.p;
            const vol = price * t.q;
            
            if (!candlesMap.has(bucketKey)) {
                candlesMap.set(bucketKey, {
                    time: bucketKey as Time,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                });

                volumesMap.set(bucketKey, {
                    time: bucketKey as Time,
                    value: vol,
                    color: t.side === 1 ? 'rgba(8, 153, 129, 0.8)' : 'rgba(242, 54, 69, 0.8)',
                    customValues: { buyVol: t.side === 1 ? vol : 0, sellVol: t.side === 0 ? vol : 0 }
                });
            } else {
                const candle = candlesMap.get(bucketKey);
                if (candle) {
                    candle.high = Math.max(candle.high, price);
                    candle.low = Math.min(candle.low, price);
                    candle.close = price; // Update close continuously
                }

                const volume = volumesMap.get(bucketKey);
                if (volume) {
                    volume.value += vol;
                    if (t.side === 1) volume.customValues.buyVol += vol;
                    else volume.customValues.sellVol += vol;
                    
                    // Color dominant volume
                    volume.color = volume.customValues.buyVol >= volume.customValues.sellVol 
                        ? 'rgba(8, 153, 129, 0.8)' 
                        : 'rgba(242, 54, 69, 0.8)';
                }
            }
            
            // Check threshold for bubble markers at this bucket
            const totalVolObj = volumesMap.get(bucketKey);
            if (totalVolObj && totalVolObj.value >= labelThreshold) {
                const totalVol = totalVolObj.value;
                const txt = totalVol >= 1e6 ? (totalVol/1e6).toFixed(1)+'M' : totalVol >= 1e3 ? (totalVol/1e3).toFixed(1)+'k' : totalVol.toFixed(0);
                const isBuyDom = totalVolObj.customValues.buyVol >= totalVolObj.customValues.sellVol;
                
                // Calculate size based on volume, similar to whale detection
                const relativeSize = totalVol / (labelThreshold * 2);
                let bubbleSize = 1;
                if (relativeSize > 2) bubbleSize = 2;
                if (relativeSize > 5) bubbleSize = 3;

                const cnd = candlesMap.get(bucketKey);
                markersMap.set(bucketKey, {
                    time: bucketKey as Time,
                    position: isBuyDom ? 'belowBar' : 'aboveBar',
                    color: isBuyDom ? '#089981' : '#f23645',
                    shape: 'circle',
                    text: txt,
                    size: bubbleSize,
                    priceValue: isBuyDom ? (cnd ? cnd.low : 0) : (cnd ? cnd.high : 0)
                });
            }
        }

        // Second pass: fill empty gaps realistically from left-to-right using chronological close propagation
        if (sorted.length > 0) {
            const minBucket = Math.floor((sorted[0].T / 1000) / BUCKET_SECONDS) * BUCKET_SECONDS;
            const maxBucket = Math.floor((sorted[sorted.length - 1].T / 1000) / BUCKET_SECONDS) * BUCKET_SECONDS;
            let currentClose = sorted[0].p;
            
            // Protect against enormous gaps crashing browser
            const expectedCount = ((maxBucket - minBucket) / BUCKET_SECONDS) + 1;
            if (expectedCount > 0 && expectedCount < 86400) {
                for (let t = minBucket; t <= maxBucket; t += BUCKET_SECONDS) {
                    if (!candlesMap.has(t)) {
                        candlesMap.set(t, { time: t as Time, open: currentClose, high: currentClose, low: currentClose, close: currentClose });
                        volumesMap.set(t, { time: t as Time, value: 0, color: 'rgba(0,0,0,0)', customValues: { buyVol: 0, sellVol: 0 } });
                    } else {
                        const c = candlesMap.get(t);
                        if (c) {
                            currentClose = c.close;
                        }
                    }
                }
            }
        }

        const candles = Array.from(candlesMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
        const volumes = Array.from(volumesMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
        const markers = Array.from(markersMap.values()).sort((a, b) => (a.time as number) - (b.time as number));

        return { candles, volumes, markers };
    };

    const list = (dataService as DataService & { list: TradeData[] }).list;
    const threshold = (dataService as DataService & { threshold: number }).threshold || 0;

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { color: '#131722' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: '#1e222d' },
                horzLines: { color: '#1e222d' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#2b2b43',
                autoScale: true,
            },
            timeScale: {
                borderColor: '#2b2b43',
                timeVisible: true,
                secondsVisible: true,
                rightOffset: 0,
                shiftVisibleRangeOnNewBar: true,
            },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#089981',
            downColor: '#f23645',
            borderDownColor: '#f23645',
            borderUpColor: '#089981',
            wickDownColor: '#f23645',
            wickUpColor: '#089981',
            priceScaleId: 'right',
        });
        
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        // Main price scale for candles (top 80%)
        chart.priceScale('right').applyOptions({
            scaleMargins: {
                top: 0.05,
                bottom: 0.25,
            },
        });

        // Volume scale at bottom (bottom 25%)
        chart.priceScale('volume').applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;

        // Track if user is actively scrolling/dragging
        chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
            if (range && range.from && range.to && isUserScrollingRef.current) {
                onVisibleTimeRangeChanged((range.from as number) * 1000, (range.to as number) * 1000, true);
            }
        });
        
        // Mouse down starts user interaction
        chartContainerRef.current?.addEventListener('mousedown', () => {
            isUserScrollingRef.current = true;
        });
        
        // Mouse up ends user interaction
        window.addEventListener('mouseup', () => {
            setTimeout(() => isUserScrollingRef.current = false, 200);
        });

        // Wheel starts user interaction (for zooming)
        chartContainerRef.current?.addEventListener('wheel', () => {
             isUserScrollingRef.current = true;
             setTimeout(() => isUserScrollingRef.current = false, 500);
        }, { passive: true });

        // Touch interactions
        chartContainerRef.current?.addEventListener('touchstart', () => {
             isUserScrollingRef.current = true;
        }, { passive: true });
        window.addEventListener('touchend', () => {
             setTimeout(() => isUserScrollingRef.current = false, 200);
        });

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        // Initial resize to ensure chart has proper size
        setTimeout(handleResize, 0);

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [onVisibleTimeRangeChanged]);

    // Handle syncViewport changes - only apply big jumps (generate, timeframe change)
    useEffect(() => {
        if (!chartRef.current || !syncViewport) return;
        
        // Skip if we already processed this exact viewport
        const lastVP = lastSyncViewportRef.current;
        if (lastVP && lastVP.startTime === syncViewport.startTime && lastVP.endTime === syncViewport.endTime) {
            return;
        }
        lastSyncViewportRef.current = { startTime: syncViewport.startTime, endTime: syncViewport.endTime };
        
        // Only snap on big viewport jumps, not on small auto-scroll diffs from T5
        // This prevents the TradingView chart from constantly being reset during live data flow
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        
        if (syncViewport.startTime > 0 && syncViewport.endTime > syncViewport.startTime) {
            // Calculate drift vs current view
            let drift = Infinity;
            if (visibleRange && visibleRange.from && visibleRange.to) {
                const currentEnd = (visibleRange.to as number) * 1000;
                drift = Math.abs(currentEnd - syncViewport.endTime);
            }
            
            // Only snap if this is a big jump (>2s) or initial sync
            if (drift > 2000) {
                try {
                    timeScale.setVisibleRange({
                        from: (syncViewport.startTime / 1000) as Time,
                        to: (syncViewport.endTime / 1000) as Time,
                    });
                } catch (e) {
                    console.warn('Failed to set visible range from syncViewport:', e);
                }
            }
        }
    }, [syncViewport]);

    // Track if viewport change came from user interaction (not auto-scroll)
    const isUserScrollingRef = useRef(false);

    // Anlık Veri Çekme (Instant Data Fetch) Modeli from T5
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current || !dataService) return;

        let frameId: number;
        let lastProcessedLength = -1;

        const syncData = () => {
            const trades = list;
            const thr = threshold;
            
            const hasNewData = trades && trades.length > 0 && trades.length !== lastProcessedLength;
            
            if (hasNewData) {
                lastProcessedLength = trades.length;
                
                if (trades.length === 0) {
                    frameId = requestAnimationFrame(syncData);
                    return;
                }
                
                const { candles, volumes, markers } = formatData(trades, thr);
                
                if (candles.length > 0) {
                    candleSeriesRef.current!.setData(candles);
                    volumeSeriesRef.current!.setData(volumes);
                    
                    if (markersContainerRef.current && chartRef.current) {
                        const timeScale = chartRef.current.timeScale();
                        const timeRange = timeScale.getVisibleLogicalRange();
                        
                        let html = '';
                        if (timeRange && timeRange.from !== null && timeRange.to !== null) {
                            for (const m of markers) {
                                // logical range gives index. We check if marker is within visible range roughly.
                                // Instead of full iteration, just draw them. lightweight-charts handles off-screen.
                                const x = timeScale.timeToCoordinate(m.time);
                                if (x !== null) {
                                    const y = candleSeriesRef.current!.priceToCoordinate(m.priceValue);
                                    if (y !== null) {
                                        const yOffset = m.position === 'aboveBar' ? -25 - (m.size * 5) : 10 + (m.size * 5);
                                        const radius = 20 + m.size * 5;
                                        const fSize = 10 + m.size * 1;
                                        html += `<div style="position: absolute; left: ${x}px; top: ${y + yOffset}px; transform: translate(-50%, -50%); background: ${m.color}; color: white; border-radius: 50%; width: ${radius}px; height: ${radius}px; display: flex; align-items: center; justify-content: center; font-size: ${fSize}px; font-weight: bold; box-shadow: 0 0 10px ${m.color}; border: 2px solid #131722;"><span style="transform: scale(0.8)">${m.text}</span></div>`;
                                    }
                                }
                            }
                        }
                        markersContainerRef.current.innerHTML = html;
                    }

                    
                    // Re-apply the desired viewport after setData to prevent
                    // lightweight-charts from auto-fitting to a tiny initial data set.
                    // Guards: skip if user is actively scrolling, and only apply once
                    // per syncViewport change to avoid redundant calls every frame.
                    const desiredVP = lastSyncViewportRef.current;
                    const appliedVP = lastAppliedViewportRef.current;
                    const vpChanged = desiredVP && (!appliedVP || appliedVP.startTime !== desiredVP.startTime || appliedVP.endTime !== desiredVP.endTime);
                    
                    if (vpChanged && !isUserScrollingRef.current && desiredVP.startTime > 0 && chartRef.current) {
                        try {
                            chartRef.current.timeScale().setVisibleRange({
                                from: (desiredVP.startTime / 1000) as Time,
                                to: (desiredVP.endTime / 1000) as Time,
                            });
                            lastAppliedViewportRef.current = { startTime: desiredVP.startTime, endTime: desiredVP.endTime };
                        } catch { /* range may be invalid if no data covers the window yet */ }
                    }
                }
            }
            frameId = requestAnimationFrame(syncData);
        };

        syncData(); // Start loop

        return () => {
             cancelAnimationFrame(frameId);
        };
    }, [dataService, list, threshold]);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div ref={chartContainerRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />
            <div ref={markersContainerRef} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 10 }} />
        </div>
    );
};
