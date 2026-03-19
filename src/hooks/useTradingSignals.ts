import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { F4Data } from "@/lib/trading-logic";
export type { F4Data };

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

export function useTradingSignals(enabled: boolean = true) {
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
      const d = data as any;
      const prediction = d.prediction as Record<string, unknown> | undefined;
      return {
        ...d,
        symbol: symbol.replace("USDT", ""),
        interval: interval,
        signal: (d.signal === "WAIT" || d.signal === "BEKLE") ? null : d.signal,
      };
    },
    [],
  );

  const fetchSignal = useCallback(
    async (symbol: string, interval: string): Promise<F4Data | null> => {
      if (!enabled) return null;
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
    [mapApiResponse, enabled],
  );

  const fetchMtfAnalysis = useCallback(
    async (tradeId: number, symbol: string) => {
      if (!enabled) return;
      setLoadingMtf((prev) => ({ ...prev, [tradeId]: true }));
      try {
        const rawResults = await Promise.all(
          MTF_INTERVALS.map(async (tf: string) => {
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
    [fetchSignal, enabled],
  );

  const fetchMultipleMtfAnalysis = useCallback(
    async (trades: { id: number; symbol: string }[]) => {
      if (!enabled || !trades.length) return;

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
    [mapApiResponse, enabled],
  );

  const fetchLiveSignals = useCallback(
    async (symbols: string[], interval: string = "4h") => {
      if (!enabled || !symbols.length) return;

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
    [mapApiResponse, enabled],
  );

  const fetchIntervalForSymbols = useCallback(
    async (symbols: string[], interval: string) => {
      if (!enabled || !symbols.length) return;
      setIsLoadingSignals(true);
      
      try {
        const CHUNK_SIZE = 100;
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
              const r = res as any;
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
    [mapApiResponse, enabled],
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
