import { MatrixV5Engine, MatrixV5Result } from "./matrix-v5-engine";
import { getKlines } from "./mexc-wrapper"; // Use wrapper!
import { sql } from "@/lib/postgres";
import { executePanicSell } from "./panic-service";
import { getBotConfig, BotConfig, resolveTradeMode } from "./db";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Alarm {
  id: number;
  user_id: string;
  symbol: string;
  condition_type:
    | "BUY_SIGNAL"
    | "SELL_SIGNAL"
    | "F4_BUY_SIGNAL"
    | "F4_SELL_SIGNAL"
    | "PRICE_ABOVE"
    | "PRICE_BELOW"; // added F4
  action_type: "NOTIFY" | "TRADE" | "PANIC_SELL";
  parameters?: Record<string, unknown>;
}

interface KlineData {
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

// Helper to map raw MEXC klines to arrays required by Matrix V5
function mapToArrays(rawKlines: unknown[][]): KlineData {
  // MEXC kline structure: [time, open, high, low, close, vol, ...]
  const high = rawKlines.map((k) => parseFloat(String(k[2])));
  const low = rawKlines.map((k) => parseFloat(String(k[3])));
  const close = rawKlines.map((k) => parseFloat(String(k[4])));
  const volume = rawKlines.map((k) => parseFloat(String(k[5])));

  return { high, low, close, volume };
}

// ─── CORE ENGINE ─────────────────────────────────────────────────────────────

export async function checkAlarms() {
  console.log("[AlarmEngine] Starting alarm check cycle...");

  try {
    const { rows } = await sql`SELECT * FROM alarms WHERE is_active = true`;
    const alarms = rows as unknown as Alarm[];

    if (alarms.length === 0) {
      console.log("[AlarmEngine] No active alarms");
      return;
    }

    console.log(`[AlarmEngine] Checking ${alarms.length} active alarms`);

    // Group alarms by user_id to fetch configs efficiently
    const alarmsByUser = alarms.reduce((acc: Map<number, Alarm[]>, a: Alarm) => {
      const uid = Number(a.user_id);
      if (!acc.has(uid)) acc.set(uid, []);
      acc.get(uid)!.push(a);
      return acc;
    }, new Map<number, Alarm[]>());

    const userConfigCache = new Map<number, { 
      tradeMode: "Scalp" | "Swing"; 
      scanTimeframe: string; 
      f4Multiplier: number;
      scalpF4Multiplier: number;
      swingF4Multiplier: number;
    }>();

    for (const [userId, userAlarms] of alarmsByUser.entries()) {
      let config = userConfigCache.get(userId);
      if (!config) {
        try {
          const botConfig = await getBotConfig(userId);
          config = {
            tradeMode: resolveTradeMode(botConfig),
            scanTimeframe: botConfig?.pilot_timeframe || "1h",
            f4Multiplier: botConfig?.f4_multiplier ? Number(botConfig.f4_multiplier) : 1.0,
            scalpF4Multiplier: botConfig?.scalp_f4_multiplier ? Number(botConfig.scalp_f4_multiplier) : 3.7,
            swingF4Multiplier: botConfig?.swing_f4_multiplier ? Number(botConfig.swing_f4_multiplier) : 1.2
          };
          userConfigCache.set(userId, config);
        } catch {
          config = { 
            tradeMode: "Scalp", 
            scanTimeframe: "1h", 
            f4Multiplier: 1.0, 
            scalpF4Multiplier: 3.7, 
            swingF4Multiplier: 1.2 
          };
        }
      }

      const engine = new MatrixV5Engine({ 
        tradeMode: config.tradeMode,
        f4Multiplier: config.f4Multiplier,
        scalpF4Multiplier: config.scalpF4Multiplier,
        swingF4Multiplier: config.swingF4Multiplier
      });
      
      // Group by symbol for this user
      const symbolGroups = userAlarms.reduce((acc: Map<string, Alarm[]>, a: Alarm) => {
        if (!acc.has(a.symbol)) acc.set(a.symbol, []);
        acc.get(a.symbol)!.push(a);
        return acc;
      }, new Map<string, Alarm[]>());

      const symbolEntries = Array.from(symbolGroups.entries());
      const CONCURRENCY = 3; 

      for (let i = 0; i < symbolEntries.length; i += CONCURRENCY) {
        const chunk = symbolEntries.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          chunk.map(([symbol, symbolAlarms]) => 
            processSymbolAlarms(symbol, symbolAlarms, engine, config!.scanTimeframe)
          )
        );
      }
    }
  } catch (error) {
    console.error("[AlarmEngine] Failed to run alarm cycle:", error);
  }
}

