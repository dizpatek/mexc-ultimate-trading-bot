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

export function useWhaleRadar(symbol?: string) {
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

  // Periodic cleanup — runs every 30s, not on every WS message
  useEffect(() => {
    const cleanup = setInterval(
      () => dispatch({ type: "CLEANUP" }),
      CLEANUP_INTERVAL_MS,
    );
    return () => clearInterval(cleanup);
  }, []);

  const connect = useCallback(() => {
    // P4.1: Ensure no orphaned connection exists before starting a new one
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

    if (!symbol) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    const normalizedSym = symbol.replace("/", "").toLowerCase();
    const activeSymbol = symbol; // P4.1: Capture the symbol for this connection's message handler

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${normalizedSym}@aggTrade`,
    );

    ws.onopen = () => setStatus("connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        const quantity = parseFloat(data.q);
        const valueUsd = price * quantity;
        if (valueUsd > 100000) {
          // P4.1: Use CAPTURED activeSymbol instead of potentially changed outer symbol
          dispatch({
            type: "ADD",
            payload: {
              id: String(data.a),
              symbol: activeSymbol.replace("USDT", "").replace("/", ""),
              amount: quantity,
              valueUsd,
              side: (data.m as boolean) ? "SELL" : "BUY",
              time: data.T as number,
            },
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      setStatus("error");
      ws.close();
    };

    ws.onclose = () => setStatus("disconnected");

    wsRef.current = ws;
  }, [symbol]); // Re-connect when symbol changes

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    // P4.2: Add small 1s debounce to avoid rapid re-connections when portfolio values fluctuate
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
