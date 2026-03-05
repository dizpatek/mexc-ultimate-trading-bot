import { useEffect, useState } from "react";
import { core } from "../services/ApiCore";

interface TickerData {
  s: string; // Symbol
  p: string; // Price
  r: string; // Price change percent
  t: number; // Timestamp
}

/**
 * Bridge hook to consume real-time market data from the ApiCore MarketKernel.
 */
export function useMexcWebSocket(symbols: string[]) {
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
  const [isConnected, setIsConnected] = useState(true);

  const symbolsKey = symbols.join(",");

  // Register symbols with the MarketKernel
  useEffect(() => {
    const syms = symbolsKey.split(",").filter(Boolean);
    if (syms.length > 0) {
      core.market.setSymbols(syms);
    }
  }, [symbolsKey]);

  // Subscribe to updates
  useEffect(() => {
    return core.market.subscribe((updates) => {
      const transformed: Record<string, TickerData> = {};
      Object.entries(updates).forEach(([s, data]) => {
        transformed[s] = {
          s,
          p: data.price,
          r: "0",
          t: data.time,
        };
      });
      setTickerData(transformed);
      setIsConnected(true);
    });
  }, []);

  return { tickerData, isConnected };
}
