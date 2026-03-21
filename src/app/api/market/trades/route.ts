import { NextRequest, NextResponse } from "next/server";
import { getMarketTrades, insertMarketTrades, MarketTrade } from "@/lib/db";
import { ensureTablesExist } from "@/lib/db-init";

/**
 * Standardizes symbol for uniform DB storage and API calls
 */
function standardizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[-/]/g, '');
}

/**
 * Parallel-Friendly Market Trade Fetcher with Database Caching
 * Optimized for "Maker/Taker" charts across multiple exchanges.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const symbolParam = searchParams.get("symbol") || "BTC-USDT";
    const exchangeParam = searchParams.get("exchange") || "mexc"; // Can be comma-separated list
    const from = Number(searchParams.get("from")) || (Date.now() - 5 * 60 * 1000);
    const to = Number(searchParams.get("to")) || Date.now();

    const cleanSymbol = standardizeSymbol(symbolParam);
    const exchanges = exchangeParam.split(',').filter(Boolean);

    // Optimized response map
    const results: Record<string, MarketTrade[]> = {};

    // process each exchange (most logic moved to a helper)
    const processExchange = async (ex: string) => {
        // 1. Get from DB
        // Note: DB symbol might be original or standardized. We use standardized for consistency.
        const dbTrades = await getMarketTrades(cleanSymbol, ex, from, to);
        
        // 2. Identify gap
        const latestDbTime = dbTrades.length > 0 ? dbTrades[dbTrades.length - 1].t : from;
        const now = Date.now();
        const needsFetch = (to > latestDbTime + 10000) && (to <= now + 60000);

        let fetched: MarketTrade[] = [];
        if (needsFetch) {
            const fetchFrom = Math.max(from, latestDbTime + 1);
            const parts = ex.split('_');
            const baseExchange = parts[0];
            const isFutures = parts[1] === 'PERP' ? 'true' : 'false';

            const url = `https://api.sjoerd.tech/get_trades?symbol=${cleanSymbol}&exchange=${baseExchange}&from=${fetchFrom}&to=${to}&futures=${isFutures}`;
            
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
                if (response.ok) {
                    const data = await response.json();
                    const tradesFromApi = data.trades || data || []; 
                    if (Array.isArray(tradesFromApi)) {
                        fetched = tradesFromApi
                            .map((tr: any) => ({
                                symbol: cleanSymbol,
                                exchange: ex,
                                t: Number(tr.t || tr.T || tr.timestamp),
                                p: Number(tr.p || tr.price),
                                q: Number(tr.q || tr.qty || tr.amount),
                                side: Number(tr.side === 'buy' || tr.side === 1 || tr.side === true ? 1 : 0),
                                usd: Number(tr.usd || (Number(tr.p || tr.price) * Number(tr.q || tr.qty || tr.amount)))
                            }))
                            .filter((tr: any) => !isNaN(tr.t) && !isNaN(tr.p) && tr.t > 0);
                        
                        if (fetched.length > 0) {
                            // Non-blocking save
                            insertMarketTrades(fetched).catch(err => console.error(`[API] DB Save Error for ${ex}:`, err.message));
                        }
                    }
                }
            } catch (e: any) {
                console.warn(`[API] Fetch gap failed for ${ex}:`, e.message);
            }
        }

        // Merge and simple unique (to avoids duplicates in return set if DB and Fetch overlapped)
        const combined = [...dbTrades, ...fetched];
        const seenKeys = new Set<string>();
        results[ex] = combined.filter(tr => {
            const key = `${tr.t}_${tr.p}_${tr.side}_${tr.q}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
    };

    // Parallel processing with full concurrency for speed
    const BATCH_SIZE = 30;
    for (let i = 0; i < exchanges.length; i += BATCH_SIZE) {
        const batch = exchanges.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(ex => processExchange(ex)));
    }

    // If only one exchange was requested, return as array for backward compatibility
    if (exchanges.length === 1) {
        return NextResponse.json(results[exchanges[0]] || []);
    }

    // Return as map for bulk requests
    return NextResponse.json(results);

  } catch (error) {
    console.error("[API] Market Trades Bulk Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
