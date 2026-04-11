"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
    createChart, 
    IChartApi, 
    ISeriesApi, 
    Time, 
    CandlestickSeries, 
    LineSeries,
    ColorType,
    CrosshairMode
} from "lightweight-charts";
import { MatrixScatterPaneView, MatrixScatterData } from "../matrix-v5/core/MatrixScatterPlugin";
import { MatrixSignalPaneView, MatrixSignalData } from "../matrix-v5/core/MatrixSignalPlugin";
import { DataService } from "../matrix-v5/core/data";
import { TechnicalIndicators } from "../matrix-v5/core/indicators";
import { F4Strategy } from "../matrix-v5/core/f4Strategy";
import { useAuth } from "@/hooks/useAuth";
import { useModuleTimeframe } from "@/context/TimeframeContext";

interface InteractiveChartProps {
  symbol: string;
}

interface WhaleAlert {
  id: string;
  symbol: string;
  volume: number;
  side: "BUY" | "SELL";
  price: number;
  time: number;
}

interface LiveTick {
  id: string;
  price: number;
  qty: number;
  vol: number;
  side: "BUY" | "SELL";
  ts: number;
}

interface OrderBookLevel {
  price: number;
  qty: number;
  side: "bid" | "ask";
}

const getWhaleTier = (vol: number) => {
  if (vol >= 500000) return { icon: "🐋", tier: "MEGA", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" };
  if (vol >= 200000) return { icon: "🦈", tier: "SHARK", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" };
  if (vol >= 100000) return { icon: "🐬", tier: "DOLPHIN", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" };
  return { icon: "🐟", tier: "FISH", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" };
};

const getInterval = (dur: number) => {
    if (dur <= 1800) return "1m";
    if (dur <= 21600) return "5m";
    if (dur <= 86400) return "15m";
    return "1h";
};

export const InteractiveChart = React.memo(({ symbol: initialSymbol }: InteractiveChartProps) => {
  const { user } = useAuth();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  // Series Refs
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const scatterSeriesRef = useRef<ISeriesApi<"Custom"> | null>(null);
  const signalSeriesRef = useRef<ISeriesApi<"Custom"> | null>(null);
  const f4SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const f4FiboSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema8SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema55SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const stSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Core State
  const [symbol, setSymbol] = useState(initialSymbol);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(500000);
  
  const [moduleTf, setModuleTf] = useModuleTimeframe("5m");
  const duration = React.useMemo(() => {
      switch(moduleTf) {
          case "1m": return 60;
          case "5m": return 300;
          case "15m": return 900;
          case "1h": return 3600;
          case "4h": return 14400;
          case "12h": return 43200;
          case "1d": return 86400;
          case "3d": return 259200;
          case "1w": return 604800;
          case "1Mo": return 2592000;
          default: return 300;
      }
  }, [moduleTf]);

  const [exchange, setExchange] = useState<string>("ALL");
  const [showIndicators, setShowIndicators] = useState<boolean>(true);
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showSupertrend, setShowSupertrend] = useState<boolean>(true);
  const [showBB, setShowBB] = useState<boolean>(true);
  const [showOrderBook, setShowOrderBook] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pine Script indicators state (SMC HUD)
  const [stDirection, setStDirection] = useState<number>(1); // 1 = bull, -1 = bear
  const [rsiVal, setRsiVal] = useState<number>(50);
  const [f4Direction, setF4Direction] = useState<"UP" | "DOWN" | "—">("—");

  // Whale Alerts
  const [whaleAlerts, setWhaleAlerts] = useState<WhaleAlert[]>([]);
  
  // Live Tape
  const [liveTicks, setLiveTicks] = useState<LiveTick[]>([]);

  // Order Book Overlay
  const [orderBook, setOrderBook] = useState<OrderBookLevel[]>([]);
  const [obMidPrice, setObMidPrice] = useState<number>(0);

  // Data Service & Cache
  const dataServiceRef = useRef<DataService>(new DataService());
  const currentKlinesRef = useRef<any[]>([]);
  const whaleWsRef = useRef<WebSocket | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync prop changes (e.g. parent asset selector)
  useEffect(() => {
    setSymbol(initialSymbol);
  }, [initialSymbol]);

  // --- Chart Initialization ---
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.2)" },
        horzLines: { color: "rgba(30, 41, 59, 0.2)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#64748b", width: 1, style: 2, labelBackgroundColor: "#1e293b" },
        horzLine: { color: "#64748b", width: 1, style: 2, labelBackgroundColor: "#1e293b" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "rgba(51, 65, 85, 0.5)",
      },
      rightPriceScale: {
        borderColor: "rgba(51, 65, 85, 0.5)",
        autoScale: true,
      },
    });

    chartRef.current = chart;
    
    // 🌐 LOCAL TIME FIX (Turkey UTC+3): Match user's computer clock exactly
    chart.timeScale().applyOptions({
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false
    });
    // Force Local Time display (Override UTC)
    try { (chart.timeScale() as any)._convertTime = (t: number) => t; } catch(e) {}


    // Core Series
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceScaleId: 'right',
    });

    // Indicator Lines
    f4SeriesRef.current = chart.addSeries(LineSeries, { color: "#00ff68", lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: true });
    f4FiboSeriesRef.current = chart.addSeries(LineSeries, { color: "#2196f3", lineWidth: 1, lineStyle: 2, priceLineVisible: false });
    ema8SeriesRef.current = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 1, priceLineVisible: false });
    ema21SeriesRef.current = chart.addSeries(LineSeries, { color: "#818cf8", lineWidth: 1, priceLineVisible: false });
    ema55SeriesRef.current = chart.addSeries(LineSeries, { color: "#fb7185", lineWidth: 1, priceLineVisible: false });
    vwapSeriesRef.current = chart.addSeries(LineSeries, { color: "#facc15", lineWidth: 1, lineStyle: 1, priceLineVisible: false });
    
    // Supertrend (dynamic color handled via data update)
    stSeriesRef.current = chart.addSeries(LineSeries, { color: "#10b981", lineWidth: 2, lineStyle: 0, priceLineVisible: false, lastValueVisible: false });
    
    // Bollinger Bands
    bbUpperSeriesRef.current = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.4)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.4)", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

    // Custom Native Plugins
    scatterSeriesRef.current = chart.addCustomSeries(new MatrixScatterPaneView(), { priceScaleId: 'right' });
    signalSeriesRef.current = chart.addCustomSeries(new MatrixSignalPaneView(), { priceScaleId: 'right' });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    
    // Add ResizeObserver for layout shift / animation support
    let animationFrameId: number;
    const resizeObserver = new ResizeObserver(() => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(handleResize);
    });
    if (chartContainerRef.current) {
        resizeObserver.observe(chartContainerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // --- Data & Calculation Loop ---
  const syncChart = useCallback(async (klinesData?: any[]) => {
    const ds = dataServiceRef.current;
    if (!chartRef.current) return;

    if (klinesData && Array.isArray(klinesData) && klinesData.length > 0) {
        currentKlinesRef.current = klinesData;
        setError(null);
    }

    const klines = currentKlinesRef.current;
    if (!klines || !Array.isArray(klines) || klines.length === 0) return;

    // 1. Base candles
    candleSeriesRef.current?.setData(klines);
    
    const lastKline = klines[klines.length - 1];
    if (lastKline) {
        setLastPrice(lastKline.close);
        if (klines.length > 2) {
            setPriceChange((lastKline.close - klines[klines.length-2].close) / klines[klines.length-2].close * 100);
        }
    }

    // 2. Indicators
    if (showIndicators && klines.length > 20) {
        try {
            const highs = klines.map((k: any) => k.high);
            const lows = klines.map((k: any) => k.low);
            const closes = klines.map((k: any) => k.close);
            const volumes = klines.map((k: any) => k.volume);

            const f4Res = F4Strategy.calculate(highs, lows, closes, {
                length: 10, alpha: 3.7, fiboLength: 5, fiboAlpha: 0.618,
                slopeThreshold: 0.01, powerLossThreshold: 50, lookbackBars: 10, squeezeThreshold: 40
            });

            const ema8 = TechnicalIndicators.ema(closes, 8);
            const ema21 = TechnicalIndicators.ema(closes, 21);
            const ema55 = TechnicalIndicators.ema(closes, 55);
            const vwap = TechnicalIndicators.vwap(highs, lows, closes, volumes);

            // Pine Script: RSI for HUD
            const rsi = TechnicalIndicators.rsi(closes, 14);
            const lastRsi = rsi[rsi.length - 1];
            if (!isNaN(lastRsi)) setRsiVal(lastRsi);

            const mapToLine = (vals: number[]) => {
                if (!Array.isArray(vals)) return [];
                return vals.map((v, i) => {
                    if (!klines[i] || isNaN(v)) return null;
                    return { time: klines[i].time, value: v };
                }).filter((d: any) => d !== null) as any[];
            };

            f4SeriesRef.current?.setData(mapToLine(f4Res.f4));
            f4FiboSeriesRef.current?.setData(mapToLine(f4Res.f4Fibo));
            ema8SeriesRef.current?.setData(mapToLine(ema8));
            ema21SeriesRef.current?.setData(mapToLine(ema21));
            ema55SeriesRef.current?.setData(mapToLine(ema55));
            vwapSeriesRef.current?.setData(mapToLine(vwap));

            // F4 direction for HUD (Pine Script: F4 > F4[1])
            const lastF4 = f4Res.f4[f4Res.f4.length - 1];
            const prevF4 = f4Res.f4[f4Res.f4.length - 2];
            if (!isNaN(lastF4) && !isNaN(prevF4)) {
                setF4Direction(lastF4 > prevF4 ? "UP" : "DOWN");
            }

            // Signal Triangles
            const rawSignalData: MatrixSignalData[] = [];
            for (let i = 0; i < klines.length; i++) {
                if (f4Res.earlyBuySignals[i]) {
                    rawSignalData.push({ time: klines[i].time, price: klines[i].low, type: 'EAL', color: '#00ff68', label: 'EAL' });
                }
                if (f4Res.earlySellSignals[i]) {
                    rawSignalData.push({ time: klines[i].time, price: klines[i].high, type: 'ESAT', color: '#ff0008', label: 'ESAT' });
                }
            }
            
            rawSignalData.sort((a, b) => (a.time as number) - (b.time as number));
            const signalData: MatrixSignalData[] = [];
            let lastSigTime = 0;
            for (const d of rawSignalData) {
                if ((d.time as number) <= lastSigTime) {
                    d.time = (lastSigTime + 1) as Time;
                }
                signalData.push(d);
                lastSigTime = d.time as number;
            }
            signalSeriesRef.current?.setData(signalData);
        } catch (e) {
            console.error("Indicator calculation failed:", e);
        }
    } else {
        f4SeriesRef.current?.setData([]);
        f4FiboSeriesRef.current?.setData([]);
        ema8SeriesRef.current?.setData([]);
        ema21SeriesRef.current?.setData([]);
        ema55SeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
        signalSeriesRef.current?.setData([]);
    }

    // 3. Supertrend (Pine Script: ta.supertrend(3.0, 10))
    if (showSupertrend && klines.length > 15) {
        try {
            const highs = klines.map((k: any) => k.high);
            const lows = klines.map((k: any) => k.low);
            const closes = klines.map((k: any) => k.close);
            const { trend, direction } = TechnicalIndicators.supertrend(highs, lows, closes, 10, 3.0);
            
            const lastDir = direction[direction.length - 1];
            setStDirection(lastDir > 0 ? 1 : -1);

            // Split into segments by direction (green when bull, red when bear)
            const stBullData: any[] = [];
            const stBearData: any[] = [];
            for (let i = 0; i < klines.length; i++) {
                if (isNaN(trend[i])) continue;
                const point = { time: klines[i].time, value: trend[i] };
                if (direction[i] > 0) {
                    stBullData.push(point);
                } else {
                    stBearData.push(point);
                }
            }

            // Render as single series with color changes using sorted merged data
            const stAllData = klines.map((k: any, i: number) => {
                if (isNaN(trend[i])) return null;
                return {
                    time: k.time,
                    value: trend[i],
                    color: direction[i] > 0 ? '#10b981' : '#f43f5e'
                };
            }).filter(Boolean) as any[];

            stSeriesRef.current?.setData(stAllData);
        } catch(e) {
            console.error("Supertrend failed:", e);
        }
    } else {
        stSeriesRef.current?.setData([]);
    }

    // 4. Bollinger Bands (Pine Script: ta.bb(close, 20, 2))
    if (showBB && klines.length > 25) {
        try {
            const closes = klines.map((k: any) => k.close);
            const bb = TechnicalIndicators.bollingerBands(closes, 20, 2.0);
            const mapToLine = (vals: number[]) => klines.map((k: any, i: number) => 
                isNaN(vals[i]) ? null : { time: k.time, value: vals[i] }
            ).filter(Boolean) as any[];
            bbUpperSeriesRef.current?.setData(mapToLine(bb.upper));
            bbLowerSeriesRef.current?.setData(mapToLine(bb.lower));
        } catch(e) {
            console.error("BB failed:", e);
        }
    } else {
        bbUpperSeriesRef.current?.setData([]);
        bbLowerSeriesRef.current?.setData([]);
    }

    // 5. Maker/Taker Bubbles — aggregated per candle time
    if (showMarkers) {
        const trades = ds.list;
        
        // Use current candle interval for precise horizontal alignment
        const intervalSec = duration; 

        const secMap = new Map<number, { buyVol: number, sellVol: number, sumPriceBuy: number, sumPriceSell: number }>();
        for (const t of trades) {
            if (!t || !t.T || !t.q || !t.p) continue;
            const sec = Math.floor(t.T / 1000);
            if (!secMap.has(sec)) secMap.set(sec, { buyVol: 0, sellVol: 0, sumPriceBuy: 0, sumPriceSell: 0 });
            const state = secMap.get(sec)!;
            const vol = t.p * t.q;
            const sideStr = String(t.side).toUpperCase();
            if (sideStr === '1' || sideStr === 'BUY') {
                state.buyVol += vol;
                state.sumPriceBuy += t.p * vol;
            } else if (sideStr === '2' || sideStr === '0' || sideStr === '-1' || sideStr === 'SELL') {
                state.sellVol += vol;
                state.sumPriceSell += t.p * vol;
            }
        }

        const candleMap = new Map<number, any[]>();
        const sortedSecs = Array.from(secMap.keys()).sort((a, b) => a - b);
        
        for (const sec of sortedSecs) {
            const state = secMap.get(sec)!;
            // Snap to candle boundary
            const candleTime = Math.floor(sec / intervalSec) * intervalSec;
            if (!candleMap.has(candleTime)) candleMap.set(candleTime, []);
            const bubblesForCandle = candleMap.get(candleTime)!;

            if (state.buyVol >= threshold) {
                const vol = state.buyVol;
                const size = Math.max(5, Math.min(45, (vol / threshold) * 8));
                const label = vol >= 1000000 ? (vol/1000000).toFixed(1)+'M' : vol >= 10000 ? (vol/1000).toFixed(0)+'k' : '';
                bubblesForCandle.push({
                    price: state.sumPriceBuy / state.buyVol,
                    size,
                    color: 'rgba(0, 255, 104, 0.05)',
                    side: 1,
                    label
                });
            }

            if (state.sellVol >= threshold) {
                const vol = state.sellVol;
                const size = Math.max(5, Math.min(45, (vol / threshold) * 8));
                const label = vol >= 1000000 ? (vol/1000000).toFixed(1)+'M' : vol >= 10000 ? (vol/1000).toFixed(0)+'k' : '';
                bubblesForCandle.push({
                    price: state.sumPriceSell / state.sellVol,
                    size,
                    color: 'rgba(255, 0, 8, 0.05)',
                    side: 2,
                    label
                });
            }
        }
        
        const scatterData: MatrixScatterData[] = Array.from(candleMap.entries()).map(([cTime, bubbles]) => ({
            time: cTime as Time,
            price: bubbles.length > 0 ? bubbles[0].price : 0,
            bubbles
        })).sort((a, b) => (a.time as number) - (b.time as number));
        
        scatterSeriesRef.current?.setData(scatterData);
    } else {
        scatterSeriesRef.current?.setData([]);
    }

  }, [threshold, showIndicators, showMarkers, showSupertrend, showBB, duration]);

  // Keep ref in sync to prevent stale closures in setInterval/WS callbacks
  const syncChartRef = useRef(syncChart);
  useEffect(() => {
      syncChartRef.current = syncChart;
  }, [syncChart]);

  // --- Main Data Load Effect ---
  useEffect(() => {
    const ds = dataServiceRef.current;
    
    const generate = async () => {
        if (!user) return;
        
        // Anti-Flicker & Perceived Performance Optimization
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        
        // Only show full loading if no data
        const hasData = currentKlinesRef.current.length > 0;
        if (!hasData) {
            setIsLoading(true);
        } else {
            // Delay local spinner to avoid flicker for fast responses
            loadingTimeoutRef.current = setTimeout(() => setIsLoading(true), 150);
        }

        setError(null);
        const now = Date.now();
        const startTime = now - duration * 1000;
        const interval = getInterval(duration);
        const normSymbol = symbol.replace(/[-\/]/g, '').toUpperCase();
        
        try {
            // STEP 1: Fetch Klines → render chart immediately
            const token = localStorage.getItem("token");
            const klinesUrl = `/api/market/klines?symbol=${normSymbol}&interval=${interval}&limit=500`;
            const kResp = await fetch(klinesUrl, {
                headers: { 
                    'Authorization': token ? `Bearer ${token}` : '',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!kResp.ok) {
                const errData = await kResp.json();
                throw new Error(errData.error || `HTTP ${kResp.status}`);
            }

            const klines = await kResp.json();
            
            // Step 1.1: Render immediately
            await syncChart(klines);
            
            // Step 1.2: End loading state
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            setIsLoading(false); 

            // STEP 2: Load trade bubbles in background (non-blocking)
            await ds.reset();
            const firstKlineTime = klines.length > 0 ? klines[0].time * 1000 : startTime;
            const tradeStart = firstKlineTime;
            
            ds.loadRange(normSymbol, exchange, tradeStart, now, () => {
                // Progressive update: Render as soon as chunks arrive
                syncChartRef.current(klines);
            }).catch(err => console.warn("[Trades] Background load failed:", err));

        } catch (e: any) {
            console.error("Failed to load Matrix chart data:", e);
            setError(e.message || "Failed to load data");
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            setIsLoading(false); 
        }
    };

    const normSymbol = symbol.replace(/[-\/]/g, '').toUpperCase();
    const interval = getInterval(duration);

    generate();

    const handleTrade = () => {
        if (!ds.isBulkLoading) syncChartRef.current();
    };
    (window as any).onLiveTradeReceived = handleTrade;
    
    const pollId = setInterval(async () => {
        if (document.hidden) return;
        try {
            const token = localStorage.getItem("token");
            
            // 1. KLINE POLL (Last 10 candles)
            const kResp = await fetch(`/api/market/klines?symbol=${normSymbol}&interval=${interval}&limit=10`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (kResp.ok) {
                const newKlines = await kResp.json();
                if (Array.isArray(newKlines) && newKlines.length > 0) {
                    const existing = currentKlinesRef.current;
                    if (existing.length > 0) {
                        const lastExt = existing[existing.length-1];
                        let merged = [...existing];
                        for (const nk of newKlines) {
                            const idx = merged.findIndex(ek => ek.time === nk.time);
                            if (idx !== -1) merged[idx] = nk;
                            else if (nk.time > lastExt.time) merged.push(nk);
                        }
                        if (merged.length > 550) merged = merged.slice(merged.length - 500);
                        currentKlinesRef.current = merged;
                        syncChart();
                    }
                }
            }

            // 2. TRADE POLL FALLBACK (Every 10s, ensures Bubbles even if WS fails)
            const tFrom = Date.now() - 60 * 1000;
            const tResp = await fetch(`/api/market/trades?symbol=${normSymbol}&exchange=MEXC_SPOT&from=${tFrom}`, {
                headers: { 'Authorization': token ? `Bearer ${token}` : '' }
            });
            if (tResp.ok) {
                const liveTrades = await tResp.json();
                if (Array.isArray(liveTrades) && liveTrades.length > 0) {
                    ds.processTrades(liveTrades);
                    syncChart();
                }
            }
        } catch(e) {
            console.warn("[Chart] Live update poll failed:", e);
        }
    }, 6000); // 6s health check

    return () => {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        clearInterval(pollId);
        (window as any).onLiveTradeReceived = null;
    };
  }, [symbol, duration, exchange, user]);

  // UI filter changes — chart only update (no API refetch)
  useEffect(() => {
      syncChart();
  }, [syncChart]);

  // --- Order Book Polling (Liquidity Heatmap) ---
  useEffect(() => {
    if (!showOrderBook) { setOrderBook([]); return; }
    
    let isActive = true;
    const normSymbol = symbol.replace(/[-\/]/g, '').toUpperCase();
    
    const fetchOB = async () => {
        try {
            const r = await fetch(`/api/orderbook?symbol=${normSymbol}&limit=10`);
            if (!r.ok || !isActive) return;
            const ob = await r.json();
            const bids: OrderBookLevel[] = (ob.bids || []).slice(0, 8).map((b: any) => ({
                price: parseFloat(b[0] || b.price || 0),
                qty: parseFloat(b[1] || b.quantity || 0),
                side: "bid" as const
            }));
            const asks: OrderBookLevel[] = (ob.asks || []).slice(0, 8).map((a: any) => ({
                price: parseFloat(a[0] || a.price || 0),
                qty: parseFloat(a[1] || a.quantity || 0),
                side: "ask" as const
            }));
            if (!isActive) return;
            setOrderBook([...asks.reverse(), ...bids]);
            if (bids.length > 0 && asks.length > 0) {
                setObMidPrice((bids[0].price + asks[asks.length-1].price) / 2);
            }
        } catch {}
    };
    
    fetchOB();
    const id = setInterval(fetchOB, 3000);
    return () => { isActive = false; clearInterval(id); };
  }, [symbol, showOrderBook]);

  // --- Whale Alert WebSocket (MEXC) ---
  useEffect(() => {
    const normSymbol = symbol.replace(/[-\/]/g, '').toUpperCase();
    let ws: WebSocket;
    let isActive = true;

    const connect = () => {
        try {
            ws = new WebSocket("wss://wbs.mexc.com/ws");
            ws.onopen = () => {
                const wsSymbol = normSymbol.toUpperCase();
                // Send both as fallback (some MEXC v3 accounts use SUBSCRIPTION, some SUBSCRIBE)
                ws.send(JSON.stringify({
                    method: "SUBSCRIPTION",
                    params: [`spot@public.deals.v3.api@${wsSymbol}`]
                }));
                ws.send(JSON.stringify({
                    method: "SUBSCRIBE",
                    params: [`spot@public.deals.v3.api@${wsSymbol}`]
                }));
            };
            ws.onmessage = (event) => {
                if (!isActive) return;
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.d?.deals?.length > 0) {
                        for (const deal of msg.d.deals) {
                            const price = parseFloat(deal.p || 0);
                            const qty = parseFloat(deal.v || 0);
                            const vol = price * qty;
                            const side = deal.S === 1 ? "BUY" : "SELL";

                            // Live Tape
                            const tick: LiveTick = {
                                id: `${deal.t}-${Math.random()}`,
                                price, qty, vol, side,
                                ts: deal.t || Date.now()
                            };
                            setLiveTicks(prev => [tick, ...prev].slice(0, 25));
                            
                            // 🚀 LIVE BUBBLE SYNC: Push live trade to DataService so bubble shows immediately
                            const ds = dataServiceRef.current;
                            if (ds) {
                                ds.processTrades([{
                                    id: `${deal.t}-${price}-${qty}`,
                                    T: deal.t || Date.now(),
                                    p: price,
                                    q: qty,
                                    side: deal.S === 1 ? 1 : 2 // 1: Buy, 2: Sell
                                }]);
                                // Trigger immediate bubble re-render
                                syncChart();
                            }

                            // Whale filter (Pine Script: whaleVolMult=1.8x avg)
                            if (vol >= 50000) {
                                const alert: WhaleAlert = {
                                    id: `${deal.t}-W`,
                                    symbol: normSymbol,
                                    volume: vol,
                                    side,
                                    price,
                                    time: deal.t || Date.now()
                                };
                                setWhaleAlerts(prev => [alert, ...prev].slice(0, 8));
                            }
                        }
                    }
                } catch {}
            };
            ws.onerror = () => {};
            ws.onclose = () => { if (isActive) setTimeout(connect, 3000); };
        } catch {}
    };

    connect();
    whaleWsRef.current = ws!;

    return () => {
        isActive = false;
        try { ws?.close(); } catch {}
    };
  }, [symbol]);

  // Max qty for order book bar width calc
  const maxObQty = Math.max(...orderBook.map(l => l.qty), 1);

  return (
    <div className="w-full flex flex-col overflow-hidden bg-slate-950/20 border border-slate-800/40 rounded-xl">
      {/* ═══ HEADER ═══ */}
      <div className="px-4 py-2.5 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 backdrop-blur-md">
        
        {/* Left: Ticker & Price */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white tracking-tight uppercase">{symbol.replace('-','/')}</span>
                <span className="text-[10px] font-mono text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">PRO v5</span>
            </div>
            {lastPrice > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-lg font-black font-mono tracking-tighter ${priceChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                    <span className={`text-xs font-bold ${priceChange >= 0 ? "text-emerald-500/80" : "text-rose-500/80"}`}>
                        {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                    </span>
                </div>
            )}
          </div>
          
          <div className="h-8 w-px bg-white/5 mx-1" />

          {/* Timeframes */}
          <div className="flex items-center bg-black/40 p-1 rounded-lg border border-white/5">
            {[
                { label: '5m', val: 300 },
                { label: '15m', val: 900 },
                { label: '1h', val: 3600 },
                { label: '4h', val: 14400 },
                { label: '12h', val: 43200 },
                { label: '1d', val: 86400 },
                { label: '3d', val: 259200 }
            ].map(tf => (
                <button 
                  key={tf.label}
                  onClick={() => setModuleTf(tf.label)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${moduleTf === tf.label ? "bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
                >
                    {tf.label}
                </button>
            ))}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4">
          
          {/* Min Vol Slider */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <div className="flex justify-between text-[9px] font-black tracking-widest text-slate-500 uppercase">
                <span>Min Vol</span>
                <span className="text-cyan-400">
                  ${threshold >= 1000000 ? (threshold/1000000).toFixed(1) + 'M' : (threshold/1000).toFixed(0) + 'k'}
                </span>
            </div>
            <input 
              type="range" min="100000" max="5000000" step="50000"
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <div className="h-8 w-px bg-white/5" />

          {/* Exchange Selector */}
          <select 
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            className="bg-black/40 border border-white/5 rounded-md px-2 py-1.5 text-[10px] font-bold text-slate-300 outline-none focus:border-cyan-500/50 transition-colors"
          >
            <option value="ALL">ALL EXCH</option>
            <option value="BINANCE_PERP">Binance Perp</option>
            <option value="BINANCE_SPOT">Binance Spot</option>
            <option value="BYBIT_PERP">Bybit Perp</option>
            <option value="BYBIT_SPOT">Bybit Spot</option>
            <option value="OKX_PERP">OKX Perp</option>
            <option value="OKX_SPOT">OKX Spot</option>
            <option value="BITGET_PERP">Bitget Perp</option>
            <option value="BITGET_SPOT">Bitget Spot</option>
            <option value="HTX_PERP">HTX Perp</option>
            <option value="HTX_SPOT">HTX Spot</option>
            <option value="GATEIO_PERP">Gateio Perp</option>
            <option value="GATEIO_SPOT">Gateio Spot</option>
            <option value="KUCOIN_PERP">Kucoin Perp</option>
            <option value="KUCOIN_SPOT">Kucoin Spot</option>
            <option value="MEXC_SPOT">MEXC Spot</option>
          </select>

          <div className="h-8 w-px bg-white/5" />

          {/* Toggle Buttons */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            {/* Indicators */}
            <button 
              onClick={() => setShowIndicators(v => !v)}
              className={`px-2 py-1.5 rounded-md transition-all text-[9px] font-bold ${showIndicators ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-slate-600 hover:text-slate-400"}`}
              title="Toggle Indicators (F4/EMA/VWAP)"
            >EMA</button>
            {/* Bubbles */}
            <button 
              onClick={() => setShowMarkers(v => !v)}
              className={`px-2 py-1.5 rounded-md transition-all text-[9px] font-bold ${showMarkers ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20" : "text-slate-600 hover:text-slate-400"}`}
              title="Toggle Maker/Taker Bubbles"
            >M/T</button>
            {/* Supertrend */}
            <button 
              onClick={() => setShowSupertrend(v => !v)}
              className={`px-2 py-1.5 rounded-md transition-all text-[9px] font-bold ${showSupertrend ? (stDirection > 0 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/20 text-rose-400 border border-rose-500/20") : "text-slate-600 hover:text-slate-400"}`}
              title="Toggle Supertrend"
            >ST</button>
            {/* Bollinger */}
            <button 
              onClick={() => setShowBB(v => !v)}
              className={`px-2 py-1.5 rounded-md transition-all text-[9px] font-bold ${showBB ? "bg-slate-400/20 text-slate-300 border border-slate-400/20" : "text-slate-600 hover:text-slate-400"}`}
              title="Toggle Bollinger Bands"
            >BB</button>
            {/* Order Book */}
            <button 
              onClick={() => setShowOrderBook(v => !v)}
              className={`px-2 py-1.5 rounded-md transition-all text-[9px] font-bold ${showOrderBook ? "bg-violet-500/20 text-violet-400 border border-violet-500/20" : "text-slate-600 hover:text-slate-400"}`}
              title="Toggle Liquidity Heatmap"
            >OB</button>
          </div>

          {isLoading && <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]" />}
        </div>
      </div>

      {/* ═══ CHART CANVAS ZONE ═══ */}
      <div className="relative flex w-full">
        
        {/* Main Chart */}
        <div className="relative flex-1 h-[540px] group">
          <div ref={chartContainerRef} className="absolute inset-0" />
          
          {/* Loading Overlay (Only if no data) */}
          {isLoading && currentKlinesRef.current.length === 0 && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
                  <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">Matrix Syncing</span>
                          <span className="text-[8px] text-cyan-500/60 font-mono animate-pulse uppercase">Accessing Real-Time Stream</span>
                      </div>
                  </div>
              </div>
          )}

          {error && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                      <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                          <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                      </div>
                      <div className="space-y-1">
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">Sync Failed</h3>
                          <p className="text-xs text-slate-400">{error.includes("401") ? "Oturum süresi dolmuş." : `Hata: ${error}`}</p>
                      </div>
                      <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                          Re-initialize
                      </button>
                  </div>
              </div>
          )}

          {!user && !isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Waiting for Authentication...</span>
              </div>
          )}

          {/* ── SMC / AI Confluence HUD (top-left) ── */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-lg p-2 flex flex-col gap-1 min-w-[130px]">
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">▸ Matrix V5 HUD</div>
                  <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] text-slate-400">ST</span>
                      <span className={`text-[9px] font-bold ${stDirection > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stDirection > 0 ? '▲ BULL' : '▼ BEAR'}
                      </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] text-slate-400">F4</span>
                      <span className={`text-[9px] font-bold ${f4Direction === 'UP' ? 'text-emerald-400' : f4Direction === 'DOWN' ? 'text-rose-400' : 'text-slate-500'}`}>
                          {f4Direction === 'UP' ? '↑ YÜKSELİYOR' : f4Direction === 'DOWN' ? '↓ DÜŞÜYOR' : '— NÖTR'}
                      </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] text-slate-400">RSI</span>
                      <span className={`text-[9px] font-bold ${rsiVal >= 70 ? 'text-rose-400' : rsiVal <= 30 ? 'text-emerald-400' : rsiVal > 50 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                          {rsiVal.toFixed(1)} {rsiVal >= 70 ? '⚠ OB' : rsiVal <= 30 ? '⚠ OS' : ''}
                      </span>
                  </div>
              </div>
          </div>

          {/* ── Whale Alert Floating Panel (bottom-left) ── */}
          {whaleAlerts.length > 0 && (
              <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1 max-w-[200px] pointer-events-none">
                  {whaleAlerts.slice(0, 4).map(alert => {
                      const tier = getWhaleTier(alert.volume);
                      return (
                          <div key={alert.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${tier.bg} backdrop-blur-md`}>
                              <span className="text-xs">{tier.icon}</span>
                              <div className="flex flex-col min-w-0">
                                  <span className={`text-[9px] font-black ${tier.color}`}>{tier.tier}</span>
                                  <span className={`text-[9px] font-bold ${alert.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {alert.side} ${alert.volume >= 1000000 ? (alert.volume/1000000).toFixed(1)+'M' : (alert.volume/1000).toFixed(0)+'k'}
                                  </span>
                              </div>
                          </div>
                      );
                  })}
              </div>
          )}

          {/* ── Indicator Legend (top-right hover) ── */}
          {showIndicators && (
              <div className="absolute top-3 right-3 p-2 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-lg flex flex-col gap-1 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-[#00ff68]" /><span className="text-slate-300">F4 Line</span></div>
                  <div className="flex items-center gap-2 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-[#38bdf8]" /><span className="text-slate-300">EMA 8</span></div>
                  <div className="flex items-center gap-2 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-[#818cf8]" /><span className="text-slate-300">EMA 21</span></div>
                  <div className="flex items-center gap-2 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-[#fb7185]" /><span className="text-slate-300">EMA 55</span></div>
                  <div className="flex items-center gap-2 text-[9px] font-bold"><span className="w-2 h-2 rounded-full bg-[#facc15]" /><span className="text-slate-300">VWAP</span></div>
                  {showSupertrend && <div className="flex items-center gap-2 text-[9px] font-bold"><span className={`w-2 h-2 rounded-full ${stDirection > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} /><span className="text-slate-300">Supertrend</span></div>}
              </div>
          )}
        </div>

        {/* ── Liquidity Heatmap (Order Book Panel) ── */}
        {showOrderBook && orderBook.length > 0 && (
            <div className="w-[120px] border-l border-white/5 bg-black/40 flex flex-col overflow-hidden">
                <div className="px-2 py-1.5 border-b border-white/5">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Liquidity</span>
                </div>
                <div className="flex-1 flex flex-col justify-center px-1 py-1 gap-px overflow-hidden">
                    {orderBook.map((level, i) => {
                        const widthPct = Math.max(5, (level.qty / maxObQty) * 100);
                        const isAsk = level.side === 'ask';
                        const isMid = obMidPrice > 0 && i < orderBook.length - 1 && 
                            orderBook[i].price >= obMidPrice && orderBook[i+1]?.price < obMidPrice;
                        return (
                            <div key={i}>
                                {isMid && <div className="w-full h-px bg-yellow-500/40 my-0.5" />}
                                <div className="relative flex items-center h-5 rounded-sm overflow-hidden">
                                    <div 
                                        className={`absolute left-0 top-0 h-full ${isAsk ? 'bg-rose-500/15' : 'bg-emerald-500/15'}`}
                                        style={{ width: `${widthPct}%` }}
                                    />
                                    <div className="relative z-10 flex items-center justify-between w-full px-1">
                                        <span className={`text-[8px] font-mono font-bold ${isAsk ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {level.price.toFixed(2)}
                                        </span>
                                        <span className="text-[7px] font-mono text-slate-500">
                                            {level.qty >= 1000 ? (level.qty/1000).toFixed(1)+'k' : level.qty.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      {/* ═══ LIVE TAPE (Bottom Ticker Band) ═══ */}
      <div className="border-t border-white/5 bg-black/60 px-3 py-1.5 flex items-center gap-0 overflow-hidden" style={{ minHeight: 32 }}>
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mr-3 shrink-0">LIVE TAPE</span>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap">
              {liveTicks.length === 0 ? (
                  <span className="text-[9px] text-slate-600 italic">Waiting for trades...</span>
              ) : liveTicks.map(tick => {
                  const isBig = tick.vol >= 100000;
                  return (
                      <div key={tick.id} className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded ${tick.side === 'BUY' ? 'bg-emerald-500/5 border border-emerald-500/10' : 'bg-rose-500/5 border border-rose-500/10'} ${isBig ? 'ring-1 ring-yellow-500/30' : ''}`}>
                          {isBig && <span className="text-[8px]">🐋</span>}
                          <span className={`text-[9px] font-mono font-bold ${tick.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {tick.price.toFixed(2)}
                          </span>
                          <span className="text-[8px] text-slate-500 font-mono">
                              {tick.vol >= 1000000 ? (tick.vol/1000000).toFixed(1)+'M' : tick.vol >= 1000 ? (tick.vol/1000).toFixed(0)+'k' : tick.vol.toFixed(0)}
                          </span>
                      </div>
                  );
              })}
          </div>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="px-4 py-1.5 border-t border-white/5 bg-black/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">Engine: LWv5 Native</span>
            <span className="text-[9px] font-mono text-slate-600">|</span>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">Sync: 2s Poll + WS</span>
            <span className="text-[9px] font-mono text-slate-600">|</span>
            <span className={`text-[9px] font-mono font-bold ${stDirection > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                ST: {stDirection > 0 ? '▲ BULL' : '▼ BEAR'}
            </span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400">{exchange === 'ALL' ? 'All Exchanges' : exchange.replace('_',' ')} Connected</span>
            <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
        </div>
      </div>
    </div>
  );
});

InteractiveChart.displayName = "InteractiveChart";
