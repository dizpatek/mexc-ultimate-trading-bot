import * as dotenv from "dotenv";
dotenv.config();

import { getMarketTrades, insertMarketTrades, MarketTrade } from "../src/lib/db";
import { ensureTablesExist } from "../src/lib/db-init";
import ccxt from "ccxt";

const SYMBOL_DB = "BTCUSDT"; // Default symbol for our DB
const SYMBOL_SPOT = "BTC/USDT";
const SYMBOL_PERP = "BTC/USDT:USDT";

const EXCHANGES = [
  // Tier 1
  "BINANCE_PERP", "BINANCE_SPOT",
  "BYBIT_PERP", "BYBIT_SPOT",
  "OKX_PERP", "OKX_SPOT",
  "BITGET_PERP", "BITGET_SPOT",
  "MEXC_PERP", "MEXC_SPOT",
  // Tier 2
  "KUCOIN_PERP", "KUCOIN_SPOT",
  "GATE_PERP", "GATE_SPOT",
  "HUOBI_PERP", "HUOBI_SPOT",
  "HTX_PERP", "HTX_SPOT",
  "COINBASE_SPOT",
  "KRAKEN_SPOT",
  "BITSTAMP_SPOT",
  // Tier 3
  "PHEMEX_PERP", "PHEMEX_SPOT",
  "BITMEX_PERP",
  "DERIBIT_PERP",
  "WOO_PERP", "WOO_SPOT",
  "CRYPTOCOM_SPOT",
];

// Initialize CCXT exchange instances cache
const ccxtExchanges: Record<string, typeof ccxt.Exchange> = {};

function getCcxtExchange(exString: string) {
    if (ccxtExchanges[exString]) return ccxtExchanges[exString];
    
    let [name, type] = exString.split('_');
    let ccxtName = name.toLowerCase();
    const isFutures = type === 'PERP';
    
    // Map internal names to CCXT identifiers
    if (ccxtName === 'huobi') ccxtName = 'htx';
    
    if (!(ccxtName in ccxt)) {
        console.log(`[CCXT] Borsa bulunamadı veya desteklenmiyor: ${ccxtName}`);
        return null;
    }
    
    try {
        const ExClass = (ccxt as any)[ccxtName];
        const exchange = new ExClass({
            enableRateLimit: true,
            // İlk açılışta loadMarkets çalıştığı için 8sn yetmez, büyük borsalar zaman alır.
            timeout: 30000, 
            options: { defaultType: isFutures ? 'swap' : 'spot' }
        });
        ccxtExchanges[exString] = exchange;
        return exchange;
    } catch(e) {
        return null;
    }
}

async function fetchAndSave(exchangeStr: string, from: number, to: number) {
    const exchange = getCcxtExchange(exchangeStr) as any;
    if (!exchange || !exchange.has['fetchTrades']) return;
    
    const isFutures = exchangeStr.includes('PERP');
    
    // Standardizing Symbols for generic ccxt calls
    let targetSymbol = isFutures ? SYMBOL_PERP : SYMBOL_SPOT;
    if (exchangeStr.startsWith("DERIBIT")) targetSymbol = "BTC-PERPETUAL"; 
    if (exchangeStr.startsWith("BITMEX")) targetSymbol = "BTC/USD:BTC";
    if (exchangeStr.startsWith("COINBASE")) targetSymbol = "BTC/USD"; 
    
    try {
        // limit 1000 is common maximum across exchanges
        const params: any = {};
        if (['MEXC_SPOT', 'COINBASE_SPOT', 'MEXC_PERP'].includes(exchangeStr)) {
            params.until = to;
        }
        const trades = await exchange.fetchTrades(targetSymbol, from, 1000, params); 
        if (!trades || trades.length === 0) return;
        
        let fetched: any[] = [];
        for (const tr of trades) {
            if (!tr.timestamp || !tr.price || !tr.amount) continue;
            // Filter future overlaps (prevent resaving the same recent trades)
            if (tr.timestamp < from || tr.timestamp > to) continue;

            fetched.push({
                symbol: SYMBOL_DB,
                exchange: exchangeStr,
                t: tr.timestamp,
                p: tr.price,
                q: tr.amount,
                side: tr.side === 'buy' ? 1 : 0,
                usd: tr.cost || (tr.price * tr.amount)
            });
        }
        
        if (fetched.length > 0) {
            await insertMarketTrades(fetched);
            // console.log(`[SYNC/CCXT] ${exchangeStr} -> DB'ye ${fetched.length} islem eklendi.`);
        }
    } catch (e: any) {
        // Log short version of error (avoid giant timeout stacks)
        // console.warn(`[SYNC/CCXT-ERR] ${exchangeStr} veri cekilemedi: ${e.message.split('\n')[0].substring(0, 150)}`);
    }
}

async function syncAll() {
    // console.log("-----------------------------------------");
    // console.log(`[SYNC START] ${new Date().toLocaleTimeString()} - Piyasalar senkronize ediliyor.`);
    await ensureTablesExist();
    
    const now = Date.now();
    const to = now;

    // Concurrency control: fetch 3 exchanges at a time to avoid heavy socket blockage
    const BATCH_SIZE = 3;
    
    for (let i = 0; i < EXCHANGES.length; i += BATCH_SIZE) {
        const batch = EXCHANGES.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (ex) => {
            const fromCheck = now - 60 * 60 * 1000;
            // CCXT DB Read checking
            const dbTrades = await getMarketTrades(SYMBOL_DB, ex, fromCheck, now);
            const latestDbTime = dbTrades.length > 0 ? dbTrades[dbTrades.length - 1].t : (now - 5 * 60 * 1000); 
            
            // Eğer veritabanı ile şu anki zaman arasında 1 saniyeden fazla fark varsa çek.
            if (to > latestDbTime + 1000) { 
                const fetchFrom = Math.max(fromCheck, latestDbTime + 1);
                await fetchAndSave(ex, fetchFrom, to);
            } else {
                // Sessizlik: 1 sn'de bir log spami engellemek için atlandı logunu kapattık
                // console.log(`[SYNC/CCXT] ${ex} güncel. Atlanıyor.`);
            }
        }));
    }
    
    // Sessizlik
    // console.log(`[SYNC END] Tamamlandı.`);
}

async function startDaemon() {
    console.log("MakerTaker CCXT Direk Veri Yakalama Başlatıldı.");
    console.log("Her 1 saniyede bir borsalar doğrudan CCXT ile sorgulanacak.");
    
    await syncAll();
    
    setInterval(async () => {
        await syncAll();
    }, 1000);
}

startDaemon().catch(console.error);
