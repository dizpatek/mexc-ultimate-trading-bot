import { BotConfig, createStrategySignal } from "./db";
import { DEFAULT_BOT_CONFIG, DEFAULT_TIMEFRAME_SETTINGS } from "./constants/bot-defaults";
import { TradingMode, getPrice } from "./mexc-wrapper";
import { handleSmartTrade } from "./smart-trade";
import { sql } from "./postgres";

// ═══════════════════════════════════════════════════════════════════
// PILOT RE-ENTRY MEMORY SYSTEM (DB-BACKED)
// Tracks assets that were traded and sold by the pilot.
// After a sell, the USDT proceeds are stored in DB so the pilot can
// re-buy the same asset on the next BUY signal — even after restart.
// ═══════════════════════════════════════════════════════════════════
interface ReEntryRecord {
  lastSaleUsdt: number;   // USDT proceeds from the last sale
  lastSaleAt: number;     // Timestamp of the sale
  symbol: string;         // The traded symbol
}

// In-memory cache: symbol -> re-entry record (fast lookup, backed by DB)
const pilotReEntryMap = new Map<string, ReEntryRecord>();
let isReEntryMapLoaded = false;

/**
 * Load re-entry records from the DB into the in-memory map.
 * Called once on first signal check after restart.
 * Queries closed pilot_auto TRADE orders that haven't been re-entered.
 */
async function loadReEntryMapFromDB(): Promise<void> {
  if (isReEntryMapLoaded) return;
  try {
    // Find closed pilot_auto BUY trades (TRADE mode) with exit data
    // that don't have a newer FILLED/PENDING order for the same symbol
    const { rows } = await sql`
      SELECT o.symbol, o.meta
      FROM orders o
      WHERE o.status = 'CLOSED'
        AND o.side = 'BUY'
        AND o.meta::jsonb->>'source' = 'pilot_auto'
        AND o.meta::jsonb->>'tradeState' = 'TRADE_COMPLETED'
        AND o.meta::jsonb->>'reEntryConsumed' IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.symbol = o.symbol 
            AND o2.status IN ('FILLED', 'PENDING')
            AND o2.meta::jsonb->>'smartTrade' = 'true'
        )
      ORDER BY o.updated_at DESC
    `;

    for (const row of rows) {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      const exitPrice = Number(meta.exitPrice || 0);
      const executedQty = Number(meta.executedQty || 0);
      const usdtProceeds = exitPrice * executedQty;

      if (usdtProceeds >= 5 && !pilotReEntryMap.has(row.symbol as string)) {
        pilotReEntryMap.set(row.symbol as string, {
          lastSaleUsdt: usdtProceeds,
          lastSaleAt: Number(meta.closedAt || Date.now()),
          symbol: row.symbol as string,
        });
        console.log(`[Pilot] ♻️ RE-ENTRY LOADED FROM DB: ${row.symbol as string} | USDT: $${usdtProceeds.toFixed(2)}`);
      }
    }

    isReEntryMapLoaded = true;
    console.log(`[Pilot] ♻️ Re-entry map loaded: ${pilotReEntryMap.size} symbols ready for re-entry.`);
  } catch (err) {
    console.error("[Pilot] Failed to load re-entry map from DB:", err);
    isReEntryMapLoaded = true; // Mark loaded to avoid infinite retries
  }
}

/**
 * Register a symbol for re-entry after a pilot TRADE sell completion.
 * Called from smart-trade-execution.ts when a pilot_auto TRADE exits.
 * Persists to in-memory map (DB record already exists in orders table).
 */
export function registerPilotReEntry(symbol: string, usdtProceeds: number) {
  pilotReEntryMap.set(symbol, {
    lastSaleUsdt: usdtProceeds,
    lastSaleAt: Date.now(),
    symbol,
  });
  console.log(`[Pilot] ♻️ RE-ENTRY REGISTERED: ${symbol} | USDT: $${usdtProceeds.toFixed(2)}`);
}

/**
 * Consume (and remove) a re-entry record for a symbol.
 * Also marks the source order as consumed in DB to prevent double re-entry.
 * Returns null if no re-entry is registered.
 */
