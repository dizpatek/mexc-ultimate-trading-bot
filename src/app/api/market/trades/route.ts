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
 * Strategy: DB-first (cache hit), fallback to external API when DB empty or stale.
 */
export async function GET(req: NextRequest) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const symbolParam = searchParams.get("symbol") || "BTC-USDT";
    const exchangeParam = searchParams.get("exchange") || "mexc";
    const from = Number(searchParams.get("from")) || (Date.now() - 5 * 60 * 1000);
    const to = Number(searchParams.get("to")) || Date.now();

    const cleanSymbol = standardizeSymbol(symbolParam);
    const exchanges = exchangeParam.split(',').filter(Boolean);

    const results: Record<string, MarketTrade[]> = {};

    const processExchange = async (ex: string) => {
        // Sadece DB'den oku (Senkronizasyon arkaplanda sync_maker_taker.ts ile yapılır)
        const dbTrades = await getMarketTrades(cleanSymbol, ex, from, to);
        results[ex] = dbTrades;
    };

    const BATCH_SIZE = 30;
    for (let i = 0; i < exchanges.length; i += BATCH_SIZE) {
        const batch = exchanges.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(ex => processExchange(ex)));
    }

    if (exchanges.length === 1) {
        return NextResponse.json(results[exchanges[0]] || []);
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error("[API] Market Trades Bulk Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
