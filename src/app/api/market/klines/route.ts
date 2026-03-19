import { NextRequest, NextResponse } from "next/server";
import { getKlines } from "@/lib/mexc";
import { getSessionUser } from "@/lib/auth-utils";

// ──────────────────────────────────────────────────────────────
// Server-side kline cache.
// Kline bars change once per candle — so TTL = half the candle duration
// makes sense. We use a fixed 12s TTL as a pragmatic middle-ground
// across all timeframes (even 1m candles won't look stale beyond ~3 bars).
//
// Impact: 5 users @ 15s polling → 20 upstream calls/min
//         With 12s cache        → max 5 upstream calls/min  ✓
// ──────────────────────────────────────────────────────────────

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const KLINE_CACHE_TTL_MS = 12_000; // 12s — balanced for all timeframes

declare global {
  var __klineCache: Map<string, CacheEntry> | undefined;
  var __klineInflight: Map<string, Promise<unknown>> | undefined;
}

if (!globalThis.__klineCache) globalThis.__klineCache = new Map();
if (!globalThis.__klineInflight) globalThis.__klineInflight = new Map();

const cache = globalThis.__klineCache;
const inflight = globalThis.__klineInflight;

async function fetchKlinesDeduped(
  symbol: string,
  interval: string,
  limit: number,
  startTime: number | undefined,
  endTime: number | undefined,
  cacheKey: string,
): Promise<unknown> {
  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const klines = await getKlines(symbol, interval, limit, startTime, endTime);

    const formattedKlines = klines.map((k: (string | number)[]) => ({
      time: (k[0] as number) / 1000,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    cache.set(cacheKey, {
      data: formattedKlines,
      expiresAt: Date.now() + KLINE_CACHE_TTL_MS,
    });

    return formattedKlines;
  })();

  inflight.set(cacheKey, promise);
  promise.finally(() => inflight.delete(cacheKey));

  return promise;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") || "1h";
    const limit = parseInt(searchParams.get("limit") || "500");
    const startTime = searchParams.get("startTime")
      ? parseInt(searchParams.get("startTime")!)
      : undefined;
    const endTime = searchParams.get("endTime")
      ? parseInt(searchParams.get("endTime")!)
      : undefined;

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );
    }

    // Historical requests (with startTime/endTime) are not cached — they're one-off
    const isCacheable = !startTime && !endTime;
    const cacheKey = `kline:${symbol}:${interval}:${limit}`;

    if (isCacheable) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data, {
          headers: { "X-Cache": "HIT", "Cache-Control": "no-store" },
        });
      }
    }

    const formattedKlines = await fetchKlinesDeduped(
      symbol,
      interval,
      limit,
      startTime,
      endTime,
      cacheKey,
    );

    return NextResponse.json(formattedKlines, {
      headers: {
        "X-Cache": isCacheable ? "MISS" : "BYPASS",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Klines API Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Stale-on-error for non-historical requests
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const interval = searchParams.get("interval") || "1h";
    const limit = parseInt(searchParams.get("limit") || "500");
    const cacheKey = `kline:${symbol}:${interval}:${limit}`;
    const stale = cache.get(cacheKey);
    if (stale) {
      console.warn("[klines] Serving stale cache on error:", errorMessage);
      return NextResponse.json(stale.data, {
        headers: { "X-Cache": "STALE", "Cache-Control": "no-store" },
      });
    }

    if (
      errorMessage.includes("timeout") ||
      errorMessage.includes("429") ||
      errorMessage.includes("ECONNABORTED")
    ) {
      return NextResponse.json(
        {
          error: "PROVIDER_TIMEOUT",
          message:
            "MEXC API is currently slow or rate-limiting. Retrying in background...",
          details: errorMessage,
        },
        { status: 504 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
