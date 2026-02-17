import axios from 'axios';
import crypto from 'crypto';
import qs from 'qs';
import https from 'https';
import { getMexcCredentials } from './settings';

const BASE = 'https://api.mexc.com';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function getEnv() {
    const { apiKey, apiSecret } = await getMexcCredentials();
    if (!apiKey || !apiSecret) {
        throw new Error('MEXC API credentials not configured. Please set MEXC_KEY and MEXC_SECRET environment variables.');
    }
    return { apiKey, apiSecret };
}

function sign(totalParams: string, secret: string): string {
    if (!secret) throw new Error('MEXC_SECRET is not defined');
    return crypto.createHmac('sha256', secret).update(totalParams).digest('hex');
}

async function publicGet<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = `${BASE}${endpoint}`;
    try {
        const res = await axios.get(url, { params, timeout: 10000, httpsAgent });
        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            console.error(`Public GET ${endpoint} error:`, err.response?.data || err.message);
        } else {
            console.error(`Public GET ${endpoint} error:`, err);
        }
        throw err;
    }
}

async function signedGet<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T | null> {
    const { apiKey, apiSecret } = await getEnv();

    const timestamp = Date.now();
    const recvWindow = 60000; // Increased to 60s
    const queryParams = { ...params, timestamp, recvWindow };
    const queryString = qs.stringify(queryParams, { encode: false });
    const signature = sign(queryString, apiSecret);
    const url = `${BASE}${endpoint}?${queryString}&signature=${signature}`;

    try {
        const res = await axios.get(url, {
            headers: { 'X-MEXC-APIKEY': apiKey },
            timeout: 10000,
            httpsAgent
        });
        return res.data;
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            console.error(`Signed GET ${endpoint} error:`, err.response?.data || err.message);
        } else {
            console.error(`Signed GET ${endpoint} error:`, err);
        }
        throw err;
    }
}

export async function testConnection() {
    return publicGet('/api/v3/ping');
}

export async function getServerTime() {
    return publicGet<{ serverTime: number }>('/api/v3/time');
}

export async function getPrice(symbol: string): Promise<number> {
    try {
        const data = await publicGet<{ price: string }>('/api/v3/ticker/price', { symbol });
        return parseFloat(data.price);
    } catch {
        if (symbol === 'BTCUSDT') return 95000;
        if (symbol === 'ETHUSDT') return 3500;
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
        return await publicGet<TickerData>('/api/v3/ticker/24hr', { symbol });
    } catch {
        return {
            symbol,
            priceChange: '0',
            priceChangePercent: '0',
            prevClosePrice: '0',
            lastPrice: '0',
            bidPrice: '0',
            bidQty: '0',
            askPrice: '0',
            askQty: '0',
            openPrice: '0',
            highPrice: '0',
            lowPrice: '0',
            volume: '0',
            quoteVolume: '0',
            openTime: 0,
            closeTime: 0,
            count: 0
        };
    }
}