async function consumeReEntry(symbol: string): Promise<ReEntryRecord | null> {
  const record = pilotReEntryMap.get(symbol);
  if (record) {
    pilotReEntryMap.delete(symbol);
    // Mark ONLY the most recent matching order as consumed in DB
    try {
      await sql`
        UPDATE orders SET meta = (meta::jsonb || '{"reEntryConsumed": true}'::jsonb)::text
        WHERE id = (
          SELECT id FROM orders
          WHERE symbol = ${symbol}
            AND status = 'CLOSED'
            AND side = 'BUY'
            AND meta::jsonb->>'source' = 'pilot_auto'
            AND meta::jsonb->>'tradeState' = 'TRADE_COMPLETED'
            AND meta::jsonb->>'reEntryConsumed' IS NULL
          ORDER BY updated_at DESC
          LIMIT 1
        )
      `;
    } catch (err) {
      console.warn(`[Pilot] Failed to mark re-entry as consumed for ${symbol}:`, err);
    }
    return record;
  }
  return null;
}

/**
 * Check if a symbol has a pending re-entry record (without consuming it).
 * Returns false if the DB map hasn't been loaded yet (prevents race conditions).
 */
function hasReEntry(symbol: string): boolean {
  if (!isReEntryMapLoaded) return false; // Guard: DB not loaded yet
  return pilotReEntryMap.has(symbol);
}

export class PilotExecutor {
  /**
   * Ensure the re-entry map is loaded from DB before processing signals.
   * Must be called before calculateAllocation.
   */
  static async ensureReEntryMapLoaded(): Promise<void> {
    await loadReEntryMapFromDB();
  }

  /**
   * Calculates the target quantity and identifies if the signal is a new buy
   */
  static calculateAllocation(
    symbol: string,
    holdingsMap: Map<string, any>,
    botConfig: BotConfig,
    signalType: string
  ): { hasHolding: boolean; targetQty: number; isNewBuy: boolean; isReEntry: boolean; reEntryUsdt: number } {
    const holding = holdingsMap.get(symbol);
    const free = Number(holding?.free || 0);
    const locked = Number(holding?.locked || 0);
    const totalQty = free + locked;

    // Fetch Pilot Allocation from config, default 10%
    const pilotAllocPct = Number(botConfig.timeframe_settings?.pilot_trade_allocation || 10);
    let targetQty = totalQty * (pilotAllocPct / 100);

    // For SELL (Cover), we can only sell the free balance. Cap it to free balance.
    if (signalType === "SELL") {
      targetQty = Math.min(targetQty, free);
    }

    // Standardized threshold (0.0001) to ensure small positions can be managed
    const hasHolding = targetQty > 0.0001;
    
    // RE-ENTRY CHECK: If we don't hold the asset but have a re-entry record, it's a re-entry buy
    const isReEntry = !hasHolding && signalType === "BUY" && hasReEntry(symbol);
    const reEntryUsdt = isReEntry ? (pilotReEntryMap.get(symbol)?.lastSaleUsdt || 0) : 0;

    // If we don't hold the asset, but signal is BUY and pilot_only_holdings is false -> New Buy
    // Note: isNewBuy is only for brand-new assets that were never traded by pilot
    const isNewBuy = !hasHolding && !isReEntry && signalType === "BUY" && botConfig.pilot_only_holdings === false;

    return { hasHolding, targetQty, isNewBuy, isReEntry, reEntryUsdt };
  }

  /**
   * Validates and adjusts TP/SL prices based on entry price and direction.
   * Ensures TP/SL are in the correct direction and maintain minimum distance defined by user.
   */
  private static validatePilotTargets(
    currentPrice: number,
    signalTargets: { t1?: number; sl?: number },
    tpPerc: number,
    slPerc: number,
    isLong: boolean
  ) {
    let finalTpPrice = Number(signalTargets?.t1 || 0);
    let finalSlPrice = Number(signalTargets?.sl || 0);

    const dirMultiplier = isLong ? 1 : -1;
    
    // Calculate required distance thresholds based on user % settings
    const userTpThreshold = currentPrice * (1 + (dirMultiplier * tpPerc / 100));
    const userSlThreshold = currentPrice * (1 - (dirMultiplier * slPerc / 100));

    if (isLong) {
      // Long: TP must be at least as high as user threshold.
      // SL must be at most as high as user threshold (closest to price wins for safety, but user % is the fallback).
      if (finalTpPrice <= userTpThreshold) finalTpPrice = userTpThreshold;
      
      // If signal SL is zero, too wide, or higher than current price, use user set threshold
      if (finalSlPrice <= 0 || finalSlPrice >= currentPrice || finalSlPrice < userSlThreshold) {
        finalSlPrice = userSlThreshold;
      }
    } else {
      // Short / Cover: TP must be at least as low as user threshold.
      if (finalTpPrice <= 0 || finalTpPrice >= currentPrice || finalTpPrice > userTpThreshold) {
        finalTpPrice = userTpThreshold;
      }

      // SL must be at least as high as user threshold (further from price)
      if (finalSlPrice <= currentPrice || finalSlPrice < userSlThreshold) {
        finalSlPrice = userSlThreshold;
      }
    }

    // ASYMMETRIC GUARD (Risk/Reward): Ensure TP distance >= 1.5x SL distance
    const tpDist = Math.abs(finalTpPrice - currentPrice);
    const slDist = Math.abs(finalSlPrice - currentPrice);
    
    if (tpDist < slDist * 1.5) {
      finalTpPrice = currentPrice + (dirMultiplier * slDist * 1.5);
    }

    return { finalTpPrice, finalSlPrice };
  }

