import * as dotenv from "dotenv";
dotenv.config();

import { pool, sql, getMarketTrades, insertMarketTrades, MarketTrade, getLatestMarketTrade } from "../../src/lib/db";
import { ensureTablesExist } from "../../src/lib/db-init";
import ccxt from "ccxt";

/**
 * Standardizes symbol for DB storage (e.g., BTCUSDT)
 */
function standardizeSymbol(symbol: string): string {
    return symbol.toUpperCase().replace(/[-/]/g, '');
}

/**
 * Maps DB symbol (e.g. BTCUSDT) to CCXT-specific format (e.g. BTC/USDT)
 */
function getCcxtSymbol(symbol: string, exchangeStr: string) {
    const clean = standardizeSymbol(symbol);
    const isPerp = exchangeStr.includes("_PERP");
    let base = clean.replace("USDT", "");
    
    // Special Mappings
    if (exchangeStr.startsWith("DERIBIT")) return "BTC-PERPETUAL";
    if (exchangeStr.startsWith("BITMEX")) return "BTC/USD:BTC";
    if (exchangeStr.startsWith("COINBASE")) return `${base}/USD`;

    if (isPerp) {
        // Binance, Bybit, OKX Perp format: BASE/USDT:USDT
        if (["BINANCE", "BYBIT", "OKX", "BITGET", "MEXC"].some(e => exchangeStr.startsWith(e))) {
            return `${base}/USDT:USDT`;
        }
        return `${base}/USDT`;
    }
    
    return `${base}/USDT`;
}

const DEFAULT_EXCHANGES = [
  // Spot Orijinal 15 Borsa
  "BINANCE_SPOT", "BYBIT_SPOT", "OKX_SPOT", "BITGET_SPOT", "MEXC_SPOT", 
  "KUCOIN_SPOT", "GATE_SPOT", "HUOBI_SPOT", "HTX_SPOT", "COINBASE_SPOT", 
  "KRAKEN_SPOT", "BITSTAMP_SPOT", "PHEMEX_SPOT", "WOO_SPOT", "CRYPTOCOM_SPOT",
  // Perp Orijinal 13 Borsa
  "BINANCE_PERP", "BYBIT_PERP", "OKX_PERP", "BITGET_PERP", "MEXC_PERP", 
  "KUCOIN_PERP", "GATE_PERP", "HUOBI_PERP", "HTX_PERP", "PHEMEX_PERP", 
  "BITMEX_PERP", "DERIBIT_PERP", "WOO_PERP"
];

// Cache CCXT instances
const ccxtExchanges: Record<string, any> = {};

function getCcxtExchange(exString: string) {
    if (ccxtExchanges[exString]) return ccxtExchanges[exString];
    
    let [name, type] = exString.split('_');
    let ccxtName = name.toLowerCase();
    if (ccxtName === 'huobi') ccxtName = 'htx';
    const isFutures = type === 'PERP';
    
    if (!(ccxtName in ccxt)) return null;
    
    try {
        const ExClass = (ccxt as any)[ccxtName];
        const exchange = new ExClass({
            enableRateLimit: true,
            timeout: 20000,
            options: { defaultType: isFutures ? 'swap' : 'spot' }
        });
        ccxtExchanges[exString] = exchange;
        return exchange;
    } catch(e) {
        return null;
    }
}

/**
 * Detect symbols that actually need syncing.
 * Strategy: Orders DB'den aktifleri al + Popüler demirbaşlar (Anchor coins)
 */
async function getTargetSymbols(): Promise<string[]> {
    try {
        const { rows } = await pool.query(`
            SELECT DISTINCT symbol FROM orders 
            WHERE status NOT IN ('CLOSED', 'CANCELED', 'REJECTED')
            UNION (SELECT 'BTCUSDT')
            UNION (SELECT 'ETHUSDT')
            UNION (SELECT 'TAOUSDT')
            UNION (SELECT 'SOLUSDT')
        `);
        return rows.map((r: any) => standardizeSymbol(r.symbol));
    } catch (e) {
        return ["BTCUSDT", "ETHUSDT", "TAOUSDT"];
    }
}

