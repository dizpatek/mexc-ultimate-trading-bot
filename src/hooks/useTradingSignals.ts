import { useState, useCallback } from "react";
import { F4Data } from "@/lib/trading-logic";
import { api } from "@/services/api";

export const MTF_INTERVALS = ["15m", "1h", "4h", "1d", "1w"];

async function fetchBulkMtfData(trades: { id: number; symbol: string }[], mapApiResponse: any) {
  const updates: Record<number, Record<string, F4Data>> = {};
  const newFailures: Record<number, boolean> = {};
  const CHUNK_SIZE = 25;

  for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
    const chunk = trades.slice(i, i + CHUNK_SIZE);
    const chunkSymbols = chunk.map(t => t.symbol.replace("/", ""));

    const rawIntervalResults = await Promise.all(
      MTF_INTERVALS.map(async (tf) => {
        try {
          const res = await api.post("/indicators/f4/bulk", {
            symbols: chunkSymbols,
            interval: tf,
            riskMode: "normal"
          });
          return { tf, data: res.data?.results || [] };
        } catch (e) {
          return { tf, data: [] };
        }
      })
    );

    const intervalMaps: Record<string, Map<string, any>> = {};
    rawIntervalResults.forEach(({ tf, data }) => {
      const symMap = new Map<string, any>();
      if (Array.isArray(data)) {
         data.forEach(item => {
           if (item && !item.error && item.symbol) symMap.set(item.symbol, item);
         });
      }
      intervalMaps[tf] = symMap;
    });

    chunk.forEach((trade) => {
       const sym = trade.symbol.replace("/", "");
       const map: Record<string, F4Data> = {};
       let hasData = false;
       
       MTF_INTERVALS.forEach(tf => {
          const r = intervalMaps[tf]?.get(sym);
          if (r) {
             map[tf] = mapApiResponse(r, sym, tf);
             hasData = true;
          }
       });
       
       if (hasData) {
         updates[trade.id] = map;
         newFailures[trade.id] = false;
       } else {
         newFailures[trade.id] = true;
       }
    });

    if (i + CHUNK_SIZE < trades.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return { updates, newFailures };
}

export function useTradingSignals() {
  const [signalDataMap, setSignalDataMap] = useState<Record<string, F4Data>>(
    {},
  );
  const [mtfData, setMtfData] = useState<
    Record<number, Record<string, F4Data>>
  >({});
  const [loadingMtf, setLoadingMtf] = useState<Record<number, boolean>>({});
  const [failedMtf, setFailedMtf] = useState<Record<number, boolean>>({});
  const [liveSignals, setLiveSignals] = useState<Record<string, F4Data>>({});
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);

  const mapApiResponse = useCallback(
    (data: unknown, symbol: string, interval: string): F4Data => {
      const d = data as any; // Cast for internal access to fix lint
      const prediction = d.prediction as Record<string, unknown> | undefined;
      return {
        symbol: symbol.replace("USDT", ""),
        interval: interval,
        currentPrice: d.currentPrice,
        f4Slope: d.f4Slope,
        f4Acceleration: d.f4Acceleration,
        whaleDetected: d.whaleDetected ?? false,
        whaleStatus: d.whaleStatus || d.whaleSignalText || "",
        trend: d.trend || "NEUTRAL",
        signal: d.signal || null,
        aiScore: d.confluenceScore ?? d.aiScore ?? 0,
        confluenceScore: d.confluenceScore,
        prediction: d.prediction,
        v5Indicators: Array.isArray(d.v5Indicators) ? d.v5Indicators : [],
        adm: d.adm,
        vpa: d.vpa,
        marketRegime: d.marketRegime || "NEUTRAL",
        volatilityRegime: d.volatilityRegime || "",
        regimePrediction: (prediction?.text as string) || d.regimePrediction || "",
        systemDecision: d.systemDecision || "",
        mtfConsensus: d.mtfConsensus || "",
        zScoreValue: d.zScoreValue || 0,
        deathRisk: d.deathRisk ?? false,
        smc: d.smc,
        liquidity: d.liquidity,
        whaleTrust: d.whaleTrust,
        tfAdaptFactor: d.tfAdaptFactor,
        f4PowerLoss: d.f4PowerLoss,
        liquidityZone: d.liquidityZone,
        f4EarlyBuy: d.f4EarlyBuy ?? false,
        f4EarlySell: d.f4EarlySell ?? false,
        f4ConfirmedBuy: d.f4ConfirmedBuy ?? false,
        f4ConfirmedSell: d.f4ConfirmedSell ?? false,
      };
    },
    [],
  );

  /**
   * Single signal fetcher
   */
  const fetchSignal = useCallback(
    async (symbol: string, interval: string): Promise<F4Data | null> => {
      try {
        const sym = symbol.replace("/", "");
        const res = await api.get(
          `/indicators/f4?symbol=${sym}&interval=${interval}`,
        );
        if (res.status !== 200) return null;
        const data = res.data;
        if (data.error) return null;
        return mapApiResponse(data, sym, interval);
      } catch (error) {
        console.error(
          `Failed to fetch F4 data for ${symbol}/${interval}`,
          error,
        );
        return null;
      }
    },
    [mapApiResponse],
  );

  /**
   * Fetch Multi-Timeframe Analysis for a trade row
   */
  const fetchMtfAnalysis = useCallback(
    async (tradeId: number, symbol: string) => {
      setLoadingMtf((prev) => ({ ...prev, [tradeId]: true }));
      try {
        const rawResults = await Promise.all(
          MTF_INTERVALS.map(async (tf) => {
            const d = await fetchSignal(symbol, tf);
            return { tf, d };
          }),
        );
        const map: Record<string, F4Data> = {};
        let hasData = false;
        rawResults.forEach(({ tf, d }) => {
          if (d) {
            map[tf] = d;
            hasData = true;
          }
        });
        if (hasData) {
          setMtfData((prev) => ({ ...prev, [tradeId]: map }));
          setFailedMtf((prev) => ({ ...prev, [tradeId]: false }));
        } else {
          setFailedMtf((prev) => ({ ...prev, [tradeId]: true }));
        }
      } finally {
        setLoadingMtf((prev) => ({ ...prev, [tradeId]: false }));
      }
    },
    [fetchSignal],
  );

  /**
   * Fetch MTF Analysis for multiple trades sequentially to prevent fan-out
   */
  const fetchMultipleMtfAnalysis = useCallback(
    async (trades: { id: number; symbol: string }[]) => {
      if (!trades.length) return;

      // Mark all as loading
      setLoadingMtf((prev) => {
        const next = { ...prev };
        trades.forEach((t) => (next[t.id] = true));
        return next;
      });

      try {
        const { updates, newFailures } = await fetchBulkMtfData(trades, mapApiResponse);
        setMtfData((prev) => ({ ...prev, ...updates }));
        setFailedMtf((prev) => ({ ...prev, ...newFailures }));
      } finally {
        setLoadingMtf((prev) => {
          const next = { ...prev };
          trades.forEach((t) => (next[t.id] = false));
          return next;
        });
      }
    },
    [mapApiResponse],
  );

  const fetchLiveSignals = useCallback(
    async (symbols: string[], interval: string = "4h") => {
      if (!symbols.length) return;

      try {
        const cleanSymbols = symbols.map(s => s.replace("/", ""));
        const res = await api.post("/indicators/f4/bulk", {
          symbols: cleanSymbols,
          interval,
          riskMode: "normal"
        });

        if (res.status === 200 && res.data?.results) {
          setLiveSignals((prev) => {
            const next = { ...prev };
            res.data.results.forEach((r: any) => {
              if (r && !r.error) {
                next[r.symbol] = mapApiResponse(r, r.symbol, interval);
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error("fetchLiveSignals bulk failed:", err);
      }
    },
    [mapApiResponse],
  );

  /**
   * Fetch signals for all symbols at a specific interval (Portfolio View) - CHUNKED for Scale
   */
  const fetchIntervalForSymbols = useCallback(
    async (symbols: string[], interval: string) => {
      if (!symbols.length) return;
      setIsLoadingSignals(true);
      
      try {
        const CHUNK_SIZE = 25; // Safer than 30-entry limit
        const chunks: string[][] = [];
        for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
          chunks.push(symbols.slice(i, i + CHUNK_SIZE));
        }

        const nextSignals: Record<string, F4Data> = {};

        for (const chunk of chunks) {
          const res = await api.post("/indicators/f4/bulk", {
            symbols: chunk,
            interval,
            riskMode: "normal",
          });

          if (res.status !== 200) continue;
          const data = res.data;

          if (data.results && Array.isArray(data.results)) {
            data.results.forEach((res: unknown) => {
              const r = res as any; // Cast for property access to fix lint
              if (r && !r.error) {
                const sym = r.symbol as string;
                nextSignals[sym] = mapApiResponse(r, sym, interval);
              }
            });
          }
        }

        setSignalDataMap((prev) => ({ ...prev, ...nextSignals }));
      } catch (error) {
        console.error("Failed to fetch chunked bulk indicator data", error);
      } finally {
        setIsLoadingSignals(false);
      }
    },
    [mapApiResponse],
  );

  return {
    signalDataMap,
    mtfData,
    loadingMtf,
    failedMtf,
    liveSignals,
    isLoadingSignals,
    fetchMtfAnalysis,
    fetchMultipleMtfAnalysis,
    fetchLiveSignals,
    fetchIntervalForSymbols,
  };
}
