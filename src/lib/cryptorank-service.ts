import axios from 'axios';

const CRYPTORANK_API_KEY = process.env.CRYPTORANK_API_KEY || 'a6ea95811d51a85fda8206308aa0b6c435e24c1327191b261776b8bf101a';
const BASE_URL = 'https://api.cryptorank.io/v1';

// Rate limiting for free tier (100 requests per day)
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_DAY = 90; // Leave some buffer
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function resetRateLimitIfNeeded() {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    if (now - lastResetTime > dayInMs) {
        requestCount = 0;
        lastResetTime = now;
    }
}

function canMakeRequest(): boolean {
    resetRateLimitIfNeeded();
    return requestCount < MAX_REQUESTS_PER_DAY;
}

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION) {
        cache.delete(key);
        return null;
    }

    return entry.data as T;
}

function setCache<T>(key: string, data: T) {
    cache.set(key, { data, timestamp: Date.now() });
}

async function makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

    // Check cache first
    const cached = getCached<T>(cacheKey);
    if (cached) {
        console.log(`[CryptoRank] Cache hit for ${endpoint}`);
        return cached;
    }

    // Check rate limit
    if (!canMakeRequest()) {
        console.warn('[CryptoRank] Rate limit reached, using cached data or throwing error');
        throw new Error('CryptoRank API rate limit reached for today');
    }

    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, {
            params: {
                api_key: CRYPTORANK_API_KEY,
                ...params
            },
            timeout: 10000
        });

        requestCount++;
        console.log(`[CryptoRank] Request ${requestCount}/${MAX_REQUESTS_PER_DAY} - ${endpoint}`);

        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        console.error('[CryptoRank] API Error:', error.message);
        throw error;
    }
}

export interface CryptoRankCurrency {
    id: number;
    key: string;
    name: string;
    symbol: string;
    rank: number;
    price: {
        USD: number;
    };
    volume24h: number;
    marketCap: number;
    circulatingSupply: number;
    maxSupply: number | null;
    delta: {
        hour: number;
        day: number;
        week: number;
        month: number;
        quarter: number;
        year: number;
    };
}

export interface CryptoRankGlobalStats {
    marketCap: number;
    volume24h: number;
    btcDominance: number;
    ethDominance: number;
    marketCapChange24h: number;
}

export async function getTopCurrencies(limit: number = 20): Promise<CryptoRankCurrency[]> {
    try {
        const response = await makeRequest<{ data: CryptoRankCurrency[] }>('/currencies', {
            limit,
            convert: 'USD'
        });
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch top currencies:', error);
        return [];
    }
}

export async function getGlobalStats(): Promise<CryptoRankGlobalStats | null> {
    try {
        const response = await makeRequest<{ data: CryptoRankGlobalStats }>('/global');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch global stats:', error);
        return null;
    }
}

export async function getCurrencyBySymbol(symbol: string): Promise<CryptoRankCurrency | null> {
    try {
        const response = await makeRequest<{ data: CryptoRankCurrency[] }>('/currencies', {
            symbols: symbol,
            convert: 'USD'
        });
        return response.data?.[0] || null;
    } catch (error) {
        console.error(`Failed to fetch currency ${symbol}:`, error);
        return null;
    }
}

export function getRateLimitStatus() {
    resetRateLimitIfNeeded();
    return {
        used: requestCount,
        remaining: MAX_REQUESTS_PER_DAY - requestCount,
        total: MAX_REQUESTS_PER_DAY,
        resetTime: new Date(lastResetTime + 24 * 60 * 60 * 1000)
    };
}
