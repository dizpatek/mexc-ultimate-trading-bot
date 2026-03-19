import { BotConfig, createStrategySignal, logSystemEvent } from "./db";
import { buildInsight } from "./insight-utils";
import { DEFAULT_BOT_CONFIG, DEFAULT_TIMEFRAME_SETTINGS } from "./constants/bot-defaults";
import { TradingMode, getPrice } from "./mexc-wrapper";
import { handleSmartTrade } from "./smart-trade";
import { executeExit } from "./smart-trade-execution";
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

// In-memory cache: userId -> (symbol -> re-entry record)
// P4.2: Structured for multi-user compatibility
const pilotReEntryMap = new Map<number, Map<string, ReEntryRecord>>();
const initializedUsers = new Set<number>();

/**
 * Load re-entry records from the DB into the in-memory map.
 * Called once on first signal check after restart.
 * Queries closed pilot_auto TRADE orders that haven't been re-entered.
 */
async function loadReEntryMapFromDB(userId: number): Promise<void> {
  if (initializedUsers.has(userId)) return;
  try {
    // Find closed pilot_auto BUY trades (TRADE mode) with exit data
    // that don't have a newer FILLED/PENDING order for the same symbol
    const { rows } = await sql`
      SELECT o.symbol, o.meta
      FROM orders o
      WHERE o.user_id = ${userId}
        AND o.status = 'CLOSED'
        AND o.side = 'BUY'
        AND o.meta::jsonb->>'source' = 'pilot_auto'
        AND o.meta::jsonb->>'tradeState' = 'TRADE_COMPLETED'
        AND o.meta::jsonb->>'reEntryConsumed' IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.user_id = o.user_id
            AND o2.symbol = o.symbol 
            AND o2.status IN ('FILLED', 'PENDING')
            AND o2.meta::jsonb->>'smartTrade' = 'true'
        )
      ORDER BY o.updated_at DESC
    `;

    if (!pilotReEntryMap.has(userId)) {
      pilotReEntryMap.set(userId, new Map());
    }
    const userMap = pilotReEntryMap.get(userId)!;

    for (const row of rows) {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      const exitPrice = Number(meta.exitPrice || 0);
      const executedQty = Number(meta.executedQty || 0);
      const usdtProceeds = exitPrice * executedQty;

      if (usdtProceeds >= 5 && !userMap.has(row.symbol as string)) {
        userMap.set(row.symbol as string, {
          lastSaleUsdt: usdtProceeds,
          lastSaleAt: Number(meta.closedAt || Date.now()),
          symbol: row.symbol as string,
        });
        console.log(`[Pilot] ♻️ RE-ENTRY LOADED FROM DB: ${row.symbol as string} | User: ${userId} | USDT: $${usdtProceeds.toFixed(2)}`);
      }
    }

    initializedUsers.add(userId);
    console.log(`[Pilot] ♻️ Re-entry map initialized for User ${userId}: ${userMap.size} symbols ready.`);
  } catch (err) {
    console.error(`[Pilot] Failed to load re-entry map for user ${userId} from DB:`, err);
    initializedUsers.add(userId); // Mark as attempt made
  }
}

/**
 * Register a symbol for re-entry after a pilot TRADE sell completion.
 * Called from smart-trade-execution.ts when a pilot_auto TRADE exits.
 * Persists to in-memory map (DB record already exists in orders table).
 */
export function registerPilotReEntry(userId: number, symbol: string, usdtProceeds: number) {
  if (!pilotReEntryMap.has(userId)) {
    pilotReEntryMap.set(userId, new Map());
  }
  pilotReEntryMap.get(userId)!.set(symbol, {
    lastSaleUsdt: usdtProceeds,
    lastSaleAt: Date.now(),
    symbol,
  });
  console.log(`[Pilot] ♻️ RE-ENTRY REGISTERED: ${symbol} | User: ${userId} | USDT: $${usdtProceeds.toFixed(2)}`);
}

