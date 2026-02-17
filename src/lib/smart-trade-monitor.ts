import { sql } from '@vercel/postgres';
import { getPrice, marketSellByQty, marketBuyByQuote } from './mexc-wrapper';
import { MatrixV3Engine } from './matrix-v3-engine';
import { fetchKlines } from './mexc'; // Need to make sure this exists or use a wrapper

let lastRun = 0;
const MONITOR_INTERVAL = 5000; // 5 seconds minimum between cycles

export async function monitorSmartTrades() {
    const now = Date.now();
    if (now - lastRun < MONITOR_INTERVAL) {
        return;
    }
    lastRun = now;
    
    console.log('[SmartMonitor] Starting monitoring cycle...');
    
    try {
        // 1. Fetch active smart trades
        const { rows } = await sql`
            SELECT id, symbol, side, qty, price, meta 
            FROM orders 
            WHERE meta::jsonb->>'smartTrade' = 'true' 
            AND status = 'FILLED'
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
}

async function processTradeMonitoring(trade: MonitoredTrade, engine: MatrixV3Engine) {
    const { id, symbol, side, price: entryPrice, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    const payload = meta.payload;

    try {
        const currentPrice = await getPrice(symbol);
        if (!currentPrice) return;

        // 1. AI Analysis
        let aiScore = 0;
        let aiLogs: string[] = [];
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
            }
        } catch (aiErr) {
            console.warn(`[SmartMonitor] AI Analysis failed for ${symbol}:`, aiErr);
        }

        // 2. Trailing Logic
        const highestPrice = meta.highestPrice || entryPrice;
        let newHighest = highestPrice;
        let shouldExit = false;
        let exitReason = '';

        if (side === 'BUY') {
            // Update Highest Price
            if (currentPrice > highestPrice) {
                newHighest = currentPrice;
            }

            // Trailing Stop Loss
            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                const slPrice = newHighest * (1 - payload.stopLoss.deviation / 100);
                if (currentPrice <= slPrice) {
                    shouldExit = true;
                    exitReason = `TRAILING STOP LOSS HIT @ ${currentPrice}`;
                }
            } else if (payload.stopLoss?.price) {
                // Fixed SL
                const fixedSL = parseFloat(payload.stopLoss.price);
                if (currentPrice <= fixedSL) {
                    shouldExit = true;
                    exitReason = `FIXED STOP LOSS HIT @ ${currentPrice}`;
                }
            }

            // Take Profit
            if (payload.takeProfit?.price) {
                const tpPrice = parseFloat(payload.takeProfit.price);
                if (currentPrice >= tpPrice) {
                    if (payload.takeProfit.trailing && payload.takeProfit.deviation) {
                        // Trailing TP Logic: If price starts dropping by X% from Peak AFTER hitting TP
                        // For now, simple implementation: Exit if price drops deviation% from newHighest
                        const trailExit = newHighest * (1 - payload.takeProfit.deviation / 100);
                        if (currentPrice <= trailExit) {
                            shouldExit = true;
                            exitReason = `TRAILING TAKE PROFIT HIT @ ${currentPrice}`;
                        }
                    } else {
                        shouldExit = true;
                        exitReason = `FIXED TAKE PROFIT HIT @ ${currentPrice}`;
                    }
                }
            }
        } else {
            // Side === 'SELL' (Cover mode)
            // Reverse logic: Track Lowest Price
            const lowestPrice = meta.lowestPrice || entryPrice;
            let newLowest = lowestPrice;

            if (currentPrice < lowestPrice) {
                newLowest = currentPrice;
            }

            // Trailing Stop Loss (Buy back at higher price)
            if (payload.stopLoss?.trailing && payload.stopLoss?.deviation) {
                const slPrice = newLowest * (1 + payload.stopLoss.deviation / 100);
                if (currentPrice >= slPrice) {
                    shouldExit = true;
                    exitReason = `TRAILING STOP LOSS (SELL) HIT @ ${currentPrice}`;
                }
            }

            // Take Profit (Buy back at lower price)
            if (payload.takeProfit?.price) {
                const tpPrice = parseFloat(payload.takeProfit.price);
                if (currentPrice <= tpPrice) {
                    shouldExit = true;
                    exitReason = `TAKE PROFIT (SELL) HIT @ ${currentPrice}`;
                }
            }
            
            meta.lowestPrice = newLowest;
        }

        // 3. Update Meta & DB
        meta.highestPrice = newHighest;
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

async function executeExit(trade: MonitoredTrade, currentPrice: number, reason: string) {
    const { id, symbol, side, qty, meta: rawMeta } = trade;
    const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
    
    try {
        let result;
        if (side === 'BUY') {
            // Sell to close
            result = await marketSellByQty(symbol, String(qty));
        } else {
            // Buy back to close
            const cost = qty * currentPrice;
            result = await marketBuyByQuote(symbol, cost.toFixed(4));
        }

        await sql`
            UPDATE orders 
            SET status = 'CLOSED', 
                meta = ${JSON.stringify({ ...meta, exitReason: reason, exitResult: result, exitPrice: currentPrice, closedAt: Date.now() })} 
            WHERE id = ${id}
        `;
        
        console.log(`[SmartMonitor] Successfully closed trade ${id} for ${symbol}`);
    } catch (err) {
        console.error(`[SmartMonitor] Failed to execute exit for ${symbol}:`, err);
    }
}
