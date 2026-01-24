/**
 * MEXC API Wrapper with Test/Production Mode Support
 * This file is safely shared between Client and Server.
 */
import * as realMexc from './mexc';
import { getSimulator } from './trading-simulator';

export type TradingMode = 'test' | 'production';

// Safe way to get cookies on server side without top-level import
function getSafeServerCookie(name: string): string | undefined {
    if (typeof window === 'undefined') {
        try {
            const { cookies } = require('next/headers');
            const cookieStore = cookies();
            return cookieStore.get(name)?.value;
        } catch (e) {
            return undefined;
        }
    }
    return undefined;
}

export function getTradingMode(): TradingMode {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('TRADING_MODE') as TradingMode) || 'test';
    }

    // Server side
    const cookieMode = getSafeServerCookie('TRADING_MODE') as TradingMode | undefined;
    if (cookieMode === 'production' || cookieMode === 'test') return cookieMode;

    return (process.env.TRADING_MODE as TradingMode) || 'test';
}

export function setTradingMode(mode: TradingMode) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('TRADING_MODE', mode);
        document.cookie = `TRADING_MODE=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    }
}

// Wrapper Functions
export async function getAccountInfo(forcedMode?: TradingMode) {
    const mode = forcedMode || getTradingMode();
    if (mode === 'production') return realMexc.getAccountInfo();
    return getSimulator().getAccountInfo();
}

export async function getBalance(asset: string, forcedMode?: TradingMode) {
    const mode = forcedMode || getTradingMode();
    if (mode === 'production') return realMexc.getBalance(asset);
    return getSimulator().getBalance(asset);
}

export async function getPrice(symbol: string): Promise<number> {
    return realMexc.getPrice(symbol);
}

export async function getOpenOrders(symbol: string | null = null, forcedMode?: TradingMode) {
    const mode = forcedMode || getTradingMode();
    if (mode === 'production') return realMexc.getOpenOrders(symbol);
    return getSimulator().getOpenOrders(symbol || undefined);
}

export async function postOrder(params: Record<string, any>, forcedMode?: TradingMode) {
    const mode = forcedMode || getTradingMode();
    if (mode === 'production') return realMexc.postOrder(params);

    const { symbol, side, quoteOrderQty, quantity } = params;
    const currentPrice = await getPrice(symbol);
    const simulator = getSimulator();

    if (side === 'BUY') {
        const amount = quoteOrderQty || (Number(quantity) * currentPrice);
        return simulator.executeMarketBuy(symbol, Number(amount), currentPrice);
    } else {
        const qty = quantity || (Number(quoteOrderQty) / currentPrice);
        return simulator.executeMarketSell(symbol, Number(qty), currentPrice);
    }
}

export async function marketBuyByQuote(pair: string, quoteAmount: string, forcedMode?: TradingMode) {
    if (forcedMode === 'production' || (forcedMode === undefined && getTradingMode() === 'production')) {
        return realMexc.marketBuyByQuote(pair, quoteAmount);
    }
    return getSimulator().executeMarketBuy(pair, parseFloat(quoteAmount), await getPrice(pair));
}

export async function marketSellByQty(pair: string, quantity: string, forcedMode?: TradingMode) {
    if (forcedMode === 'production' || (forcedMode === undefined && getTradingMode() === 'production')) {
        return realMexc.marketSellByQty(pair, quantity);
    }
    return getSimulator().executeMarketSell(pair, parseFloat(quantity), await getPrice(pair));
}

export async function placeStopMarket(pair: string, side: string, stopPrice: string, qty: string) {
    const mode = getTradingMode();
    if (mode === 'production') return realMexc.placeStopMarket(pair, side, stopPrice, qty);
    return { orderId: 'SIM_STOP_' + Date.now(), status: 'NEW' };
}

export { get24hrTicker, getTopAssets, getExchangeInfo, getKlines, cancelOrder, testConnection, getServerTime } from './mexc';
export type { TickerData } from './mexc';
