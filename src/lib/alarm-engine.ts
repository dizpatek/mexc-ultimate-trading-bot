import { F3 } from './indicators/f3-indicator';
import { getKlines } from './mexc';
import { sql } from '@vercel/postgres';
import { executePanicSell } from './panic-service';

interface Alarm {
    id: number;
    user_id: string;
    symbol: string;
    condition_type: 'BUY_SIGNAL' | 'SELL_SIGNAL' | 'PRICE_ABOVE' | 'PRICE_BELOW';
    action_type: 'NOTIFY' | 'TRADE' | 'PANIC_SELL';
    parameters?: any;
}

// Helper to map raw MEXC klines to OHLCData
function mapToOHLC(rawKlines: any[]): any[] {
    // MEXC kline structure: [time, open, high, low, close, vol, ...]
    return rawKlines.map(k => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
    }));
}

export async function checkAlarms() {
    console.log('[AlarmEngine] Starting alarm check cycle...');

    // 1. Fetch active alarms
    try {
        const { rows: alarms } = await sql<Alarm>`
            SELECT * FROM alarms WHERE is_active = true
        `;

        if (alarms.length === 0) {
            console.log('[AlarmEngine] No active alarms');
            return;
        }

        console.log(`[AlarmEngine] Checking ${alarms.length} active alarms`);

        // Group by symbol to minimize API calls
        const symbols = [...new Set(alarms.map(a => a.symbol))];

        for (const symbol of symbols) {
            await processSymbolAlarms(symbol, alarms.filter(a => a.symbol === symbol));
        }

    } catch (error) {
        console.error('[AlarmEngine] Failed to run alarm cycle:', error);
    }
}

async function processSymbolAlarms(symbol: string, alarms: Alarm[]) {
    try {
        // 2. Fetch OHLC Data
        // Default to 1h interval for now as per F3 standard
        const rawKlines: any[] = await getKlines(symbol, '60m');
        if (!rawKlines || rawKlines.length < 200) {
            console.warn(`[AlarmEngine] Insufficient data for ${symbol}`);
            return;
        }

        const ohlcData = mapToOHLC(rawKlines);

        // 3. Calculate Indicator (F3)
        const { f3, f3Fibo, buySignal, sellSignal } = F3(ohlcData);

        // Log latest values
        const latestPrice = ohlcData[ohlcData.length - 1].close;
        console.log(`[AlarmEngine] ${symbol}: Price=${latestPrice}, Buy=${buySignal}, Sell=${sellSignal}`);

        // 4. Check Conditions
        for (const alarm of alarms) {
            let triggered = false;

            if (alarm.condition_type === 'BUY_SIGNAL' && buySignal) {
                triggered = true;
            } else if (alarm.condition_type === 'SELL_SIGNAL' && sellSignal) {
                triggered = true;
            }

            if (triggered) {
                await executeAlarmAction(alarm, latestPrice);
            }
        }

    } catch (error) {
        console.error(`[AlarmEngine] Error processing ${symbol}:`, error);
    }
}

async function executeAlarmAction(alarm: Alarm, price: number) {
    console.log(`[AlarmEngine] 🚨 ALARM TRIGGERED: ${alarm.symbol} ${alarm.condition_type}`);

    try {
        let actionResult: any = { status: 'triggered' };

        // Execute Action
        if (alarm.action_type === 'PANIC_SELL') {
            console.log(`[AlarmEngine] EXECUTING PANIC SELL FOR USER ${alarm.user_id}`);
            // Execute actual panic logic
            const panicResult = await executePanicSell(alarm.user_id);
            actionResult = { ...actionResult, ...panicResult };
        } else if (alarm.action_type === 'TRADE') {
            console.log(`[AlarmEngine] EXECUTING AUTO TRADE FOR ${alarm.symbol}`);

            // Simple Auto-Trade Logic (Mock/Simulation Phase)
            // If BUY_SIGNAL -> Market Buy
            // If SELL_SIGNAL -> Market Sell
            const side = alarm.condition_type === 'BUY_SIGNAL' ? 'BUY' : 'SELL';

            // In real scenario: await marketOrder(alarm.symbol, side, quantity...);
            actionResult = {
                status: 'simulated_trade',
                side,
                symbol: alarm.symbol,
                price,
                message: `Would execute ${side} on ${alarm.symbol} at ${price}`
            };
        }

        // Log trigger
        await sql`
            INSERT INTO alarm_logs (alarm_id, triggered_at, signal_value, action_result, success)
            VALUES (${alarm.id}, ${Date.now()}, ${price}, ${JSON.stringify(actionResult)}, true)
        `;

        // Update last triggered
        await sql`
            UPDATE alarms SET last_triggered_at = ${Date.now()} WHERE id = ${alarm.id}
        `;

    } catch (error) {
        console.error(`[AlarmEngine] Action failed for alarm ${alarm.id}:`, error);
    }
}
