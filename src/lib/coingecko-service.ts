import axios from 'axios';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Cache to prevent hitting rate limits
// CoinGecko Free API limit: ~10-30 calls / minute
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_DURATION = 60 * 1000; // 1 minute cache

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_DURATION) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

function setCache<T>(key: string, data: T) {
    cache.set(key, { data, timestamp: Date.now() });
}

export interface MarketCoin {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    total_volume: number;
    price_change_percentage_24h: number;
}

export async function getTopCoins(limit: number = 20): Promise<MarketCoin[]> {
    const cacheKey = `top_coins_${limit}`;
    const cached = getCached<MarketCoin[]>(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get<MarketCoin[]>(`${BASE_URL}/coins/markets`, {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: limit,
                page: 1,
                sparkline: false
            }
        });

        // Parse volume ensuring it's a number
        const coins = response.data.map(coin => ({
            ...coin,
            total_volume: Number(coin.total_volume) || 0
        }));

        setCache(cacheKey, coins);
        return coins;
    } catch (error: any) {
        console.error('CoinGecko API Error:', error.message);
        // Return empty array on error to prevent crashing
        return [];
    }
}
