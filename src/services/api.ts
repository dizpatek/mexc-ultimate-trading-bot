// API service to connect to our backend
import axios from "axios";

// In Next.js, API routes are relative
const API_BASE_URL = "/api"; // Changed from localhost:3000 to relative path

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    const mode = localStorage.getItem("TRADING_MODE");
    if (mode) {
      config.headers.set("Trading-Mode", mode);
    }
  }
  return config;
});

export { api };

export interface PortfolioData {
  totalValue: number;
  change24h: number;
  changePercentage: number;
  assets: number;
  isMock?: boolean; // Added warning flag for mock mode
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  holding: number;
  value: number;
  allocation: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  price: number;
  amount: number;
  total: number;
  time: string;
  status: "completed" | "pending" | "failed";
  profitLoss?: number;
  profitLossPercentage?: number;
}

export interface TradeSignal {
  signal: "buy" | "sell";
  pair: string;
  risk?: number;
  tp?: number[];
  sl?: number[];
  amount?: number;
  usdt?: number;
  secret?: string;
}

// Fetch portfolio summary
export const fetchPortfolioSummary = async (): Promise<PortfolioData> => {
  const response = await api.get("/portfolio/summary");
  return response.data;
};

// Fetch holdings
export const fetchHoldings = async (): Promise<Holding[]> => {
  const response = await api.get("/portfolio/holdings");
  return response.data;
};

// Fetch recent trades
export const fetchRecentTrades = async (): Promise<Trade[]> => {
  const response = await api.get("/portfolio/trades");
  return response.data;
};

// Send trade signal
export const sendTradeSignal = async (signal: TradeSignal) => {
  const response = await api.post("/webhook", signal);
  return response.data;
};

// Create SmartTrade
export const createSmartTrade = async (payload: Record<string, unknown>) => {
  const response = await api.post("/trade/smart", payload);
  return response.data;
};

// Diagnostic Logger
export const debugLog = async (
  level: "info" | "error" | "warn",
  message: string,
  context?: unknown,
) => {
  try {
    let msg = `[${level.toUpperCase()}] ${message}`;
    if (context && typeof context === "object") {
      const ctx = context as { error?: string };
      if (ctx.error) msg += ` | Error: ${ctx.error}`;
    }
    const debugMsg = encodeURIComponent(msg);
    // Use api instance to ensure Authorization headers are included (Fixes 401)
    api.get(`/portfolio/summary?debug=${debugMsg}`).catch(() => {});
  } catch {
    // Silently fail
  }
};

// Fetch Klines
export const fetchKlines = async (
  symbol: string,
  interval: string = "1h",
  limit: number = 500,
  startTime?: number,
  endTime?: number,
) => {
  const response = await api.get("/market/klines", {
    params: { symbol, interval, limit, startTime, endTime },
  });
  return response.data;
};