async function processSymbolAlarms(
  symbol: string,
  alarms: Alarm[],
  engine: MatrixV5Engine,
  scanTimeframe: string = "1h",
) {
  try {
    // 2. Fetch OHLC Data
    // Use config timeframe instead of hardcoded 60m
    const mexcInterval = scanTimeframe === "1h" ? "60m" : scanTimeframe === "4h" ? "4h" : "60m";
    const rawKlines: unknown[][] = (await getKlines(
      symbol,
      mexcInterval,
    )) as unknown[][];
    if (!rawKlines || rawKlines.length < 100) {
      console.warn(`[AlarmEngine] Insufficient data for ${symbol}`);
      return;
    }

    const { high, low, close, volume } = mapToArrays(rawKlines);

    // 3. Calculate Indicator (V5)
    const v5Result = engine.analyze(close, high, low, volume, scanTimeframe, "normal");

    const f4Signal = v5Result.signal;

    // Log latest values
    const latestPrice = close[close.length - 1];
    console.log(
      `[AlarmEngine] ${symbol}: Price=${latestPrice}, Signal=${f4Signal}`,
    );

    // 4. Check Conditions
    for (const alarm of alarms) {
      let triggered = false;

      // V5 Migration: "F4" signal types are now processed by the more intelligent V5 engine.
      // We maintain the F4 naming convention for database row compatibility.
      if (
        (alarm.condition_type === "BUY_SIGNAL" ||
          alarm.condition_type === "F4_BUY_SIGNAL") &&
        f4Signal === "BUY"
      ) {
        triggered = true;
      } else if (
        (alarm.condition_type === "SELL_SIGNAL" ||
          alarm.condition_type === "F4_SELL_SIGNAL") &&
        f4Signal === "SELL"
      ) {
        triggered = true;
      }

      if (triggered) {
        await executeAlarmAction(alarm, latestPrice, v5Result);
      }
    }
  } catch (error) {
    console.error(`[AlarmEngine] Error processing ${symbol}:`, error);
  }
}

async function executeAlarmAction(
  alarm: Alarm,
  price: number,
  v5Result: MatrixV5Result,
) {
  console.log(
    `[AlarmEngine] ALARM TRIGGERED: ${alarm.symbol} ${alarm.condition_type}`,
  );

  try {
    let actionResult: Record<string, unknown> = {
      status: "triggered",
      v5Data: v5Result,
    };

    // Execute Action
    if (alarm.action_type === "PANIC_SELL") {
      console.log(
        `[AlarmEngine] EXECUTING PANIC SELL FOR USER ${alarm.user_id}`,
      );
      // Execute actual panic logic (now test-mode aware)
      const panicResult = await executePanicSell(alarm.user_id);
      actionResult = { ...actionResult, ...panicResult };
    } else if (alarm.action_type === "TRADE") {
      console.log(`[AlarmEngine] EXECUTING AUTO TRADE FOR ${alarm.symbol}`);

      const side = alarm.condition_type.includes("BUY") ? "BUY" : "SELL";
      actionResult = {
        status: "auto_trade_signal_sent",
        side,
        symbol: alarm.symbol,
        price,
        message: `Auto-trade signal for ${side} on ${alarm.symbol} at ${price}`,
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
