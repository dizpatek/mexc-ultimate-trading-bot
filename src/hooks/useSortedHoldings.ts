import { useState, useCallback, useMemo, useRef } from "react";
import { F4Data } from "@/lib/trading-logic";

export type SortKey =
  | "symbol"
  | "value"
  | "change24h"
  | "aiScore"
  | "regime"
  | "whale"
  | "prediction"
  | "decision";

// Minimal shape matching the useHoldings Holding type
interface HoldingEntry {
  symbol: string;
  holding: number;
  change24h: number;
}

// Minimal shape matching the TickerData from useMexcWebSocket
interface TickerEntry {
  p: string; // price as string
}

interface UseSortedHoldingsParams {
  holdings: HoldingEntry[] | null | undefined;
  signalDataMap: Record<string, F4Data>;
  tickerData: Record<string, TickerEntry>;
}

export function useSortedHoldings({
  holdings,
  signalDataMap,
  tickerData,
}: UseSortedHoldingsParams) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Ref to always read the latest sortKey synchronously inside the callback
  const sortKeyRef = useRef<SortKey | null>(null);
  const sortDirRef = useRef<"asc" | "desc">("desc");

  const handleSort = useCallback((key: SortKey) => {
    const prevKey = sortKeyRef.current;
    const prevDir = sortDirRef.current;

    if (prevKey === key) {
      // Same column → toggle direction
      const nextDir = prevDir === "asc" ? "desc" : "asc";
      sortDirRef.current = nextDir;
      setSortDir(nextDir);
    } else {
      // New column → start descending
      sortKeyRef.current = key;
      sortDirRef.current = "desc";
      setSortKey(key);
      setSortDir("desc");
    }
  }, []);

  const sortedHoldings = useMemo(() => {
    if (!holdings) return [];
    if (!sortKey) return holdings;

    return [...holdings].sort((a, b) => {
      const aSymbol =
        a.symbol !== "USDT" && a.symbol !== "USDC"
          ? `${a.symbol}USDT`
          : a.symbol;
      const bSymbol =
        b.symbol !== "USDT" && b.symbol !== "USDC"
          ? `${b.symbol}USDT`
          : b.symbol;

      const aSig = signalDataMap[aSymbol];
      const bSig = signalDataMap[bSymbol];
      const aPrice = tickerData[aSymbol]
        ? parseFloat(tickerData[aSymbol].p)
        : aSig?.currentPrice || 0;
      const bPrice = tickerData[bSymbol]
        ? parseFloat(tickerData[bSymbol].p)
        : bSig?.currentPrice || 0;

      if (sortKey === "symbol") {
        return sortDir === "asc"
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      }

      let aVal = 0;
      let bVal = 0;

      switch (sortKey) {
        case "value":
          aVal = a.holding * aPrice;
          bVal = b.holding * bPrice;
          break;
        case "change24h":
          aVal = a.change24h;
          bVal = b.change24h;
          break;
        case "aiScore":
          aVal = aSig?.aiScore || 0;
          bVal = bSig?.aiScore || 0;
          break;
        case "regime":
          aVal =
            aSig?.marketRegime === "RISK_ON"
              ? 2
              : aSig?.marketRegime === "NEUTRAL"
                ? 1
                : 0;
          bVal =
            bSig?.marketRegime === "RISK_ON"
              ? 2
              : bSig?.marketRegime === "NEUTRAL"
                ? 1
                : 0;
          break;
        case "whale":
          aVal = aSig?.whaleDetected ? 1 : 0;
          bVal = bSig?.whaleDetected ? 1 : 0;
          break;
        case "prediction":
          aVal = aSig?.prediction?.upProb ?? 50;
          bVal = bSig?.prediction?.upProb ?? 50;
          break;
        case "decision":
          aVal =
            aSig?.systemDecision === "GO_LONG"
              ? 2
              : aSig?.systemDecision === "WAIT"
                ? 1
                : 0;
          bVal =
            bSig?.systemDecision === "GO_LONG"
              ? 2
              : bSig?.systemDecision === "WAIT"
                ? 1
                : 0;
          break;
      }

      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [holdings, sortKey, sortDir, signalDataMap, tickerData]);

  return { sortedHoldings, sortKey, sortDir, handleSort };
}
