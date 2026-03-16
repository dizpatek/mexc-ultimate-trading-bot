"use client";

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  BaselineSeries,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  IPriceLine,
  Time,
  MouseEventParams,
  LogicalRange,
} from "lightweight-charts";
import { fetchKlines } from "@/services/api";
import { core } from "@/services/ApiCore";
import { cn } from "@/lib/utils";
import type { Holding } from "@/services/api";
import { useModuleTimeframe } from "@/context/TimeframeContext";

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
  mode?: "TRADE" | "COVER";
  assets?: Holding[];
  onAssetChange?: (asset: Holding) => void;
  potentialEntry?: number;
  compact?: boolean;
  isEditingExisting?: boolean;
  isBuyEditable?: boolean;
  showChart?: boolean;
  setShowChart?: (s: boolean) => void;
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

const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "8h": 28800,
  "12h": 43200,
  "1d": 86400,
  "1w": 604800,
};

// ─── Pure chart data utilities (extracted for testability) ─────────────────────

/** Convert a lightweight-charts Time value to a Unix timestamp in seconds. */
const toSeconds = (t: Time): number => {
  if (t === null || t === undefined) return 0;
  if (typeof t === "number") return t;
  if (typeof t === "string") return Number(t) || 0;
  if (typeof t === "object" && "timestamp" in t)
    return (t as { timestamp: number }).timestamp;
  return 0;
};

/** Strip invalid timestamps and normalise time field to numeric seconds. */
const sanitizeChartData = <T extends { time: Time }>(data: T[]): T[] =>
  data
    .filter((d) => { const t = toSeconds(d.time); return !isNaN(t) && t > 0; })
    .map((d) => ({ ...d, time: toSeconds(d.time) as Time }));

const hasSignificantCandleChange = (a: CandleData, b: CandleData) =>
  Math.abs(a.close - b.close) > 0.00000001 ||
  Math.abs(a.high - b.high) > 0.00000001 ||
  Math.abs(a.low - b.low) > 0.00000001;

