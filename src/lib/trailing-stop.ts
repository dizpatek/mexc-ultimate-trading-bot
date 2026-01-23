import { sql } from '@vercel/postgres';
import { getPrice, marketSellByQty, getTradingMode } from './mexc-wrapper'; // Use wrapper for test mode
import { insertOrder, insertTradeHistory } from './db';

interface TrailingStop {
    id: number;
    user_id: string;
    symbol: string;
    quantity: number;
    entry_price: number;
    highest_price: number;
    callback_rate: number;
    activation_price?: number;
    status: string;
}

export async function checkTrailingStops() {
    console.log('[TrailingStop] Starting check cycle...');

    try {
        // 1. Fetch active trailing stops
        const { rows: activeStops } = await sql<TrailingStop>`
            SELECT * FROM trailing_stops WHERE status = 'ACTIVE'
        `;

        if (activeStops.length === 0) {
            console.log('[TrailingStop] No active stops.');
            return;
        }

        console.log(`[TrailingStop] Processing ${activeStops.length} stops.`);

        // 2. Group by symbol to optimize price checks
        const symbols = [...new Set(activeStops.map(s => s.symbol))];
        const prices: Record<string, number> = {};

        for (const symbol of symbols) {
            try {
                prices[symbol] = await getPrice(symbol);
            } catch (e) {
                console.error(`[TrailingStop] Failed to get price for ${symbol}`);
            }
        }

        // 3. Process each stop
        for (const stop of activeStops) {
            const currentPrice = prices[stop.symbol];
            if (!currentPrice) continue;

            const callbackPct = stop.callback_rate / 100;
            const stopPrice = stop.highest_price * (1 - callbackPct);

            console.log(`[TrailingStop] ${stop.symbol}: Current=${currentPrice}, Highest=${stop.highest_price}, Stop=${stopPrice.toFixed(4)}`);

            // Case A: New High Price
            if (currentPrice > stop.highest_price) {
                await sql`
                    UPDATE trailing_stops 
                    SET highest_price = ${currentPrice}, updated_at = ${Date.now()}
                    WHERE id = ${stop.id}
                `;
                console.log(`[TrailingStop] Updated highest price for ${stop.symbol} to ${currentPrice}`);
            }
            // Case B: Price dropped below stop price -> TRIGGER SELL
            else if (currentPrice <= stopPrice) {
                // Check if activation price is met (if requested)
                if (stop.activation_price && stop.highest_price < stop.activation_price) {
                    continue; // Not activated yet
                }

                await executeTrailingStop(stop, currentPrice);
            }
        }

    } catch (error) {
        console.error('[TrailingStop] Error in cycle:', error);
    }
}

async function executeTrailingStop(stop: TrailingStop, triggerPrice: number) {
    console.log(`[TrailingStop] 🚨 EXECUTING SELL for ${stop.symbol} @ ${triggerPrice}`);

    try {
        // 1. Execute Market Sell
        // mexc-wrapper handles Test Mode logic automatically
        const res = await marketSellByQty(stop.symbol, String(stop.quantity));

        const tradingMode = getTradingMode();
        console.log(`[TrailingStop] Sell Result (${tradingMode}):`, res);

        // 2. Calculate PnL (Simplified)
        const totalValue = stop.quantity * triggerPrice;
        const entryValue = stop.quantity * stop.entry_price;
        const pnl = totalValue - entryValue;
        const pnlPercent = (pnl / entryValue) * 100;

        // 3. Update DB status
        await sql`
            UPDATE trailing_stops 
            SET status = 'EXECUTED', updated_at = ${Date.now()}
            WHERE id = ${stop.id}
        `;

        // 4. Record History
        const dbId = await insertOrder({
            symbol: stop.symbol,
            side: 'SELL',
            type: 'TRAILING_STOP',
            qty: stop.quantity,
            price: triggerPrice,
            status: 'FILLED',
            meta: {
                mode: tradingMode,
                trigger: 'trailing_stop',
                callback_rate: stop.callback_rate,
                highest_price: stop.highest_price,
                execution_result: res
            }
        });

        await insertTradeHistory({
            order_id: dbId,
            symbol: stop.symbol,
            side: 'SELL',
            type: 'TRAILING_STOP',
            qty: stop.quantity,
            price: triggerPrice,
            quote_qty: totalValue,
            commission: 0, // Estimating
            profit_loss: pnl,
            profit_loss_percentage: pnlPercent
        });

        console.log(`[TrailingStop] Execution complete. PnL: ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`);

    } catch (error: any) {
        console.error(`[TrailingStop] Failed to execute sell for ${stop.id}:`, error);
        // Don't mark as executed if failed, maybe verify balance first?
        // For now, logging error.
    }
}
