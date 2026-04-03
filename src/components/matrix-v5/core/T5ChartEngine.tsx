import React, { useEffect, useRef } from "react";
import { DataService } from "./data";
import type { Trade } from "./data";
import { T5 } from "./t5";

interface ViewportState {
    startTime: number;
    endTime: number;
}

interface Candle {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    buyVol: number;
    sellVol: number;
}

export const T5ChartEngine = ({ dataService, duration, onVisibleTimeRangeChanged, syncViewport }: { 
    dataService: DataService, 
    duration: number, 
    onVisibleTimeRangeChanged: (start: number, end: number, isUserInteraction?: boolean) => void,
    syncViewport?: ViewportState | null
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<T5 | null>(null);
    const lastSyncRef = useRef<ViewportState | null>(null);
    const isInteractingRef = useRef(false);
    
    // Smooth Viewport Refs
    const smoothMinPRef = useRef<number | null>(null);
    const smoothMaxPRef = useRef<number | null>(null);
    const smoothEndTimeRef = useRef<number | null>(null);
    const durationMsRef = useRef(duration * 1000);

    const onSyncRef = useRef(onVisibleTimeRangeChanged);
    useEffect(() => {
        onSyncRef.current = onVisibleTimeRangeChanged;
    }, [onVisibleTimeRangeChanged]);

    useEffect(() => {
        if (!containerRef.current) return;

        const engine = new T5(containerRef.current);
        engineRef.current = engine;

        engine.draw = () => {
            const trades = dataService.list;
            if (trades.length === 0) {
                renderPlaceholder(engine);
                return;
            }

            // 1. Viewport Time Logic (Smooth Sliding)
            updateViewportTime(engine, dataService, durationMsRef, isInteractingRef, smoothEndTimeRef, (s: number, e: number, u: boolean) => onSyncRef.current(s, e, u));

            // 2. Data Processing (Binary Search + Single-pass Analysis)
            const visibleData = processVisibleTrades(engine, trades, dataService.threshold || 0);
            
            // 3. Vertical Range Smoothing (Price Lerp)
            updateViewportPrice(engine, visibleData.minP, visibleData.maxP, smoothMinPRef, smoothMaxPRef);

            // 4. Rendering Sequence
            renderBackground(engine);
            renderGridAndAxes(engine);
            renderCandlesAndBubbles(engine, visibleData.candles, visibleData.labelThreshold);
            renderCrosshair(engine);
        };

        const renderPlaceholder = (e: T5) => {
            e.background('#131722');
            e.fill('#787b86');
            e.textAlign('center', 'middle');
            e.textSize(14);
            e.text('Gathering data for T5 Engine...', e.width / 2, e.height / 2);
        };

        const updateViewportTime = (
            e: T5, 
            ds: DataService, 
            durRef: React.MutableRefObject<number>, 
            interactRef: React.MutableRefObject<boolean>, 
            smoothEndRef: React.MutableRefObject<number | null>, 
            onSync: (s: number, end: number, user: boolean) => void
        ) => {
            const now = Date.now();
            const latestT = ds.list.length > 0 ? ds.list[ds.list.length - 1].T : now;

            if (e.viewport.endTime === 0) {
                e.viewport.endTime = now;
                e.viewport.startTime = now - durRef.current;
                smoothEndRef.current = e.viewport.endTime;
            } else if (ds.state === 2 && !interactRef.current) {
                // Always auto-scroll forward with live data regardless of sync state.
                // The sync viewport only sets initial position; live scrolling must continue.
                const targetEnd = Math.max(now, latestT);
                if (smoothEndRef.current === null) smoothEndRef.current = e.viewport.endTime;
                
                // Temporal Lerp for buttery smooth scrolling
                const timeLerp = 0.08; 
                const oldEnd = e.viewport.endTime;
                smoothEndRef.current += (targetEnd - smoothEndRef.current) * timeLerp;
                
                if (Math.abs(smoothEndRef.current - oldEnd) > 1) {
                    const currentDuration = e.viewport.endTime - e.viewport.startTime;
                    e.viewport.endTime = smoothEndRef.current;
                    e.viewport.startTime = e.viewport.endTime - currentDuration;
                    
                    // Throttled notification: only sync others every ~100ms (10fps)
                    // This prevents React state spam while keeping visual drift minimal
                    const nowT = Date.now();
                    if (!e.lastSyncTime || nowT - e.lastSyncTime > 100) {
                        e.lastSyncTime = nowT;
                        onSync(e.viewport.startTime, e.viewport.endTime, false);
                    }
                }
            }
        };

        const processVisibleTrades = (e: T5, trades: Trade[], baseThreshold: number) => {
            let startIndex = 0;
            let ld = 0, hd = trades.length - 1;
            while (ld <= hd) {
                const mid = Math.floor((ld + hd) / 2);
                if (trades[mid].T < e.viewport.startTime) { ld = mid + 1; startIndex = ld; }
                else hd = mid - 1;
            }

            let minP = Infinity, maxP = -Infinity;
            const candles: Candle[] = [];
            const BUCKET_MS = 1000;
            
            let curBucket: Candle | null = null;
            
            for (let i = startIndex; i < trades.length; i++) {
                const t = trades[i];
                if (t.T > e.viewport.endTime) break;
                
                // Price Range
                if (t.p < minP) minP = t.p;
                if (t.p > maxP) maxP = t.p;

                // Candle Aggregation
                const bTime = Math.floor(t.T / BUCKET_MS) * BUCKET_MS;
                const price = t.p;
                const vol = price * t.q;

                if (!curBucket || bTime !== curBucket.time) {
                    if (curBucket) candles.push(curBucket);
                    curBucket = {
                        time: bTime, open: price, high: price, low: price, close: price,
                        buyVol: t.side === 1 ? vol : 0, sellVol: t.side === 0 ? vol : 0
                    };
                } else {
                    curBucket.high = Math.max(curBucket.high, price);
                    curBucket.low = Math.min(curBucket.low, price);
                    curBucket.close = price;
                    if (t.side === 1) curBucket.buyVol += vol;
                    else curBucket.sellVol += vol;
                }
            }
            if (curBucket) candles.push(curBucket);
            
            return { minP, maxP, candles, labelThreshold: Math.max(baseThreshold, 25000) };
        };

        const updateViewportPrice = (e: T5, minP: number, maxP: number, sMin: React.MutableRefObject<number | null>, sMax: React.MutableRefObject<number | null>) => {
            if (minP === Infinity) return;
            const pad = (maxP - minP) * 0.15 || 0.01;
            const targetMin = minP - pad;
            const targetMax = maxP + pad;

            if (sMin.current === null || sMax.current === null) {
                sMin.current = targetMin; sMax.current = targetMax;
            } else {
                const priceLerp = 0.25;
                sMin.current += (targetMin - sMin.current) * priceLerp;
                sMax.current += (targetMax - sMax.current) * priceLerp;
            }
            e.viewport.minPrice = sMin.current!;
            e.viewport.maxPrice = sMax.current!;
        };

        const renderBackground = (e: T5) => {
            e.background('#131722');
            e.fill('#1e222d');
            e.rect(Math.round(e.width - e.viewport.padding.right), 0, e.viewport.padding.right, e.height);
            e.rect(0, Math.round(e.height - e.viewport.padding.bottom), e.width, e.viewport.padding.bottom);
        };

        const renderGridAndAxes = (e: T5) => {
            e.fill('#787b86');
            e.textSize(10);
            
            // Price Grid & Labels
            const pRange = e.viewport.maxPrice - e.viewport.minPrice;
            if (pRange > 0) {
                const step = calculateStep(pRange);
                const firstLabel = Math.ceil(e.viewport.minPrice / step) * step;
                e.textAlign('left', 'middle');
                for (let p = firstLabel; p <= e.viewport.maxPrice; p += step) {
                    const py = Math.round(e.priceToY(p));
                    e.text(p.toFixed(2), e.width - e.viewport.padding.right + 10, py);
                    drawGridLine(e, 0, py, e.width - e.viewport.padding.right, py);
                }
            }

            // Time Grid & Labels
            const tRange = e.viewport.endTime - e.viewport.startTime;
            const tStep = Math.max(1000, Math.floor(tRange / 6 / 1000) * 1000);
            const firstT = Math.ceil(e.viewport.startTime / tStep) * tStep;
            e.textAlign('center', 'top');
            for (let t = firstT; t <= e.viewport.endTime; t += tStep) {
                const tx = Math.round(e.timeToX(t));
                const d = new Date(t);
                const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
                e.text(timeStr, tx, e.height - e.viewport.padding.bottom + 8);
                drawGridLine(e, tx, 0, tx, e.height - e.viewport.padding.bottom);
            }
        };

        const calculateStep = (range: number) => {
            const raw = range / 6;
            const mag = Math.pow(10, Math.floor(Math.log10(raw)));
            const norm = raw / mag;
            if (norm > 5) return 5 * mag;
            if (norm > 2) return 2 * mag;
            return mag;
        };

        const drawGridLine = (e: T5, x1: number, y1: number, x2: number, y2: number) => {
            e.ctx.beginPath();
            e.ctx.moveTo(x1, y1); e.ctx.lineTo(x2, y2);
            e.ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            e.ctx.stroke();
        };

        const renderCandlesAndBubbles = (e: T5, candles: Candle[], threshold: number) => {
            const candleWidth = 6;
            for (const c of candles) {
                const cx = Math.round(e.timeToX(c.time));
                e.candle(cx, c.open, c.high, c.low, c.close, '#089981', '#f23645', candleWidth);
                
                const totalVol = c.buyVol + c.sellVol;
                if (totalVol >= threshold) {
                    const isBuy = c.buyVol >= c.sellVol;
                    const txt = formatVol(totalVol);
                    const relSize = totalVol / (threshold * 2);
                    const radius = Math.max(12, Math.min(22, 10 + relSize * 3));
                    const pY = Math.round(isBuy ? e.priceToY(c.low) + radius + 8 : e.priceToY(c.high) - radius - 8);
                    
                    e.ctx.beginPath();
                    e.ctx.arc(cx, pY, radius, 0, Math.PI * 2);
                    e.ctx.fillStyle = isBuy ? 'rgba(8, 153, 129, 0.9)' : 'rgba(242, 54, 69, 0.9)';
                    e.ctx.fill();
                    e.ctx.fillStyle = '#ffffff';
                    e.ctx.font = 'bold 10px Inter, sans-serif';
                    e.ctx.textAlign = 'center'; e.ctx.textBaseline = 'middle';
                    e.ctx.fillText(txt, cx, pY);
                }
            }
        };

        const formatVol = (v: number) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'k' : v.toFixed(0);

        const renderCrosshair = (e: T5) => {
            if (e.mouseX > 0 && e.mouseX < e.width - e.viewport.padding.right && e.mouseY < e.height - e.viewport.padding.bottom) {
                e.stroke('rgba(255, 255, 255, 0.4)');
                e.strokeWeight(1);
                e.line(Math.round(e.mouseX), 0, Math.round(e.mouseX), e.height - e.viewport.padding.bottom);
                e.line(0, Math.round(e.mouseY), e.width - e.viewport.padding.right, Math.round(e.mouseY));
            }
        };

        engine.mouseDragged = () => {
             const dx = engine.mouseX - engine.pmouseX;
             const dur = engine.viewport.endTime - engine.viewport.startTime;
             const windowWidth = engine.width - engine.viewport.padding.left - engine.viewport.padding.right;
             const timeShift = (dx / windowWidth) * dur;
             engine.viewport.startTime -= timeShift;
             engine.viewport.endTime -= timeShift;
             smoothEndTimeRef.current = engine.viewport.endTime;
             onSyncRef.current(engine.viewport.startTime, engine.viewport.endTime, true);
        };

        engine.init();

        const handleDown = () => isInteractingRef.current = true;
        const handleUp = () => isInteractingRef.current = false;
        
        let wheelTimeout: ReturnType<typeof setTimeout>;
        const handleWheel = (ev: WheelEvent) => {
             ev.preventDefault();
             isInteractingRef.current = true;
             clearTimeout(wheelTimeout);
             wheelTimeout = setTimeout(() => { isInteractingRef.current = false; }, 2000);
             
             const zoomF = 1.1;
             const engine = engineRef.current;
             if (!engine) return;
             
             const dur = engine.viewport.endTime - engine.viewport.startTime;
             const mouseT = engine.xToTime(engine.mouseX);
             const chartW = engine.width - engine.viewport.padding.left - engine.viewport.padding.right;
             const ratio = (engine.mouseX - engine.viewport.padding.left) / chartW;
             
             const nextDur = ev.deltaY > 0 ? dur * zoomF : dur / zoomF;
             engine.viewport.startTime = mouseT - (nextDur * ratio);
             engine.viewport.endTime = engine.viewport.startTime + nextDur;
             smoothEndTimeRef.current = engine.viewport.endTime;
             
             onSyncRef.current(engine.viewport.startTime, engine.viewport.endTime, true);
        };

        const container = containerRef.current;
        container?.addEventListener('mousedown', handleDown);
        window.addEventListener('mouseup', handleUp);
        container?.addEventListener('wheel', handleWheel, { passive: false });
        container?.addEventListener('touchstart', handleDown, { passive: true });
        window.addEventListener('touchend', handleUp);

        return () => {
            container?.removeEventListener('mousedown', handleDown);
            window.removeEventListener('mouseup', handleUp);
            container?.removeEventListener('wheel', handleWheel);
            container?.removeEventListener('touchstart', handleDown);
            window.removeEventListener('touchend', handleUp);
            clearTimeout(wheelTimeout);
            engine.destroy();
        };
    }, [dataService]);

    // Update duration ref when prop changes, don't restart engine
    useEffect(() => {
        durationMsRef.current = duration * 1000;
    }, [duration]);

    // Handle syncViewport from other charts (but NOT our own broadcasts)
    useEffect(() => {
        if (!engineRef.current || !syncViewport) return;
        
        // Skip if this is the same viewport we already have (e.g., our own broadcast coming back)
        const lastVP = lastSyncRef.current;
        if (lastVP && lastVP.startTime === syncViewport.startTime && lastVP.endTime === syncViewport.endTime) return;
        lastSyncRef.current = { startTime: syncViewport.startTime, endTime: syncViewport.endTime };
        
        // Only snap viewport if user is actively interacting with another chart 
        // (i.e., NOT during auto-scroll). During live mode, each chart auto-scrolls independently.
        if (isInteractingRef.current) return; // We're the ones interacting, skip
        
        // Check if this is a big jump (e.g., generate was clicked or timeframe changed)
        const currentEnd = engineRef.current.viewport.endTime;
        const drift = Math.abs(currentEnd - syncViewport.endTime);
        
        // Only snap on large jumps (> 2 seconds), not small auto-scroll differences
        if (drift > 2000) {
            engineRef.current.viewport.startTime = syncViewport.startTime;
            engineRef.current.viewport.endTime = syncViewport.endTime;
            smoothEndTimeRef.current = syncViewport.endTime;
        }
    }, [syncViewport]);

    return <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />;
};