export async function getTopAssets(limit: number = 20): Promise<TickerData[]> {
    try {
        const allTickers = await publicGet<TickerData[]>('/api/v3/ticker/24hr');
        // Filter for USDT pairs and exclude leveraged tokens (usually contain 3L/3S or clean symbols)
        const validPairs = allTickers.filter(t =>
            t.symbol.endsWith('USDT') &&
            !t.symbol.includes('3L') &&
            !t.symbol.includes('3S') &&
            !t.symbol.includes('5L') &&
            !t.symbol.includes('5S')
        );

        // Sort by quote volume (value traded) descending
        validPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

        return validPairs.slice(0, limit);
    } catch (e) {
        console.error('Failed to get top assets from MEXC:', e);
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

export async function getAccountInfo() {
    const res = await signedGet<AccountInfo>('/api/v3/account');
    return res as AccountInfo;
}

export async function getBalance(asset: string) {
    const account = await getAccountInfo();
    const balance = account?.balances.find(b => b.asset === asset);
    return balance ? { free: parseFloat(balance.free), locked: parseFloat(balance.locked) } : { free: 0, locked: 0 };
}

export async function getOpenOrders(symbol: string | null = null) {
    const params: Record<string, string | number | boolean> = symbol ? { symbol } : {};
    return signedGet<MexcOrder[]>('/api/v3/openOrders', params);
}

export async function cancelOrder(symbol: string, orderId: string) {
    const { apiKey, apiSecret } = await getEnv();

    const timestamp = Date.now();
    const recvWindow = 60000;
    const body: Record<string, string | number> = { symbol, orderId, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString, apiSecret);
    const url = `${BASE}/api/v3/order?${bodyString}&signature=${signature}`;
    const res = await axios.delete(url, {
        headers: { 'X-MEXC-APIKEY': apiKey },
        timeout: 10000,
        httpsAgent
    });
    return res.data;
}

export async function cancelAllOrders(symbol: string) {
    const { apiKey, apiSecret } = await getEnv();

    const timestamp = Date.now();
    const recvWindow = 60000;
    const body: Record<string, string | number> = { symbol, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString, apiSecret);
    const url = `${BASE}/api/v3/openOrders?${bodyString}&signature=${signature}`;
    const res = await axios.delete(url, {
        headers: { 'X-MEXC-APIKEY': apiKey },
        timeout: 10000,
        httpsAgent
    });
    return res.data;
}

export async function getExchangeInfo(symbol: string | null = null) {
    const params: Record<string, string | number | boolean> = symbol ? { symbol } : {};
    return publicGet('/api/v3/exchangeInfo', params);
}

export async function getKlines(symbol: string, interval: string = '1h', limit: number = 500, startTime?: number, endTime?: number) {
    const symbolUpper = symbol.toUpperCase();
    
    // MEXC expects 60m instead of 1h
    // and case-specific interval strings
    const intervalMapper: Record<string, string> = {
        '1m': '1m',
        '3m': '3m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '60m',
        '60m': '60m',
        '2h': '2h',
        '4h': '4h',
        '6h': '6h',
        '8h': '8h',
        '12h': '12h',
        '1d': '1d',
        '1w': '1W',
        '1W': '1W',
        '1M': '1M'
    };

    const mexcInterval = intervalMapper[interval] || interval;
    const params: Record<string, string | number | boolean> = { 
        symbol: symbolUpper, 
        interval: mexcInterval, 
        limit 
    };

    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return publicGet<(string | number)[][]>('/api/v3/klines', params);
}

export async function fetchKlines(symbol: string, interval: string = '1h', limit: number = 500) {
    const raw = await getKlines(symbol, interval, limit);
    return raw.map(k => ({
        time: k[0],
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string)
    }));
}

export async function postOrder(params: Record<string, string | number | boolean> = {}) {
    const { apiKey, apiSecret } = await getEnv();

    const timestamp = Date.now();
    const recvWindow = 60000;

    // Optional: Synchronize with server time once every few calls or if needed
    // For simplicity, we just use a large recvWindow for now.

    const body = { ...params, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString, apiSecret);
    const url = `${BASE}/api/v3/order?${bodyString}&signature=${signature}`;

    const headers = {
        'X-MEXC-APIKEY': apiKey,
        'Content-Type': 'application/json'
    };

    try {
        // Some MEXC V3 endpoints prefer parameters in the URL even for POSTs
        // but they still check the Content-Type header.
        const res = await axios.post(url, {}, { 
            headers,
            timeout: 10000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
        return res.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
             console.error('MEXC API Error:', error.response?.data || error.message);
        } else {
             console.error('MEXC API Error:', error);
        }
        throw error;
    }
}

export async function marketBuyByQuote(pair: string, quoteAmount: string) {
    return postOrder({
        symbol: pair,
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: String(quoteAmount)
    });
}

export async function marketSellByQty(pair: string, quantity: string) {
    return postOrder({
        symbol: pair,
        side: 'SELL',
        type: 'MARKET',
        quantity: String(quantity)
    });
}

export async function placeStopLimit(pair: string, side: string, stopPrice: string, limitPrice: string, quantity: string) {
    return postOrder({
        symbol: pair,
        side: side.toUpperCase(),
        type: 'LIMIT',
        price: String(limitPrice),
        quantity: String(quantity),
        stopPrice: String(stopPrice)
    });
}

export async function placeStopMarket(pair: string, side: string, stopPrice: string, quoteOrderQtyOrQty: string) {
    const p: Record<string, string> = {
        symbol: pair,
        side: side.toUpperCase(),
        type: 'MARKET',
        stopPrice: String(stopPrice)
    };
    if (side.toLowerCase() === 'sell') {
        p.quantity = String(quoteOrderQtyOrQty);
    } else {
        p.quoteOrderQty = String(quoteOrderQtyOrQty);
    }
    return postOrder(p);
}
