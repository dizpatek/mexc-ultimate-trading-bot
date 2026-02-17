import { 
    marketBuyByQuote, 
    marketSellByQty, 
    placeStopMarket, 
    getPrice,
    TradingMode
} from './mexc-wrapper';
import { insertOrder } from './db';
import { getSymbolPrecision } from './trade';

export interface SmartTradePayload {
    mode: 'TRADE' | 'COVER';
    symbol: string;
    amount: string;
    buyPrice: string;
    buyType: string;
    useExisting?: boolean;
    takeProfit?: {
        price: string;
        targets?: { price: string; volume: number }[];
        isSplit?: boolean;
        trailing?: boolean;
        deviation?: number;
    } | null;
    stopLoss?: {
        price: string;
        trailing?: boolean;
        deviation?: number;
    } | null;
    trailingBuy?: boolean;
    trailingBuyDev?: number;
}

export async function handleSmartTrade(payload: SmartTradePayload, forcedMode?: TradingMode) {
    const { mode, symbol, amount, takeProfit, stopLoss, useExisting } = payload;
    const pair = symbol.replace('/', '');
    const qty = parseFloat(amount);
    
    if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
    }

    console.log(`[SmartTrade] Starting ${mode} for ${pair} | Qty: ${qty} | UseExisting: ${!!useExisting}`);

    let entryResult;
    let avgPrice = 0;
    
    const precision = await getSymbolPrecision(pair);
    
    // 1. ENTRY EXECUTION
    try {
        const isTrailingBuy = !!payload.trailingBuy;

        if (useExisting) {
            console.log('[SmartTrade] bypassing entry order (useExisting=true)');
            avgPrice = await getPrice(pair);
            entryResult = { 
                orderId: 'EXISTING_ASSET_' + Date.now(), 
                status: 'FILLED',
                price: avgPrice.toString(),
                executedQty: amount
            };
        } else if (mode === 'TRADE' && isTrailingBuy) {
            // PENDING ENTRY (Trailing Buy)
            console.log('[SmartTrade] Trailing Buy enabled. Setting order to PENDING.');
            avgPrice = parseFloat(payload.buyPrice) || await getPrice(pair);
            entryResult = {
                orderId: 'PENDING_ENTRY_' + Date.now(),
                status: 'PENDING',
                price: avgPrice.toString(),
                executedQty: '0'
            };
        } else if (mode === 'TRADE') {
            const currentPrice = await getPrice(pair);
            if (!currentPrice || currentPrice <= 0) {
                throw new Error(`Could not fetch valid price for ${pair}`);
            }
            const quoteAmount = qty * currentPrice;
            const quoteStr = quoteAmount.toFixed(precision.quote);
            
            entryResult = await marketBuyByQuote(pair, quoteStr, forcedMode);
        } else {
            const qtyStr = qty.toFixed(precision.base);
            entryResult = await marketSellByQty(pair, qtyStr, forcedMode);
            // Refetch price for DB record
            avgPrice = await getPrice(pair);
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[SmartTrade] Entry order execution failed:', message);
        throw new Error(`Entry order failed: ${message}`);
    }

    // Validate entryResult structure
    if (!entryResult) {
        throw new Error('Entry order returned no result');
    }

    const orderId = entryResult.orderId || entryResult.id;
    if (!orderId) {
        console.error('[SmartTrade] Entry result missing ID:', entryResult);
        throw new Error('Entry order successful but ID is missing from response');
    }

    // Set avgPrice if not set (marketSell case)
    if (!avgPrice && entryResult.price) {
        avgPrice = parseFloat(entryResult.price);
    } else if (!avgPrice) {
        avgPrice = await getPrice(pair);
    }

    console.log(`[SmartTrade] Entry SUCCESS! OrderID: ${orderId} | AvgPrice: ${avgPrice}`);

    // 2. RECORD ENTRY IN DB
    let dbId: number | undefined;
    try {
        dbId = await insertOrder({
            symbol: pair,
            side: mode === 'TRADE' ? 'BUY' : 'SELL',
            type: 'MARKET',
            qty: qty,
            price: avgPrice,
            status: entryResult.status || 'FILLED',
            meta: { 
                smartTrade: true, 
                mode, 
                payload, 
                highestPrice: avgPrice, 
                lowestPrice: avgPrice,
                lastUpdate: Date.now()
            }
        });
    } catch (dbError: unknown) {
        console.warn('[SmartTrade] DB recording failed (continuing):', dbError instanceof Error ? dbError.message : String(dbError));
    }

    // 3. ATTACH TP/SL (Conditional Orders)
    // We are disabling native stop orders to use system-managed (virtual) monitoring
    // This reduces dependency on MEXC V3 Spot API stop-order complexity and improves reliability.
    /*
    const exitSide = mode === 'TRADE' ? 'SELL' : 'BUY';
    
    if (stopLoss && stopLoss.price && parseFloat(stopLoss.price) > 0) {
        try {
            await placeStopMarket(pair, exitSide, stopLoss.price, qty.toString(), forcedMode);
            console.log(`[SmartTrade] SL placed at ${stopLoss.price}`);
        } catch (e) {
            console.error('[SmartTrade] Failed to place SL:', e);
        }
    }

    if (takeProfit && takeProfit.price && parseFloat(takeProfit.price) > 0) {
        try {
            await placeStopMarket(pair, exitSide, takeProfit.price, qty.toString(), forcedMode);
            console.log(`[SmartTrade] TP placed at ${takeProfit.price}`);
        } catch (e) {
            console.error('[SmartTrade] Failed to place TP:', e);
        }
    }
    */
    console.log('[SmartTrade] Native stop orders disabled. System-managed monitoring will handle exit levels.');

    return {
        success: true,
        orderId,
        dbId,
        mode,
        symbol: pair,
        avgPrice
    };
}
