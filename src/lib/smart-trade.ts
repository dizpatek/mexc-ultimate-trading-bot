import { 
    marketBuyByQuote, 
    marketSellByQty, 
    getPrice,
    TradingMode
} from './mexc-wrapper';
import { OrderResult } from './mexc';
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
        timeout?: boolean;
        timeoutSeconds?: number;
        breakeven?: boolean;
    } | null;
    trailingBuy?: boolean;
    trailingBuyDev?: number;
    user_id: number;
}

export async function handleSmartTrade(payload: SmartTradePayload, forcedMode?: TradingMode) {
    console.log('[SmartTrade] New Request Payload:', JSON.stringify(payload, null, 2));
    const { mode, symbol, amount, takeProfit, stopLoss, useExisting, user_id } = payload;
    const pair = symbol.replace('/', '');
    let qty = parseFloat(amount);
    
    if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid amount: ${amount}`);
    }

    console.log(`[SmartTrade] Starting ${mode} for ${pair} | Qty: ${qty} | UseExisting: ${!!useExisting}`);

    let entryResult: Partial<OrderResult> | undefined;
    let avgPrice = 0;
    
    const precision = await getSymbolPrecision(pair);
    
    // 1. ENTRY EXECUTION
    try {
        const isTrailingBuy = !!payload.trailingBuy;

        if (useExisting && mode === 'TRADE') {
            console.log('[SmartTrade] bypassing entry order (useExisting=true)');
            avgPrice = await getPrice(pair);
            entryResult = { 
                orderId: 'EXISTING_ASSET_' + Date.now(), 
                status: 'FILLED',
                price: avgPrice.toString(),
                executedQty: amount
            };
        } else if (isTrailingBuy) {
            // PENDING ENTRY (Trailing Buy or Trailing Sell entry)
            console.log('[SmartTrade] Trailing Entry enabled. Setting order to PENDING.');
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
            // 'amount' from UI is the BASE quantity. marketBuyByQuote needs the TOTAL USDT.
            let quoteAmt = parseFloat(amount) * currentPrice;
            
            // SANITY CAP: No test trade should exceed $100K USDT
            const MAX_QUOTE = 100_000;
            if (quoteAmt > MAX_QUOTE) {
                console.warn(`[SmartTrade] quoteAmt $${quoteAmt.toFixed(2)} exceeds $${MAX_QUOTE} cap. Clamping to max.`);
                quoteAmt = MAX_QUOTE;
                qty = quoteAmt / currentPrice; // Recalculate base qty
            }
            
            const quoteStr = quoteAmt.toFixed(precision.quote);
            
            console.log(`[SmartTrade] Executing Market Buy (Base: ${qty.toFixed(8)} | Price: ${currentPrice} | Total USDT: ${quoteStr})`);
            entryResult = await marketBuyByQuote(user_id, pair, quoteStr, forcedMode);
            
            // DEBUG: Log raw MEXC response to diagnose price recording
            console.log(`[SmartTrade] RAW MEXC BUY Response:`, JSON.stringify(entryResult, null, 2));
            console.log(`[SmartTrade] Key fields → price: ${entryResult?.price}, executedQty: ${entryResult?.executedQty}, cummulativeQuoteQty: ${entryResult?.cummulativeQuoteQty}`);
            
            // Calculate real average price from response if possible
            if (entryResult?.cummulativeQuoteQty && entryResult?.executedQty && parseFloat(entryResult.executedQty) > 0) {
                avgPrice = parseFloat(entryResult.cummulativeQuoteQty) / parseFloat(entryResult.executedQty);
                console.log(`[SmartTrade] ✅ Used cummulativeQuoteQty/executedQty → avgPrice: ${avgPrice}`);
            } else {
                avgPrice = parseFloat(entryResult?.price || '0') || currentPrice;
                console.log(`[SmartTrade] ⚠️ Fallback to price field or ticker → avgPrice: ${avgPrice}`);
            }
            
            if (!avgPrice || isNaN(avgPrice) || avgPrice <= 0) {
                avgPrice = await getPrice(pair).catch(() => 0);
            }
            
            if (!avgPrice || isNaN(avgPrice) || avgPrice <= 0) {
                throw new Error(`Could not determine entry price for ${pair}. Please check connectivity or symbol name.`);
            }
            
            // Recalculate base qty if available from result, otherwise estimate
            if (entryResult?.executedQty && parseFloat(entryResult.executedQty) > 0) {
                qty = parseFloat(entryResult.executedQty);
            } else if (parseFloat(quoteStr) > 0) {
                qty = parseFloat(quoteStr) / avgPrice;
            } else {
                throw new Error('Invalid quote amount for market buy');
            }
        } else {
            // For SELL/COVER, amount is the base quantity
            const qtyStr = qty.toFixed(precision.base);
            entryResult = await marketSellByQty(user_id, pair, qtyStr, forcedMode);
            
            // Calculate real average price from response if possible
            if (entryResult?.cummulativeQuoteQty && entryResult?.executedQty && parseFloat(entryResult.executedQty) > 0) {
                avgPrice = parseFloat(entryResult.cummulativeQuoteQty) / parseFloat(entryResult.executedQty);
            } else {
                avgPrice = parseFloat(entryResult?.price || '0') || await getPrice(pair).catch(() => 0);
            }

            if (!avgPrice || isNaN(avgPrice) || avgPrice <= 0) {
                throw new Error(`Could not determine entry price for ${pair}. Please check connectivity or symbol name.`);
            }
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error('[SmartTrade] Entry order execution failed:', message, e);
        if (e instanceof Error) throw e;
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
        const hasFollowUp = (takeProfit && takeProfit.price && parseFloat(takeProfit.price) > 0) || 
                           (stopLoss && stopLoss.price && parseFloat(stopLoss.price) > 0);

        let initialStatus = entryResult.status || 'FILLED';
        
        // If it's a standalone exit (COVER/SELL) OR standalone entry (TRADE/BUY) and has no TP/SL targets,
        // we mark it as CLOSED immediately to move it to history.
        if (!hasFollowUp && initialStatus === 'FILLED') {
            initialStatus = 'CLOSED';
            console.log(`[SmartTrade] Standalone ${mode} detected for ${pair}. Marking as CLOSED immediately.`);
        }

        dbId = await insertOrder({
            user_id,
            symbol: pair,
            side: mode === 'TRADE' ? 'BUY' : 'SELL',
            type: 'MARKET',
            qty: qty,
            price: avgPrice,
            status: initialStatus,
            meta: { 
                smartTrade: true, 
                mode, 
                payload, 
                highestPrice: avgPrice, 
                lowestPrice: avgPrice,
                lastUpdate: Date.now(),
                exitReason: initialStatus === 'CLOSED' ? 'STANDALONE_MARKET_EXIT' : undefined,
                closedAt: initialStatus === 'CLOSED' ? Date.now() : undefined,
                initialQty: qty
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
