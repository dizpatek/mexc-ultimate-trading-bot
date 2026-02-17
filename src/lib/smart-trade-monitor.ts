import { sql } from '@vercel/postgres';
import { getPrice, marketSellByQty, marketBuyByQuote } from './mexc-wrapper';
import { MatrixV3Engine } from './matrix-v3-engine';
import { fetchKlines } from './mexc'; // Need to make sure this exists or use a wrapper

let lastRun = 0;
const MONITOR_INTERVAL = 5000; // 5 seconds minimum between cycles
const AI_ANALYSIS_INTERVAL = 60000; // Only re-analyze every 60s per trade

export async function monitorSmartTrades() {
    const now = Date.now();
    if (now - lastRun < MONITOR_INTERVAL) {
        return;
    }
    lastRun = now;
    
    console.log('[SmartMonitor] Starting monitoring cycle...');
    
    try {
        // 1. Fetch active smart trades (both filled and pending entry)
        const { rows } = await sql`
            SELECT id, symbol, side, qty, price, meta, status 
            FROM orders 
            WHERE meta::jsonb->>'smartTrade' = 'true' 
            AND status IN ('FILLED', 'PENDING')
        `;

        if (rows.length === 0) {
            console.log('[SmartMonitor] No active smart trades to monitor.');
            return;
        }

        const trades = rows as unknown as MonitoredTrade[];
        const engine = new MatrixV3Engine();

        for (const trade of trades) {
            await processTradeMonitoring(trade, engine);
        }

    } catch (error) {
        console.error('[SmartMonitor] Critical error in monitor cycle:', error);
    }
}

interface MonitoredTrade {
    id: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    price: number;
    meta: Record<string, unknown>;
    status: string;
}

