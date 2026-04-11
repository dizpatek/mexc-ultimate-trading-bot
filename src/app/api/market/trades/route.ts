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
    const SPOT_EXCHANGES = [
      "BINANCE_SPOT", "BYBIT_SPOT", "OKX_SPOT", "BITGET_SPOT", "MEXC_SPOT",
      "KUCOIN_SPOT", "GATE_SPOT", "HUOBI_SPOT", "HTX_SPOT", "COINBASE_SPOT",
      "KRAKEN_SPOT", "BITSTAMP_SPOT", "PHEMEX_SPOT", "WOO_SPOT", "CRYPTOCOM_SPOT"
    ];
    const PERP_EXCHANGES = [
      "BINANCE_PERP", "BYBIT_PERP", "OKX_PERP", "BITGET_PERP", "MEXC_PERP",
      "KUCOIN_PERP", "GATE_PERP", "HUOBI_PERP", "HTX_PERP", "PHEMEX_PERP",
      "BITMEX_PERP", "DERIBIT_PERP", "WOO_PERP"
    ];

    let exchanges = exchangeParam.split(',').filter(Boolean);
    if (exchangeParam === "ALL") {
        exchanges = [...SPOT_EXCHANGES, ...PERP_EXCHANGES];
    } else if (exchangeParam === "ALL_SPOT") {
        exchanges = SPOT_EXCHANGES;
    } else if (exchangeParam === "ALL_PERP") {
        exchanges = PERP_EXCHANGES;
    }

    const results: Record<string, MarketTrade[]> = {};

    const processExchange = async (ex: string) => {
        let dbTrades = await getMarketTrades(cleanSymbol, ex, from, to);
        
        const latestDbTime = dbTrades.length > 0 ? dbTrades[dbTrades.length - 1].t : 0;
        
        // --- FALLBACK LOGIC ---
        // If the latest trade in DB is more than 2 minutes older than 'to' (requested end range)
        // AND we are looking for very recent data, fetch directly from exchange.
        if (ex === "MEXC_SPOT" && (latestDbTime < to - 2 * 60 * 1000) && (to > Date.now() - 30 * 60 * 1000)) {
            try {
                const { getRecentTrades } = await import("@/lib/mexc");
                const { insertMarketTrades } = await import("@/lib/db");
                
                // Fetch the latest 500 trades from exchange
                const rawTrades = await getRecentTrades(cleanSymbol, 500);
                
                const mapped: MarketTrade[] = rawTrades.map((t: any) => ({
                    symbol: cleanSymbol,
                    exchange: "MEXC_SPOT",
                    t: t.time,
                    p: Number(t.price),
                    q: Number(t.qty),
                    side: t.isBuyerMaker ? 2 : 1, // MEXC: isBuyerMaker=true means Sell (2)
                    usd: Number(t.price) * Number(t.qty)
                }));
                
                // Save to DB (on conflict do nothing)
                await insertMarketTrades(mapped);
                
                // Re-read from DB to get the combined result
                dbTrades = await getMarketTrades(cleanSymbol, ex, from, to);
            } catch (e) {
                console.error("[API] Fallback fetch failed:", e);
            }
        }
        
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
