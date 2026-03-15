import { useReducer, useEffect, useCallback, useRef, useState } from "react";

export interface WhaleAlert {
  id: string;
  symbol: string;
  amount: number;
  valueUsd: number;
  side: "BUY" | "SELL";
  time: number;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
const MAX_HISTORY = 500;
const CLEANUP_INTERVAL_MS = 30_000;
const STORAGE_KEY = "matrix_whale_history";

// --- Reducer for idiomatic high-frequency state updates ---

type AlertState = { latest: WhaleAlert | null; history: WhaleAlert[] };
type AlertAction =
  | { type: "ADD"; payload: WhaleAlert }
  | { type: "CLEANUP" }
  | { type: "LOAD"; payload: WhaleAlert[] };

function alertReducer(state: AlertState, action: AlertAction): AlertState {
  switch (action.type) {
    case "ADD":
      // Prepend only – no O(N) scan here; cleanup handles purging
      return {
        latest: action.payload,
        history: [action.payload, ...state.history].slice(0, MAX_HISTORY),
      };
    case "CLEANUP": {
      const cutoff = Date.now() - TWO_DAYS_MS;
      const filtered = state.history.filter((a) => a.time > cutoff);
      // Return same reference if nothing changed – avoids unnecessary re-renders
      return filtered.length === state.history.length
        ? state
        : { ...state, history: filtered };
    }
    case "LOAD":
      return {
        ...state,
        history: action.payload
          .filter((a) => a.time > Date.now() - TWO_DAYS_MS)
          .slice(0, MAX_HISTORY),
      };
    default:
      return state;
  }
}

export function useWhaleRadar(symbols?: string | string[]) {
  const [{ latest: alert, history: alerts }, dispatch] = useReducer(
    alertReducer,
    {
      latest: null,
      history: [],
    },
  );
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const isFirstRun = useRef(true);

  // Initial load from localStorage
  useEffect(() => {
    if (!isFirstRun.current) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          dispatch({ type: "LOAD", payload: parsed });
        }
      }
    } catch (e) {
      console.error("[WhaleRadar] Failed to load history:", e);
    }
    isFirstRun.current = false;
  }, []);

  // Save to localStorage on change with 5s debounce to prevent UI jank
  useEffect(() => {
    if (alerts.length === 0) return;
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
      } catch (e) {
        console.error("[WhaleRadar] Persistence failed:", e);
      }
    }, 5000);
    return () => clearTimeout(timeoutId);
  }, [alerts]);

  // Periodic cleanup — runs every 30s
  useEffect(() => {
    const cleanup = setInterval(
      () => dispatch({ type: "CLEANUP" }),
      CLEANUP_INTERVAL_MS,
    );
    return () => clearInterval(cleanup);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    // Default monitored symbols (Market benchmarks)
    const baseSymbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"];
    const userSymbols = symbols ? (Array.isArray(symbols) ? symbols : [symbols]) : [];
    
    // Merge and deduplicate
    const finalSymbols = Array.from(new Set([...userSymbols, ...baseSymbols])).filter(Boolean);
    
    if (finalSymbols.length === 0) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    
    // Normalize for Binance combined streams: <symbol>@aggTrade
    // Example: btcbusd@aggTrade/ethbusd@aggTrade
    const streams = finalSymbols.map(s => {
      let norm = s.toUpperCase().replace("/", "").replace("USDT", "usdt").toLowerCase();
      if (!norm.endsWith("usdt")) norm += "usdt"; // Fallback to USDT if not specified
      return `${norm}@aggTrade`;
    });

    try {
      const combinedStreamUrl = `wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`;
      const ws = new WebSocket(combinedStreamUrl);

      ws.onopen = () => {
        if (wsRef.current === ws) setStatus("connected");
      };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return;
        try {
          const msg = JSON.parse(event.data);
          const data = msg.data;
          if (!data) return;

          const price = parseFloat(data.p);
          const quantity = parseFloat(data.q);
          const valueUsd = price * quantity;
          
          if (valueUsd >= 50000) {
            const rawSymbol = data.s;
            dispatch({
              type: "ADD",
              payload: {
                id: String(data.a),
                symbol: rawSymbol.replace("USDT", ""),
                amount: quantity,
                valueUsd,
                side: (data.m as boolean) ? "SELL" : "BUY",
                time: data.T as number,
              },
            });
          }
        } catch (e) {
          /* ignore parse */
        }
      };

      ws.onerror = () => {
        if (wsRef.current === ws) {
          setStatus("error");
          ws.close();
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) setStatus("disconnected");
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("[WhaleRadar] Connection failed:", e);
      setStatus("error");
    }
  }, [symbols]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      const ws = wsRef.current;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      
      // Fix: Only close if open or connecting
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch (e) {
          console.warn("[WhaleRadar] Close failed:", e);
        }
      }
      wsRef.current = null;
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      connect();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
      disconnect();
    };
  }, [connect, disconnect]);

  return { alert, alerts, status, connect, disconnect };
}