  /**
   * Executes a trade on an existing holding.
   * Based on config, it either bypasses the buy and applies TP/SL, or buys more.
   */
  static async executeTradeOnHolding(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, targetQty: number) {
    try {
      const currentPrice = await getPrice(symbol);
      
      const tpPerc = botConfig.timeframe_settings?.pilot_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc = botConfig.timeframe_settings?.pilot_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;
      
      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice, 
        signal.targets || {}, 
        tpPerc, 
        slPerc, 
        true // Trade mode is Long
      );

      console.log(`[Pilot] ✈️ Applying Trade Protections for holding ${symbol} | Qty: ${targetQty.toFixed(8)} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)}`);
      
      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: targetQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: botConfig.pilot_only_holdings, // Tied to config
        user_id: userId,
        trailingBuy: false, // Don't trail buy since we likely own it
        takeProfit: {
          price: finalTpPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_tp_trailing ?? botConfig.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_tp_deviation ?? botConfig.pilot_tp_deviation ?? DEFAULT_BOT_CONFIG.pilot_tp_deviation),
        },
        stopLoss: {
          price: finalSlPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_sl_trailing ?? botConfig.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_sl_deviation ?? botConfig.pilot_sl_deviation ?? DEFAULT_BOT_CONFIG.pilot_sl_deviation),
        },
        timeframe,
        source: "pilot_auto",
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a brand new buy using USDT balance
   */
  static async executeNewBuy(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, holdingsMap: Map<string, any>) {
    try {
      const currentPrice = await getPrice(symbol);
      const usdtHolding = holdingsMap.get("USDT");
      const usdtBalance = Number(usdtHolding?.free || 0);
      const pilotAllocPct = Number(botConfig.timeframe_settings?.pilot_trade_allocation || 10);
      
      // Calculate allocation based on USDT for new buys
      let allocUsdt = usdtBalance * (pilotAllocPct / 100);
      allocUsdt = Math.min(allocUsdt, 100000); // 100k safety max capping
      
      if (allocUsdt < 5) {
        const msg = `USDT bakiye yetersiz: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`;
        console.log(`[Pilot] ⚠️ ${symbol} BUY ATLANDI: ${msg}`);
        return { executed: false, data: { message: msg } };
      }

      const baseQty = allocUsdt / currentPrice;
      
      const tpPerc = botConfig.timeframe_settings?.pilot_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc = botConfig.timeframe_settings?.pilot_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice, 
        signal.targets || {}, 
        tpPerc, 
        slPerc, 
        true // New Buy is Long
      );

      console.log(`[Pilot] ✈️ Executing NEW BUY (Increasing Position) for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Alloc: $${allocUsdt.toFixed(2)}`);
      
      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: baseQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: false, // Brand new asset, we MUST buy
        user_id: userId,
        trailingBuy: botConfig.pilot_trailing_buy ?? DEFAULT_BOT_CONFIG.pilot_trailing_buy,
        trailingBuyDev: botConfig.pilot_trailing_buy_dev ?? DEFAULT_BOT_CONFIG.pilot_trailing_buy_dev,
        takeProfit: {
          price: finalTpPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_tp_trailing ?? botConfig.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_tp_deviation ?? botConfig.pilot_tp_deviation ?? DEFAULT_BOT_CONFIG.pilot_tp_deviation),
        },
        stopLoss: {
          price: finalSlPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_sl_trailing ?? botConfig.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_sl_deviation ?? botConfig.pilot_sl_deviation ?? DEFAULT_BOT_CONFIG.pilot_sl_deviation),
        },
        timeframe,
        source: "pilot_auto",
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a RE-ENTRY buy using USDT proceeds from a previous pilot sale.
   * This is called when the pilot previously sold an asset and wants to re-buy.
   */
  static async executeReEntryBuy(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, reEntryUsdt: number) {
    try {
      // Consume the re-entry record (removes it from the map)
      const record = await consumeReEntry(symbol);
      const allocUsdt = record?.lastSaleUsdt || reEntryUsdt;

      if (allocUsdt < 5) {
        const msg = `Re-entry USDT miktarı yetersiz: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`;
        console.log(`[Pilot] ⚠️ ${symbol} RE-ENTRY ATLANDI: ${msg}`);
        return { executed: false, data: { message: msg } };
      }

      const currentPrice = await getPrice(symbol);
      const baseQty = allocUsdt / currentPrice;
      
      const tpPerc = botConfig.timeframe_settings?.pilot_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc = botConfig.timeframe_settings?.pilot_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice, 
        signal.targets || {}, 
        tpPerc, 
        slPerc, 
        true // Re-entry is Long
      );

      console.log(`[Pilot] ♻️ Executing RE-ENTRY BUY for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | USDT: $${allocUsdt.toFixed(2)}`);

      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: baseQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: false, // Re-entry MUST buy with USDT
        user_id: userId,
        trailingBuy: botConfig.pilot_trailing_buy ?? DEFAULT_BOT_CONFIG.pilot_trailing_buy,
        trailingBuyDev: botConfig.pilot_trailing_buy_dev ?? DEFAULT_BOT_CONFIG.pilot_trailing_buy_dev,
        takeProfit: {
          price: finalTpPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_tp_trailing ?? botConfig.pilot_tp_trailing ?? DEFAULT_BOT_CONFIG.pilot_tp_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_tp_deviation ?? botConfig.pilot_tp_deviation ?? DEFAULT_BOT_CONFIG.pilot_tp_deviation),
        },
        stopLoss: {
          price: finalSlPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.pilot_sl_trailing ?? botConfig.pilot_sl_trailing ?? DEFAULT_BOT_CONFIG.pilot_sl_trailing),
          deviation: Number(botConfig.timeframe_settings?.pilot_sl_deviation ?? botConfig.pilot_sl_deviation ?? DEFAULT_BOT_CONFIG.pilot_sl_deviation),
        },
        timeframe,
        source: "pilot_auto",
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto", reEntry: true } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a COVER mode SmartTrade to sell and buy back lower.
   */
  static async executeCover(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, targetQty: number, signal: any) {
    try {
      const currentPrice = await getPrice(symbol);

      console.log(`[Pilot] ✈️ Creating SmartTrade SELL (COVER) for ${symbol} | Qty: ${targetQty.toFixed(8)}`);

      const tpPerc = botConfig.timeframe_settings?.cover_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.cover_tp_percent;
      const slPerc = botConfig.timeframe_settings?.cover_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.cover_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice, 
        signal.targets || {}, 
        tpPerc, 
        slPerc, 
        false // Cover is Short
      );

      console.log(`[Pilot] ✈️ Creating SmartTrade SELL (COVER) for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Qty: ${targetQty.toFixed(8)}`);

      const res = await handleSmartTrade({
        mode: "COVER",
        symbol,
        amount: targetQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: true,
        user_id: userId,
        takeProfit: {
          price: finalTpPrice.toString(), 
          trailing: Boolean(botConfig.timeframe_settings?.cover_tp_trailing ?? DEFAULT_TIMEFRAME_SETTINGS.cover_tp_trailing),
          deviation: Number(botConfig.timeframe_settings?.cover_tp_deviation ?? DEFAULT_TIMEFRAME_SETTINGS.cover_tp_deviation),
        },
        stopLoss: {
          price: finalSlPrice.toString(),
          trailing: Boolean(botConfig.timeframe_settings?.cover_sl_trailing ?? DEFAULT_TIMEFRAME_SETTINGS.cover_sl_trailing),
          deviation: Number(botConfig.timeframe_settings?.cover_sl_deviation ?? DEFAULT_TIMEFRAME_SETTINGS.cover_sl_deviation),
        },
        timeframe,
        source: "pilot_auto",
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  static async recordSignalResult(p: {
    symbol: string, 
    signal: any, 
    timestamp: number, 
    executed: boolean, 
    executionResult: any, 
    mode: TradingMode, 
    scanTimeframe: string, 
    aiScore: number, 
    recentSignals: any[]
  }) {
    const { symbol, signal, timestamp, executed, executionResult, mode, scanTimeframe, aiScore } = p;
    let vetoReason: string | undefined = undefined;
    if (signal.reason && signal.reason.includes("🛑")) vetoReason = signal.reason.split("🛑")[1].trim();

    const mergedResult = {
      ...(executionResult || {}),
      confidence: aiScore,
      is_whale: !!signal.indicators?.whaleDetected,
      meta: {
        rawSignal: signal,
        vetoReason,
        mode
      }
    };

    await createStrategySignal({
      symbol,
      timeframe: scanTimeframe,
      signal_type: signal.signal,
      price: signal.price || 0,
      timestamp, // Fix: the DB requires timestamp, we pass it explicitly here
      executed,
      execution_result: mergedResult,
      trading_mode: mode,
      veto_reason: vetoReason
    });
  }

  static async handleSignal(params: {
    symbol: string;
    signal: any;
    scanTimeframe: string;
    botConfig: BotConfig;
    userId: number;
    mode: TradingMode;
    holdingsMap: Map<string, any>;
    recentSignals: any[];
    lockInfo?: any;
  }) {
    const { symbol, signal, scanTimeframe, botConfig, userId, mode, holdingsMap, recentSignals } = params;
    const timestamp = Date.now();

    // 1. Deduplication check
    const recentExecuted = recentSignals.find(s => 
      s.symbol === symbol && (s.signal_type === "BUY" || s.signal_type === "SELL") && s.executed === true
    );
    if (recentExecuted) return;

    if (!signal.signal) {
      await this.recordSignalResult({ ...params, timestamp, executed: false, executionResult: {}, aiScore: 0 });
      return;
    }

    const aiScore = typeof signal.indicators?.aiScore === 'number' ? signal.indicators.aiScore : 0;
    console.log(`[Pilot] Signal for ${symbol}: ${signal.signal} | Score: ${aiScore}`);
    
    // 2. Calculate Allocation
    const alloc = this.calculateAllocation(symbol, holdingsMap, botConfig, signal.signal);

    let executed = false;
    let executionResult: Record<string, unknown> = {};

    // 3. Execution Routing
    if (!alloc.hasHolding && !alloc.isNewBuy && !alloc.isReEntry) {
      console.log(`[Pilot] 🛡 ${symbol} ATLANDI: Yetersiz miktar veya sadece elde olanlar ayarı devrede.`);
      executionResult = { message: "Miktar yetersiz veya portföyde yok." };
    } else {
      if (signal.signal === "BUY") {
        if (alloc.isReEntry) {
          // ♻️ RE-ENTRY: Previously traded asset, use stored USDT proceeds
          const result = await this.executeReEntryBuy(symbol, botConfig, userId, mode, scanTimeframe, signal, alloc.reEntryUsdt);
          executed = result.executed;
          executionResult = result.data;
        } else if (alloc.isNewBuy) {
           const result = await this.executeNewBuy(symbol, botConfig, userId, mode, scanTimeframe, signal, holdingsMap);
           executed = result.executed;
           executionResult = result.data;
        } else {
           const result = await this.executeTradeOnHolding(symbol, botConfig, userId, mode, scanTimeframe, signal, alloc.targetQty);
           executed = result.executed;
           executionResult = result.data;
        }
      } else if (signal.signal === "SELL" && alloc.hasHolding) {
        const result = await this.executeCover(symbol, botConfig, userId, mode, scanTimeframe, alloc.targetQty, signal);
        executed = result.executed;
        executionResult = result.data;
      }
    }

    // 4. Record Result
    await this.recordSignalResult({
      symbol,
      signal,
      timestamp,
      executed,
      executionResult,
      mode,
      scanTimeframe,
      aiScore,
      recentSignals
    });

    if (executed) {
      recentSignals.push({
        symbol,
        signal_type: signal.signal,
        executed: true
      });
    }
  }
}