/** Applies Heikin-Ashi transformation to a sequence of candles. */
const calculateHeikinAshi = (data: CandleData[]): CandleData[] => {
  if (data.length === 0) return [];
  const haData: CandleData[] = [];
  let prevOpen = data[0].open;
  let prevClose = data[0].close;

  for (let i = 0; i < data.length; i++) {
    const curr = data[i];
    const haClose = (curr.open + curr.high + curr.low + curr.close) / 4;
    const haOpen = i === 0 ? (curr.open + curr.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(curr.high, haOpen, haClose);
    const haLow = Math.min(curr.low, haOpen, haClose);

    const haCandle = {
      time: curr.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    };
    haData.push(haCandle);
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return haData;
};

type VolumeBar = { time: Time; value: number; color: string };

/**
 * Full O(n) diff: compare every incoming candle against the cache.
 * Returns {changedKlines, changedVolume, hasHistoricalChange, nextKlineMap, nextVolMap}.
 */
const fullDiffScan = (
  existingKlines: CandleData[],
  existingVolume: VolumeBar[],
  incomingKlines: CandleData[],
  incomingVolume: VolumeBar[],
) => {
  const lastExistingTime =
    existingKlines.length > 0 ? toSeconds(existingKlines[existingKlines.length - 1].time) : 0;

  const klineMap = new Map<number, CandleData>(existingKlines.map((k) => [toSeconds(k.time), k]));
  const volMap   = new Map<number, VolumeBar>(existingVolume.map((v) => [toSeconds(v.time), v]));

  const changedKlines: CandleData[] = [];
  let hasHistoricalChange = false;

  incomingKlines.forEach((k) => {
    const t = toSeconds(k.time);
    const existing = klineMap.get(t);
    if (!existing || hasSignificantCandleChange(existing, k)) {
      changedKlines.push(k);
      klineMap.set(t, k);
      if (t < lastExistingTime) hasHistoricalChange = true;
    }
  });

  const changedVolume: VolumeBar[] = [];
  incomingVolume.forEach((v) => {
    const t = toSeconds(v.time);
    const existing = volMap.get(t);
    if (!existing || Math.abs(existing.value - v.value) > 0.1) {
      changedVolume.push(v);
      volMap.set(t, v);
      if (t < lastExistingTime) hasHistoricalChange = true;
    }
  });

  return { changedKlines, changedVolume, hasHistoricalChange, klineMap, volMap };
};

/**
 * Fast O(k) diff: only compare tip candles (last 5) — used on every normal poll.
 */
const tipDiffScan = (
  existingKlines: CandleData[],
  existingVolume: VolumeBar[],
  incomingKlines: CandleData[],
  incomingVolume: VolumeBar[],
) => {
  const lastExistingTime =
    existingKlines.length > 0 ? toSeconds(existingKlines[existingKlines.length - 1].time) : 0;

  const tipMap = new Map<number, CandleData>(
    existingKlines.slice(-5).map((k) => [toSeconds(k.time), k]),
  );

  const changedKlines: CandleData[] = [];
  incomingKlines
    .filter((k) => toSeconds(k.time) >= lastExistingTime)
    .forEach((k) => {
      const existing = tipMap.get(toSeconds(k.time));
      if (!existing || hasSignificantCandleChange(existing, k)) changedKlines.push(k);
    });

  // For volume at the tip we accept whatever comes in (volume bars update frequently)
  const changedVolume: VolumeBar[] = incomingVolume.filter(
    (v) => toSeconds(v.time) >= lastExistingTime,
  );

  return { changedKlines, changedVolume };
};
// ──────────────────────────────────────────────────────────────────────────────

export const SmartChart = forwardRef<{ focusOnPrices: () => void }, SmartChartProps>((props, ref) => {
  const {
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
    mode = "TRADE",
    assets = [],
    onAssetChange,
    potentialEntry,
    compact = false,
    isEditingExisting = false,
    isBuyEditable = true,
    showChart = true,
    setShowChart,
  } = props;

  useImperativeHandle(ref, () => ({
    focusOnPrices,
  }));
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const assetScrollRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ghostSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const isMountedRef = useRef(true);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<boolean>(false);
  const [isChartReady, setIsChartReady] = useState(false);
  const [lastClose, setLastClose] = useState(0);
  const lastCandleRef = useRef<CandleData | null>(null);
  const allKlinesRef = useRef<CandleData[]>([]);
  const allVolumeRef = useRef<{ time: Time; value: number; color: string }[]>(
    [],
  );
  const isHistoryLoadingRef = useRef(false);
  const lastCloseRef = useRef(0);
  const lastFullScanRef = useRef<number>(0); // timestamp of last O(n) full diff scan
  const [timeframe, setTimeframe] = useModuleTimeframe("1h");
  const hasUserInteractedRef = useRef(false);
  const initialFocusDoneRef = useRef(false);

  const isUpdatingOverlaysRef = useRef(false);

  const startScroll = (direction: "left" | "right") => {
    if (scrollIntervalRef.current) return;
    scrollIntervalRef.current = setInterval(() => {
      if (assetScrollRef.current) {
        assetScrollRef.current.scrollLeft += direction === "left" ? -8 : 8;
      }
    }, 16);
  };

  const stopScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  // The "current price" is the last close price from the data, or the external one
  const currentPrice = externalMarketPrice || lastClose;


  // Forces the chart to include all trade levels in the visible area
  const focusOnPrices = useCallback((force = false) => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !seriesRef.current ||
      !ghostSeriesRef.current ||
      !isChartReady
    )
      return;

    // Don't auto-focus if user is manually controlling (unless forced)
    if (hasUserInteractedRef.current && !force) return;

    // We can try to focus even if we don't have all klines yet
    // but lightweight-charts needs a time range to scale prices.
    // If we have at least TWO trade levels, we can ghost-scale even without klines
    const activeLevels = [buyPrice, tpPrice, slPrice].filter(p => p > 0);
    
    // Check if we have enough data to scale
    const hasData = allKlinesRef.current.length > 0;
    if (!hasData && activeLevels.length < 2) return;

    const b = buyPrice;
    const t = tpPrice;
    const s = slPrice;
    const te = tpEnabled;
    const se = slEnabled;

    const klines = allKlinesRef.current;
    const tFirst = klines[0]?.time as number;
    const tLast = klines[klines.length - 1]?.time as number;

    if (!tFirst || !tLast) return;

    // Ensure strict ascending order for lightweight-charts
    const timestamp1 = tFirst;
    let timestamp3 = Math.max(tLast, tFirst + 2);
    let timestamp2 = timestamp1 + Math.floor((timestamp3 - timestamp1) / 2);

    // Final sanity check for uniqueness
    if (timestamp2 <= timestamp1) timestamp2 = timestamp1 + 1;
    if (timestamp3 <= timestamp2) timestamp3 = timestamp2 + 1;

    const safeB = isNaN(b) ? 0 : b;
    const safeT = te && !isNaN(t) && t > 0 ? t : 0;
    const safeS = se && !isNaN(s) && s > 0 ? s : 0;

    const minV =
      Math.min(
        safeB > 0 ? safeB : Infinity,
        safeT > 0 ? safeT : Infinity,
        safeS > 0 ? safeS : Infinity,
      );
    const maxV =
      Math.max(
        safeB,
        safeT,
        safeS
      );

    if (minV !== Infinity && maxV > 0 && minV > 0) {
      ghostSeriesRef.current.setData([
        { time: timestamp1 as Time, value: minV * 0.998 },
        { time: timestamp2 as Time, value: maxV * 1.002 },
        { time: timestamp3 as Time, value: safeB },
      ]);
    }

    if (chartRef.current) {
      chartRef.current.priceScale("right").applyOptions({ 
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        }
      });
      // Ensure the visible range is wide enough to avoid "too close" feeling
      if (hasData) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [isChartReady, buyPrice, tpPrice, slPrice, tpEnabled, slEnabled]);

  // Refs for price lines
  const currentPriceLineRef = useRef<IPriceLine | null>(null);
  const initialDragPercents = useRef<{ tp: number; sl: number } | null>(null);
  const buyPriceLineRef = useRef<IPriceLine | null>(null);
  const tpPriceLineRef = useRef<IPriceLine | null>(null);
  const slPriceLineRef = useRef<IPriceLine | null>(null);
  const potentialEntryLineRef = useRef<IPriceLine | null>(null);
  const tpFillRef = useRef<ISeriesApi<"Baseline"> | null>(null);
  const slFillRef = useRef<ISeriesApi<"Baseline"> | null>(null);

  // Dragging state
  const [draggingLine, setDraggingLine] = useState<"buy" | "tp" | "sl" | null>(
    null,
  );

  // Coordinates for the drag buttons overlay
  const [lineCoords, setLineCoords] = useState<{
    buy?: number;
    tp?: number;
    sl?: number;
  }>({});

  // Local prices for ultra-smooth dragging
  const [localPrices, setLocalPrices] = useState({
    buy: Number(buyPrice),
    tp: Number(tpPrice),
    sl: slPrice ? Number(slPrice) : 0,
  });
  const localPricesRef = useRef(localPrices);
  useEffect(() => {
    localPricesRef.current = localPrices;
  }, [localPrices]);

  // Sync local prices when props change (but NOT when dragging)
  useEffect(() => {
    if (!draggingLine) {
      setLocalPrices((prev) => {
        const b = Number(buyPrice);
        const t = Number(tpPrice);
        const s = slPrice ? Number(slPrice) : 0;
        if (prev.buy === b && prev.tp === t && prev.sl === s) return prev;
        return { buy: b, tp: t, sl: s };
      });
    }
  }, [buyPrice, tpPrice, slPrice, draggingLine]);

  const propsRef = useRef({
    buyPrice,
    tpPrice,
    slPrice,
    tpEnabled,
    slEnabled,
    trailingBuy,
    onPricesChange,
    isBuyEditable,
  });
  useEffect(() => {
    propsRef.current = {
      buyPrice,
      tpPrice,
      slPrice,
      tpEnabled,
      slEnabled,
      trailingBuy,
      onPricesChange,
      isBuyEditable,
    };
  }, [
    buyPrice,
    tpPrice,
    slPrice,
    tpEnabled,
    slEnabled,
    trailingBuy,
    onPricesChange,
    isBuyEditable,
  ]);


  // When trailing buy is OFF, keep TBuy line in sync with the real-time market price.
  // Visual-only update: directly moves the chart price line and updates the label overlay
  // without calling onPricesChange (SmartTrade's own priceSync handles the state).
  const lastReportedBuyRef = useRef<number>(0);
  useEffect(() => {
    if (trailingBuy || draggingLine || !currentPrice || currentPrice <= 0 || !isBuyEditable) return;

    // Avoid redundant updates
    if (lastReportedBuyRef.current === currentPrice) return;
    lastReportedBuyRef.current = currentPrice;

    // Update localPrices so the label badge shows the correct price and % distance
    setLocalPrices((prev) => {
      if (prev.buy === currentPrice) return prev;
      return { ...prev, buy: currentPrice };
    });
  }, [currentPrice, trailingBuy, draggingLine, isBuyEditable]);

  // Unified Chart Update Function (Zones + Coords)
  const refreshChartOverlays = useCallback(() => {
    if (
      !isMountedRef.current ||
      !chartRef.current ||
      !seriesRef.current ||
      !isChartReady ||
      isUpdatingOverlaysRef.current
    )
      return;

    // Allow label sync even if no klines are present, as labels use priceToCoordinate
    // Coords will return null if no data, which we handle
    
    isUpdatingOverlaysRef.current = true;
    try {
      const series = seriesRef.current;
      const buy = Number(localPricesRef.current.buy);
      const tp = Number(localPricesRef.current.tp);
      const sl = Number(localPricesRef.current.sl);

      // 1. Sync Labels (React side)
      const buyCoord = buy > 0 ? series.priceToCoordinate(buy) : null;
      const tpCoord =
        tpEnabled && !isNaN(tp) && tp > 0 ? series.priceToCoordinate(tp) : null;
      const slCoord =
        slEnabled && !isNaN(sl) && sl > 0 ? series.priceToCoordinate(sl) : null;

      const newCoords = {
        buy: buyCoord ?? undefined,
        tp: tpCoord ?? undefined,
        sl: slCoord ?? undefined,
      };
      setLineCoords((prev) => {
        if (
          prev.buy === newCoords.buy &&
          prev.tp === newCoords.tp &&
          prev.sl === newCoords.sl
        )
          return prev;
        return newCoords;
      });

      // 2. Sync Background Zones (Chart side)
      const klines = allKlinesRef.current;
      const tFirst = klines[0]?.time as number;
      const tLast = klines[klines.length - 1]?.time as number;

      if (!tFirst || !tLast) return;

      const ONE_YEAR = 31536000;
      const tStart = Math.max(0, tFirst - ONE_YEAR * 5) as Time;
      const tEnd = (tLast + ONE_YEAR * 5) as Time;

      const isCover = mode === "COVER";

      if (tpFillRef.current && tpEnabled && !isNaN(tp) && tp > 0) {
        // UPDATE BASELINE COLORS ON MODE CHANGE
        tpFillRef.current.applyOptions({
          baseValue: { type: "price", price: buy },
          topFillColor1: isCover ? "transparent" : "rgba(16, 185, 129, 0.15)",
          topFillColor2: isCover ? "transparent" : "rgba(16, 185, 129, 0.05)",
          bottomFillColor1: isCover
            ? "rgba(16, 185, 129, 0.15)"
            : "transparent",
          bottomFillColor2: isCover
            ? "rgba(16, 185, 129, 0.05)"
            : "transparent",
        });
        tpFillRef.current.setData([
          { time: tStart, value: tp },
          { time: tEnd, value: tp },
        ]);
      }
      if (slFillRef.current && slEnabled && !isNaN(sl) && sl > 0) {
        // UPDATE BASELINE COLORS ON MODE CHANGE
        slFillRef.current.applyOptions({
          baseValue: { type: "price", price: buy },
          topFillColor1: isCover ? "rgba(244, 63, 94, 0.15)" : "transparent",
          topFillColor2: isCover ? "rgba(244, 63, 94, 0.05)" : "transparent",
          bottomFillColor1: isCover ? "transparent" : "rgba(244, 63, 94, 0.15)",
          bottomFillColor2: isCover ? "transparent" : "rgba(244, 63, 94, 0.05)",
        });
        slFillRef.current.setData([
          { time: tStart, value: sl },
          { time: tEnd, value: sl },
        ]);
      }
    } catch (e) {
      console.error("[SmartChart] Overlay Error:", e);
    } finally {
      isUpdatingOverlaysRef.current = false;
    }
  }, [isChartReady, tpEnabled, slEnabled, mode, localPrices.buy, localPrices.tp, localPrices.sl]);

  const rafIdRef = useRef<number | null>(null);
  const triggerCoordSync = useCallback(() => {
    if (!isMountedRef.current || !chartRef.current || !isChartReady) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }
    
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!isMountedRef.current || !chartRef.current || !isChartReady) return;
      
      try {
        refreshChartOverlays();
        // Also update localPrices state for the badges to follow snappy
        setLocalPrices({ ...localPricesRef.current });
      } catch (e) {
        console.warn("[SmartChart] rAF Sync Failed (disposed?):", e);
      }
    });
  }, [refreshChartOverlays, isChartReady]);

  // Forces the label coordinates to update whenever the price values change
  useEffect(() => {
    triggerCoordSync();
  }, [localPrices.buy, localPrices.tp, localPrices.sl, triggerCoordSync]);

  // Initialize Chart Instance (Once)
  useEffect(() => {
    if (!chartContainerRef.current) return;
    isMountedRef.current = true;

    const container = chartContainerRef.current;
    const chartInstance = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.3)" },
        horzLines: { color: "rgba(30, 41, 59, 0.3)" },
      },
      width: container.clientWidth || 800,
      height: compact
        ? container.clientHeight || 250
        : container.clientHeight || 800,
      timeScale: { borderColor: "#1e293b", timeVisible: true },
      rightPriceScale: { borderColor: "#1e293b", autoScale: true },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        axisPressedMouseMove: true,
      },
      crosshair: {
        horzLine: {
          color: "rgba(6, 182, 212, 0.3)",
          labelBackgroundColor: "#06b6d4",
        },
        vertLine: {
          color: "rgba(6, 182, 212, 0.3)",
          labelBackgroundColor: "#06b6d4",
        },
      },
    });

    const candlestickSeries = chartInstance.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    const volumeSeries = chartInstance.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chartInstance.priceScale("volume")?.applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const ghostSeries = chartInstance.addSeries(LineSeries, {
      color: "transparent",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chartInstance;
    seriesRef.current = candlestickSeries;
    ghostSeriesRef.current = ghostSeries;
    volumeSeriesRef.current = volumeSeries;
    setIsChartReady(true);

    // Track user interaction to prevent auto-reset
    chartInstance.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (isMountedRef.current) {
        // If the logical range changes, we assume user is interacting
        // We only set this AFTER the initial load to avoid blocking first auto-focus
        if (initialFocusDoneRef.current) {
          hasUserInteractedRef.current = true;
        }
      }
    });

    const handleResize = () => {
      if (!isMountedRef.current || !chartRef.current || !chartContainerRef.current) return;
      
      try {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        if (width > 0 && height > 0 && chartRef.current) {
          chartRef.current.applyOptions({ width, height });
          chartRef.current.timeScale().fitContent();
        }
      } catch (e) {
        console.warn("[SmartChart] Resize Error (likely disposed):", e);
      }
    };

    const robserver = new ResizeObserver(() => {
      if (isMountedRef.current && chartRef.current) {
        handleResize();
      }
    });

    if (chartContainerRef.current) {
      robserver.observe(chartContainerRef.current);
    }

    window.addEventListener("resize", handleResize);
    // Initial resize call to ensure it fits the container on mount
    resizeTimeoutRef.current = setTimeout(handleResize, 100);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("resize", handleResize);
      robserver.disconnect();
      
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (chartRef.current) {
        try {
          // Exhaustive internal cleanup
          if (tpFillRef.current) { chartRef.current.removeSeries(tpFillRef.current); tpFillRef.current = null; }
          if (slFillRef.current) { chartRef.current.removeSeries(slFillRef.current); slFillRef.current = null; }
          if (seriesRef.current) { chartRef.current.removeSeries(seriesRef.current); seriesRef.current = null; }
          if (ghostSeriesRef.current) { chartRef.current.removeSeries(ghostSeriesRef.current); ghostSeriesRef.current = null; }
          if (volumeSeriesRef.current) { chartRef.current.removeSeries(volumeSeriesRef.current); volumeSeriesRef.current = null; }
          
          chartRef.current.remove();
        } catch (e) {
          console.warn("[SmartChart] Cleanup Error:", e);
        } finally {
          chartRef.current = null;
          seriesRef.current = null;
          ghostSeriesRef.current = null;
          volumeSeriesRef.current = null;
          setIsChartReady(false);
        }
      }
    };
  }, [compact, showChart, timeframe]);

  // Real unmount cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
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
    initialFocusDoneRef.current = false;
    hasUserInteractedRef.current = false;
  }, [symbol, timeframe]);

  // Data Fetching & Sync (on symbol/timeframe change or interval)
  useEffect(() => {
    if (!isChartReady || !seriesRef.current || !volumeSeriesRef.current) return;

    let isMounted = true;

    // ── Sync strategy: Full Reset ───────────────────────────────────────────────
    const handleFullReset = (
      cleanKlines: CandleData[],
      cleanVolume: VolumeBar[],
    ) => {
      if (!seriesRef.current || !volumeSeriesRef.current) return;
      cleanKlines.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));
      cleanVolume.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));
      allKlinesRef.current = cleanKlines;
      allVolumeRef.current = cleanVolume;
      seriesRef.current.setData(calculateHeikinAshi(cleanKlines));
      volumeSeriesRef.current.setData(cleanVolume);
    };

    // ── Sync strategy: Historical Prepend ──────────────────────────────────────
    const handleHistoricalPrepend = (
      cleanKlines: CandleData[],
      cleanVolume: VolumeBar[],
    ) => {
      if (!seriesRef.current || !volumeSeriesRef.current) return;
      const firstKnownTime = toSeconds(allKlinesRef.current[0].time);
      const olderKlines = cleanKlines.filter((k) => toSeconds(k.time) < firstKnownTime);
      const olderVolume = cleanVolume.filter((v) => toSeconds(v.time) < firstKnownTime);
      if (olderKlines.length > 0) {
        allKlinesRef.current = [...olderKlines, ...allKlinesRef.current];
        allVolumeRef.current = [...olderVolume, ...allVolumeRef.current];
        seriesRef.current.setData(calculateHeikinAshi(allKlinesRef.current));
        volumeSeriesRef.current.setData(allVolumeRef.current);
      }
    };

    // ── Sync strategy: Incremental Update (tip-fast or periodic full-scan) ──────
    const handleIncrementalUpdate = (
      cleanKlines: CandleData[],
      cleanVolume: VolumeBar[],
    ) => {
      if (!seriesRef.current || !volumeSeriesRef.current) return;
      const now = Date.now() / 1000;
      const shouldFullScan = now - lastFullScanRef.current > 30;

      let changedKlines: CandleData[];
      let changedVolume: VolumeBar[];
      let hasHistoricalChange = false;

      if (shouldFullScan) {
        const result = fullDiffScan(
          allKlinesRef.current, allVolumeRef.current,
          cleanKlines, cleanVolume,
        );
        changedKlines = result.changedKlines;
        changedVolume = result.changedVolume;
        hasHistoricalChange = result.hasHistoricalChange;
        if (changedKlines.length > 0 || hasHistoricalChange) {
          allKlinesRef.current = Array.from(result.klineMap.values()).sort(
            (a, b) => toSeconds(a.time) - toSeconds(b.time),
          );
          allVolumeRef.current = Array.from(result.volMap.values()).sort(
            (a, b) => toSeconds(a.time) - toSeconds(b.time),
          );
        }
        lastFullScanRef.current = now;
      } else {
        ({ changedKlines, changedVolume } = tipDiffScan(
          allKlinesRef.current, allVolumeRef.current,
          cleanKlines, cleanVolume,
        ));
      }

      if (hasHistoricalChange || changedKlines.length > 0 || changedVolume.length > 0) {
        seriesRef.current.setData(calculateHeikinAshi(allKlinesRef.current));
        volumeSeriesRef.current.setData(allVolumeRef.current);
      }
      // else: no changes → skip all chart API calls
    };

    // ── Dispatcher ─────────────────────────────────────────────────────────────
    const updateSeriesData = (
      newKlines: CandleData[],
      newVolume: VolumeBar[],
      updateMode: "reset" | "update" | "prepend" = "reset",
    ) => {
      if (!seriesRef.current || !volumeSeriesRef.current || !isChartReady) return;
      const cleanKlines = sanitizeChartData(newKlines);
      const cleanVolume = sanitizeChartData(newVolume);

      if (updateMode === "reset" || allKlinesRef.current.length === 0) {
        handleFullReset(cleanKlines, cleanVolume);
      } else if (updateMode === "prepend") {
        handleHistoricalPrepend(cleanKlines, cleanVolume);
      } else {
        handleIncrementalUpdate(cleanKlines, cleanVolume);
      }

      if (allKlinesRef.current.length > 0) {
        lastCandleRef.current = allKlinesRef.current[allKlinesRef.current.length - 1];
        // If we are editing and this is the first data load, ensure we focus
        if (isEditingExisting) {
          if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
          focusTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) focusOnPrices();
          }, 100);
        }
      }
    };

    const fetchData = async (shouldFocus = false) => {
      if (!isMounted) return;
      if (shouldFocus) {
        setIsLoading(true);
        setError(null);
      }
      setSyncError(false);
      const apiSymbol = symbol.replace("/", "");

      try {
        const data = await fetchKlines(apiSymbol, timeframe);
        if (!isMounted) return;

        if (!data || !Array.isArray(data) || data.length === 0) {
          if (shouldFocus) setError(`Veri bulunamadı: ${apiSymbol}`);
          return;
        }

        // Double check data validity before mapping
        interface RawCandleLocal {
          time: string | number;
          open: string | number;
          high: string | number;
          low: string | number;
          close: string | number;
          volume?: string | number;
        }
        const validRaw = (data as RawCandleLocal[]).filter(
          (d) =>
            d && (typeof d.time === "number" || typeof d.time === "string"),
        );

        const validData: CandleData[] = calculateHeikinAshi(
          validRaw.map((d) => ({
            time: d.time as Time,
            open: Number(d.open) || 0,
            high: Number(d.high) || 0,
            low: Number(d.low) || 0,
            close: Number(d.close) || 0,
          })),
        );

        const volumeData = validRaw
          .filter((d) => d.volume !== undefined)
          .map((d) => ({
            time: d.time as Time,
            value: Number(d.volume || 0) || 0,
            color:
              Number(d.close) >= Number(d.open)
                ? "rgba(16,185,129,0.25)"
                : "rgba(244,63,94,0.25)",
          }));

        // Use 'reset' for initial load/focus, 'update' for background polling
        updateSeriesData(
          validRaw.map((d) => ({
            time: d.time as Time,
            open: Number(d.open) || 0,
            high: Number(d.high) || 0,
            low: Number(d.low) || 0,
            close: Number(d.close) || 0,
          })),
          volumeData,
          shouldFocus ? "reset" : "update",
        );

        if (allKlinesRef.current.length > 0) {
          const latest = allKlinesRef.current[allKlinesRef.current.length - 1];
          const price = latest.close;
          if (price > 0 && !isNaN(price)) {
            setLastClose(price);
            if (onMarketPriceUpdate) onMarketPriceUpdate(price);
            
            // Only auto-focus once per symbol/timeframe load
            if (shouldFocus && !initialFocusDoneRef.current) {
              focusOnPrices();
              initialFocusDoneRef.current = true;
            }
          }
        }
      } catch (err) {
        console.error("[SmartChart] Data error:", err);
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
      if (isHistoryLoadingRef.current || allKlinesRef.current.length === 0)
        return;
      isHistoryLoadingRef.current = true;
      setHistoryLoading(true);

      const apiSymbol = symbol.replace("/", "");
      const firstCandle = allKlinesRef.current[0];
      const endTime = (firstCandle.time as number) * 1000 - 1; // 1ms before first candle

      try {
        const data = await fetchKlines(
          apiSymbol,
          timeframe,
          500,
          undefined,
          endTime,
        );
        if (!isMounted) return;

        if (data && Array.isArray(data) && data.length > 0) {
          const historicalKlines: CandleData[] = (data as RawCandle[])
            .filter((d): d is RawCandle => !!(d && d.time !== undefined))
            .map((d) => ({
              time: d.time as Time,
              open: Number(d.open),
              high: Number(d.high),
              low: Number(d.low),
              close: Number(d.close),
            }));

          const historicalVolume = (data as RawCandle[])
            .filter(
              (d): d is RawCandle =>
                !!(d && d.time !== undefined && d.volume !== undefined),
            )
            .map((d) => ({
              time: d.time as Time,
              value: Number(d.volume || 0),
              color:
                Number(d.close) >= Number(d.open)
                  ? "rgba(16,185,129,0.25)"
                  : "rgba(244,63,94,0.25)",
            }));

          updateSeriesData(historicalKlines, historicalVolume, "prepend");
        }
      } catch (err) {
        console.error("[SmartChart] History fetch error:", err);
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
      chartRef.current
        .timeScale()
        .subscribeVisibleLogicalRangeChange(rangeListener);
    }

    fetchData(true); // Initial/Symbol change load: Focus
    const refreshInterval = setInterval(() => fetchData(false), 5000); // 5s REST poll; MarketKernel handles 1s realtime updates

    // Real-time pulse from MarketKernel
    const formattedSym = symbol.replace("/", "");
    core.market.setSymbols([formattedSym]);
    const unsubscribeMarket = core.market.subscribe((updates) => {
      if (!isMounted || !isMountedRef.current || !chartRef.current || !seriesRef.current) return;
      
      const update = updates[formattedSym];
      if (update) {
        try {
          const price = Number(update.price);
          if (price > 0) {
            const prevPrice = lastCloseRef.current;
            setLastClose(price);
            lastCloseRef.current = price;
            if (onMarketPriceUpdate) onMarketPriceUpdate(price);
            
            // Only trigger coordinate sync if price moved >0.01% to reduce layout thrashing
            if (prevPrice === 0 || Math.abs(price - prevPrice) / price > 0.0001) {
              triggerCoordSync();
            }
          }

          // Update candlestick logic...
          const candlestickSeconds = TIMEFRAME_SECONDS[timeframe] || 3600;
          const nowTotalSeconds = Math.floor(Date.now() / 1000);
          const lastKnownTime =
            allKlinesRef.current.length > 0
              ? Number(allKlinesRef.current[allKlinesRef.current.length - 1].time)
              : 0;

          let currentBarTime: number;
          if (lastKnownTime > 0) {
            const offset = lastKnownTime % candlestickSeconds;
            const ideal =
              Math.floor((nowTotalSeconds - offset) / candlestickSeconds) *
                candlestickSeconds +
              offset;
            currentBarTime = Math.max(ideal, lastKnownTime);
          } else {
            currentBarTime =
              Math.floor(nowTotalSeconds / candlestickSeconds) *
              candlestickSeconds;
          }

          const lastCandle = lastCandleRef.current;

          if (seriesRef.current) {
            if (lastCandle && Number(lastCandle.time) === currentBarTime) {
              const updatedCandle = {
                ...lastCandle,
                close: price,
                high: Math.max(lastCandle.high, price),
                low: Math.min(lastCandle.low, price),
              };
              lastCandleRef.current = updatedCandle;
              if (
                allKlinesRef.current.length > 0 &&
                Number(
                  allKlinesRef.current[allKlinesRef.current.length - 1].time,
                ) === currentBarTime
              ) {
                allKlinesRef.current[allKlinesRef.current.length - 1] =
                  updatedCandle;
              }
            } else if (!lastCandle || currentBarTime > Number(lastCandle.time)) {
              const newBar = {
                time: currentBarTime as Time,
                open: price,
                high: price,
                low: price,
                close: price,
              };
              lastCandleRef.current = newBar;
              allKlinesRef.current = [
                ...allKlinesRef.current.filter(
                  (k) => Number(k.time) < currentBarTime,
                ),
                newBar,
              ];
            }
            // HA Refresh
            seriesRef.current.setData(calculateHeikinAshi(allKlinesRef.current));
          }
        } catch (e) {
          console.warn("[SmartChart] Market Pulse Error (likely disposed):", e);
        }
      }
    });

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
      unsubscribeMarket();
      if (chartRef.current && rangeListener) {
        chartRef.current
          .timeScale()
          .unsubscribeVisibleLogicalRangeChange(rangeListener);
      }
    };
  }, [
    isChartReady,
    symbol,
    timeframe,
    onMarketPriceUpdate,
    focusOnPrices,
    triggerCoordSync,
  ]);


  // Subscriptions for timescale changes to keep overlays in sync
  useEffect(() => {
    if (!isChartReady || !chartRef.current || !seriesRef.current) return;
    const chart = chartRef.current;
    const series = seriesRef.current;

    const handleScaleChange = () => {
      // Only sync labels on scale change, DO NOT modify series data (prevents Max Call Stack Size Exceeded)
      if (!isMountedRef.current || !chartRef.current || !seriesRef.current || allKlinesRef.current.length === 0) return;
      const chart = chartRef.current;
      const series = seriesRef.current;
      const buy = Number(localPricesRef.current.buy);
      const tp = Number(localPricesRef.current.tp);
      const sl = Number(localPricesRef.current.sl);

      const buyCoord = buy > 0 ? series.priceToCoordinate(buy) : null;
      // Allow dragging even if not yet enabled so user can visually set them
      const tpCoord =
        propsRef.current.isBuyEditable && !propsRef.current.tpEnabled && tp > 0
          ? series.priceToCoordinate(tp)
          : propsRef.current.tpEnabled && !isNaN(tp) && tp > 0
            ? series.priceToCoordinate(tp)
            : null;
      const slCoord =
        propsRef.current.isBuyEditable && !propsRef.current.slEnabled && sl > 0
          ? series.priceToCoordinate(sl)
          : propsRef.current.slEnabled && !isNaN(sl) && sl > 0
            ? series.priceToCoordinate(sl)
            : null;

      setLineCoords((prev) => {
        if (prev.buy === buyCoord && prev.tp === tpCoord && prev.sl === slCoord)
          return prev;
        return {
          buy: buyCoord ?? undefined,
          tp: tpCoord ?? undefined,
          sl: slCoord ?? undefined,
        };
      });
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleScaleChange);
    return () =>
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleScaleChange);
  }, [isChartReady, triggerCoordSync]);

  // Update markers and trigger overlay refresh on price changes
  useEffect(() => {
    if (!isMountedRef.current || !chartRef.current || !seriesRef.current || !isChartReady) return;
    const series = seriesRef.current;

    const updateMarkerLine = (
      lineRef: React.MutableRefObject<IPriceLine | null>,
      price: number,
      color: string,
      title: string,
      enabled: boolean,
      style: number = LineStyle.Solid,
      axisLabelVisible: boolean = true,
    ) => {
      if (!enabled || price <= 0) {
        if (lineRef.current) {
          series.removePriceLine(lineRef.current);
          lineRef.current = null;
        }
        return;
      }
      if (lineRef.current) {
        lineRef.current.applyOptions({
          price,
          color,
          lineStyle: style,
          title,
          axisLabelVisible,
        });
      } else {
        lineRef.current = series.createPriceLine({
          price,
          color,
          lineWidth: 2,
          lineStyle: style,
          axisLabelVisible,
          title,
        });
      }
    };

    // Standard Static/Trigger Markers
    updateMarkerLine(
      currentPriceLineRef,
      currentPrice,
      "#fbbf24",
      "",
      true,
      LineStyle.Dashed,
      false,
    );

    // Use localPrices for everything to ensure labels and lines are 100% synced at 60fps
    const displayBuy = localPrices.buy;
    const displayTp = localPrices.tp;
    const displaySl = localPrices.sl;

    const isCover = mode === "COVER";
    updateMarkerLine(
      buyPriceLineRef,
      displayBuy,
      isCover ? "#10b981" : "#06b6d2",
      isCover ? "ENTRY-S" : "ENTRY-L",
      true,
    );
    updateMarkerLine(
      tpPriceLineRef,
      displayTp,
      "#10b981",
      "TAKE PROFIT",
      tpEnabled,
    );
    updateMarkerLine(
      slPriceLineRef,
      displaySl,
      "#f43f5e",
      "STOP LOSS",
      slEnabled,
    );

    // Potential Entry Marker (Visualization of Trailing)
    updateMarkerLine(
      potentialEntryLineRef,
      potentialEntry || 0,
      isCover ? "#10b981" : "#06b6d2",
      "TRAILING...",
      !!potentialEntry,
      LineStyle.LargeDashed,
      false,
    );

    // Manage Profit/Risk Area Series Lifecycle
    const chart = chartRef.current;
    if (!chart) return;

    const isTpProfit = isCover
      ? localPrices.tp < localPrices.buy
      : localPrices.tp > localPrices.buy;
    const isSlRisk = isCover
      ? localPrices.sl > localPrices.buy
      : localPrices.sl < localPrices.buy;

    if (tpEnabled && isTpProfit) {
      if (!tpFillRef.current) {
        tpFillRef.current = chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: localPrices.buy },
          topFillColor1: isCover ? "transparent" : "rgba(16, 185, 129, 0.15)",
          topFillColor2: isCover ? "transparent" : "rgba(16, 185, 129, 0.05)",
          bottomFillColor1: isCover
            ? "rgba(16, 185, 129, 0.15)"
            : "transparent",
          bottomFillColor2: isCover
            ? "rgba(16, 185, 129, 0.05)"
            : "transparent",
          lineVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          autoscaleInfoProvider: () => null,
        });
      }
    } else if (tpFillRef.current) {
      chart.removeSeries(tpFillRef.current);
      tpFillRef.current = null;
    }

    if (slEnabled && isSlRisk) {
      if (!slFillRef.current) {
        slFillRef.current = chart.addSeries(BaselineSeries, {
          baseValue: { type: "price", price: localPrices.buy },
          topFillColor1: isCover ? "rgba(244, 63, 94, 0.15)" : "transparent",
          topFillColor2: isCover ? "rgba(244, 63, 94, 0.05)" : "transparent",
          bottomFillColor1: isCover ? "transparent" : "rgba(244, 63, 94, 0.15)",
          bottomFillColor2: isCover ? "transparent" : "rgba(244, 63, 94, 0.05)",
          lineVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
          autoscaleInfoProvider: () => null,
        });
      }
    } else if (slFillRef.current) {
      chart.removeSeries(slFillRef.current);
      slFillRef.current = null;
    }

    refreshChartOverlays();
  }, [
    isChartReady,
    tpEnabled,
    slEnabled,
    currentPrice,
    localPrices.buy,
    localPrices.tp,
    localPrices.sl,
    refreshChartOverlays,
    mode,
    potentialEntry,
    trailingBuy,
    trailingTp,
    trailingSl,
    isEditingExisting,
    buyPrice, // Added props for extra reactivity
    tpPrice,
    slPrice
  ]);

  // Optimize Dragging
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const chart = chartRef.current;
    const series = seriesRef.current;

    const onMouseDown = (param: MouseEventParams) => {
      if (!isMountedRef.current || !chartRef.current || !param.point) return;
      const {
        buyPrice: b,
        tpPrice: t,
        slPrice: s,
        tpEnabled: te,
        slEnabled: se,
        isBuyEditable: ibe,
      } = propsRef.current;
      const dist = (p: number) =>
        Math.abs(param.point!.y - (series.priceToCoordinate(p) || 0));
      if (ibe && dist(b) < 30) {
        setDraggingLine("buy");
        if (b > 0) {
          initialDragPercents.current = {
            tp: t > 0 ? (t / b) : 0,
            sl: s > 0 ? (s / b) : 0
          };
        }
      }
      else if ((te || ibe) && dist(t) < 30) setDraggingLine("tp");
      else if ((se || ibe) && dist(s) < 30) setDraggingLine("sl");
    };

    const isProcessing = { current: false };
    const onMouseMove = (param: MouseEventParams) => {
      if (
        !isMountedRef.current ||
        !chartRef.current ||
        !seriesRef.current ||
        allKlinesRef.current.length === 0
      )
        return;
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        if (draggingLine && param.point) {
          const series = seriesRef.current;
          const price = series.coordinateToPrice(param.point.y);
          if (price !== null) {
            const rounded = Number(price.toFixed(6));

            if (draggingLine === "buy" && initialDragPercents.current) {
               const { tp: tpRatio, sl: slRatio } = initialDragPercents.current;
               const newPrices = { ...localPricesRef.current, buy: rounded };
               
               if (tpRatio > 0) {
                 newPrices.tp = Number((rounded * tpRatio).toFixed(6));
                 tpPriceLineRef.current?.applyOptions({ price: newPrices.tp });
               }
               if (slRatio > 0) {
                 newPrices.sl = Number((rounded * slRatio).toFixed(6));
                 slPriceLineRef.current?.applyOptions({ price: newPrices.sl });
               }
               
               localPricesRef.current = newPrices;
               buyPriceLineRef.current?.applyOptions({ price: rounded });
            } else {
              localPricesRef.current = {
                ...localPricesRef.current,
                [draggingLine]: rounded,
              };

              // Update visual line immediately for 60fps drag
              if (draggingLine === "buy" && buyPriceLineRef.current) {
                buyPriceLineRef.current.applyOptions({ price: rounded });
              } else if (draggingLine === "tp" && tpPriceLineRef.current) {
                tpPriceLineRef.current.applyOptions({ price: rounded });
              } else if (draggingLine === "sl" && slPriceLineRef.current) {
                slPriceLineRef.current.applyOptions({ price: rounded });
              }
            }

            // Sync React overlays and badges during drag through throttled rAF
            triggerCoordSync();
          }
        }

        if (
          chartContainerRef.current &&
          param.point &&
          allKlinesRef.current.length > 0
        ) {
          const series = seriesRef.current;
          // Use current local drag positions for cursor feedback, not stale props
          const buyY = series.priceToCoordinate(localPricesRef.current.buy) || -100;
          const tpY = (propsRef.current.tpEnabled || propsRef.current.isBuyEditable)
            ? series.priceToCoordinate(localPricesRef.current.tp) || -100 
            : -100;
          const slY = (propsRef.current.slEnabled || propsRef.current.isBuyEditable)
            ? series.priceToCoordinate(localPricesRef.current.sl) || -100 
            : -100;

          const distY = (y: number) => Math.abs(param.point!.y - y);
          const over = distY(buyY) < 30 || distY(tpY) < 30 || distY(slY) < 30;
          chartContainerRef.current.style.cursor =
            over || draggingLine ? "ns-resize" : "crosshair";
        }
      } finally {
        isProcessing.current = false;
      }
    };

    chart.subscribeClick(onMouseDown);
    chart.subscribeCrosshairMove(onMouseMove);
    const onMouseUp = () => {
      if (draggingLine) {
        // Send final coordinate to parent on drop
        propsRef.current.onPricesChange({
          buy: localPricesRef.current.buy,
          tp: localPricesRef.current.tp,
          sl: localPricesRef.current.sl,
        });
        setDraggingLine(null);
        initialDragPercents.current = null;
      }
    };
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      chart.unsubscribeClick(onMouseDown);
      chart.unsubscribeCrosshairMove(onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isChartReady, draggingLine, isEditingExisting, refreshChartOverlays, triggerCoordSync]);

  // Helper: % distance from current price
  const pctFromCurrent = (price: number) => {
    if (currentPrice <= 0) return 0;
    return (price / currentPrice - 1) * 100;
  };

  return (
    <div
      className={cn(
        "w-full select-none flex flex-col h-full relative group/chart flex-1 pb-0",
        !showChart ? "invisible h-0 opacity-0 overflow-hidden" : "visible"
      )}
    >
      <div
        ref={chartContainerRef}
        className={cn(
          "w-full bg-slate-950/20 transition-all flex-1",
          !compact && "min-h-[560px]",
        )}
      />
      {syncError && allKlinesRef.current.length > 0 && (
          <div className="absolute top-4 right-4 z-30 px-3 py-1 bg-rose-500/20 border border-rose-500/40 backdrop-blur-md rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
              Senkronizasyon Sorunu
            </span>
          </div>
        )}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-20 text-rose-400 font-bold uppercase tracking-widest text-[10px]">
            ⚠️ {error}
          </div>
        )}

        {/* Enhanced Price Labels with trailing toggles and % */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {Object.entries(lineCoords).map(([key, coord]) => {
            if (coord === undefined) return null;

            let label = "";
            if (key === "buy") label = mode === "COVER" ? "Sell" : "Buy";
            else if (key === "tp")
              label = mode === "COVER" ? "Buy (Cover)" : "Take Profit";
            else if (key === "sl")
              label = mode === "COVER" ? "Buy (Cover SL)" : "Stop Loss";

            // Prepend Trailing prefix when toggle is active
            if (key === "buy" && trailingBuy) label = "Trailing " + label;
            else if (key === "tp" && trailingTp) label = "Trailing " + label;
            else if (key === "sl" && trailingSl) label = "Trailing " + label;

            const bgColor =
              key === "buy"
                ? "bg-cyan-500"
                : key === "tp"
                  ? "bg-emerald-500"
                  : "bg-rose-500";
            const bgGlow =
              key === "buy"
                ? "shadow-cyan-500/30"
                : key === "tp"
                  ? "shadow-emerald-500/30"
                  : "shadow-rose-500/30";
            const lineColor =
              key === "buy"
                ? "border-cyan-500/40"
                : key === "tp"
                  ? "border-emerald-500/40"
                  : "border-rose-500/40";
            const price = localPrices[key as keyof typeof localPrices];
            const pctDist = pctFromCurrent(price);
            const isTrailing =
              key === "buy"
                ? trailingBuy
                : key === "tp"
                  ? trailingTp
                  : trailingSl;
            const onToggleTrailing =
              key === "buy"
                ? onTrailingBuyChange
                : key === "tp"
                  ? onTrailingTpChange
                  : onTrailingSlChange;

            const isDisabledBuy = key === "buy" && !isBuyEditable;

            const onLabelMouseDown = (e: React.MouseEvent) => {
              if (!isDisabledBuy) {
                e.preventDefault();
                setDraggingLine(key as "buy" | "tp" | "sl");
                // IMPORTANT: We MUST set initial ratios even when dragging from label
                // to support proportional TP/SL movement.
                const b = propsRef.current.buyPrice;
                const t = propsRef.current.tpPrice;
                const s = propsRef.current.slPrice;
                if (b > 0) {
                  initialDragPercents.current = {
                    tp: t > 0 ? (t / b) : 0,
                    sl: s > 0 ? (s / b) : 0
                  };
                }
              }
            };

            return (
              <div
                key={key}
                className={cn(
                  "absolute inset-x-0 transition-all duration-150",
                  draggingLine && "duration-0 transition-none",
                )}
                style={{
                  top: coord,
                }}
              >
                {/* Full-width dashed horizontal line */}
                <div
                  className={`absolute left-0 right-0 border-t border-dashed ${lineColor}`}
                  style={{ top: 0 }}
                />

                <div className="absolute left-4 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
                  {/* Drag Handle + Label */}
                  <div
                    onMouseDown={onLabelMouseDown}
                    className={`flex items-center ${bgColor} rounded-lg shadow-xl ${bgGlow} ${isDisabledBuy ? "opacity-50 cursor-not-allowed" : "cursor-ns-resize hover:scale-105"} transition-transform active:scale-95`}
                  >
                    {/* Feature Name Instead of Price */}
                    <div className="px-2 py-1 text-[10px] font-bold text-white tracking-widest">
                      {label}
                    </div>
                    {isDisabledBuy && (
                      <div
                        className="px-1.5 py-0.5 bg-slate-800 rounded text-[8px] font-black text-slate-400 ml-1"
                        title="Fiyat değiştirilemez"
                      >
                        🔒
                      </div>
                    )}
                  </div>

                  {/* % Distance Badge */}
                  <div
                    className={`px-1.5 py-1 rounded-md text-[8px] font-black font-mono shadow-lg backdrop-blur-md ${pctDist >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {pctDist >= 0 ? "+" : ""}
                    {pctDist.toFixed(2)}%
                  </div>

                  {/* Trailing Toggle Micro-Button: Hidden for Cover Buy Entry */}
                  {!(key === "buy" && mode === "COVER") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTrailing(!isTrailing);
                      }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isTrailing
                          ? "border-cyan-400 bg-cyan-400"
                          : "border-slate-600 bg-slate-900/80 hover:border-slate-500"
                      }`}
                      title={`Trailing ${label}`}
                    >
                      <span
                        className={`text-[7px] font-black ${isTrailing ? "text-slate-950" : "text-slate-400"}`}
                      >
                        T
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
});

SmartChart.displayName = "SmartChart";
