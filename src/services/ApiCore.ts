import { api, Holding, PortfolioData, Trade } from "./api"; // Import standardized instance and types

/**
 * Types for the Core System
 */
export type CoreCallback<T> = (data: T) => void;

abstract class Kernel<T> {
  protected data: T | null = null;
  protected subscribers: Set<CoreCallback<T>> = new Set();
  protected intervalId: NodeJS.Timeout | null = null;
  protected isRunning: boolean = false;

  constructor(protected refreshInterval: number) {}

  public subscribe(cb: CoreCallback<T>): () => void {
    this.subscribers.add(cb);
    if (this.data) cb(this.data);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  protected notify(newData: T) {
    this.data = newData;
    this.subscribers.forEach((cb) => cb(newData));
  }

  public abstract start(): void;
  public refresh(): void {
    this.fetch();
  }
  protected abstract fetch(): Promise<void>;

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  public restart() {
    this.stop();
    this.start();
  }

  public getData(): T | null {
    return this.data;
  }
}

class MarketKernel extends Kernel<
  Record<string, { price: string; time: number }>
> {
  private symbols: Set<string> = new Set();
  private symbolRegistry: Map<string, Set<string>> = new Map(); // componentId -> symbols
  private debounceTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super(2000); // Reduced from 1s to 2s to reduce MEXC API pressure
  }

  /**
   * Register symbols needed by a specific component or service.
   * This allows multiple modules to request data without orverwriting each other.
   */
  public registerSymbols(componentId: string, symbols: string[]) {
    const normalized = symbols.map((s) => {
      let n = s.toUpperCase().replace("/", "");
      if (!n.endsWith("USDT") && n !== "USDT") n += "USDT";
      return n;
    });

    this.symbolRegistry.set(componentId, new Set(normalized));
    this.recalculateSymbols();
  }

  public unregisterSymbols(componentId: string) {
    this.symbolRegistry.delete(componentId);
    this.recalculateSymbols();
  }

  private recalculateSymbols() {
    const allSymbols = new Set<string>();
    this.symbolRegistry.forEach((symbols) => {
      symbols.forEach((s) => allSymbols.add(s));
    });

    // Check if anything actually changed
    const changed =
      allSymbols.size !== this.symbols.size ||
      Array.from(allSymbols).some((s) => !this.symbols.has(s));

    if (changed) {
      this.symbols = allSymbols;
      this.triggerDebouncedFetch();
    }
  }

  private triggerDebouncedFetch() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      if (this.isRunning) this.fetch();
      this.debounceTimeout = null;
    }, 500); // Minimum 500ms as requested by user
  }

  /**
   * Legacy support for overwriting everything (discouraged)
   */
  public setSymbols(symbols: string[]) {
    this.registerSymbols("legacy_global", symbols);
  }

  protected async fetch() {
    if (this.symbols.size === 0) return;
    try {
      const allSymbols = Array.from(this.symbols);
      const CHUNK_SIZE = 20; // Reduced from 30 to 20 to reduce per-request payload
      const chunks: string[][] = [];
      
      for (let i = 0; i < allSymbols.length; i += CHUNK_SIZE) {
        chunks.push(allSymbols.slice(i, i + CHUNK_SIZE));
      }

      const now = Date.now();
      const updates: Record<string, { price: string; time: number }> = {};

      await Promise.all(chunks.map(async (chunk) => {
        try {
          const symbolsJson = JSON.stringify(chunk);
          const response = await api.get("/market/ticker", {
            params: { symbols: symbolsJson },
            timeout: 8000, // 8s hard cap per chunk — well within Vercel's 30s limit
          });
          const data = response.data;

          if (Array.isArray(data)) {
            data.forEach((item: { symbol: string; price: string }) => {
              updates[item.symbol] = { price: item.price, time: now };
            });
          }
        } catch (innerErr: any) {
          const isTimeout = innerErr?.code === 'ECONNABORTED' || innerErr?.message?.includes('timeout');
          if (isTimeout) {
            console.warn("[MarketKernel] Chunk timeout — skipping, using last known prices.");
          } else {
            console.error("[MarketKernel] Chunk Fetch Error:", innerErr?.message || innerErr);
          }
          // Slow down on repeated errors
          if (this.refreshInterval < 10000) {
            this.refreshInterval = Math.min(this.refreshInterval + 2000, 10000);
            this.restart();
          }
        }
      }));

      // Recover interval if it was slowed down
      if (Object.keys(updates).length > 0 && this.refreshInterval > 1000) {
        this.refreshInterval = 1000;
        this.restart();
      }

      if (Object.keys(updates).length > 0) {
        this.notify({ ...(this.data || {}), ...updates });
      }
    } catch (err) {
      console.error("[MarketKernel] Fatal Fetch Error:", err);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.fetch();
    this.intervalId = setInterval(() => this.fetch(), this.refreshInterval);
  }
}

/**
 * Portfolio Kernel: Balance, holdings and trade history
 */
