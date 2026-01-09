import axios from 'axios';
import crypto from 'crypto';
import qs from 'qs';
import https from 'https';

const API_KEY = process.env.MEXC_KEY || '';
const API_SECRET = process.env.MEXC_SECRET || '';
const BASE = 'https://api.mexc.com';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function sign(totalParams: string): string {
    if (!API_SECRET) throw new Error('MEXC_SECRET is not defined');
    return crypto.createHmac('sha256', API_SECRET).update(totalParams).digest('hex');
}

async function publicGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = `${BASE}${endpoint}`;
    try {
        const res = await axios.get(url, { params, timeout: 10000, httpsAgent });
        return res.data;
    } catch (err: any) {
        console.error(`Public GET ${endpoint} error:`, err.message);
        throw err;
    }
}

async function signedGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    if (!API_KEY) throw new Error('MEXC_KEY is not defined');
    const timestamp = Date.now();
    const recvWindow = 60000;
    const queryParams = { ...params, timestamp, recvWindow };
    const queryString = qs.stringify(queryParams, { encode: false });
    const signature = sign(queryString);
    const url = `${BASE}${endpoint}?${queryString}&signature=${signature}`;

    try {
        const res = await axios.get(url, {
            headers: { 'X-MEXC-APIKEY': API_KEY },
            timeout: 10000,
            httpsAgent
        });
        return res.data;
    } catch (err: any) {
        console.error(`Signed GET ${endpoint} error:`, err.response?.data || err.message);
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
    const data = await publicGet<{ price: string }>('/api/v3/ticker/price', { symbol });
    return parseFloat(data.price);
}

export async function get24hrTicker(symbol: string) {
    return publicGet('/api/v3/ticker/24hr', { symbol });
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

export async function getAccountInfo() {
    return signedGet<AccountInfo>('/api/v3/account');
}

export async function getBalance(asset: string) {
    const account = await getAccountInfo();
    const balance = account.balances.find(b => b.asset === asset);
    return balance ? { free: parseFloat(balance.free), locked: parseFloat(balance.locked) } : { free: 0, locked: 0 };
}

export async function getOpenOrders(symbol: string | null = null) {
    const params = symbol ? { symbol } : {};
    return signedGet<any[]>('/api/v3/openOrders', params);
}

export async function cancelOrder(symbol: string, orderId: string) {
    const timestamp = Date.now();
    const recvWindow = 5000;
    const body = { symbol, orderId, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString);
    const finalBody = `${bodyString}&signature=${signature}`;

    const url = `${BASE}/api/v3/order`;
    const res = await axios.delete(url, {
        headers: { 'X-MEXC-APIKEY': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: finalBody,
        timeout: 10000,
        httpsAgent
    });
    return res.data;
}

export async function cancelAllOrders(symbol: string) {
    const timestamp = Date.now();
    const recvWindow = 5000;
    const body = { symbol, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString);
    const finalBody = `${bodyString}&signature=${signature}`;

    const url = `${BASE}/api/v3/openOrders`;
    const res = await axios.delete(url, {
        headers: { 'X-MEXC-APIKEY': API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
        data: finalBody,
        timeout: 10000,
        httpsAgent
    });
    return res.data;
}

export async function getExchangeInfo(symbol: string | null = null) {
    const params = symbol ? { symbol } : {};
    return publicGet('/api/v3/exchangeInfo', params);
}

export async function getKlines(symbol: string, interval: string = '1h', limit: number = 100) {
    // interval: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
    const params = { symbol, interval, limit };
    return publicGet<any[][]>('/api/v3/klines', params);
}

export async function postOrder(params: Record<string, any> = {}) {
    // params is an object with symbol, side, type, quantity / quoteOrderQty, price, stopPrice, etc.
    const timestamp = Date.now();
    const recvWindow = 5000;

    const body = { ...params, timestamp, recvWindow };
    const bodyString = qs.stringify(body, { encode: false });
    const signature = sign(bodyString);
    const finalBody = `${bodyString}&signature=${signature}`;

    const url = `${BASE}/api/v3/order`;
    const headers = {
        'X-MEXC-APIKEY': API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
        const res = await axios.post(url, finalBody, {
            headers,
            timeout: 10000,
            proxy: false,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
        return res.data;
    } catch (error: any) {
        console.error('MEXC API Error:', error.response?.data || error.message);
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