async function processTradeMonitoring(trade: MonitoredTrade, engine: MatrixV3Engine) {
    const { id, symbol, side, price: entryPrice, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const payload = meta.payload;

    try {
        const currentPrice = await getPrice(symbol);
        if (!currentPrice) return;

        // 1. AI Analysis Throttling
        let aiScore = meta.lastAiScore || 0;
        let aiLogs: string[] = meta.monitorLogs || [];
        const lastAiRun = meta.lastAiRunAt || 0;

        if (Date.now() - lastAiRun > AI_ANALYSIS_INTERVAL) {
            try {
                const klines = await fetchKlines(symbol, '1m', 200);
                if (klines && klines.length >= 50) {
                    const closes = klines.map((k) => k.close);
                    const highs = klines.map((k) => k.high);
                    const lows = klines.map((k) => k.low);
                    const volumes = klines.map((k) => k.volume);
                    
                    const result = engine.analyze(closes, highs, lows, volumes);
                    aiScore = result.aiScore;
                    aiLogs = [
                        `Trend: ${result.trend}`,
                        `Regime: ${result.regimePrediction}`,
                        `Decision: ${result.systemDecision}`
                    ];
                    meta.lastAiRunAt = Date.now();
                }
            } catch (aiErr) {
                console.warn(`[SmartMonitor] AI Analysis failed for ${symbol}:`, aiErr);
            }
        }

        // 2. Trailing & SL/TP Logic
        const highestPrice = meta.highestPrice || entryPrice;
        const lowestPrice = meta.lowestPrice || entryPrice;
        let tpTriggered = meta.tpTriggered || false;
        
        let newHighest = highestPrice;
        let newLowest = lowestPrice;
        let shouldExit = false;
        let exitReason = '';

        if (trade.status === 'PENDING') {
            const targetEntryPrice = parseFloat(payload.buyPrice) || entryPrice;
            const isTrailingBuy = !!payload.trailingBuy;
            const trailingBuyDev = payload.trailingBuyDev || 1.0;
            let entryTriggered = meta.entryTriggered || false;

            // Update Lowest Price seen so far and adjust SL/TP to follow
            if (currentPrice < lowestPrice) {
                const dropRatio = currentPrice / lowestPrice;
                newLowest = currentPrice;
                
                if (isTrailingBuy) {
                    // Update payload prices proportionally
                    if (payload.buyPrice) {
                        payload.buyPrice = (parseFloat(payload.buyPrice) * dropRatio).toString();
                    }
                    if (payload.stopLoss?.price) {
                        payload.stopLoss.price = (parseFloat(payload.stopLoss.price) * dropRatio).toString();
                    }
                    if (payload.takeProfit?.price) {
                        payload.takeProfit.price = (parseFloat(payload.takeProfit.price) * dropRatio).toString();
                    }
                    console.log(`[SmartMonitor] Trailing Buy: Price dropped. Adjusted SL/TP by factor ${dropRatio.toFixed(6)}`);
                }
            }

            // 1. Check Entry Condition
            if (!entryTriggered && currentPrice <= targetEntryPrice) {
                entryTriggered = true;
                console.log(`[SmartMonitor] Entry trigger reached for ${symbol} @ ${currentPrice}.`);
                if (!isTrailingBuy) {
                    shouldExit = true; // Non-trailing immediate entry
                    exitReason = 'LIMIT ENTRY REACHED';
                }
            }

            if (entryTriggered && isTrailingBuy) {
                // Tracking bounce from bottom
                const buyTrigger = newLowest * (1 + trailingBuyDev / 100);
                if (currentPrice >= buyTrigger) {
                    shouldExit = true;
                    exitReason = `TRAILING BUY EXECUTED @ ${currentPrice} (Bottom: ${newLowest})`;
                }
            }

            meta.entryTriggered = entryTriggered;
            
            if (shouldExit) {
                console.log(`[SmartMonitor] 🟢 EXECUTING ENTRY for ${symbol}: ${exitReason}`);
                await executeEntry(trade, currentPrice, exitReason);
                return; // executeEntry handles DB update
            }
        } else if (side === 'BUY') {
            // Update Highest Price
            if (currentPrice > highestPrice) {
                newHighest = currentPrice;
            }

            // A. STOP LOSS
            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                const slPrice = newHighest * (1 - payload.stopLoss.deviation / 100);
                if (currentPrice <= slPrice) {
                    shouldExit = true;
                    exitReason = `TRAILING STOP LOSS HIT @ ${currentPrice}`;
                }
            } else if (payload.stopLoss?.price) {
                const fixedSL = parseFloat(payload.stopLoss.price);
                if (currentPrice <= fixedSL) {
                    shouldExit = true;
                    exitReason = `FIXED STOP LOSS HIT @ ${currentPrice}`;
                }
            }

            // B. TAKE PROFIT
            if (payload.takeProfit?.price) {
                const tpPrice = parseFloat(payload.takeProfit.price);
                
                // Check if target hit for the first time
                if (!tpTriggered && currentPrice >= tpPrice) {
                    tpTriggered = true;
                    console.log(`[SmartMonitor] TP Target reached for ${symbol} @ ${currentPrice}. Trailing active.`);
                }

                if (tpTriggered) {
                    if (payload.takeProfit.trailing && payload.takeProfit.deviation) {
                        // Trailing exit: price drops X% from the peak reached AFTER trigger
                        const trailExit = newHighest * (1 - Math.abs(payload.takeProfit.deviation) / 100);
                        if (currentPrice <= trailExit) {
                            shouldExit = true;
                            exitReason = `TRAILING TAKE PROFIT HIT @ ${currentPrice} (Peak: ${newHighest})`;
                        }
                    } else if (currentPrice >= tpPrice) {
                        // Fixed TP (Immediate exit if not trailing)
                        shouldExit = true;
                        exitReason = `FIXED TAKE PROFIT HIT @ ${currentPrice}`;
                    }
                }
            }
        }
 else {
            // Side === 'SELL' (Cover mode / Short)
            if (currentPrice < lowestPrice) {
                newLowest = currentPrice;
            }

            // A. STOP LOSS (Short)
            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                const slPrice = newLowest * (1 + payload.stopLoss.deviation / 100);
                if (currentPrice >= slPrice) {
                    shouldExit = true;
                    exitReason = `TRAILING STOP LOSS (SELL) HIT @ ${currentPrice}`;
                }
            } else if (payload.stopLoss?.price) {
                const fixedSL = parseFloat(payload.stopLoss.price);
                if (currentPrice >= fixedSL) {
                    shouldExit = true;
                    exitReason = `FIXED STOP LOSS (SELL) HIT @ ${currentPrice}`;
                }
            }

            // B. TAKE PROFIT (Short)
            if (payload.takeProfit?.price) {
                const tpPrice = parseFloat(payload.takeProfit.price);
                
                if (!tpTriggered && currentPrice <= tpPrice) {
                    tpTriggered = true;
                    console.log(`[SmartMonitor] TP Target (Short) reached for ${symbol} @ ${currentPrice}. Trailing active.`);
                }

                if (tpTriggered) {
                    if (payload.takeProfit.trailing && payload.takeProfit.deviation) {
                        // Trailing exit for short: price rises X% from the BOTTOM reached after trigger
                        const trailExit = newLowest * (1 + payload.takeProfit.deviation / 100);
                        if (currentPrice >= trailExit) {
                            shouldExit = true;
                            exitReason = `TRAILING TAKE PROFIT (SELL) HIT @ ${currentPrice} (Bottom: ${newLowest})`;
                        }
                    } else if (currentPrice <= tpPrice) {
                        shouldExit = true;
                        exitReason = `FIXED TAKE PROFIT (SELL) HIT @ ${currentPrice}`;
                    }
                }
            }
        }

        // 3. Update Meta & DB
        meta.highestPrice = newHighest;
        meta.lowestPrice = newLowest;
        meta.tpTriggered = tpTriggered;
        meta.lastAiScore = aiScore;
        meta.monitorLogs = aiLogs;
        meta.lastUpdate = Date.now();

        if (shouldExit) {
            console.log(`[SmartMonitor] 🚨 EXIT TRIGGERED for ${symbol}: ${exitReason}`);
            await executeExit(trade, currentPrice, exitReason);
        } else {
            await sql`
                UPDATE orders 
                SET meta = ${JSON.stringify(meta)} 
                WHERE id = ${id}
            `;
        }

    } catch (err) {
        console.error(`[SmartMonitor] Error processing trade ${id}:`, err);
    }
}

