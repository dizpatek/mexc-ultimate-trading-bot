import { calculateF4 } from './indicators/f4';
import { getKlines } from './mexc-wrapper'; // Use wrapper!
import { sql } from '@vercel/postgres';
import { executePanicSell } from './panic-service';

interface Alarm {
    id: number;
    user_id: string;
    symbol: string;
    condition_type: 'BUY_SIGNAL' | 'SELL_SIGNAL' | 'F4_BUY_SIGNAL' | 'F4_SELL_SIGNAL' | 'PRICE_ABOVE' | 'PRICE_BELOW'; // added F4
    action_type: 'NOTIFY' | 'TRADE' | 'PANIC_SELL';
    parameters?: any;
}

// Helper to map raw MEXC klines to arrays required by F4
function mapToArrays(rawKlines: any[]): any {
    // MEXC kline structure: [time, open, high, low, close, vol, ...]
    const high = rawKlines.map(k => parseFloat(k[2]));
    const low = rawKlines.map(k => parseFloat(k[3]));
    const close = rawKlines.map(k => parseFloat(k[4]));
    const volume = rawKlines.map(k => parseFloat(k[5]));

    return { high, low, close, volume };
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
        // Default to 1h interval for now as per F4 standard
        const rawKlines: any[] = await getKlines(symbol, '60m');
        if (!rawKlines || rawKlines.length < 100) {
            console.warn(`[AlarmEngine] Insufficient data for ${symbol}`);
            return;
        }

        const { high, low, close, volume } = mapToArrays(rawKlines);

        // 3. Calculate Indicator (F4)
        const f4Result = calculateF4({
            high, low, close, volume,
            length1: 7,
            a1: 3.7,
            length12: 5,
            a12: 0.618,
            wtLength: 10,
            wtAvgLength: 21,
        });

        const { f4Signal, actionRecommendation } = f4Result;

        // Log latest values
        const latestPrice = close[close.length - 1];
        console.log(`[AlarmEngine] ${symbol}: Price=${latestPrice}, Signal=${f4Signal}`);

        // 4. Check Conditions
        for (const alarm of alarms) {
            let triggered = false;

            // Updated condition checks for F4
            if ((alarm.condition_type === 'BUY_SIGNAL' || alarm.condition_type === 'F4_BUY_SIGNAL') && f4Signal === 'BUY') {
                triggered = true;
            } else if ((alarm.condition_type === 'SELL_SIGNAL' || alarm.condition_type === 'F4_SELL_SIGNAL') && f4Signal === 'SELL') {
                triggered = true;
            }

            if (triggered) {
                await executeAlarmAction(alarm, latestPrice, f4Result);
            }
        }

    } catch (error) {
        console.error(`[AlarmEngine] Error processing ${symbol}:`, error);
    }
}

async function executeAlarmAction(alarm: Alarm, price: number, f4Result: any) {
    console.log(`[AlarmEngine] 🚨 ALARM TRIGGERED: ${alarm.symbol} ${alarm.condition_type}`);

    try {
        let actionResult: any = { status: 'triggered', f4Data: f4Result };

        // Execute Action
        if (alarm.action_type === 'PANIC_SELL') {
            console.log(`[AlarmEngine] EXECUTING PANIC SELL FOR USER ${alarm.user_id}`);
            // Execute actual panic logic (now test-mode aware)
            const panicResult = await executePanicSell(alarm.user_id);
            actionResult = { ...actionResult, ...panicResult };
        } else if (alarm.action_type === 'TRADE') {
            console.log(`[AlarmEngine] EXECUTING AUTO TRADE FOR ${alarm.symbol}`);

            const side = (alarm.condition_type.includes('BUY')) ? 'BUY' : 'SELL';
            actionResult = {
                status: 'auto_trade_signal_sent',
                side,
                symbol: alarm.symbol,
                price,
                message: `Auto-trade signal for ${side} on ${alarm.symbol} at ${price}`
            };
            // Ideally trigger trade logic here (requires user context/API keys)
            // For now just logging the signal
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
