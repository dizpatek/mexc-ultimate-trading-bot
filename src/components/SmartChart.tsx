"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
import { SmartChartHeader } from "./matrix-horizon/SmartChartHeader";

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
  mode = "TRADE",
  assets = [],
  onAssetChange,
  potentialEntry,
  compact = false,
  isEditingExisting = false,
  isBuyEditable = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const assetScrollRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const allVolumeRef = useRef<{ time: Time; value: number; color: string }[]>(
    [],
  );
  const isHistoryLoadingRef = useRef(false);
  const [timeframe, setTimeframe] = useModuleTimeframe("1h");
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
  const focusOnPrices = useCallback(() => {
    if (
      !chartRef.current ||
      !seriesRef.current ||
      !ghostSeriesRef.current ||
      !isChartReady
    )
      return;
    if (allKlinesRef.current.length === 0) return; // FIX: Don't set ghost series if no real data

    const b = propsRef.current.buyPrice;
    const t = propsRef.current.tpPrice;
    const s = propsRef.current.slPrice;
    const te = propsRef.current.tpEnabled;
    const se = propsRef.current.slEnabled;

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
    const minV =
      Math.min(
        safeB,
        te && !isNaN(t) ? t : safeB,
        se && !isNaN(s) ? s : safeB,
      ) * 0.999;
    const maxV =
      Math.max(
        safeB,
        te && !isNaN(t) ? t : safeB,
        se && !isNaN(s) ? s : safeB,
      ) * 1.001;

    if (!isNaN(minV) && !isNaN(maxV) && minV > 0) {
      ghostSeriesRef.current.setData([
        { time: timestamp1 as Time, value: minV },
        { time: timestamp2 as Time, value: maxV },
        { time: timestamp3 as Time, value: safeB },
      ]);
    }

    if (chartRef.current) {
      chartRef.current.priceScale("right").applyOptions({ autoScale: true });
    }
  }, [isChartReady]);

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

  // Track market price for buy line when trailingBuy is OFF
  // REMOVED: This was causing infinite loops as both SmartTrade and SmartChart 
  // were fighting over the same state update. SmartTrade.tsx now handles this.
  // Unified Chart Update Function (Zones + Coords)
  const refreshChartOverlays = useCallback(() => {
    if (
      !chartRef.current ||
      !seriesRef.current ||
      !isChartReady ||
      isUpdatingOverlaysRef.current
    )
      return;
    if (allKlinesRef.current.length === 0) return;

    isUpdatingOverlaysRef.current = true;
    try {
      const series = seriesRef.current;
      const buy = Number(localPricesRef.current.buy);
      const tp = Number(localPricesRef.current.tp);
      const sl = Number(localPricesRef.current.sl);

      if (isNaN(buy) || buy <= 0) return;

      // 1. Sync Labels (React side)
      const buyCoord = series.priceToCoordinate(buy);
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
  }, [isChartReady, tpEnabled, slEnabled, mode]);

  const rafIdRef = useRef<number | null>(null);
  const triggerCoordSync = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      refreshChartOverlays();
      // Also update localPrices state for the badges to follow snappy
      setLocalPrices({ ...localPricesRef.current });
    });
  }, [refreshChartOverlays]);

  // Initialize Chart Instance (Once)
  useEffect(() => {
    if (!chartContainerRef.current) return;

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
    chartInstance.priceScale("volume").applyOptions({
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

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        const width = chartContainerRef.current.clientWidth;
        const height = chartContainerRef.current.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height: height - 10 });
        }
      }
    };

    const robserver = new ResizeObserver(() => {
      handleResize();
    });

    if (chartContainerRef.current) {
      robserver.observe(chartContainerRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      robserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
        ghostSeriesRef.current = null;
        volumeSeriesRef.current = null;
        setIsChartReady(false);
      }
    };
  }, [compact]);

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

    const updateSeriesData = (
      newKlines: CandleData[],
      newVolume: { time: Time; value: number; color: string }[],
      mode: "reset" | "update" | "prepend" = "reset",
    ) => {
      if (!seriesRef.current || !volumeSeriesRef.current || !isChartReady)
        return;

      const toSeconds = (t: Time): number => {
        if (t === null || t === undefined) return 0;
        if (typeof t === "number") return t;
        if (typeof t === "string") return Number(t) || 0;
        if (typeof t === "object" && "timestamp" in t)
          return (t as { timestamp: number }).timestamp;
        return 0;
      };

      const sanitize = <T extends { time: Time }>(data: T[]): T[] => {
        return data
          .filter((d) => {
            const t = toSeconds(d.time);
            return !isNaN(t) && t > 0;
          })
          .map((d) => ({
            ...d,
            time: toSeconds(d.time) as Time,
          }));
      };

      const cleanKlines = sanitize(newKlines);
      const cleanVolume = sanitize(newVolume);

      if (mode === "reset" || allKlinesRef.current.length === 0) {
        // Full Reset Mode
        cleanKlines.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));
        cleanVolume.sort((a, b) => toSeconds(a.time) - toSeconds(b.time));

        allKlinesRef.current = cleanKlines;
        allVolumeRef.current = cleanVolume;
        seriesRef.current.setData(cleanKlines);
        volumeSeriesRef.current.setData(cleanVolume);
      } else if (mode === "prepend") {
        // Prepend Mode (for history)
        const firstKnownTime =
          allKlinesRef.current.length > 0
            ? toSeconds(allKlinesRef.current[0].time)
            : Infinity;

        const olderKlines = cleanKlines.filter(
          (k) => toSeconds(k.time) < firstKnownTime,
        );
        const olderVolume = cleanVolume.filter(
          (v) => toSeconds(v.time) < firstKnownTime,
        );

        if (olderKlines.length > 0) {
          allKlinesRef.current = [...olderKlines, ...allKlinesRef.current];
          allVolumeRef.current = [...olderVolume, ...allVolumeRef.current];
          seriesRef.current.setData(allKlinesRef.current);
          volumeSeriesRef.current.setData(allVolumeRef.current);
        }
      } else {
        // Smart Update Mode (Merge API data into existing ref)
        const klineMap = new Map<number, CandleData>(
          allKlinesRef.current.map((k) => [toSeconds(k.time), k]),
        );
        const volMap = new Map<
          number,
          { time: Time; value: number; color: string }
        >(allVolumeRef.current.map((v) => [toSeconds(v.time), v]));

        const hasSignificantChange = (a: number, b: number) =>
          Math.abs(a - b) > 0.00000001;
        let hasHistoricalChange = false;
        const lastExistingTime =
          allKlinesRef.current.length > 0
            ? toSeconds(
                allKlinesRef.current[allKlinesRef.current.length - 1].time,
              )
            : 0;

        cleanKlines.forEach((k) => {
          const t = toSeconds(k.time);
          const existing = klineMap.get(t);
          if (
            !existing ||
            hasSignificantChange(existing.close, k.close) ||
            hasSignificantChange(existing.high, k.high) ||
            hasSignificantChange(existing.low, k.low)
          ) {
            klineMap.set(t, k);
            if (t < lastExistingTime) hasHistoricalChange = true;
          }
        });

        cleanVolume.forEach((v) => {
          const t = toSeconds(v.time);
          const existing = volMap.get(t);
          if (!existing || Math.abs(existing.value - v.value) > 0.1) {
            volMap.set(t, v);
            if (t < lastExistingTime) hasHistoricalChange = true;
          }
        });

        allKlinesRef.current = Array.from(klineMap.values()).sort(
          (a, b) => toSeconds(a.time) - toSeconds(b.time),
        );
        allVolumeRef.current = Array.from(volMap.values()).sort(
          (a, b) => toSeconds(a.time) - toSeconds(b.time),
        );

        if (hasHistoricalChange) {
          // Must use setData if older candles were updated
          seriesRef.current.setData(allKlinesRef.current);
          volumeSeriesRef.current.setData(allVolumeRef.current);
        } else {
          // Only update candles at or after the current tip
          cleanKlines
            .filter((k) => toSeconds(k.time) >= lastExistingTime)
            .sort((a, b) => toSeconds(a.time) - toSeconds(b.time))
            .forEach((k) => seriesRef.current?.update(k));

          cleanVolume
            .filter((v) => toSeconds(v.time) >= lastExistingTime)
            .sort((a, b) => toSeconds(a.time) - toSeconds(b.time))
            .forEach((v) => volumeSeriesRef.current?.update(v));
        }
      }

      if (allKlinesRef.current.length > 0) {
        lastCandleRef.current =
          allKlinesRef.current[allKlinesRef.current.length - 1];
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

        const validData: CandleData[] = validRaw.map((d) => ({
          time: d.time as Time,
          open: Number(d.open) || 0,
          high: Number(d.high) || 0,
          low: Number(d.low) || 0,
          close: Number(d.close) || 0,
        }));

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
          validData,
          volumeData,
          shouldFocus ? "reset" : "update",
        );

        if (allKlinesRef.current.length > 0) {
          const latest = allKlinesRef.current[allKlinesRef.current.length - 1];
          const price = latest.close;
          if (price > 0 && !isNaN(price)) {
            setLastClose(price);
            if (onMarketPriceUpdate) onMarketPriceUpdate(price);
            if (shouldFocus) focusOnPrices();
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
    const refreshInterval = setInterval(() => fetchData(false), 5000); // Reduced from 15s to 5s for faster updates

    // Real-time pulse from MarketKernel
    const formattedSym = symbol.replace("/", "");
    core.market.setSymbols([formattedSym]);
    const unsubscribeMarket = core.market.subscribe((updates) => {
      const update = updates[formattedSym];
      if (update && seriesRef.current && isMounted) {
        const price = Number(update.price);
        if (price > 0) {
          setLastClose(price);
          if (onMarketPriceUpdate) onMarketPriceUpdate(price);
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

        if (isMounted && seriesRef.current) {
          if (lastCandle && Number(lastCandle.time) === currentBarTime) {
            const updatedCandle = {
              ...lastCandle,
              close: price,
              high: Math.max(lastCandle.high, price),
              low: Math.min(lastCandle.low, price),
            };
            seriesRef.current.update(updatedCandle);
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
            seriesRef.current.update(newBar);
            lastCandleRef.current = newBar;
            allKlinesRef.current = [
              ...allKlinesRef.current.filter(
                (k) => Number(k.time) < currentBarTime,
              ),
              newBar,
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
      if (allKlinesRef.current.length === 0) return;
      const buy = Number(localPricesRef.current.buy);
      const tp = Number(localPricesRef.current.tp);
      const sl = Number(localPricesRef.current.sl);

      if (isNaN(buy) || buy <= 0) return;

      const buyCoord = series.priceToCoordinate(buy);
      const tpCoord =
        propsRef.current.tpEnabled && !isNaN(tp) && tp > 0
          ? series.priceToCoordinate(tp)
          : null;
      const slCoord =
        propsRef.current.slEnabled && !isNaN(sl) && sl > 0
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
    if (!seriesRef.current || !isChartReady) return;
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

    const isCover = mode === "COVER";
    updateMarkerLine(
      buyPriceLineRef,
      localPrices.buy,
      isCover ? "#10b981" : "#06b6d2",
      isCover ? "ENTRY-S" : "ENTRY-L",
      true,
    );
    updateMarkerLine(
      tpPriceLineRef,
      localPrices.tp,
      "#10b981",
      "TAKE PROFIT",
      tpEnabled,
    );
    updateMarkerLine(
      slPriceLineRef,
      localPrices.sl,
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
    const chart = chartRef.current!;
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
  ]);

  // Optimize Dragging
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const chart = chartRef.current;
    const series = seriesRef.current;

    const onMouseDown = (param: MouseEventParams) => {
      if (!param.point) return;
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
      else if (te && dist(t) < 30) setDraggingLine("tp");
      else if (se && dist(s) < 30) setDraggingLine("sl");
    };

    const isProcessing = { current: false };
    const onMouseMove = (param: MouseEventParams) => {
      if (
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
          const tpY = propsRef.current.tpEnabled 
            ? series.priceToCoordinate(localPricesRef.current.tp) || -100 
            : -100;
          const slY = propsRef.current.slEnabled 
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
        "w-full select-none flex flex-col h-full",
      )}
    >
      {!compact && typeof document !== "undefined" && document.getElementById("smart-chart-header-portal") ? (
        createPortal(
          <SmartChartHeader
            compact={compact}
            symbol={symbol}
            currentPrice={currentPrice}
            assets={assets}
            onAssetChange={onAssetChange}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            focusOnPrices={focusOnPrices}
            startScroll={startScroll}
            stopScroll={stopScroll}
            assetScrollRef={assetScrollRef}
          />,
          document.getElementById("smart-chart-header-portal")!
        )
      ) : (
        <SmartChartHeader
          compact={compact}
          symbol={symbol}
          currentPrice={currentPrice}
          assets={assets}
          onAssetChange={onAssetChange}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          focusOnPrices={focusOnPrices}
          startScroll={startScroll}
          stopScroll={stopScroll}
          assetScrollRef={assetScrollRef}
        />
      )}

      <div className="relative group/chart flex-1 flex flex-col pb-8">
        <div
          ref={chartContainerRef}
          className={cn(
            "w-full bg-slate-950/20 border border-slate-800 rounded-lg transition-all flex-1",
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

        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest italic">
                Matrix Senkronizasyon...
              </span>
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
            <span className="text-[9px] font-black text-cyan-400 uppercase tracking-tighter">
              Geçmiş Yükleniyor...
            </span>
          </div>
        )}

        {/* Enhanced Price Labels with trailing toggles and % */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {Object.entries(lineCoords).map(([key, coord]) => {
            if (coord === undefined) return null;

            let label = "";
            if (key === "buy") label = mode === "COVER" ? "Sell" : "TBuy";
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
                    onMouseDown={(e) => {
                      if (!isDisabledBuy) {
                        e.preventDefault();
                        setDraggingLine(key as "buy" | "tp" | "sl");
                      }
                    }}
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

      {/* Chart Footer: Engine Version Only */}
      {!compact && (
        <div className="flex items-center justify-end px-1 mt-1">
          <div className="text-[8px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1 pr-1">
            <div className="w-1 h-1 rounded-full bg-slate-800" />
            Matrix Engine v3.0
          </div>
        </div>
      )}
    </div>
  );
};
