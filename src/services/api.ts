// API service to connect to our backend
import axios from "axios";

// In Next.js, API routes are relative
const API_BASE_URL = "/api"; // Changed from localhost:3000 to relative path

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 4.7 FIXED: Increased to 60s for stability during 24h Training Marathon
});

api.interceptors.request.use(async (config) => {
  // Throttler disabled to prevent development environment timeouts
  /*
  if (config.method === "get" || config.method === "GET") {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < MIN_REQUEST_GAP) {
      const delay = MIN_REQUEST_GAP - timeSinceLast;
      await new Promise(resolve => setTimeout(resolve, delay));
      lastRequestTime = Date.now();
    } else {
      lastRequestTime = now;
    }
  }
  */
  
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

// Add global error handler for 401 Unauthorized and Network Issues
api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const { config } = error;
    
    // RETRY LOGIC (Max 3 retries for Network Errors or Timeouts)
    if (config && !config._isRetry && (!error.response || error.code === "ECONNABORTED")) {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= 3) {
        const delay = config._retryCount * 1000;
        console.warn(`[API] Network Error/Timeout. Retrying (${config._retryCount}/3) in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return api(config);
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        const failedUrl = config?.url || "unknown";
        console.warn(`[API] 401 Unauthorized detected! URL: ${failedUrl} | Path: ${currentPath}`);

        // P1.0 SAFETY: Avoid auto-logout loop if we are on login page or if the failure is from the auth endpoints themselves
        if (currentPath === "/login" || failedUrl.includes("/auth/login") || failedUrl.includes("/auth/me")) {
           console.log("[API] 401 ignored to prevent redirect loop on auth/login pages.");
           return Promise.reject(error);
        }
        
        // Only clear and notify if there was a token to begin with
        if (localStorage.getItem("token")) {
          console.warn(`[API] Clearing session and triggering logout...`);
          localStorage.removeItem("token");
          // Dispatch custom event to notify components/contexts
          window.dispatchEvent(new Event("api-auth-logout"));
        }
      }
    } else if (error.code === "ECONNABORTED") {
      console.warn("[API] Request timeout. Server may be busy.");
    }
    return Promise.reject(error);
  }
);

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
let lastLogTime = 0;
export const debugLog = async (
  level: "info" | "error" | "warn",
  message: string,
  context?: unknown,
) => {
  try {
    const msg = `[${level.toUpperCase()}] ${message}`;
    console.log(msg, context || "");
    
    // 4.7 FIXED: Throttling remote logs to max 1 per second to prevent "API Explosion"
    const now = Date.now();
    if (now - lastLogTime < 1000) return;
    lastLogTime = now;

    let msgEncoded = encodeURIComponent(msg);
    if (context && typeof context === "object") {
        const ctx = context as { error?: string };
        if (ctx.error) msgEncoded += ` | Error: ${ctx.error}`;
    }
    api.get(`/portfolio/summary?debug=${msgEncoded}`).catch(() => {});
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