/**
 * Consume (and remove) a re-entry record for a symbol.
 * Also marks the source order as consumed in DB to prevent double re-entry.
 * Returns null if no re-entry is registered.
 */
async function consumeReEntry(userId: number, symbol: string): Promise<ReEntryRecord | null> {
  const userMap = pilotReEntryMap.get(userId);
  const record = userMap?.get(symbol);
  if (record) {
    userMap!.delete(symbol);
    // Mark ONLY the most recent matching order as consumed in DB
    try {
      await sql`
        UPDATE orders SET meta = (meta::jsonb || '{"reEntryConsumed": true}'::jsonb)::text
        WHERE id = (
          SELECT id FROM orders
          WHERE user_id = ${userId}
            AND symbol = ${symbol}
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
      console.warn(`[Pilot] Failed to mark re-entry as consumed for ${symbol} (User: ${userId}):`, err);
    }
    return record;
  }
  return null;
}

/**
 * Check if a symbol has a pending re-entry record (without consuming it).
 * Returns false if the DB map hasn't been loaded yet (prevents race conditions).
 */
function hasReEntry(userId: number, symbol: string): boolean {
  if (!initializedUsers.has(userId)) return false; // Guard: DB not loaded yet
  return !!pilotReEntryMap.get(userId)?.has(symbol);
}

/**
 * Normalizes symbols to prevent double USDT suffixes (e.g. BTCUSDTUSDT -> BTCUSDT)
 */
function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";
  let s = symbol.toUpperCase().replace(/\//g, "");
  if (s.endsWith("USDTUSDT")) {
    s = s.replace("USDTUSDT", "USDT");
  }
  return s;
}

export class PilotExecutor {
  /**
   * Ensure the re-entry map is loaded from DB before processing signals.
   * Must be called before calculateAllocation.
   */
  static async ensureReEntryMapLoaded(userId: number): Promise<void> {
    await loadReEntryMapFromDB(userId);
  }

  /**
   * Calculates the target quantity and identifies if the signal is a new buy
   */
  static calculateAllocation(
    userId: number,
    symbol: string,
    holdingsMap: Map<string, any>,
    botConfig: BotConfig,
    signalType: string
  ): { hasHolding: boolean; targetQty: number; isNewBuy: boolean; isReEntry: boolean; reEntryUsdt: number } {
    const symbolKey = normalizeSymbol(symbol);
    const holding = holdingsMap.get(symbolKey) || holdingsMap.get(symbol);
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
    const isReEntry = !hasHolding && signalType === "BUY" && hasReEntry(userId, symbolKey);
    const reEntryUsdt = isReEntry ? (pilotReEntryMap.get(userId)?.get(symbolKey)?.lastSaleUsdt || 0) : 0;

    // If we don't hold the asset, but signal is BUY and pilot_only_holdings is false -> New Buy
    const isNewBuy = !hasHolding && !isReEntry && signalType === "BUY" && botConfig.pilot_only_holdings === false;

    // TARGET QTY logic for Adding to positions (Ek Alım): 
    // If we have holding, we should still use USDT balance for the new buy part.
    if (hasHolding && signalType === "BUY") {
       // P4.2: If we already have the asset, we don't necessarily want to set quantity to 0 here because 
       // it causes "Invalid amount" if the pilot tries to "take over" the position at line 616.
       // We keep the targetQty as the current holding to allow Management mode.
       targetQty = totalQty; 
    }

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
        const cleanSymbol = normalizeSymbol(symbol);
        const msg = `Bakiye yetersiz.`;
        console.log(`[Pilot] \u26a0\ufe0f ${cleanSymbol} BUY ATLANDI: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`);
        await logSystemEvent(userId, "SYSTEM", "TRADE_SKIPPED", `TRADE_SKIPPED: ${cleanSymbol} atlandı: ${msg}`);
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

      console.log(`[Pilot] \u2708\ufe0f Executing NEW BUY for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Alloc: $${allocUsdt.toFixed(2)}`);
      
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
   */
  static async executeReEntryBuy(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, reEntryUsdt: number) {
    try {
      const symbolKey = normalizeSymbol(symbol);
      const record = await consumeReEntry(userId, symbolKey);
      const allocUsdt = record?.lastSaleUsdt || reEntryUsdt;

      if (allocUsdt < 5) {
        const cleanSymbol = normalizeSymbol(symbol);
        const msg = `Bakiye yetersiz.`;
        console.log(`[Pilot] \u26a0\ufe0f ${cleanSymbol} RE-ENTRY ATLANDI: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`);
        await logSystemEvent(userId, "SYSTEM", "TRADE_SKIPPED", `TRADE_SKIPPED: ${cleanSymbol} atlandı: ${msg}`);
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

      console.log(`[Pilot] \u267b\ufe0f Executing RE-ENTRY BUY for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | USDT: $${allocUsdt.toFixed(2)}`);

      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: baseQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: false, 
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
      const tpPerc = botConfig.timeframe_settings?.cover_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.cover_tp_percent;
      const slPerc = botConfig.timeframe_settings?.cover_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.cover_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice, 
        signal.targets || {}, 
        tpPerc, 
        slPerc, 
        false // Cover is Short
      );

      console.log(`[Pilot] \u2708\ufe0f Creating SmartTrade SELL (COVER) for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Qty: ${targetQty.toFixed(8)}`);

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
    userId: number,
    symbol: string, 
    signal: any, 
    timestamp: number, 
    executed: boolean, 
    executionResult: any, 
    mode: TradingMode, 
    scanTimeframe: string, 
    aiScore: number,
    recentSignals: any[],
    activeSmartTrades?: any[]
  }) {
    const { userId, symbol, signal, timestamp, executed, executionResult, mode, scanTimeframe, aiScore } = p;
    let vetoReason: string | undefined = undefined;
    if (signal.reason && signal.reason.includes("🛑")) vetoReason = signal.reason.split("🛑")[1].trim();

    const mergedResult = {
      ...(executionResult || {}),
      confidence: aiScore,
      is_whale: !!signal.indicators?.whaleDetected,
      insight: buildInsight(signal.signal, signal.indicators),
      meta: {
        rawSignal: signal,
        vetoReason,
        mode
      }
    };

    await createStrategySignal({
      user_id: userId,
      symbol,
      timeframe: scanTimeframe,
      signal_type: signal.signal,
      price: signal.price || 0,
      timestamp, 
      executed,
      execution_result: mergedResult,
      trading_mode: mode,
      veto_reason: vetoReason
    });
  }

  /**
   * Force-closes an active SmartTrade (used for Matrix mode flipping).
   */
  static async closeSmartTrade(record: any, userId: number, mode: TradingMode) {
    const symbol = record.symbol;
    try {
      console.log(`[Pilot] \u21aa\ufe0f Closing SmartTrade for ${symbol} (Matrix Flip/Exit)`);
      const currentPrice = await getPrice(symbol);
      const qty = parseFloat(String(record.qty || 0));
      
      if (qty <= 0) {
        await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = (meta::jsonb || '{"exitReason": "ZERO_QTY_GHOST_ORDER"}'::jsonb)::text WHERE id = ${record.id}`;
        return;
      }

      await executeExit(
        {
          id: record.id,
          user_id: userId,
          symbol: symbol,
          side: record.side,
          qty: record.qty,
          price: record.price,
          meta: record.meta,
          trading_mode: mode
        },
        currentPrice,
        "MATRIX_FLIP_EXIT",
        record.meta,
        qty
      );
      console.log(`[Pilot] \u2705 Successfully closed ${symbol} for flip.`);
    } catch (err) {
      console.error(`[Pilot] \u274c Failed to close SmartTrade for ${symbol}:`, err);
      await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = (meta::jsonb || '{"exitError": "FAILED_TO_EXIT_API"}'::jsonb)::text WHERE id = ${record.id}`;
    }
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
    activeSmartTrades: any[];
    lockInfo?: any;
  }) {
    const { symbol, signal, scanTimeframe, botConfig, userId, mode, holdingsMap, recentSignals, activeSmartTrades } = params;
    const timestamp = Date.now();

    // 1. Deduplication check
    const recentExecuted = recentSignals.find(s => 
      s.symbol === symbol && (s.signal_type === "BUY" || s.signal_type === "SELL") && s.executed === true
    );
    if (recentExecuted) return;

    // 2. Matrix vs Hedge Logic
    const activeForSymbol = activeSmartTrades.filter(t => normalizeSymbol(t.symbol) === normalizeSymbol(symbol));
    const buyTrade = activeForSymbol.find(t => t.meta?.mode === "TRADE");
    const sellTrade = activeForSymbol.find(t => t.meta?.mode === "COVER");

    const pilotMode = botConfig.pilot_mode || "matrix";

    if (signal.signal === "BUY") {
      if (buyTrade) {
        console.log(`[Pilot] \ud83d\udee1 ${symbol} için zaten aktif bir ALIM (TRADE) işlemi var. Sinyal atlanıyor.`);
        return;
      }
      if (sellTrade && pilotMode === "matrix") {
        console.log(`[Pilot] \u21aa\ufe0f ${symbol} Matrix Modu: Aktif SATIŞ (COVER) kapatılıyor...`);
        await this.closeSmartTrade(sellTrade, userId, mode);
      }
    } else if (signal.signal === "SELL") {
      if (sellTrade) {
        console.log(`[Pilot] \ud83d\udee1 ${symbol} için zaten aktif bir SATIŞ (COVER) işlemi var. Sinyal atlanıyor.`);
        return;
      }
      if (buyTrade && pilotMode === "matrix") {
        console.log(`[Pilot] \u21aa\ufe0f ${symbol} Matrix Modu: Aktif ALIŞ (TRADE) kapatılıyor...`);
        await this.closeSmartTrade(buyTrade, userId, mode);
      }
    }

    if (!signal.signal) {
      await this.recordSignalResult({ ...params, timestamp, executed: false, executionResult: {}, aiScore: 0 });
      return;
    }

    const aiScore = typeof signal.indicators?.aiScore === 'number' ? signal.indicators.aiScore : 0;
    console.log(`[Pilot] Signal for ${symbol}: ${signal.signal} | Score: ${aiScore}`);
    
    // 3. Calculate Allocation
    const alloc = this.calculateAllocation(userId, symbol, holdingsMap, botConfig, signal.signal);

    let executed = false;
    let executionResult: Record<string, unknown> = {};

    // 4. Execution Routing
    const cleanSymbol = normalizeSymbol(symbol);
    if (!alloc.hasHolding && !alloc.isNewBuy && !alloc.isReEntry) {
      const skipMsg = botConfig.pilot_only_holdings 
        ? "Portföyü Tara aktif olduğu için ve varlık bulunmadığı için atlandı." 
        : "Varlık bakiyesi yetersiz olduğu için atlandı.";
        
      console.log(`[Pilot] \ud83d\udee1 ${cleanSymbol} ATLANDI: ${skipMsg}`);
      
      await logSystemEvent(userId, "SYSTEM", 
        `Sinyal geldi [${cleanSymbol}]`, 
        `${skipMsg} | AI Skoru: ${aiScore} | Portföy Ayarı: ${botConfig.pilot_only_holdings ? 'Sadece Portföy' : 'Tümü'}`
      );
      executionResult = { message: skipMsg };
    } else {
      await logSystemEvent(userId, "SYSTEM", "POSITIVE", `\ud83c\udfaf MATRIX V5 S\u0130NYAL\u0130: ${cleanSymbol} [${signal.signal === "BUY" ? "GO_LONG" : "GO_SHORT"}]: AI Skoru: ${aiScore} | ${signal.signal === "BUY" ? "YUKARI \ud83d\udcc8" : "A\u015eA\u011eI \ud83d\udcc9"}`);

      if (signal.signal === "BUY") {
        if (alloc.isReEntry) {
          await logSystemEvent(userId, "SYSTEM", 
            `Sinyal geldi [${cleanSymbol}], Re-Entry (Geri Alım) modunda işleme giriliyor.`,
            `AI Skoru: ${aiScore}.`
          );
          const result = await this.executeReEntryBuy(symbol, botConfig, userId, mode, scanTimeframe, signal, alloc.reEntryUsdt);
          executed = result.executed;
          executionResult = result.data;
        } else if (alloc.isNewBuy) {
          await logSystemEvent(userId, "SYSTEM", 
            `Sinyal geldi [${cleanSymbol}], Yeni Varlık modunda işleme giriliyor.`,
            `AI Skoru: ${aiScore}.`
          );
          const result = await this.executeNewBuy(symbol, botConfig, userId, mode, scanTimeframe, signal, holdingsMap);
          executed = result.executed;
          executionResult = result.data;
        } else {
          // 📦 EXISTING ASSET MANAGEMENT (No Ek Alım / Portföy Odaklı)
          // Eğer cüzdanda varlık varsa ancak aktif bir SmartTrade yoksa (manuel alım veya takip dışı),
          // otopilot bu varlığı 'useExisting: true' ile devralır. Ek bakiye harcamaz.
          await logSystemEvent(userId, "SYSTEM", 
            `Sinyal geldi [${cleanSymbol}], Mevcut varlık otopilot denetimine alınıyor.`,
            `Varlık Denetimi: Aktif. Ek Alım: Hayır (Pas geçildi). AI Skoru: ${aiScore}`
          );
          
          // executeTradeOnHolding'i useExisting: true olacak şekilde çağırmalıyız veya benzer mantık.
          // Mevcut executeTradeOnHolding USDT harcamaya çalışıyor, onu pas geçip direkt handleSmartTrade'e gidelim.
          const currentPrice = await getPrice(symbol);
          const tpPerc = botConfig.timeframe_settings?.pilot_tp_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
          const slPerc = botConfig.timeframe_settings?.pilot_sl_percent ?? DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;
          const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(currentPrice, signal.targets || {}, tpPerc, slPerc, true);

          const finalAmount = alloc.targetQty > 0 ? alloc.targetQty.toString() : "0";
          if (finalAmount === "0") {
            console.warn(`[Pilot] ⚠️ ${symbol} için miktar 0 olarak hesaplandı, işlem atlanıyor.`);
            return;
          }

          const res = await handleSmartTrade({
            mode: "TRADE",
            symbol,
            amount: finalAmount, // hasHolding true olduğu için calculateAllocation'dan gelen miktar (veya cüzdan miktarı)
            buyPrice: currentPrice.toString(),
            buyType: "MARKET",
            useExisting: true, // KRİTİK: Mevcut varlığı kullan, USDT harcama
            user_id: userId,
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
            timeframe: scanTimeframe,
            source: "pilot_auto",
          }, mode);
          
          executed = true;
          executionResult = { ...(res as any), type: "SMART_TRADE_ADOPTED", source: "pilot_auto" };
        }
      } else if (signal.signal === "SELL" && alloc.hasHolding) {
        await logSystemEvent(userId, "SYSTEM", 
          `Sinyal geldi [${cleanSymbol}], Satış (COVER) modunda çıkış yapılıyor.`,
          `AI Skoru: ${aiScore}.`
        );
        const result = await this.executeCover(symbol, botConfig, userId, mode, scanTimeframe, alloc.targetQty, signal);
        executed = result.executed;
        executionResult = result.data;
      }
    }

    // 5. Record Result
    await this.recordSignalResult({
      userId,
      symbol,
      signal,
      timestamp,
      executed,
      executionResult,
      mode,
      scanTimeframe,
      aiScore,
      recentSignals,
      activeSmartTrades
    });

    if (executed) {
      recentSignals.push({
        symbol,
        signal_type: signal.signal,
        executed: true,
        timestamp: Date.now()
      });
    }
  }
}