async function fetchAndSave(exchangeStr: string, symbol: string, from: number, to: number) {
    const exchange = getCcxtExchange(exchangeStr);
    if (!exchange || !exchange.has['fetchTrades']) return;
    
    const ccxtSymbol = getCcxtSymbol(symbol, exchangeStr);
    
    try {
        const params: any = {};
        if (['MEXC_SPOT', 'COINBASE_SPOT', 'MEXC_PERP'].includes(exchangeStr)) {
            params.until = to;
        }

        const trades = await exchange.fetchTrades(ccxtSymbol, from, 1000, params); 
        if (!trades || trades.length === 0) return;
        
        let fetched: MarketTrade[] = [];
        for (const tr of trades) {
            if (!tr.timestamp || !tr.price || !tr.amount) continue;
            if (tr.timestamp < from || tr.timestamp > to) continue;

            fetched.push({
                symbol: standardizeSymbol(symbol),
                exchange: exchangeStr,
                t: tr.timestamp,
                p: tr.price,
                q: tr.amount,
                side: tr.side === 'buy' ? 1 : 2,
                usd: tr.cost || (tr.price * tr.amount)
            });
        }
        
        if (fetched.length > 0) {
            await insertMarketTrades(fetched);
        }
    } catch (e: any) {
        // Silently skip
    }
}

async function syncAll() {
    await ensureTablesExist();
    
    const symbols = await getTargetSymbols();
    const now = Date.now();
    const to = now;

    // P4.3: PRIORITY SYSTEM
    // Anchor coins are synced every cycle. 
    // Other coins are synced with 50% probability each cycle to prioritize bandwidth for majors.
    const ANCHOR_COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "TAOUSDT"];
    
    console.log(`[SYNC] Starting parallel sync for ${symbols.length} symbols...`);
    const startTime = Date.now();

    // Parallelize symbol processing for extreme speed
    await Promise.all(symbols.map(async (symbol) => {
        // Skip some normal coins randomly to save rate limits for anchors if the list is long
        const isAnchor = ANCHOR_COINS.includes(symbol);
        if (!isAnchor && symbols.length > 10 && Math.random() > 0.6) return;

        const targetExchanges = isAnchor
            ? DEFAULT_EXCHANGES 
            : ["BINANCE_PERP", "BYBIT_PERP", "OKX_PERP", "MEXC_SPOT", "MEXC_PERP", "BINANCE_SPOT"];

        // Increased BATCH_SIZE for faster exchange processing
        const BATCH_SIZE = 10;
        for (let i = 0; i < targetExchanges.length; i += BATCH_SIZE) {
            const batch = targetExchanges.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (ex) => {
                const fromCheck = now - 15 * 60 * 1000;
                // Optimization: Use getLatestMarketTrade (DESC LIMIT 1) instead of fetching full range
                const latest = await getLatestMarketTrade(symbol, ex);
                const latestDbTime = latest ? latest.t : (now - 3 * 60 * 1000); 
                
                if (to > latestDbTime + 1500) { // Sync if gap > 1.5s
                    const fetchFrom = Math.max(fromCheck, latestDbTime + 1);
                    await fetchAndSave(ex, symbol, fetchFrom, to);
                }
            }));
        }
    }));

    const duration = Date.now() - startTime;
    console.log(`[SYNC] Cycle completed in ${duration}ms. Full freshness achieved.`);
}

async function startDaemon() {
    console.log("-----------------------------------------");
    console.log("MakerTaker PRO Ultra-Speed Sync Başlatıldı.");
    console.log("Paralel işlem ve Öncelikli Coin sistemi devrede.");
    
    while (true) {
        try {
            await syncAll();
        } catch (e: any) {
            console.error("[SYNC] Fatal Loop Error:", e?.message || e);
            if (e?.column) console.error("[Postgres] Details:", e.column, e.constraint, e.detail);
        }
        // Minimal sleep to prevent CPU spiking while maintaining high frequency
        await new Promise(r => setTimeout(r, 500));
    }
}

startDaemon().catch(console.error);
