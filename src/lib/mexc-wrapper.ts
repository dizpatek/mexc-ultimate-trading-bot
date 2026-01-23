/**
 * MEXC API Wrapper with Test/Production Mode Support
 * Intelligently routes requests to real API or simulator based on TRADING_MODE
 */

import * as realMexc from './mexc';
import { getSimulator } from './trading-simulator';

export type TradingMode = 'test' | 'production';

let currentMode: TradingMode = 'test'; // Default to test mode for safety

export function setTradingMode(mode: TradingMode) {
    currentMode = mode;
    console.log(`🔄 Trading mode set to: ${mode.toUpperCase()}`);
}

export function getTradingMode(): TradingMode {
    return currentMode;
}

// Initialize mode from environment variable
if (typeof window === 'undefined') {
    const envMode = process.env.TRADING_MODE as TradingMode;
    if (envMode === 'production' || envMode === 'test') {
        currentMode = envMode;
    }
}

// Re-export all types from real MEXC
export type { TickerData } from './mexc';

// Test connection
export async function testConnection() {
    if (currentMode === 'production') {
        return realMexc.testConnection();
    }
    return { status: 'ok', mode: 'test' };
}

// Get server time
export async function getServerTime() {
    if (currentMode === 'production') {
        return realMexc.getServerTime();
    }
    return { serverTime: Date.now() };
}

// Get price - always use real API for price data
export async function getPrice(symbol: string): Promise<number> {
    return realMexc.getPrice(symbol);
}

// Get 24hr ticker - always use real API for market data
export async function get24hrTicker(symbol: string) {
    return realMexc.get24hrTicker(symbol);
}

// Get top assets - always use real API for market data
export async function getTopAssets(limit: number = 20) {
    return realMexc.getTopAssets(limit);
}

// Get account info
export async function getAccountInfo() {
    if (currentMode === 'production') {
        return realMexc.getAccountInfo();
    }

    const simulator = getSimulator();
    return simulator.getAccountInfo();
}

// Get balance
export async function getBalance(asset: string) {
    if (currentMode === 'production') {
        return realMexc.getBalance(asset);
    }

    const simulator = getSimulator();
    return simulator.getBalance(asset);
}

// Get open orders
export async function getOpenOrders(symbol: string | null = null) {
    if (currentMode === 'production') {
        return realMexc.getOpenOrders(symbol);
    }

    const simulator = getSimulator();
    return simulator.getOpenOrders(symbol || undefined);
}

// Cancel order
export async function cancelOrder(symbol: string, orderId: string) {
    if (currentMode === 'production') {
        return realMexc.cancelOrder(symbol, orderId);
    }

    const simulator = getSimulator();
    return simulator.cancelOrder(orderId);
}

// Cancel all orders
export async function cancelAllOrders(symbol: string) {
    if (currentMode === 'production') {
        return realMexc.cancelAllOrders(symbol);
    }

    const simulator = getSimulator();
    const orders = simulator.getOpenOrders(symbol);
    orders.forEach(order => simulator.cancelOrder(order.orderId));
    return { message: 'All orders cancelled (simulated)' };
}

// Get exchange info
export async function getExchangeInfo(symbol: string | null = null) {
    return realMexc.getExchangeInfo(symbol);
}

// Get klines
export async function getKlines(symbol: string, interval: string = '1h', limit: number = 100) {
    return realMexc.getKlines(symbol, interval, limit);
}

// Post order
export async function postOrder(params: Record<string, any>) {
    if (currentMode === 'production') {
        return realMexc.postOrder(params);
    }

    const simulator = getSimulator();
    const { symbol, side, type, quantity, quoteOrderQty } = params;

    // Get current price
    const currentPrice = await getPrice(symbol);

    if (side === 'BUY') {
        const amount = quoteOrderQty || (quantity * currentPrice);
        return simulator.executeMarketBuy(symbol, parseFloat(amount), currentPrice);
    } else {
        const qty = quantity || (quoteOrderQty / currentPrice);
        return simulator.executeMarketSell(symbol, parseFloat(qty), currentPrice);
    }
}

// Market buy by quote
export async function marketBuyByQuote(pair: string, quoteAmount: string) {
    if (currentMode === 'production') {
        return realMexc.marketBuyByQuote(pair, quoteAmount);
    }

    const simulator = getSimulator();
    const currentPrice = await getPrice(pair);
    return simulator.executeMarketBuy(pair, parseFloat(quoteAmount), currentPrice);
}

// Market sell by quantity
export async function marketSellByQty(pair: string, quantity: string) {
    if (currentMode === 'production') {
        return realMexc.marketSellByQty(pair, quantity);
    }

    const simulator = getSimulator();
    const currentPrice = await getPrice(pair);
    return simulator.executeMarketSell(pair, parseFloat(quantity), currentPrice);
}

// Place stop limit
export async function placeStopLimit(
    pair: string,
    side: string,
    stopPrice: string,
    limitPrice: string,
    quantity: string
) {
    if (currentMode === 'production') {
        return realMexc.placeStopLimit(pair, side, stopPrice, limitPrice, quantity);
    }

    // In test mode, stop orders are not fully simulated yet
    return {
        orderId: `SIM_STOP_${Date.now()}`,
        symbol: pair,
        status: 'NEW',
        message: 'Stop limit order simulated (not executed until price reaches stop)'
    };
}

// Place stop market
export async function placeStopMarket(
    pair: string,
    side: string,
    stopPrice: string,
    quoteOrderQtyOrQty: string
) {
    if (currentMode === 'production') {
        return realMexc.placeStopMarket(pair, side, stopPrice, quoteOrderQtyOrQty);
    }

    return {
        orderId: `SIM_STOP_${Date.now()}`,
        symbol: pair,
        status: 'NEW',
        message: 'Stop market order simulated (not executed until price reaches stop)'
    };
}
