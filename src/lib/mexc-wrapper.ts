/**
 * MEXC API Wrapper with Test/Production Mode Support
 * This file is safely shared between Client and Server.
 */
import * as realMexc from './mexc';
import { getSimulator } from './trading-simulator';

export type TradingMode = 'test' | 'production';

// Safe way to get cookies on server side without top-level import
// Safe way to check server side
export function getTradingMode(): TradingMode {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('TRADING_MODE') as TradingMode) || 'test';
    }

    // Server side: rely on environment variable for stability in Next.js 15
    return (process.env.TRADING_MODE as TradingMode) || 'test';
}

export function setTradingMode(mode: TradingMode) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('TRADING_MODE', mode);
        document.cookie = `TRADING_MODE=${mode}; path=/; max-age=31536000; SameSite=Lax`;
        // Notify other components
        window.dispatchEvent(new Event('tradingModeChanged'));
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

export async function postOrder(params: Record<string, string | number | boolean>, forcedMode?: TradingMode) {
    const mode = forcedMode || getTradingMode();
    if (mode === 'production') return realMexc.postOrder(params);

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

export async function getHoldings(forcedMode?: TradingMode): Promise<HoldingItem[]> {
    const mode = forcedMode || getTradingMode();
    const accountInfo = await getAccountInfo(mode);
    
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
