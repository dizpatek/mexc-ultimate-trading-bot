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
        // Now selecting user_id as well
        const { rows } = await sql`
            SELECT id, user_id, symbol, side, qty, price, meta, status 
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
            try {
                await processTradeMonitoring(trade, engine);
            } catch (err) {
                console.error(`[SmartMonitor] Error monitoring trade ${trade.id}:`, err);
            }
        }

    } catch (error) {
        console.error('[SmartMonitor] Critical error in monitor cycle:', error);
    }
}

interface MonitoredTrade {
    id: number;
    user_id: number;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    price: number;
    meta: Record<string, unknown>;
    status: string;
}

async function processTradeMonitoring(trade: MonitoredTrade, engine: MatrixV3Engine) {
    const { id, user_id, symbol, side, qty: rawQty, price: rawEntryPrice, meta: rawMeta } = trade;
    const entryPrice = typeof rawEntryPrice === 'string' ? parseFloat(rawEntryPrice) : Number(rawEntryPrice);
    const qty = typeof rawQty === 'string' ? parseFloat(rawQty) : Number(rawQty);
    
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const payload = meta.payload;

    try {
        const currentPrice = await getPrice(symbol);
        if (!currentPrice || isNaN(currentPrice)) return;

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

                // Directional tracking for Entry phase
                if (side === 'BUY') {
                    // Long Entry: Trail the bottom
                    if (currentPrice < lowestPrice) {
                        newLowest = currentPrice;
                    }
                } else if (side === 'SELL') {
                    // Short Entry: Trail the top
                    if (currentPrice > highestPrice) {
                        newHighest = currentPrice;
                    }
                }
                
                // 1. Check Entry Condition
                if (!entryTriggered) {
                    // Long Entry Trigger: Price drops to or below target
                    if (side === 'BUY' && currentPrice <= targetEntryPrice) {
                        entryTriggered = true;
                        console.log(`[SmartMonitor] Long Entry triggered for ${symbol} @ ${currentPrice}.`);
                        if (!isTrailingBuy) {
                            shouldExit = true;
                            exitReason = 'LIMIT ENTRY REACHED';
                        } else {
                             // Initialize trailing tracking
                             newLowest = currentPrice;
                             console.log(`[SmartMonitor] Trailing Buy Activates! Tracking bottom from ${newLowest}`);
                        }
                    } 
                    // Short Entry Trigger (Cover Mode): Price rises to or above target
                    else if (side === 'SELL' && currentPrice >= targetEntryPrice) {
                        entryTriggered = true;
                        console.log(`[SmartMonitor] Short Entry triggered for ${symbol} @ ${currentPrice}.`);
                         if (!isTrailingBuy) { // Reusing 'trailingBuy' flag for 'Trailing Entry' generic
                            shouldExit = true;
                            exitReason = 'LIMIT ENTRY REACHED (SHORT)';
                        } else {
                             // Initialize trailing tracking
                             newHighest = currentPrice;
                             console.log(`[SmartMonitor] Trailing Short Entry Activates! Tracking top from ${newHighest}`);
                        }
                    }
                }

                if (entryTriggered && isTrailingBuy) {
                    if (side === 'BUY') {
                        // Trailing Buy: Wait for bounce from bottom
                        // 3Commas behavior: Once triggered, track absolute bottom. Buy when price bounces by deviation%.
                        const buyTrigger = newLowest * (1 + trailingBuyDev / 100);
                        if (currentPrice >= buyTrigger) {
                            shouldExit = true;
                            exitReason = `TRAILING BUY EXECUTED @ ${currentPrice} (Bottom: ${newLowest}, Dev: ${trailingBuyDev}%)`;
                        }
                    } else {
                        // Trailing Sell (Short Entry): Wait for drop from top
                        const sellTrigger = newHighest * (1 - trailingBuyDev / 100);
                        if (currentPrice <= sellTrigger) {
                            shouldExit = true;
                            exitReason = `TRAILING SHORT ENTRY EXECUTED @ ${currentPrice} (Top: ${newHighest}, Dev: ${trailingBuyDev}%)`;
                        }
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
            // Check Move to Breakeven: If first TP filled and breakeven enabled, override SL to entry price
            let effectiveSLPrice = payload.stopLoss?.price ? parseFloat(payload.stopLoss.price) : 0;
            const filledTargetsForBE = meta.filledTargets || [];
            if (payload.stopLoss?.breakeven && filledTargetsForBE.length > 0 && !meta.slMovedToBreakeven) {
                meta.slMovedToBreakeven = true;
                effectiveSLPrice = entryPrice;
                console.log(`[SmartMonitor] Move to Breakeven activated for ${symbol}. SL moved to entry: ${entryPrice}`);
            } else if (meta.slMovedToBreakeven) {
                effectiveSLPrice = entryPrice; // Keep SL at entry after breakeven
            }

            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                // 3Commas AEP-based formula: Trail value = AEP × SL%
                const trailValue = entryPrice * (Math.abs(payload.stopLoss.deviation) / 100);
                const trailingSLPrice = newHighest - trailValue;
                
                // Use the higher of trailing SL and breakeven SL
                const finalSL = Math.max(trailingSLPrice, meta.slMovedToBreakeven ? entryPrice : 0);
                
                // DEBUG LOG
                if (Date.now() % 30000 < 5000) { // Log every ~30s to avoid spam
                    console.log(`[SmartMonitor] ${symbol} TSL Check | Price: ${currentPrice.toFixed(2)} | TrailSL: ${finalSL.toFixed(2)} | Peak: ${newHighest.toFixed(2)}`);
                }

                if (currentPrice <= finalSL) {
                    // SL Timeout: Wait N seconds before confirming
                    if (payload.stopLoss.timeout && payload.stopLoss.timeoutSeconds) {
                        const timeoutSec = Number(payload.stopLoss.timeoutSeconds) || 10;
                        if (!meta.slTimeoutStart) {
                            meta.slTimeoutStart = Date.now();
                            console.log(`[SmartMonitor] ⏱ SL Timeout started for ${symbol}. Waiting ${timeoutSec}s...`);
                        } else if (Date.now() - meta.slTimeoutStart >= timeoutSec * 1000) {
                            shouldExit = true;
                            exitReason = `TRAILING STOP LOSS HIT @ ${currentPrice} (after ${timeoutSec}s timeout)`;
                        }
                    } else {
                        shouldExit = true;
                        exitReason = `TRAILING STOP LOSS HIT @ ${currentPrice} (AEP Trail: ${trailValue.toFixed(4)})`;
                    }
                } else {
                    // Price recovered above SL, reset timeout
                    if (meta.slTimeoutStart) {
                        console.log(`[SmartMonitor] ✨ SL Timeout reset for ${symbol}. Price recovered to ${currentPrice}`);
                        meta.slTimeoutStart = null;
                    }
                }
            } else if (effectiveSLPrice > 0) {
                if (currentPrice <= effectiveSLPrice) {
                    // SL Timeout for fixed SL
                    if (payload.stopLoss?.timeout && payload.stopLoss?.timeoutSeconds) {
                        const timeoutSec = Number(payload.stopLoss.timeoutSeconds) || 10;
                        if (!meta.slTimeoutStart) {
                            meta.slTimeoutStart = Date.now();
                            console.log(`[SmartMonitor] ⏱ SL Timeout started for ${symbol}. Waiting ${timeoutSec}s...`);
                        } else if (Date.now() - meta.slTimeoutStart >= timeoutSec * 1000) {
                            shouldExit = true;
                            exitReason = `FIXED STOP LOSS HIT @ ${currentPrice} (after ${timeoutSec}s timeout)`;
                        }
                    } else {
                        shouldExit = true;
                        exitReason = `FIXED STOP LOSS HIT @ ${currentPrice}`;
                    }
                } else {
                    if (meta.slTimeoutStart) {
                        meta.slTimeoutStart = null;
                    }
                }
            }

            // B. TAKE PROFIT
            if (payload.takeProfit?.price || payload.takeProfit?.targets?.length > 0) {
                const isSplit = !!payload.takeProfit.isSplit && payload.takeProfit.targets?.length > 0;
                const targets = isSplit ? payload.takeProfit.targets : [{ price: payload.takeProfit.price, volume: 100 }];
                const filledTargets = meta.filledTargets || []; // Array of indices

                // Sort targets by price ascending for BUY trades
                const sortedTargets = [...targets].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
                
                for (let i = 0; i < sortedTargets.length; i++) {
                    if (filledTargets.includes(i)) continue;

                    const target = sortedTargets[i];
                    const tpPrice = parseFloat(target.price);
                    const isLastTarget = i === sortedTargets.length - 1;

                    // If target reached
                    if (currentPrice >= tpPrice) {
                        // Check if trailing applies to THIS target
                        // Rule: Trailing only applies to the LAST target if multiple exist, or the single target.
                        const useTrailing = payload.takeProfit.trailing && payload.takeProfit.deviation && isLastTarget;

                        if (useTrailing) {
                            if (!tpTriggered) {
                                tpTriggered = true;
                                meta.tpTriggered = true;
                                console.log(`[SmartMonitor] Final TP Target reached for ${symbol} @ ${currentPrice}. Trailing active.`);
                            }

                            const trailExit = newHighest * (1 - Math.abs(payload.takeProfit.deviation) / 100);
                            if (currentPrice <= trailExit) {
                                shouldExit = true;
                                exitReason = `TRAILING TAKE PROFIT HIT @ ${currentPrice} (Peak: ${newHighest})`;
                            }
                        } else {
                            // Immediate Partial or Full Exit
                            if (isSplit && !isLastTarget) {
                                console.log(`[SmartMonitor] Split TP Target ${i+1} reached for ${symbol} @ ${currentPrice}. Executing partial sell.`);
                                // Execute partial sell
                                const targetVolume = parseFloat(String(target.volume)) / 100;
                                const originalQty = parseFloat(meta.initialQty || qty); // track initial qty for precise % calculation
                                const sellQty = originalQty * targetVolume;
                                
                                // Safety: Ensure we don't oversell current qty
                                const safeSellQty = Math.min(sellQty, qty);

                                try {
                                    await marketSellByQty(user_id, symbol, safeSellQty.toFixed(8).replace(/\.?0+$/, ''));
                                    filledTargets.push(i);
                                    meta.filledTargets = filledTargets;
                                    
                                    // Update internal Quantity tracking
                                    const remainingQty = qty - safeSellQty;
                                    
                                    // Update the 'qty' in the main order record for consistent display/logic
                                    await sql`UPDATE orders SET qty = ${remainingQty} WHERE id = ${id}`;
                                    
                                    console.log(`[SmartMonitor] Partial sell successful. Remaining: ${remainingQty}`);
                                    
                                    // We need to return here to avoid double processing or inconsistent state in this loop
                                    // The next tick will pick up the new Qty.
                                    meta.lastUpdate = Date.now();
                                    await sql`UPDATE orders SET meta = ${JSON.stringify(meta)} WHERE id = ${id}`;
                                    return; 
                                } catch (err) {
                                    console.error(`[SmartMonitor] Partial sell failed for target ${i+1}:`, err);
                                }
                            } else {
                                // Final or Single Target (No Trailing)
                                shouldExit = true;
                                exitReason = isSplit ? `FINAL SPLIT TP TARGET HIT @ ${currentPrice}` : `FIXED TAKE PROFIT HIT @ ${currentPrice}`;
                            }
                        }
                    }
                    
                    // Only process one target at a time per tick for safety, 
                    // or break if we found the first un-filled target that isn't hit yet.
                    if (!filledTargets.includes(i)) break;
                }
            }
        } else {
            // Side === 'SELL' (Cover mode / Short)
            if (currentPrice < lowestPrice) {
                newLowest = currentPrice;
            }

            // A. STOP LOSS (Short)
            // Check Move to Breakeven for Short
            let effectiveSLPriceShort = payload.stopLoss?.price ? parseFloat(payload.stopLoss.price) : 0;
            const filledTargetsForBEShort = meta.filledTargets || [];
            if (payload.stopLoss?.breakeven && filledTargetsForBEShort.length > 0 && !meta.slMovedToBreakeven) {
                meta.slMovedToBreakeven = true;
                effectiveSLPriceShort = entryPrice;
                console.log(`[SmartMonitor] Move to Breakeven (Short) activated for ${symbol}. SL moved to entry: ${entryPrice}`);
            } else if (meta.slMovedToBreakeven) {
                effectiveSLPriceShort = entryPrice;
            }

            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                // 3Commas AEP-based formula for Short: Trail value = AEP × SL%
                const trailValue = entryPrice * (Math.abs(payload.stopLoss.deviation) / 100);
                const trailingSLPrice = newLowest + trailValue;
                const finalSL = Math.min(trailingSLPrice, meta.slMovedToBreakeven ? entryPrice : Infinity);
                if (currentPrice >= finalSL) {
                    if (payload.stopLoss.timeout && payload.stopLoss.timeoutSeconds) {
                        if (!meta.slTimeoutStart) {
                            meta.slTimeoutStart = Date.now();
                        } else if (Date.now() - meta.slTimeoutStart >= payload.stopLoss.timeoutSeconds * 1000) {
                            shouldExit = true;
                            exitReason = `TRAILING STOP LOSS (SELL) HIT @ ${currentPrice} (after timeout)`;
                        }
                    } else {
                        shouldExit = true;
                        exitReason = `TRAILING STOP LOSS (SELL) HIT @ ${currentPrice} (AEP Trail: ${trailValue.toFixed(4)})`;
                    }
                } else {
                    if (meta.slTimeoutStart) meta.slTimeoutStart = null;
                }
            } else if (effectiveSLPriceShort > 0) {
                if (currentPrice >= effectiveSLPriceShort) {
                    if (payload.stopLoss?.timeout && payload.stopLoss?.timeoutSeconds) {
                        if (!meta.slTimeoutStart) {
                            meta.slTimeoutStart = Date.now();
                        } else if (Date.now() - meta.slTimeoutStart >= payload.stopLoss.timeoutSeconds * 1000) {
                            shouldExit = true;
                            exitReason = `FIXED STOP LOSS (SELL) HIT @ ${currentPrice} (after timeout)`;
                        }
                    } else {
                        shouldExit = true;
                        exitReason = `FIXED STOP LOSS (SELL) HIT @ ${currentPrice}`;
                    }
                } else {
                    if (meta.slTimeoutStart) meta.slTimeoutStart = null;
                }
            }

            // B. TAKE PROFIT (Short)
            if (payload.takeProfit?.price || payload.takeProfit?.targets?.length > 0) {
                const isSplit = !!payload.takeProfit.isSplit && payload.takeProfit.targets?.length > 0;
                const targets = isSplit ? payload.takeProfit.targets : [{ price: payload.takeProfit.price, volume: 100 }];
                const filledTargets = meta.filledTargets || [];

                // Sort targets by price descending for SELL (Short) trades
                const sortedTargets = [...targets].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

                for (let i = 0; i < sortedTargets.length; i++) {
                    if (filledTargets.includes(i)) continue;

                    const target = sortedTargets[i];
                    const tpPrice = parseFloat(target.price);
                    const isLastTarget = i === sortedTargets.length - 1;

                    // If target reached (price went DOWN)
                    if (currentPrice <= tpPrice) {
                        const useTrailing = payload.takeProfit.trailing && payload.takeProfit.deviation && isLastTarget;

                        if (useTrailing) {
                            if (!tpTriggered) {
                                tpTriggered = true;
                                meta.tpTriggered = true;
                                console.log(`[SmartMonitor] Final TP Target (Short) reached for ${symbol} @ ${currentPrice}. Trailing active.`);
                            }

                            const trailExit = newLowest * (1 + Math.abs(payload.takeProfit.deviation) / 100);
                            if (currentPrice >= trailExit) {
                                shouldExit = true;
                                exitReason = `TRAILING TAKE PROFIT (SELL) HIT @ ${currentPrice} (Bottom: ${newLowest})`;
                            }
                        } else {
                            if (isSplit && !isLastTarget) {
                                console.log(`[SmartMonitor] Split TP Target (Short) ${i+1} reached for ${symbol} @ ${currentPrice}. Executing partial buyback.`);
                                const targetVolume = parseFloat(String(target.volume)) / 100;
                                const buyQty = qty * targetVolume;
                                
                                try {
                                    const cost = buyQty * currentPrice;
                                    await marketBuyByQuote(user_id, symbol, cost.toFixed(6));
                                    filledTargets.push(i);
                                    meta.filledTargets = filledTargets;
                                } catch (err) {
                                    console.error(`[SmartMonitor] Partial buyback failed for target ${i+1}:`, err);
                                }
                            } else {
                                shouldExit = true;
                                exitReason = isSplit ? `FINAL SPLIT TP TARGET (SHORT) HIT @ ${currentPrice}` : `FIXED TAKE PROFIT (SELL) HIT @ ${currentPrice}`;
                            }
                        }
                    }
                    if (!filledTargets.includes(i)) break;
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
    const { id, user_id, symbol, qty, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    
    try {
        // Execute real market buy using our quote amount logic
        const quoteAmount = qty * currentPrice;
        // Round quote amount to standard precision
        
        // Use userId to get their specific mode/keys
        const result = await marketBuyByQuote(user_id, symbol, quoteAmount.toFixed(6));
        
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
    const { id, user_id, symbol, side, qty, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    
    try {
        let result;
        if (side === 'BUY') {
            // Sell to close: Round quantity to avoid MEXC precision rejection
            const sellQty = parseFloat(String(qty)).toFixed(8).replace(/\.?0+$/, '');
            result = await marketSellByQty(user_id, symbol, sellQty);
        } else {
            // Buy back to close
            const cost = qty * currentPrice;
            result = await marketBuyByQuote(user_id, symbol, cost.toFixed(6));
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