async function executeEntry(trade: MonitoredTrade, currentPrice: number, reason: string) {
    const { id, symbol, qty, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    
    try {
        // Execute real market buy using our quote amount logic
        const quoteAmount = qty * currentPrice;
        // Round quote amount to standard precision
        const result = await marketBuyByQuote(symbol, quoteAmount.toFixed(6));
        
        // Calculate real average price from fill data
        let avgPrice = currentPrice;
        if (result?.cummulativeQuoteQty && result?.executedQty && parseFloat(result.executedQty) > 0) {
            avgPrice = parseFloat(result.cummulativeQuoteQty) / parseFloat(result.executedQty);
        } else if (result?.price) {
            avgPrice = parseFloat(result.price);
        }

        await sql`
            UPDATE orders 
            SET status = 'FILLED',
                price = ${avgPrice},
                meta = ${JSON.stringify({ 
                    ...meta, 
                    entryReason: reason, 
                    entryResult: result, 
                    highestPrice: avgPrice, 
                    lowestPrice: avgPrice, 
                    filledAt: Date.now() 
                })} 
            WHERE id = ${id}
        `;
        
        console.log(`[SmartMonitor] Successfully entered trade ${id} for ${symbol} @ ${avgPrice}`);
    } catch (err) {
        console.error(`[SmartMonitor] Failed to execute entry for ${symbol}:`, err);
    }
}

async function executeExit(trade: MonitoredTrade, currentPrice: number, reason: string) {
    const { id, symbol, side, qty, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    
    try {
        let result;
        if (side === 'BUY') {
            // Sell to close: Round quantity to avoid MEXC precision rejection
            const sellQty = parseFloat(String(qty)).toFixed(8).replace(/\.?0+$/, '');
            result = await marketSellByQty(symbol, sellQty);
        } else {
            // Buy back to close
            const cost = qty * currentPrice;
            result = await marketBuyByQuote(symbol, cost.toFixed(6));
        }

        // Calculate real exit price from the fill result
        let realExitPrice = currentPrice;
        if (result?.cummulativeQuoteQty && result?.executedQty && parseFloat(result.executedQty) > 0) {
            realExitPrice = parseFloat(result.cummulativeQuoteQty) / parseFloat(result.executedQty);
        } else if (result?.price) {
            realExitPrice = parseFloat(result.price);
        }

        await sql`
            UPDATE orders 
            SET status = 'CLOSED', 
                meta = ${JSON.stringify({ ...meta, exitReason: reason, exitResult: result, exitPrice: realExitPrice, closedAt: Date.now() })} 
            WHERE id = ${id}
        `;
        
        console.log(`[SmartMonitor] Successfully closed trade ${id} for ${symbol}`);
    } catch (err) {
        console.error(`[SmartMonitor] Failed to execute exit for ${symbol}:`, err);
    }
}
