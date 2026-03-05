import { api, Holding, PortfolioData, Trade } from "./api";

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

  public getData(): T | null {
    return this.data;
  }
}

/**
 * Market Kernel: High-frequency pricing and market data
 */
class MarketKernel extends Kernel<
  Record<string, { price: string; time: number }>
> {
  private symbols: Set<string> = new Set();

  constructor() {
    super(1000); // Reduced from 3s to 1s for faster candle updates
    this.symbols.add("BTCUSDT"); // Default seed
  }

  public setSymbols(symbols: string[]) {
    // Normalize symbols: BTC/USDT -> BTCUSDT, BTC -> BTCUSDT (unless it's already USDT)
    const normalized = symbols.map((s) => {
      let n = s.toUpperCase().replace("/", "");
      if (!n.endsWith("USDT") && n !== "USDT") n += "USDT";
      return n;
    });
    this.symbols = new Set(normalized);
    if (this.isRunning) {
      this.fetch(); // Immediate fetch on symbol change
    }
  }

  protected async fetch() {
    if (this.symbols.size === 0) {
      console.log("[MarketKernel] No symbols to fetch");
      return;
    }
    try {
      const symbolsJson = JSON.stringify(Array.from(this.symbols));
      console.log(`[MarketKernel] Fetching: ${symbolsJson}`);
      const response = await fetch(
        `/api/market/ticker?symbols=${encodeURIComponent(symbolsJson)}`,
      );
      const data = await response.json();

      if (Array.isArray(data)) {
        console.log(`[MarketKernel] Received ${data.length} updates`);
        const updates: Record<string, { price: string; time: number }> = {};
        const now = Date.now();
        data.forEach((item: { symbol: string; price: string }) => {
          updates[item.symbol] = { price: item.price, time: now };
        });
        this.notify({ ...(this.data || {}), ...updates });
      }
    } catch (err) {
      console.error("[MarketKernel] Fetch Error:", err);
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
    super(15000); // Reduced from 5s to 15s to save Vercel usage limits
  }

  protected async fetch() {
    console.log("[PortfolioKernel] Fetching portfolio data...");
    try {
      // Helper to handle individual fetch errors
      const safeFetch = async <R>(
        fn: () => Promise<R>,
        name: string,
        fallback: R,
      ): Promise<R> => {
        try {
          return await fn();
        } catch (error: unknown) {
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

      const [holdings, summary, trades] = await Promise.all([
        safeFetch(fetchHoldings, "Holdings", this.data?.holdings || []),
        safeFetch(fetchSummary, "Summary", this.data?.summary || null),
        safeFetch(fetchTrades, "Trades", this.data?.trades || []),
      ]);

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
      console.log("[ApiCore] Client environment detected, starting kernels...");
      this.market.start();
      this.portfolio.start();
    } else {
      console.log("[ApiCore] SSR environment detected, kernels in idle mode.");
    }
  }

  public static getInstance(): ApiCore {
    if (!ApiCore.instance) {
      ApiCore.instance = new ApiCore();
    } else if (typeof window !== "undefined") {
      // Ensure running if instance existed but was idle
      ApiCore.instance.market.start();
      ApiCore.instance.portfolio.start();
    }
    return ApiCore.instance;
  }
}

export const core = ApiCore.getInstance();
