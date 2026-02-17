import { api, Holding, PortfolioData, Trade } from './api';

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
        return () => { this.subscribers.delete(cb); };
    }

    protected notify(newData: T) {
        this.data = newData;
        this.subscribers.forEach(cb => cb(newData));
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
class MarketKernel extends Kernel<Record<string, { price: string; time: number }>> {
    private symbols: Set<string> = new Set();

    constructor() {
        super(500); // 500ms high-priority pulse
        this.symbols.add('BTCUSDT'); // Default seed
    }

    public setSymbols(symbols: string[]) {
        // Normalize symbols: BTC/USDT -> BTCUSDT, BTC -> BTCUSDT (unless it's already USDT)
        const normalized = symbols.map(s => {
            let n = s.toUpperCase().replace('/', '');
            if (!n.endsWith('USDT') && n !== 'USDT') n += 'USDT';
            return n;
        });
        this.symbols = new Set(normalized);
        if (this.isRunning) {
            this.fetch(); // Immediate fetch on symbol change
        }
    }

    protected async fetch() {
        if (this.symbols.size === 0) {
            console.log('[MarketKernel] No symbols to fetch');
            return;
        }
        try {
            const symbolsJson = JSON.stringify(Array.from(this.symbols));
            console.log(`[MarketKernel] Fetching: ${symbolsJson}`);
            const response = await fetch(`/api/market/ticker?symbols=${encodeURIComponent(symbolsJson)}`);
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
            console.error('[MarketKernel] Fetch Error:', err);
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
class PortfolioKernel extends Kernel<{ holdings: Holding[]; summary: PortfolioData | null; trades: Trade[] }> {
    constructor() {
        super(5000); // 5 seconds for portfolio
    }

    protected async fetch() {
        console.log('[PortfolioKernel] Fetching portfolio data...');
        try {
            // Use individual try-catches to prevent one failure from blocking everything
            const fetchHoldings = async () => {
                try { return (await api.get('/portfolio/holdings')).data; }
                catch (e) { console.error('[PortfolioKernel] Holdings Error:', e); return this.data?.holdings || []; }
            };
            const fetchSummary = async () => {
                try { return (await api.get('/portfolio/summary')).data; }
                catch (e) { console.error('[PortfolioKernel] Summary Error:', e); return this.data?.summary || null; }
            };
            const fetchTrades = async () => {
                try { return (await api.get('/portfolio/trades')).data; }
                catch (e) { console.error('[PortfolioKernel] Trades Error:', e); return this.data?.trades || []; }
            };

            const [holdings, summary, trades] = await Promise.all([
                fetchHoldings(),
                fetchSummary(),
                fetchTrades()
            ]);

            console.log(`[PortfolioKernel] Status: Holdings(${holdings?.length}), Summary(${!!summary}), Trades(${trades?.length})`);
            this.notify({ holdings, summary, trades });
        } catch (err) {
            console.error('[PortfolioKernel] Fatal Fetch Error:', err);
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
        console.log('[ApiCore] Initializing Singleton...');
        this.market = new MarketKernel();
        this.portfolio = new PortfolioKernel();
        
        if (typeof window !== 'undefined') {
            console.log('[ApiCore] Client environment detected, starting kernels...');
            this.market.start();
            this.portfolio.start();
        } else {
            console.log('[ApiCore] SSR environment detected, kernels in idle mode.');
        }
    }

    public static getInstance(): ApiCore {
        if (!ApiCore.instance) {
            ApiCore.instance = new ApiCore();
        } else if (typeof window !== 'undefined') {
            // Ensure running if instance existed but was idle
            ApiCore.instance.market.start();
            ApiCore.instance.portfolio.start();
        }
        return ApiCore.instance;
    }
}

export const core = ApiCore.getInstance();
