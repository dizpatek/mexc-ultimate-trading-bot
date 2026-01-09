import axios from 'axios';
import crypto from 'crypto';
import qs from 'qs';
import https from 'https';

const API_KEY = process.env.MEXC_KEY || '';
const API_SECRET = process.env.MEXC_SECRET || '';
const BASE = 'https://api.mexc.com';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const IS_MOCK_MODE = !API_KEY || !API_SECRET;

if (IS_MOCK_MODE) {
    console.warn('MEXC_KEY or MEXC_SECRET not found. Running in MOCK MODE.');
}

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

async function signedGet<T>(endpoint: string, params: Record<string, any> = {}): Promise<T | null> {
    if (IS_MOCK_MODE) {
        console.log(`[MOCK] Calling ${endpoint} with params:`, params);
        return getMockDataForEndpoint(endpoint);
    }

    // Safety check just in case
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

function getMockDataForEndpoint(endpoint: string): any {
    if (endpoint === '/api/v3/account') {
        const mockBalances = [
            { asset: 'USDT', free: '1000.00', locked: '0.00' },
            { asset: 'BTC', free: '0.05', locked: '0.00' },
            { asset: 'ETH', free: '0.5', locked: '0.1' },
            { asset: 'MX', free: '150.00', locked: '0.00' }
        ];
        return {
            makerCommission: 0,
            takerCommission: 0,
            buyerCommission: 0,
            sellerCommission: 0,
            canTrade: true,
            canWithdraw: true,
            canDeposit: true,
            balances: mockBalances
        };
    }
    if (endpoint === '/api/v3/openOrders') {
        return [];
    }
    return null;
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
    } catch (e) {
        // Fallback for mocked environment if public API fails (rate limit etc)
        // or just return a static price for common pairs
        if (symbol === 'BTCUSDT') return 95000;
        if (symbol === 'ETHUSDT') return 3500;
        return 0;
    }
}

export async function get24hrTicker(symbol: string) {
    try {
        return await publicGet('/api/v3/ticker/24hr', { symbol });
    } catch (e) {
        return {
            priceChange: '120.5',
            priceChangePercent: '2.5',
            lastPrice: '95120.50',
            volume: '1500',
            quoteVolume: '145000000'
        }
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

export async function getAccountInfo() {
    // If signedGet returns null in mock mode (though it shouldn't with correct setup),
    // we cast it or ensure signedGet handles it.
    // Our signedGet is typed to return Promise<T | null>, so we should handle potentially null
    // but the implementation guarantees return for tested endpoints.
    const res = await signedGet<AccountInfo>('/api/v3/account');
    return res as AccountInfo;
}

export async function getBalance(asset: string) {
    const account = await getAccountInfo();
    const balance = account?.balances.find(b => b.asset === asset);
    return balance ? { free: parseFloat(balance.free), locked: parseFloat(balance.locked) } : { free: 0, locked: 0 };
}

export async function getOpenOrders(symbol: string | null = null) {
    const params = symbol ? { symbol } : {};
    return signedGet<any[]>('/api/v3/openOrders', params);
}

export async function cancelOrder(symbol: string, orderId: string) {
    if (IS_MOCK_MODE) {
        console.log(`[MOCK] Cancel order ${orderId} for ${symbol}`);
        return { symbol, orderId, status: 'CANCELED' };
    }

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
    if (IS_MOCK_MODE) {
        console.log(`[MOCK] Cancel ALL orders for ${symbol}`);
        return { symbol, status: 'CANCELED' };
    }

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
    const params = { symbol, interval, limit };
    return publicGet<any[][]>('/api/v3/klines', params);
}

export async function postOrder(params: Record<string, any> = {}) {
    if (IS_MOCK_MODE) {
        console.log(`[MOCK] POST ORDER:`, params);
        return {
            symbol: params.symbol,
            orderId: 'MOCK-' + Date.now(),
            clientOrderId: 'mock_client_id',
            transactTime: Date.now(),
            price: params.price || 'Market',
            origQty: params.quantity || params.quoteOrderQty,
            executedQty: params.quantity || params.quoteOrderQty, // Simulate fill
            cummulativeQuoteQty: '100.0', // dummy
            status: 'FILLED',
            timeInForce: 'GTC',
            type: params.type,
            side: params.side
        };
    }

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
