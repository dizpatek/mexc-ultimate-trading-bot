import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";

// ──────────────────────────────────────────────────────────────
// Server-side in-memory cache for ticker prices.
// Lives in the Node.js process on Northflank — shared across ALL
// concurrent requests from different users for the same symbols.
// Cache TTL: 2.5s → max 1 upstream MEXC call per 2.5s regardless
// of how many users are polling. For 5 users @ 3s interval:
//   Without cache: 5 users × 20 req/min = 100 upstream calls/min
//   With cache   : ceil(60/2.5) = 24 upstream calls/min  ✓
// ──────────────────────────────────────────────────────────────

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const CACHE_TTL_MS = 900; // 0.9s TTL — 1s UI polling hızına izin verecek şekilde kısaltıldı

// Use globalThis to survive Next.js hot-reload without losing state
declare global {
  var __tickerCache: Map<string, CacheEntry> | undefined;
  var __tickerInflight: Map<string, Promise<unknown>> | undefined;
}

if (!globalThis.__tickerCache) globalThis.__tickerCache = new Map();
if (!globalThis.__tickerInflight) globalThis.__tickerInflight = new Map();

const cache = globalThis.__tickerCache;
const inflight = globalThis.__tickerInflight;

/**
 * Fetch from MEXC, deduplicate concurrent in-flight requests for the same key.
 */
async function fetchFromMexc(url: string, cacheKey: string): Promise<unknown> {
  // If there's already a pending fetch for this key, piggyback on it
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch(url, {
      cache: "no-store",
      // 6s hard timeout - MEXC bazen yavaş yanıt veriyor
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      throw new Error(`MEXC API responded with ${response.status}`);
    }

    const data = await response.json();

    // Store in cache
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  })();

  inflight.set(cacheKey, promise);
  promise.finally(() => inflight.delete(cacheKey));

  return promise;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols");
    const symbol = searchParams.get("symbol");

    let url = "https://api.mexc.com/api/v3/ticker/price";
    let cacheKey = "ticker:all";

    if (symbol) {
      url += `?symbol=${encodeURIComponent(symbol)}`;
      cacheKey = `ticker:${symbol}`;
    } else if (symbols) {
      // Normalize key: sort symbols so ["BTC","ETH"] and ["ETH","BTC"] hit same cache slot
      try {
        const parsed: string[] = JSON.parse(symbols);
        const sortedKey = parsed.slice().sort().join(",");
        cacheKey = `ticker:bulk:${sortedKey}`;
      } catch {
        cacheKey = `ticker:bulk:${symbols}`;
      }
      url += `?symbols=${encodeURIComponent(symbols)}`;
    }

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data, {
        headers: {
          "X-Cache": "HIT",
          "Cache-Control": "no-store",
        },
      });
    }

    // Cache miss — fetch (with deduplication)
    const data = await fetchFromMexc(url, cacheKey);

    return NextResponse.json(data, {
      headers: {
        "X-Cache": "MISS",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn("[ticker] Fetch error:", errorMessage);

    // On timeout/rate-limit, serve stale data if available
    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols");
    const symbol = searchParams.get("symbol");
    
    // Cache key'i success path ile aynı oluştur (sorted key)
    let staleCacheKey = "ticker:all";
    if (symbol) {
      staleCacheKey = `ticker:${symbol}`;
    } else if (symbols) {
      try {
        const parsed: string[] = JSON.parse(symbols);
        staleCacheKey = `ticker:bulk:${parsed.slice().sort().join(",")}`;
      } catch {
        staleCacheKey = `ticker:bulk:${symbols}`;
      }
    }

    const stale = cache.get(staleCacheKey);
    if (stale) {
      console.warn("[ticker] Serving stale cache on error:", errorMessage);
      return NextResponse.json(stale.data, {
        headers: { "X-Cache": "STALE", "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
