import { sql } from '@vercel/postgres';
import { getPrice, marketBuyByQuote, marketSellByQty, getTradingMode } from './mexc-wrapper'; // Use wrapper for test mode safe execution
import { insertOrder, insertTradeHistory } from './db';

interface DcaBot {
    id: number;
    user_id: string;
    symbol: string;
    amount: number;
    interval_hours: number;
    take_profit_percent?: number;
    total_invested: number;
    total_bought_qty: number;
    average_price: number;
    status: string;
    last_run_at: number;
    meta?: string | Record<string, unknown>;
}

export async function checkDcaBots() {
    console.log('[DCA Engine] Starting check cycle...');

    try {
        const { rows: bots } = await sql<DcaBot>`
            SELECT * FROM dca_bots WHERE status = 'ACTIVE'
        `;

        if (bots.length === 0) {
            console.log('[DCA Engine] No active bots.');
            return;
        }

        console.log(`[DCA Engine] Checking ${bots.length} active bots.`);

        for (const bot of bots) {
            await processBot(bot);
        }

    } catch (error) {
        console.error('[DCA Engine] Failed to run cycle:', error);
    }
}

async function processBot(bot: DcaBot) {
    const now = Date.now();
    const intervalMs = bot.interval_hours * 60 * 60 * 1000;

    // Check if it's time to run
    if (now < Number(bot.last_run_at) + intervalMs) {
        return; // Not time yet
    }

    console.log(`[DCA Engine] Executing bot ${bot.id} for ${bot.symbol}`);

    try {
        const currentPrice = await getPrice(bot.symbol);
        const tradingMode = getTradingMode();

        // 1. CHECK TAKE PROFIT (Before buying more)
        if (bot.take_profit_percent && bot.total_bought_qty > 0) {
            const currentValue = bot.total_bought_qty * currentPrice;
            const profitPct = ((currentValue - bot.total_invested) / bot.total_invested) * 100;
            
            // Trailing TP Logic for DCA
            const meta = typeof bot.meta === 'string' ? JSON.parse(bot.meta) : (bot.meta || {});
            const isTrailingTp = !!meta.trailingTp;
            const trailingDev = meta.trailingDev || 0.5; // Default 0.5% if not set
            
            let highestPrice = meta.highestPrice || 0;
            let tpTriggered = meta.tpTriggered || false;

            if (!tpTriggered && profitPct >= bot.take_profit_percent) {
                tpTriggered = true;
                highestPrice = currentPrice;
                console.log(`[DCA Engine] 🎯 TP Level triggered for bot ${bot.id} @ ${currentPrice}. Trailing active.`);
            }

            if (tpTriggered) {
                if (currentPrice > highestPrice) {
                    highestPrice = currentPrice;
                }

                if (isTrailingTp) {
                    const trailExit = highestPrice * (1 - trailingDev / 100);
                    if (currentPrice <= trailExit) {
                        console.log(`[DCA Engine] 🚨 Trailing TP triggered! Profit: ${profitPct.toFixed(2)}% (Peak: ${highestPrice})`);
                        await closeBot(bot, currentPrice, profitPct);
                        return;
                    } else {
                        // Still trailing, update meta and skip buy logic
                        meta.highestPrice = highestPrice;
                        meta.tpTriggered = tpTriggered;
                        await sql`UPDATE dca_bots SET meta = ${JSON.stringify(meta)} WHERE id = ${bot.id}`;
                        console.log(`[DCA Engine] Bot ${bot.id} trailing... Current: ${currentPrice}, Peak: ${highestPrice}, Exit: ${trailExit.toFixed(4)}`);
                        return; // Don't execute DCA buy while trailing TP
                    }
                } else {
                    // Fixed TP
                    console.log(`[DCA Engine] 🎯 Fixed Take Profit triggered! Profit: ${profitPct.toFixed(2)}%`);
                    await closeBot(bot, currentPrice, profitPct);
                    return;
                }
            }
        }

        // 2. EXECUTE BUY
        const res = await marketBuyByQuote(Number(bot.user_id), bot.symbol, String(bot.amount));
        console.log(`[DCA Engine] Buy executed:`, res);

        // Calculate filled quantity (Simulated or Real)
        let filledQty = 0;
        let filledQuote = 0;

        if (res.executedQty) {
            filledQty = parseFloat(res.executedQty);
            filledQuote = parseFloat(res.cummulativeQuoteQty);
        } else if (res.fills) {
            filledQty = res.fills.reduce((sum: number, f: { qty: string }) => sum + parseFloat(f.qty), 0);
            filledQuote = res.fills.reduce((sum: number, f: { price: string; qty: string }) => sum + (parseFloat(f.price) * parseFloat(f.qty)), 0);
        } else {
            // Fallback for simulation if needed, but wrapper should handle it
            filledQuote = bot.amount;
            filledQty = bot.amount / currentPrice;
        }

        if (filledQty > 0) {
            // Update Bot Stats
            const newTotalInvested = Number(bot.total_invested) + filledQuote;
            const newTotalQty = Number(bot.total_bought_qty) + filledQty;
            const newAvgPrice = newTotalInvested / newTotalQty;

            await sql`
                UPDATE dca_bots 
                SET total_invested = ${newTotalInvested},
                    total_bought_qty = ${newTotalQty},
                    average_price = ${newAvgPrice},
                    last_run_at = ${now},
                    updated_at = ${now}
                WHERE id = ${bot.id}
            `;

            // Record History
            const dbId = await insertOrder({
                symbol: bot.symbol,
                side: 'BUY',
                type: 'MARKET',
                qty: filledQty,
                quote: filledQuote,
                price: currentPrice,
                status: 'FILLED',
                meta: { mode: tradingMode, bot_id: bot.id, type: 'DCA_BUY' }
            });

            await insertTradeHistory({
                order_id: dbId,
                symbol: bot.symbol,
                side: 'BUY',
                type: 'DCA',
                qty: filledQty,
                price: currentPrice,
                quote_qty: filledQuote
            });
        }

    } catch (error: unknown) {
        console.error(`[DCA Engine] Error processing bot ${bot.id}:`, error instanceof Error ? error.message : String(error));
    }
}

async function closeBot(bot: DcaBot, price: number, profitPct: number) {
    try {
        // Sell All
        const res = await marketSellByQty(Number(bot.user_id), bot.symbol, String(bot.total_bought_qty));
        console.log(`[DCA Engine] Bot ${bot.id} liquidating holdings:`, res);

        // Mark bot as COMPLETED
        await sql`
            UPDATE dca_bots 
            SET status = 'COMPLETED', updated_at = ${Date.now()}
            WHERE id = ${bot.id}
        `;

        // Record Order
        const tradingMode = getTradingMode();
        const dbId = await insertOrder({
            symbol: bot.symbol,
            side: 'SELL',
            type: 'MARKET',
            qty: bot.total_bought_qty,
            price: price,
            status: 'FILLED',
            meta: { mode: tradingMode, bot_id: bot.id, type: 'DCA_TAKE_PROFIT' }
        });

        await insertTradeHistory({
            order_id: dbId,
            symbol: bot.symbol,
            side: 'SELL',
            type: 'DCA_TP',
            qty: bot.total_bought_qty,
            price: price,
            quote_qty: bot.total_bought_qty * price,
            profit_loss: (bot.total_bought_qty * price) - bot.total_invested,
            profit_loss_percentage: profitPct
        });

        console.log(`[DCA Engine] Bot ${bot.id} closed with ${profitPct.toFixed(2)}% profit.`);

    } catch (error) {
        console.error(`[DCA Engine] Failed to close bot ${bot.id}:`, error);
    }
}
