import axios from "axios";
import crypto from "crypto";
import qs from "qs";
import https from "https";
import { normalizeSymbol } from "./symbol-utils";
import { getMexcCredentials } from "./settings";

const BASE = "https://api.mexc.com";

const httpsAgent = new https.Agent({ 
  rejectUnauthorized: true,
  keepAlive: true,
  timeout: 15000,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
});

async function getEnv(userId: number) {
  try {
    const { apiKey, apiSecret } = await getMexcCredentials(userId, "production");
    if (!apiKey || !apiSecret) {
      return null;
    }
    return { apiKey, apiSecret };
  } catch (e) {
    return null;
  }
}


function sign(totalParams: string, secret: string): string {
  if (!secret) throw new Error("MEXC_SECRET is not defined");
  return crypto.createHmac("sha256", secret).update(totalParams).digest("hex");
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 500,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (
        axios.isAxiosError(err) &&
        (err.code === "ECONNABORTED" || 
         err.code === "EPROTO" || 
         err.code === "ECONNRESET" ||
         err.response?.status === 429)
      ) {
        console.warn(`MEXC API Retry ${i + 1}/${retries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

let lastPublicCallTime = 0;
const PUBLIC_CALL_THROTTLE_MS = 100; // Relaxed to 100ms to allow smooth batching in Next.js

/**
 * Global throttle for public GET calls.
 * Uses an atomic timestamp update strategy to mitigate race conditions 
 * and sequence requests cleanly without a heavily chained Promise queue.
 */
async function enforceThrottle() {
  const now = Date.now();
  
  // P4.3: Atomic next-slot projection to prevent race conditions in high-concurrency
  const nextSlot = Math.max(now, lastPublicCallTime + PUBLIC_CALL_THROTTLE_MS);
  lastPublicCallTime = nextSlot;

  const delay = nextSlot - now;
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function publicGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  timeout = 15000,
): Promise<T> {
  // Global Throttle Enforcement (chat_id: h99j6i631ui)
  await enforceThrottle();

  const url = `${BASE}${endpoint}`;
  const execute = async () => {
    const res = await axios.get(url, { params, timeout, httpsAgent });
    return res.data;
  };

  try {
    // Only retry for Klines or specific public data
    if (endpoint.includes("klines") || endpoint.includes("ticker")) {
      return await fetchWithRetry(execute);
    }
    return await execute();
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`Public GET ${endpoint} error:`, err.response?.data || err.message);
    }
    throw err;
  }
}

let serverTimeOffset = 0;
let lastSync = 0;

async function syncTime() {
  if (Date.now() - lastSync < 3600000) return; // Sync once an hour
  try {
    const { serverTime } = await getServerTime();
    serverTimeOffset = serverTime - Date.now();
    lastSync = Date.now();
    console.log(`[MEXC] Time synced. Offset: ${serverTimeOffset}ms`);
  } catch (e) {
    console.warn("[MEXC] Failed to sync time:", e);
  }
}

async function signedRequest<T>(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  userId: number,
  params: Record<string, string | number | boolean> = {},
  timeout = 10000,
  forceReal = false,
): Promise<T | null> {
  // P1.0 ULTIMATE SAFETY LOCK: Fetch the REAL active mode from database settings
  const { getSetting } = await import("./settings");
  const activeMode = (await getSetting("TRADING_MODE", userId)) || "test";

  // Allow bypass ONLY for GET /account (balances) if forceReal is explicitly requested
  const isSyncRequest = forceReal && method === "GET" && endpoint.includes("account");

  if (activeMode === "test" && !isSyncRequest) {
    const errorMsg = `[Security Lock] Blocking PRIVATE MEXC ${method} ${endpoint} request: System is in TEST mode.`;
    console.error(errorMsg);
    // Instead of throwing which might crash components, we return null or specific signal
    // Most services check for !res or empty balances.
    if (endpoint.includes("account")) {
        return { balances: [] } as unknown as T;
    }
    return null;
  }

  const credentials = await getEnv(userId);
  if (!credentials) {
    const errorMsg = `[Auth Error] MEXC API credentials not configured for User ${userId}. Please set your keys in Settings.`;
    console.warn(errorMsg);
    if (endpoint.includes("account")) {
        return { balances: [] } as unknown as T;
    }
    return null;
  }

  const { apiKey, apiSecret } = credentials;

  const execute = async () => {
    await syncTime();
    const timestamp = Date.now() + serverTimeOffset;
    const recvWindow = 60000;
    const queryParams = { ...params, timestamp, recvWindow };
    const queryString = qs.stringify(queryParams, { encode: false });
    const signature = sign(queryString, apiSecret);
    
    // MEXC V3 sends signature in the query string for all methods
    const url = `${BASE}${endpoint}?${queryString}&signature=${signature}`;

    const config = {
      headers: { "X-MEXC-APIKEY": apiKey },
      timeout,
      httpsAgent,
    };

    let res;
    if (method === "GET") res = await axios.get(url, config);
    else if (method === "POST") res = await axios.post(url, {}, config);
    else res = await axios.delete(url, config);
    
    return res.data;
  };

  try {
    return await fetchWithRetry(execute);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data;
      if (data && data.code === 700003) {
        console.error("[MEXC] Timestamp drift (700003). Re-syncing and retrying...");
        lastSync = 0;
        return await fetchWithRetry(execute);
      }
      console.error(`Signed ${method} ${endpoint} error:`, data || err.message);
    }
    throw err;
  }
}

async function signedGet<T>(
  endpoint: string,
  userId: number,
  params: Record<string, string | number | boolean> = {},
  timeout = 10000,
  forceReal = false,
): Promise<T | null> {
  return signedRequest<T>("GET", endpoint, userId, params, timeout, forceReal);
}

export async function getAccountInfo(userId: number, forceReal = false) {
  const res = await signedGet<AccountInfo>("/api/v3/account", userId, {}, 10000, forceReal);
  return res as AccountInfo;
}

export async function testConnection() {
  return publicGet("/api/v3/ping");
}

export async function getServerTime() {
  return publicGet<{ serverTime: number }>("/api/v3/time");
}

/**
 * Limit Wall (Order Book Depth) Analysis
 * Geçerli fiyata %1 - %2 uzaktaki alım satım duvarlarının yoğunluğunu hesaplar.
 */
export async function fetchOrderBookWall(symbol: string, limit = 100) {
  try {
    const depth = await publicGet<{ bids: [string, string][]; asks: [string, string][] }>("/api/v3/depth", { 
      symbol: normalizeSymbol(symbol), 
      limit 
    });
    
    // Geçerli tahmini orta fiyat (Market Price)
    const midPrice = (parseFloat(depth.bids[0][0]) + parseFloat(depth.asks[0][0])) / 2;
    
    let bidVolume = 0; // Alış duvarı gücü (Destek)
    let askVolume = 0; // Satış duvarı gücü (Direnç)

    // Sadece Fiyattan max %2 uzağa kadarki duvarlara bak (Kalite Kontrolü)
    depth.bids.forEach(([priceStr, qtyStr]) => {
      const price = parseFloat(priceStr);
      if (price >= midPrice * 0.98) bidVolume += parseFloat(qtyStr) * price;
    });

    depth.asks.forEach(([priceStr, qtyStr]) => {
      const price = parseFloat(priceStr);
      if (price <= midPrice * 1.02) askVolume += parseFloat(qtyStr) * price;
    });

    return {
      buyWallWeight: bidVolume,
      sellWallWeight: askVolume,
      imbalance: bidVolume > askVolume ? "BULLISH" : "BEARISH",
      ratio: bidVolume / (askVolume || 1)
    };
  } catch (err) {
    console.error("[MEXC] fetchOrderBookWall error:", err);
    return null;
  }
}

/**
 * Hyperliquid L1 fiyatını çeker (allMids endpoint — rate-limit YOK, IP dostu).
 * Sembol örnek: "BTC", "ETH" (USDT olmadan)
 */
async function getHyperliquidPrice(baseCoin: string): Promise<number | null> {
  try {
    const res = await axios.post("https://api.hyperliquid.xyz/info", 
      { type: "allMids" }, 
      { timeout: 5000, headers: { "Content-Type": "application/json" } }
    );
    // allMids yanıtı: { "BTC": "65000.5", "ETH": "3100.2", ... }
    const price = res.data?.[baseCoin];
    return price ? parseFloat(price) : null;
  } catch {
    return null; // Silent fail (Hyperliquid erişilemeze fallback)
  }
}

/**
 * Arbitrage Sensitivity Check (MEXC vs Hyperliquid L1)
 * Fiyat sapması %0.3 üzerindeyse Dashboard'a 'Arbitrage Opportunity' sinyali gönderir.
 * Promise.allSettled ile güvenli — Hyperliquid çevrimdışıysa bot MEXC döngüsü kesilmez.
 */
export async function checkPriceGap(symbol: string): Promise<{ gapPercent: number; fasterExchange: string; isArbitrage: boolean; hlPrice: number | null; mexcPrice: number | null } | null> {
  try {
    // Sembolü base coin'e çevir: "BTCUSDT" -> "BTC"
    const sym = normalizeSymbol(symbol);
    const baseCoin = sym.replace(/USDT$/, "").replace(/BUSD$/, "");

    // Paralel asenkron çekme — biri düşerse diğeri devam eder (allSettled)
    const [hlResult, mexcResult] = await Promise.allSettled([
      getHyperliquidPrice(baseCoin),
      getPrice(sym) // MEXC WS cache veya REST fallback
    ]);

    const hlPrice = hlResult.status === "fulfilled" ? hlResult.value : null;
    const mexcPrice = mexcResult.status === "fulfilled" ? mexcResult.value : null;

    if (!hlPrice || !mexcPrice) return null;

    const gap = Math.abs(hlPrice - mexcPrice);
    const gapPercent = (gap / mexcPrice) * 100;

    return {
      gapPercent,
      fasterExchange: hlPrice > mexcPrice ? "HYPERLIQUID" : "MEXC",
      isArbitrage: gapPercent > 0.3,
      hlPrice,
      mexcPrice
    };
  } catch {
    return null; // Silent fail — asla bot döngüsünü kesme
  }
}

import WebSocket from "ws";

// Next.js HMR (Hot Module Replacement) sırasında çoklu bağlantı açılmasını engellemek için Global Cache
const g = global as any;
if (!g.mexcWsCache) {
  g.mexcWsCache = {
    client: null as WebSocket | null,
    priceCache: new Map<string, number>(),
    subscribed: new Set<string>(),
    pingInterval: null as NodeJS.Timeout | null,
    isReconnecting: false
  };
}
const wsState = g.mexcWsCache;

function initMexcWs() {
  // Backend'de WS kullanımı iptal edildi. (Sunucu RAM şişirmesini engellemek için)
  // GetPrice artık direkt ultra-hızlı HTTP Batching sistemini kullanacak.
}

function subscribeToSymbolWs(sym: string) {
  // Next.js API rotalarında kalıcı bağlantı anti-pattern'dir, iptal edildi.
}

const priceQueue = new Set<string>();
const priceWaiters = new Map<string, ((price: number) => void)[]>();
let priceBatchTimeout: NodeJS.Timeout | null = null;

export async function getPrice(symbol: string): Promise<number> {
  const normalized = normalizeSymbol(symbol);
  
  // WS Auto-Subscribe
  subscribeToSymbolWs(normalized);

  // 1. FAST PATH: Return from WS Cache if exists
  if (wsState.priceCache.has(normalized)) {
    return wsState.priceCache.get(normalized)!;
  }

  // 2. HTTP FALLBACK (Initial load or WS latency)
  return new Promise((resolve) => {
    priceQueue.add(normalized);
    const list = priceWaiters.get(normalized) || [];
    list.push(resolve);
    priceWaiters.set(normalized, list);

    if (priceBatchTimeout) return;

    // Use larger batching window (100ms) since WS handles high-speed now
    priceBatchTimeout = setTimeout(async () => {
      const symbolsToFetch = Array.from(priceQueue);
      priceQueue.clear();
      priceBatchTimeout = null;

      const currentWaiters = new Map(priceWaiters);
      priceWaiters.clear();

      try {
        const data = await publicGet<unknown>("/api/v3/ticker/price", {
          symbols: JSON.stringify(symbolsToFetch),
        });

        const resultsMap = new Map<string, number>();
        if (Array.isArray(data)) {
          data.forEach((item: { symbol: string; price: string }) => {
            resultsMap.set(item.symbol, parseFloat(item.price));
            wsState.priceCache.set(item.symbol, parseFloat(item.price)); // Seed Cache
          });
        }

        currentWaiters.forEach((waiters, sym) => {
          const price = resultsMap.get(sym) || 0;
          waiters.forEach((res) => res(price));
        });
      } catch (err) {
        console.error("[MEXC] HTTP Price fetch fallback failed:", err);
        currentWaiters.forEach((waiters) => waiters.forEach((res) => res(0)));
      }
    }, 500); // 500 ms as fallback batch (CPU Optimization for Northflank)
  });
}

/**
 * High-speed batch fetch for multiple symbols.
 * Leverages the internal grouping logic of getPrice() for maximum efficiency.
 */
export async function batchFetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const results: Record<string, number> = {};
  await Promise.all(
    symbols.map(async (sym) => {
      results[sym] = await getPrice(sym);
    })
  );
  return results;
}

export interface TickerData {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  prevClosePrice: string;
  lastPrice: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

// ─── TICKER 24H SERVER-SIDE CACHE ───────────────────────────────────────────
// Shared across all requests in the Node process to prevent slamming MEXC API
// with multi-megabyte JSON payloads forEvery. Single. User.

declare global {
  var __ticker24Cache: { data: TickerData | TickerData[]; expiresAt: number } | undefined;
  var __ticker24Inflight: Promise<TickerData | TickerData[]> | undefined;
}

const TICKER24_TTL = 5000; // 5 seconds

export async function get24hrTicker(symbol?: string): Promise<TickerData | TickerData[]> {
  // If a specific symbol is requested, we don't cache globally for now to keep it simple,
  // or we could check if the global cache contains it.
  if (symbol) {
    try {
      return await publicGet<TickerData>("/api/v3/ticker/24hr", { symbol });
    } catch {
      return { symbol: symbol, priceChange: "0", priceChangePercent: "0", prevClosePrice: "0", lastPrice: "0", bidPrice: "0", bidQty: "0", askPrice: "0", askQty: "0", openPrice: "0", highPrice: "0", lowPrice: "0", volume: "0", quoteVolume: "0", openTime: 0, closeTime: 0, count: 0 };
    }
  }

  // 1. Check Global Cache
  if (globalThis.__ticker24Cache && Date.now() < globalThis.__ticker24Cache.expiresAt) {
    return globalThis.__ticker24Cache.data;
  }

  // 2. Check In-Flight (Deduplication)
  if (globalThis.__ticker24Inflight) {
    return globalThis.__ticker24Inflight;
  }

  // 3. Fetch from MEXC
  const fetchPromise = (async () => {
    try {
      console.log("[MEXC] Fetching 24hr tickers (Cache Miss/Expired)...");
      const data = await publicGet<TickerData[]>("/api/v3/ticker/24hr");
      
      globalThis.__ticker24Cache = {
        data,
        expiresAt: Date.now() + TICKER24_TTL
      };
      
      return data;
    } catch (err) {
      console.error("[MEXC] Failed to fetch 24hr tickers:", err);
      // Serve stale data if available on error
      if (globalThis.__ticker24Cache) return globalThis.__ticker24Cache.data;
      return [];
    } finally {
      globalThis.__ticker24Inflight = undefined;
    }
  })();

  globalThis.__ticker24Inflight = fetchPromise;
  return fetchPromise;
}

export async function getTopAssets(limit: number = 20): Promise<TickerData[]> {
  try {
    const allTickers = await publicGet<TickerData[]>("/api/v3/ticker/24hr");
    // Filter for USDT pairs and exclude leveraged tokens (usually contain 3L/3S or clean symbols)
    const validPairs = allTickers.filter(
      (t) =>
        t.symbol.endsWith("USDT") &&
        !t.symbol.includes("3L") &&
        !t.symbol.includes("3S") &&
        !t.symbol.includes("5L") &&
        !t.symbol.includes("5S"),
    );

    // Sort by quote volume (value traded) descending
    validPairs.sort(
      (a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume),
    );

    return validPairs.slice(0, limit);
  } catch (e) {
    console.error("Failed to get top assets from MEXC:", e);
    return [];
  }
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Balance[];
}

export interface MexcOrder {
  symbol: string;
  orderId: string;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
}

export interface OrderResult {
  symbol: string;
  orderId: string;
  id?: string;
  orderListId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  fills?: {
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }[];
}

// getAccountInfo moved to line 215 with forceReal support

export async function getBalance(asset: string, userId: number) {
  const account = await getAccountInfo(userId);
  if (!account || !account.balances) return { free: 0, locked: 0 };
  const balance = account.balances.find((b) => b.asset === asset);
  return balance
    ? { free: parseFloat(balance.free), locked: parseFloat(balance.locked) }
    : { free: 0, locked: 0 };
}

export async function getOpenOrders(
  userId: number,
  symbol: string | null = null,
) {
  const params: Record<string, string | number | boolean> = symbol
    ? { symbol }
    : {};
  return signedGet<MexcOrder[]>("/api/v3/openOrders", userId, params);
}

export async function cancelOrder(
  symbol: string,
  orderId: string,
  userId: number,
) {
  return signedRequest<any>("DELETE", "/api/v3/order", userId, { symbol, orderId });
}

export async function cancelAllOrders(symbol: string, userId: number) {
  return signedRequest<any>("DELETE", "/api/v3/openOrders", userId, { symbol });
}

export async function getExchangeInfo(symbol: string | null = null) {
  const params: Record<string, string | number | boolean> = symbol
    ? { symbol }
    : {};
  return publicGet("/api/v3/exchangeInfo", params);
}

export async function getKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 500,
  startTime?: number,
  endTime?: number,
) {
  const symbolNormalized = normalizeSymbol(symbol);

  // MEXC expects 60m instead of 1h
  // and case-specific interval strings
  const intervalMapper: Record<string, string> = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "60m",
    "60m": "60m",
    "2h": "2h",
    "4h": "4h",
    "6h": "6h",
    "8h": "8h",
    "12h": "12h",
    "1d": "1d",
    "1w": "1W",
    "1W": "1W",
    "1Mo": "1M",
    "1mo": "1M",
    "1MO": "1M",
    "1M": "1M",
  };

  const mexcInterval = intervalMapper[interval] || interval;
  const params: Record<string, string | number | boolean> = {
    symbol: symbolNormalized,
    interval: mexcInterval,
    limit,
  };

  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;

  return publicGet<(string | number)[][]>("/api/v3/klines", params);
}

// ─── KLINES IN-MEMORY CACHE ──────────────────────────────────────────────────
interface KlineCache {
  data: {
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  expiresAt: number;
}
const klinesCache = new Map<string, KlineCache>();
const KLINES_CACHE_TTL = 5 * 1000; // 5 seconds (Reduced from 5m for faster updates)

export async function fetchKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 500,
) {
  const cacheKey = `${symbol}:${interval}:${limit}`;
  const cached = klinesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const raw = await getKlines(symbol, interval, limit);
  const data = raw.map((k) => ({
    time: k[0],
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
  klinesCache.set(cacheKey, { data, expiresAt: Date.now() + KLINES_CACHE_TTL });
  return data;
}

export async function postOrder(
  userId: number,
  params: Record<string, string | number | boolean> = {},
): Promise<OrderResult> {
  const res = await signedRequest<OrderResult>("POST", "/api/v3/order", userId, params);
  if (!res) throw new Error("Order creation failed: No response");
  return res;
}

export async function marketBuyByQuote(
  userId: number,
  pair: string,
  quoteAmount: string,
): Promise<OrderResult> {
  return postOrder(userId, {
    symbol: pair,
    side: "BUY",
    type: "MARKET",
    quoteOrderQty: String(quoteAmount),
  });
}

/**
 * Market BUY by QUANTITY (used for closing shorts/selling quote to get base)
 */
export async function marketBuyByQty(
  userId: number,
  pair: string,
  quantity: string,
): Promise<OrderResult> {
  return postOrder(userId, {
    symbol: pair,
    side: "BUY",
    type: "MARKET",
    quantity: String(quantity),
  });
}

export async function marketSellByQty(
  userId: number,
  pair: string,
  quantity: string,
): Promise<OrderResult> {
  return postOrder(userId, {
    symbol: pair,
    side: "SELL",
    type: "MARKET",
    quantity: String(quantity),
  });
}

export async function placeStopLimit(
  userId: number,
  pair: string,
  side: string,
  stopPrice: string,
  limitPrice: string,
  quantity: string,
) {
  return postOrder(userId, {
    symbol: pair,
    side: side.toUpperCase(),
    type: "LIMIT",
    price: String(limitPrice),
    quantity: String(quantity),
    stopPrice: String(stopPrice),
  });
}

export async function placeStopMarket(
  userId: number,
  pair: string,
  side: string,
  stopPrice: string,
  quoteOrderQtyOrQty: string,
) {
  const p: Record<string, string> = {
    symbol: pair,
    side: side.toUpperCase(),
    type: "MARKET",
    stopPrice: String(stopPrice),
  };
  if (side.toLowerCase() === "sell") {
    p.quantity = String(quoteOrderQtyOrQty);
  } else {
    p.quoteOrderQty = String(quoteOrderQtyOrQty);
  }
  return postOrder(userId, p);
}

export async function getRecentTrades(symbol: string, limit = 500) {
  const symbolNormalized = normalizeSymbol(symbol);
  const params: Record<string, string | number | boolean> = {
    symbol: symbolNormalized,
    limit,
  };
  return publicGet<any[]>("/api/v3/trades", params);
}
