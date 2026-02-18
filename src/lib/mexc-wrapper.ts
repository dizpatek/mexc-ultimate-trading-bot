/**
 * MEXC API Wrapper with Test/Production Mode Support
 * This file is safely shared between Client and Server.
 */
import * as realMexc from './mexc';
import { getSimulator } from './trading-simulator';
import { getSetting } from './settings';

export type TradingMode = 'test' | 'production';

/**
 * Gets the trading mode for a user.
 * On client: uses localStorage.
 * On server: uses DB if userId provided, otherwise env fallback.
 */
export async function getTradingMode(userId?: number): Promise<TradingMode> {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('TRADING_MODE') as TradingMode) || 'test';
    }

    if (userId) {
        const dbMode = await getSetting('TRADING_MODE', userId);
        if (dbMode === 'test' || dbMode === 'production') return dbMode;
    }

    // Server side fallback (Admin only or global env)
    const mode = (process.env.TRADING_MODE as TradingMode) || 'test';
    return mode;
}

/**
 * Synchronous version for client side components
 */
export function getTradingModeSync(): TradingMode {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('TRADING_MODE') as TradingMode) || 'test';
    }
    return 'test';
}

export function setTradingModeClient(mode: TradingMode) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('TRADING_MODE', mode);
        document.cookie = `TRADING_MODE=${mode}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(new Event('tradingModeChanged'));
    }
}

export async function getAccountInfo(userId?: number, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production' && userId) return realMexc.getAccountInfo(userId);
    return getSimulator().getAccountInfo();
}

export async function getBalance(asset: string, userId?: number, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production' && userId) return realMexc.getBalance(asset, userId);
    return getSimulator().getBalance(asset);
}

export async function getPrice(symbol: string): Promise<number> {
    return realMexc.getPrice(symbol);
}

export async function getOpenOrders(userId?: number, symbol: string | null = null, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production' && userId) return realMexc.getOpenOrders(userId, symbol);
    return getSimulator().getOpenOrders(symbol || undefined);
}

export async function postOrder(userId: number, params: Record<string, string | number | boolean>, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production') return realMexc.postOrder(userId, params);

    const symbol = params.symbol as string;
    const side = params.side as string;
    const quoteOrderQty = params.quoteOrderQty;
    const quantity = params.quantity;

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

export async function marketBuyByQuote(userId: number, pair: string, quoteAmount: string, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production') {
        return realMexc.marketBuyByQuote(userId, pair, quoteAmount);
    }
    return getSimulator().executeMarketBuy(pair, parseFloat(quoteAmount), await getPrice(pair));
}

export async function marketSellByQty(userId: number, pair: string, quantity: string, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production') {
        return realMexc.marketSellByQty(userId, pair, quantity);
    }
    return getSimulator().executeMarketSell(pair, parseFloat(quantity), await getPrice(pair));
}

export async function placeStopMarket(userId: number, pair: string, side: string, stopPrice: string, qty: string, forcedMode?: TradingMode) {
    const mode = forcedMode || await getTradingMode(userId);
    if (mode === 'production') return realMexc.placeStopMarket(userId, pair, side, stopPrice, qty);
    return { orderId: 'SIM_STOP_' + Date.now(), status: 'NEW' };
}

export { get24hrTicker, getTopAssets, getExchangeInfo, getKlines, cancelOrder, testConnection, getServerTime } from './mexc';
export type { TickerData } from './mexc';

// Get holdings (balances with value calculation)
export interface HoldingItem {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    holding: number;
    value: number;
    allocation: number;
    id: string;
}

export async function getHoldings(userId?: number, forcedMode?: TradingMode): Promise<HoldingItem[]> {
    const mode = forcedMode || await getTradingMode(userId);
    const accountInfo = await getAccountInfo(userId, mode);
    
    if (!accountInfo || !accountInfo.balances) {
        return [];
    }
    
    // Filter non-zero balances
    const nonZeroBalances = accountInfo.balances.filter(
        (b: { asset: string; free: string; locked: string }) => 
            parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
    );
    
    // Get prices for all assets
    const holdings: HoldingItem[] = [];
    let totalValue = 0;
    
    for (const balance of nonZeroBalances) {
        const symbol = balance.asset;
        const holding = parseFloat(balance.free) + parseFloat(balance.locked);
        
        // Get price (USDT pairs)
        let price = 0;
        if (symbol === 'USDT') {
            price = 1;
        } else {
            try {
                price = await getPrice(`${symbol}USDT`);
            } catch {
                // Try with USDC if USDT fails
                try {
                    price = await getPrice(`${symbol}USDC`);
                } catch {
                    price = 0;
                }
            }
        }
        
        const value = holding * price;
        if (value > 0.01) { // Filter dust
            totalValue += value;
            holdings.push({
                id: symbol,
                symbol: `${symbol}/USDT`,
                name: symbol,
                price,
                change24h: 0, // Would need separate API call
                holding,
                value,
                allocation: 0, // Calculate after total
            });
        }
    }
    
    // Calculate allocations
    holdings.forEach(h => {
        h.allocation = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    });
    
    // Sort by value descending
    holdings.sort((a, b) => b.value - a.value);
    
    return holdings;
}
