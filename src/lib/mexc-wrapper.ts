import { getSetting, setSetting } from './settings';
import { TradingSimulator, getSimulator } from './trading-simulator';
import { fetchKlines } from './mexc';
import { getTradingMode, getTradingModeSync, setTradingModeClient } from './trading-mode';
import type { TradingMode } from './trading-mode';

export { getTradingMode, getTradingModeSync, setTradingModeClient };
export type { TradingMode };

const _lastSavePromises = new Map<number, Promise<void>>();

export async function syncSimulator(userId: number, simulator: TradingSimulator) {
    if (typeof window !== 'undefined') return;
    try {
        const saved = await getSetting('SIMULATED_BALANCES', userId);
        if (saved) {
            const balances = JSON.parse(saved);
            const usdt = balances.find((b: { asset: string; free: number }) => b.asset === 'USDT');
            if (usdt && parseFloat(String(usdt.free)) > 200000) {
                 console.warn(`[Simulator] Corruption detected for user ${userId} (${usdt.free} USDT). Resetting.`);
                 simulator.reset();
                 simulator.setBalance('USDT', 80000);
                 queueBalancePersistence(userId, simulator);
            } else {
                 simulator.loadBalances(balances);
            }
        } else {
            simulator.reset();
            simulator.setBalance('USDT', 80000);
            await setSetting('SIMULATED_BALANCES', JSON.stringify(simulator.getAllBalances()), userId);
        }
    } catch (err) {
        console.error(`[Simulator] Sync failed for user ${userId}:`, err);
    }
}

function queueBalancePersistence(userId: number, simulator: TradingSimulator) {
    if (typeof window !== 'undefined') return;
    // P4.1: Need a deep snapshot because simulator.balances mutation would affect the background task
    const balancesSnapshot = structuredClone(simulator.getAllBalances()); 
    const prevTask = _lastSavePromises.get(userId) || Promise.resolve();
    
    const nextTask = prevTask.then(async () => {
        try {
            await setSetting('SIMULATED_BALANCES', JSON.stringify(balancesSnapshot), userId);
        } catch (err) {
            console.error(`[Simulator] Background persistence failed for user ${userId}:`, err);
        }
    }).finally(() => {
        // P4.2: Prevent memory leak by cleaning up resolved promises
        if (_lastSavePromises.get(userId) === nextTask) {
            _lastSavePromises.delete(userId);
        }
    });
    
    _lastSavePromises.set(userId, nextTask);
}

import { OrderResult } from './mexc';

let _mexcModule: typeof import('./mexc') | null = null;
async function getMexcModule() {
    if (!_mexcModule) _mexcModule = await import('./mexc');
    return _mexcModule;
}

export async function getPrice(symbol: string): Promise<number> {
    const mode = getTradingMode();
    if (mode === 'test') {
        const klines = await fetchKlines(symbol, '1m', 1);
        return klines.length > 0 ? klines[0].close : 0;
    }
    // Production call with cached module
    const { getPrice: getMexcPrice } = await getMexcModule();
    return getMexcPrice(symbol);
}

export async function get24hrTicker(symbol: string) {
    const { get24hrTicker: getMexcTicker } = await getMexcModule();
    return getMexcTicker(symbol);
}

export async function getKlines(symbol: string, interval: string = '1h', limit: number = 500) {
    const { getKlines: getMexcKlines } = await getMexcModule();
    return getMexcKlines(symbol, interval, limit);
}

export async function getAccountInfo(userId: number, mode: TradingMode = 'test') {
    if (mode === 'test') {
        const simulator = getSimulator(userId);
        await syncSimulator(userId, simulator);
        return simulator.getAccountInfo();
    }
    const { getAccountInfo: getMexcAccount } = await getMexcModule();
    return getMexcAccount(userId);
}

export async function getHoldings(userId: number, mode: TradingMode = 'test') {
    const account = await getAccountInfo(userId, mode);
    return account.balances || [];
}

export async function getOpenOrders(userId: number, symbol: string | null = null, mode: TradingMode = 'test') {
    if (mode === 'test') return []; // Simulator hasn't implemented open orders yet
    const { getOpenOrders: getMexcOpenOrders } = await getMexcModule();
    return getMexcOpenOrders(userId, symbol);
}

export async function marketBuyByQuote(userId: number, symbol: string, quoteQty: string, modeOverride?: TradingMode): Promise<OrderResult> {
    const mode = modeOverride || getTradingMode();
    if (mode === 'test') {
        const simulator = getSimulator(userId);
        await syncSimulator(userId, simulator);
        const currentPrice = await getPrice(symbol);
        const res = await simulator.executeMarketBuy(symbol, parseFloat(quoteQty), currentPrice);
        queueBalancePersistence(userId, simulator);
        return res as unknown as OrderResult;
    }
    const { marketBuyByQuote: mexcBuy } = await getMexcModule();
    return mexcBuy(userId, symbol, quoteQty);
}

export async function marketSellByQty(userId: number, symbol: string, qty: string, modeOverride?: TradingMode): Promise<OrderResult> {
    const mode = modeOverride || getTradingMode();
    if (mode === 'test') {
        const simulator = getSimulator(userId);
        await syncSimulator(userId, simulator);
        const currentPrice = await getPrice(symbol);
        const res = await simulator.executeMarketSell(symbol, parseFloat(qty), currentPrice);
        queueBalancePersistence(userId, simulator);
        return res as unknown as OrderResult;
    }
    const { marketSellByQty: mexcSell } = await getMexcModule();
    return mexcSell(userId, symbol, qty);
}

export async function getBalance(asset: string, userId: number, mode: TradingMode = 'test') {
    if (mode === 'test') {
        const simulator = getSimulator(userId);
        await syncSimulator(userId, simulator);
        return simulator.getBalance(asset);
    }
    const { getBalance: getMexcBalance } = await getMexcModule();
    return getMexcBalance(asset, userId);
}

export async function placeStopMarket(userId: number, pair: string, side: string, stopPrice: string, qty: string) {
    const mode = getTradingMode();
    if (mode === 'test') {
        // Simple simulator market entry for now
        return postOrder(userId, pair, side, qty, stopPrice);
    }
    const { placeStopMarket: mexcStop } = await getMexcModule();
    return mexcStop(userId, pair, side, stopPrice, qty);
}

export async function postOrder(userId: number, symbol: string, side: string, qty: string, _price: string, type: string = 'MARKET') {
    const mode = getTradingMode();
    if (mode === 'test') {
        const simulator = getSimulator(userId);
        await syncSimulator(userId, simulator);
        const currentPrice = await getPrice(symbol);
        
        if (side.toUpperCase() === 'BUY') {
            const totalQuote = parseFloat(qty) * currentPrice;
            const res = await simulator.executeMarketBuy(symbol, totalQuote, currentPrice);
            queueBalancePersistence(userId, simulator);
            return res;
        } else {
            const res = await simulator.executeMarketSell(symbol, parseFloat(qty), currentPrice);
            queueBalancePersistence(userId, simulator);
            return res;
        }
    }
    const { postOrder: mexcPost } = await getMexcModule();
    return mexcPost(userId, { symbol, side, qty, price: _price, type });
}