class PortfolioKernel extends Kernel<{
  holdings: Holding[];
  summary: PortfolioData | null;
  trades: Trade[];
}> {
  constructor() {
    super(15000); // Reduced from 5s to 15s to save cloud usage limits
  }

  protected async fetch() {
    try {
      // Helper to handle individual fetch errors with backoff
      const safeFetch = async <R>(
        fn: () => Promise<R>,
        name: string,
        fallback: R,
      ): Promise<R> => {
        try {
          const result = await fn();
          // Reset interval if successful
          if (this.refreshInterval > 15000) {
            console.log(`[PortfolioKernel] ${name} recovered. Resetting interval.`);
            this.refreshInterval = 15000;
            this.restart();
          }
          return result;
        } catch (error: unknown) {
          // Increase interval on error (Backoff) to prevent spamming a failing server
          if (this.refreshInterval < 60000) {
             this.refreshInterval += 15000;
             console.warn(`[PortfolioKernel] ${name} failed. Increasing interval to ${this.refreshInterval}ms`);
             this.restart();
          }

          let msg = "";
          if (error && typeof error === "object" && "response" in error) {
            const axiosError = error as {
              response?: {
                data?: { error?: string; details?: string };
                status?: number;
              };
            };
            msg =
              axiosError.response?.data?.error ||
              axiosError.response?.data?.details ||
              "Unknown Error";
            if (
              axiosError.response?.status === 400 ||
              axiosError.response?.status === 401
            ) {
              console.warn(`[PortfolioKernel] ${name} Warning:`, msg);
            } else {
              console.error(
                `[PortfolioKernel] ${name} Failed (${axiosError.response?.status}):`,
                msg,
              );
            }
          } else {
            console.error(`[PortfolioKernel] ${name} Error:`, error);
          }
          return fallback;
        }
      };

      const fetchHoldings = () =>
        api.get("/portfolio/holdings").then((r) => r.data);
      const fetchSummary = () =>
        api.get("/portfolio/summary").then((r) => r.data);
      const fetchTrades = () =>
        api.get("/portfolio/trades").then((r) => r.data);

      // We stagger them slightly (100ms) to avoid instant concurrent pressure on the node server,
      // while still being effectively parallel for the user.
      const holdingsP = safeFetch(fetchHoldings, "Holdings", this.data?.holdings || []);
      await new Promise(r => setTimeout(r, 100));
      const summaryP = safeFetch(fetchSummary, "Summary", this.data?.summary || null);
      await new Promise(r => setTimeout(r, 100));
      const tradesP = safeFetch(fetchTrades, "Trades", this.data?.trades || []);

      const [holdings, summary, trades] = await Promise.all([holdingsP, summaryP, tradesP]);

      console.log(
        `[PortfolioKernel] Status: Holdings(${holdings?.length}), Summary(${!!summary}), Trades(${trades?.length})`,
      );
      this.notify({ holdings, summary, trades });
    } catch (err) {
      console.error("[PortfolioKernel] Fatal Fetch Error:", err);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.fetch();
    this.intervalId = setInterval(() => this.fetch(), this.refreshInterval);
  }
}

/**
 * ApiCore: Singleton dispatcher
 */
class ApiCore {
  private static instance: ApiCore;

  public market: MarketKernel;
  public portfolio: PortfolioKernel;

  private constructor() {
    console.log("[ApiCore] Initializing Singleton...");
    this.market = new MarketKernel();
    this.portfolio = new PortfolioKernel();

    if (typeof window !== "undefined") {
      console.log("[ApiCore] Client environment detected. Checking auth state...");
      
      const checkAndStart = () => {
        const token = localStorage.getItem("token");
        if (token) {
           console.log("[ApiCore] Token found, starting kernels...");
           this.market.start();
           this.portfolio.start();
        } else {
           console.log("[ApiCore] No token found, keeping kernels idle.");
           this.market.stop();
           this.portfolio.stop();
        }
      };

      checkAndStart();

      // Listen for mode changes
      window.addEventListener("tradingModeChanged", () => {
        const token = localStorage.getItem("token");
        if (token) {
          this.portfolio.refresh();
          this.market.refresh();
        }
      });

      // Listen for auth events from api.ts
      window.addEventListener("api-auth-logout", () => {
        console.log("[ApiCore] Logout event received, stopping kernels.");
        this.market.stop();
        this.portfolio.stop();
      });

      // Allow manual start (e.g. after login)
      window.addEventListener("api-auth-login", () => {
        console.log("[ApiCore] Login event received, starting kernels.");
        checkAndStart();
      });
    } else {
      console.log("[ApiCore] SSR environment detected, kernels in idle mode.");
    }
  }

  public static getInstance(): ApiCore {
    if (!ApiCore.instance) {
      ApiCore.instance = new ApiCore();
    }
    return ApiCore.instance;
  }
}

export const core = ApiCore.getInstance();
