import axios from "axios";
import crypto from "crypto";
import qs from "qs";
import https from "https";
import { normalizeSymbol } from "./symbol-utils";
import { getMexcCredentials } from "./settings";

const BASE = "https://api.mexc.com";

const httpsAgent = new https.Agent({ rejectUnauthorized: true });

async function getEnv(userId: number) {
  const { apiKey, apiSecret } = await getMexcCredentials(userId, "production");
  if (!apiKey || !apiSecret) {
    throw new Error(
      "MEXC API credentials not configured for this user. Please set your keys in Settings.",
    );
  }
  return { apiKey, apiSecret };
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
        (err.code === "ECONNABORTED" || err.response?.status === 429)
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

async function publicGet<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  timeout = 8000,
): Promise<T> {
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
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        `Public GET ${endpoint} error:`,
        err.response?.data || err.message,
      );
    } else {
      console.error(`Public GET ${endpoint} error:`, err);
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

async function signedGet<T>(
  endpoint: string,
  userId: number,
  params: Record<string, string | number | boolean> = {},
  timeout = 10000,
): Promise<T | null> {
  const { apiKey, apiSecret } = await getEnv(userId);

  const execute = async () => {
    await syncTime();
    const timestamp = Date.now() + serverTimeOffset;
    const recvWindow = 60000;
    const queryParams = { ...params, timestamp, recvWindow };
    const queryString = qs.stringify(queryParams, { encode: false });
    const signature = sign(queryString, apiSecret);
    const url = `${BASE}${endpoint}?${queryString}&signature=${signature}`;

    const res = await axios.get(url, {
      headers: { "X-MEXC-APIKEY": apiKey },
      timeout,
      httpsAgent,
    });
    return res.data;
  };

  try {
    return await execute();
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data;
      if (data && data.code === 700003) {
        console.error(
          "[MEXC] Timestamp drift detected (700003). Re-syncing and retrying...",
        );
        lastSync = 0; // Force sync
        return await execute(); // Transparent retry
      }
      console.error(`Signed GET ${endpoint} error:`, data || err.message);
    }
    throw err;
  }
}

export async function testConnection() {
  return publicGet("/api/v3/ping");
}

export async function getServerTime() {
  return publicGet<{ serverTime: number }>("/api/v3/time");
}

export async function getPrice(symbol: string): Promise<number> {
  const normalized = normalizeSymbol(symbol);
  try {
    const data = await publicGet<{ price: string }>("/api/v3/ticker/price", {
      symbol: normalized,
    });
    return parseFloat(data.price);
  } catch {
    if (normalized === "BTCUSDT") return 95000;
    if (normalized === "ETHUSDT") return 3500;
    return 0;
  }
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

export async function get24hrTicker(symbol: string): Promise<TickerData> {
  try {
    return await publicGet<TickerData>("/api/v3/ticker/24hr", { symbol });
  } catch {
    return {
      symbol,
      priceChange: "0",
      priceChangePercent: "0",
      prevClosePrice: "0",
      lastPrice: "0",
      bidPrice: "0",
      bidQty: "0",
      askPrice: "0",
      askQty: "0",
      openPrice: "0",
      highPrice: "0",
      lowPrice: "0",
      volume: "0",
      quoteVolume: "0",
      openTime: 0,
      closeTime: 0,
      count: 0,
    };
  }
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

export async function getAccountInfo(userId: number) {
  const res = await signedGet<AccountInfo>("/api/v3/account", userId);
  return res as AccountInfo;
}

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
  const { apiKey, apiSecret } = await getEnv(userId);

  const timestamp = Date.now();
  const recvWindow = 60000;
  const body: Record<string, string | number> = {
    symbol,
    orderId,
    timestamp,
    recvWindow,
  };
  const bodyString = qs.stringify(body, { encode: false });
  const signature = sign(bodyString, apiSecret);
  const url = `${BASE}/api/v3/order?${bodyString}&signature=${signature}`;
  const res = await axios.delete(url, {
    headers: { "X-MEXC-APIKEY": apiKey },
    timeout: 10000,
    httpsAgent,
  });
  return res.data;
}

export async function cancelAllOrders(symbol: string, userId: number) {
  const { apiKey, apiSecret } = await getEnv(userId);

  const timestamp = Date.now();
  const recvWindow = 60000;
  const body: Record<string, string | number> = {
    symbol,
    timestamp,
    recvWindow,
  };
  const bodyString = qs.stringify(body, { encode: false });
  const signature = sign(bodyString, apiSecret);
  const url = `${BASE}/api/v3/openOrders?${bodyString}&signature=${signature}`;
  const res = await axios.delete(url, {
    headers: { "X-MEXC-APIKEY": apiKey },
    timeout: 10000,
    httpsAgent,
  });
  return res.data;
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
  const { apiKey, apiSecret } = await getEnv(userId);

  const timestamp = Date.now();
  const recvWindow = 60000;

  // Optional: Synchronize with server time once every few calls or if needed
  // For simplicity, we just use a large recvWindow for now.

  const body = { ...params, timestamp, recvWindow };
  const bodyString = qs.stringify(body, { encode: false });
  const signature = sign(bodyString, apiSecret);
  const url = `${BASE}/api/v3/order?${bodyString}&signature=${signature}`;

  const headers = {
    "X-MEXC-APIKEY": apiKey,
    "Content-Type": "application/json",
  };

  try {
    // Some MEXC V3 endpoints prefer parameters in the URL even for POSTs
    // but they still check the Content-Type header.
    const res = await axios.post(
      url,
      {},
      {
        headers,
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: true }),
      },
    );
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const mexcErr = error.response?.data;
      console.error("MEXC API Error Detail:", mexcErr || error.message);
      // Enrich the error message with MEXC detail
      interface EnrichedAxiosError extends Error {
        mexcDetail?: Record<string, unknown>;
      }
      if (mexcErr && typeof mexcErr === "object") {
        (error as EnrichedAxiosError).mexcDetail = mexcErr;
        error.message = `${error.message} | MEXC: ${JSON.stringify(mexcErr)}`;
      }
    } else {
      console.error("MEXC API Error:", error);
    }
    throw error;
  }
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
