import { F3 } from './indicators/f3-indicator';
import { getKlines } from './mexc';
import { sql } from '@vercel/postgres';

interface Alarm {
    id: number;
    user_id: string;
    symbol: string;
    condition_type: 'BUY_SIGNAL' | 'SELL_SIGNAL' | 'PRICE_ABOVE' | 'PRICE_BELOW';
    action_type: 'NOTIFY' | 'TRADE' | 'PANIC_SELL';
    parameters?: any;
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
        const klines = await getKlines(symbol, '60m');
        if (!klines || klines.length < 200) {
            console.warn(`[AlarmEngine] Insufficient data for ${symbol}`);
            return;
        }

        // 3. Calculate Indicator (F3)
        const { f3, f3Fibo, buySignal, sellSignal } = F3(klines);

        // Log latest values
        const latestPrice = parseFloat(klines[klines.length - 1].close);
        console.log(`[AlarmEngine] ${symbol}: Price=${latestPrice}, Buy=${buySignal}, Sell=${sellSignal}`);

        // 4. Check Conditions
        for (const alarm of alarms) {
            let triggered = false;

            if (alarm.condition_type === 'BUY_SIGNAL' && buySignal) {
                triggered = true;
            } else if (alarm.condition_type === 'SELL_SIGNAL' && sellSignal) {
                triggered = true;
            }
            // Future: Price alerts

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
        // Log trigger
        await sql`
            INSERT INTO alarm_logs (alarm_id, triggered_at, signal_value, action_result, success)
            VALUES (${alarm.id}, ${Date.now()}, ${price}, '{"status": "triggered"}', true)
        `;

        // Execute Action
        if (alarm.action_type === 'PANIC_SELL') {
            // In a real implementation this would call the /api/panic/sell-all 
            // logic or similar internal function. 
            // For now we log it.
            console.log(`[AlarmEngine] EXECUTING PANIC SELL FOR ${alarm.symbol}`);
        } else if (alarm.action_type === 'TRADE') {
            console.log(`[AlarmEngine] EXECUTING AUTO TRADE FOR ${alarm.symbol}`);
        }

        // Update last triggered
        await sql`
            UPDATE alarms SET last_triggered_at = ${Date.now()} WHERE id = ${alarm.id}
        `;

    } catch (error) {
        console.error(`[AlarmEngine] Action failed for alarm ${alarm.id}:`, error);
    }
}
