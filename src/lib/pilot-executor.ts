import { BotConfig, createStrategySignal, logSystemEvent } from "./db";
import { buildInsight } from "./insight-utils";
import {
  DEFAULT_BOT_CONFIG,
  DEFAULT_TIMEFRAME_SETTINGS,
} from "./constants/bot-defaults";
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
  lastSaleUsdt: number; // USDT proceeds from the last sale
  lastSaleAt: number; // Timestamp of the sale
  symbol: string; // The traded symbol
}

// In-memory cache: userId -> (symbol -> re-entry record)
// P4.2: Structured for multi-user compatibility
const pilotReEntryMap = new Map<number, Map<string, ReEntryRecord>>();
const initializedUsers = new Set<number>();
const lastLoadTimeMap = new Map<number, number>(); // userId -> timestamp

// ═══════════════════════════════════════════════════════════════════
// CDT (COVER-TO-TRADE) RE-ENTRY SYSTEM
// COVER işlemi bir asset'i sattığında, BUY sinyali gelirse
// o asset'i aynı miktarda geri alabilmek için hafizaya alınır.
// pilot_cdt_reentry=false ise bypass edilir.
// ═══════════════════════════════════════════════════════════════════
interface CoverSaleRecord {
  qty: number; // Satılan asset miktarı
  symbol: string; // Orijinal sembol
  coverId: number; // Cover order DB ID
}
const coverSaleMap = new Map<number, Map<string, CoverSaleRecord>>();

export function registerCoverSale(
  userId: number,
  symbol: string,
  qty: number,
  coverId: number,
) {
  const cleanSym = normalizeSymbol(symbol);
  if (!coverSaleMap.has(userId)) coverSaleMap.set(userId, new Map());
  coverSaleMap.get(userId)!.set(cleanSym, { qty, symbol, coverId });
  console.log(
    `[Pilot] 📦 CDT COVER SALE: ${symbol} | Qty: ${qty.toFixed(8)} | Cover#${coverId}`,
  );
}

export function clearCoverSale(userId: number, symbol: string) {
  const cleanSym = normalizeSymbol(symbol);
  const deleted = coverSaleMap.get(userId)?.delete(cleanSym);
  if (deleted) console.log(`[Pilot] 📦 CDT COVER SALE CLEARED: ${symbol}`);
}

function hasCoverSale(userId: number, symbol: string): boolean {
  const cleanSym = normalizeSymbol(symbol);
  return !!coverSaleMap.get(userId)?.has(cleanSym);
}

function getCoverSaleRecord(
  userId: number,
  symbol: string,
): CoverSaleRecord | null {
  const cleanSym = normalizeSymbol(symbol);
  return coverSaleMap.get(userId)?.get(cleanSym) || null;
}

/**
 * Load re-entry records from the DB into the in-memory map.
 * Called once on first signal check after restart.
 * Queries closed pilot_auto TRADE orders that haven't been re-entered.
 */
async function loadReEntryMapFromDB(userId: number): Promise<void> {
  const now = Date.now();
  const lastLoad = lastLoadTimeMap.get(userId) || 0;

  // Throttle: Only reload from DB once every 60 seconds to keep it fresh without overhead
  if (initializedUsers.has(userId) && now - lastLoad < 60000) return;
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
      const meta =
        typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
      const exitPrice = Number(meta.exitPrice || 0);
      const executedQty = Number(meta.executedQty || 0);
      const usdtProceeds = exitPrice * executedQty;

      if (usdtProceeds >= 5) {
        const cleanSym = normalizeSymbol(row.symbol as string);
        if (!userMap.has(cleanSym)) {
          userMap.set(cleanSym, {
            lastSaleUsdt: usdtProceeds,
            lastSaleAt: Number(meta.closedAt || Date.now()),
            symbol: row.symbol as string, // keep original for db updates
          });
          console.log(
            `[Pilot] ♻️ RE-ENTRY LOADED FROM DB: ${row.symbol as string} | User: ${userId} | USDT: $${usdtProceeds.toFixed(2)}`,
          );
        }
      }
    }

    initializedUsers.add(userId);
    lastLoadTimeMap.set(userId, now);
    console.log(
      `[Pilot] ♻️ Re-entry map initialized for User ${userId}: ${userMap.size} symbols ready.`,
    );
  } catch (err) {
    console.error(
      `[Pilot] Failed to load re-entry map for user ${userId} from DB:`,
      err,
    );
    initializedUsers.add(userId); // Mark as attempt made
    lastLoadTimeMap.set(userId, now);
  }
}

/**
 * Register a symbol for re-entry after a pilot TRADE sell completion.
 * Called from smart-trade-execution.ts when a pilot_auto TRADE exits.
 * Persists to in-memory map (DB record already exists in orders table).
 */
export function registerPilotReEntry(
  userId: number,
  symbol: string,
  usdtProceeds: number,
) {
  const cleanSym = normalizeSymbol(symbol);
  if (!pilotReEntryMap.has(userId)) {
    pilotReEntryMap.set(userId, new Map());
  }
  pilotReEntryMap.get(userId)!.set(cleanSym, {
    lastSaleUsdt: usdtProceeds,
    lastSaleAt: Date.now(),
    symbol, // original symbol for DB updates
  });
  console.log(
    `[Pilot] ♻️ RE-ENTRY REGISTERED: ${symbol} | User: ${userId} | USDT: $${usdtProceeds.toFixed(2)}`,
  );
}

/**
 * Consume (and remove) a re-entry record for a symbol.
 * Also marks the source order as consumed in DB to prevent double re-entry.
 * Returns null if no re-entry is registered.
 */
async function consumeReEntry(
  userId: number,
  symbol: string,
): Promise<ReEntryRecord | null> {
  const cleanSym = normalizeSymbol(symbol);
  const userMap = pilotReEntryMap.get(userId);
  const record = userMap?.get(cleanSym);
  if (record) {
    userMap!.delete(cleanSym);
    const dbSymbol = record.symbol; // Use original symbol for SQL matching
    // Mark ONLY the most recent matching order as consumed in DB
    try {
      await sql`
        UPDATE orders SET meta = (meta::jsonb || '{"reEntryConsumed": true}'::jsonb)
        WHERE id = (
          SELECT id FROM orders
          WHERE user_id = ${userId}
            AND (symbol = ${dbSymbol} OR symbol = ${cleanSym})
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
      console.warn(
        `[Pilot] Failed to mark re-entry as consumed for ${symbol} (User: ${userId}):`,
        err,
      );
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
  const cleanSym = normalizeSymbol(symbol);
  return !!pilotReEntryMap.get(userId)?.has(cleanSym);
}

/**
 * Normalizes symbols to prevent double USDT suffixes (e.g. BTCUSDTUSDT -> BTCUSDT)
 */
function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";
  // P4.2: Strips all non-alphanumeric characters to handle hyphen, slash, etc.
  let s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Handle double USDT suffixes (e.g. BTCUSDTUSDT -> BTCUSDT)
  if (s.endsWith("USDTUSDT")) {
    s = s.replace("USDTUSDT", "USDT");
  }
  return s;
}

export class PilotExecutor {
  /**
   * Get all symbols that are eligible for re-entry for a specific user.
   */
  static getReEntrySymbols(userId: number): string[] {
    const userMap = pilotReEntryMap.get(userId);
    if (!userMap) return [];
    return Array.from(userMap.keys());
  }
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
    signalType: string,
  ): {
    hasHolding: boolean;
    targetQty: number;
    isNewBuy: boolean;
    isReEntry: boolean;
    reEntryUsdt: number;
    isCoverReEntry: boolean;
    coverReEntryQty: number;
  } {
    const symbolKey = normalizeSymbol(symbol);
    const holding = holdingsMap.get(symbolKey) || holdingsMap.get(symbol);
    const free = Number(holding?.free || 0);
    const locked = Number(holding?.locked || 0);
    const totalQty = free + locked;

    // Fetch Pilot Allocation from config, default 10%
    const pilotAllocPct = Number(
      botConfig.timeframe_settings?.pilot_trade_allocation || 10,
    );
    let targetQty = totalQty * (pilotAllocPct / 100);

    // For SELL (Cover), we can only sell the free balance. Cap it to free balance.
    if (signalType === "SELL") {
      targetQty = Math.min(targetQty, free);
    }

    // P4.2: hasHolding should be based on real total balance, not just target trade qty.
    const hasHolding = totalQty > 0.00001;

    // RE-ENTRY CHECK: Klasik re-entry (TRADE sat → geri al)
    const isReEntry =
      !hasHolding && signalType === "BUY" && hasReEntry(userId, symbolKey);
    const reEntryUsdt = isReEntry
      ? pilotReEntryMap.get(userId)?.get(symbolKey)?.lastSaleUsdt || 0
      : 0;

    // CDT RE-ENTRY CHECK: COVER satışından hafızadaki miktarla LONG aç
    const isCoverReEntry =
      !hasHolding &&
      !isReEntry &&
      signalType === "BUY" &&
      hasCoverSale(userId, symbolKey);
    const coverReEntryQty = isCoverReEntry
      ? getCoverSaleRecord(userId, symbolKey)?.qty || 0
      : 0;

    // NEW BUY: Varlık yoksa ve re-entry de yoksa, pilot_only_holdings=false ise yeni alım
    const isNewBuy =
      !hasHolding &&
      !isReEntry &&
      !isCoverReEntry &&
      signalType === "BUY" &&
      botConfig.pilot_only_holdings === false;

    // TARGET QTY: Mevcut varlık varsa management modu için toplam qty'i kullan
    if (hasHolding && signalType === "BUY") {
      targetQty = totalQty;
    }

    return {
      hasHolding,
      targetQty,
      isNewBuy,
      isReEntry,
      reEntryUsdt,
      isCoverReEntry,
      coverReEntryQty,
    };
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
    isLong: boolean,
  ) {
    let finalTpPrice = Number(signalTargets?.t1 || 0);
    let finalSlPrice = Number(signalTargets?.sl || 0);

    const dirMultiplier = isLong ? 1 : -1;

    // Calculate required distance thresholds based on user % settings
    const userTpThreshold = currentPrice * (1 + (dirMultiplier * tpPerc) / 100);
    const userSlThreshold = currentPrice * (1 - (dirMultiplier * slPerc) / 100);

    if (isLong) {
      // Long: TP must be at least as high as user threshold.
      // SL must be at most as high as user threshold (closest to price wins for safety, but user % is the fallback).
      if (finalTpPrice <= userTpThreshold) finalTpPrice = userTpThreshold;

      // If signal SL is zero, too wide, or higher than current price, use user set threshold
      if (
        finalSlPrice <= 0 ||
        finalSlPrice >= currentPrice ||
        finalSlPrice < userSlThreshold
      ) {
        finalSlPrice = userSlThreshold;
      }
    } else {
      // Short / Cover: TP must be at least as low as user threshold.
      if (
        finalTpPrice <= 0 ||
        finalTpPrice >= currentPrice ||
        finalTpPrice > userTpThreshold
      ) {
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
      finalTpPrice = currentPrice + dirMultiplier * slDist * 1.5;
    }

    // FIX-D: SL Minimum Mesafe Koruması (Floor)
    // Anlık dalgalanmalarda SL'nin çok yakın tetiklenmesini önler.
    // Minimum %0.8 mesafe zorunlu (tüm TF'ler için güvenli alt sınır).
    // INCREASED from 0.3% to 0.8% to prevent premature stops on volatile coins.
    const MIN_SL_DISTANCE = 0.008; // %0.8
    const currentSlDist = Math.abs(finalSlPrice - currentPrice) / currentPrice;
    if (currentSlDist < MIN_SL_DISTANCE) {
      if (isLong) {
        finalSlPrice = currentPrice * (1 - MIN_SL_DISTANCE);
      } else {
        finalSlPrice = currentPrice * (1 + MIN_SL_DISTANCE);
      }
    }

    return { finalTpPrice, finalSlPrice };
  }

  /**
   * Executes a brand new buy using USDT balance
   */
  static async executeNewBuy(
    symbol: string,
    botConfig: BotConfig,
    userId: number,
    mode: TradingMode,
    timeframe: string,
    signal: any,
    holdingsMap: Map<string, any>,
  ) {
    try {
      const currentPrice = await getPrice(symbol);
      const usdtHolding = holdingsMap.get("USDT");
      const usdtBalance = Number(usdtHolding?.free || 0);
      const pilotAllocPct = Number(
        botConfig.timeframe_settings?.pilot_trade_allocation || 10,
      );

      // Calculate allocation based on USDT for new buys
      let allocUsdt = usdtBalance * (pilotAllocPct / 100);
      allocUsdt = Math.min(allocUsdt, 100000); // 100k safety max capping

      if (allocUsdt < 5) {
        const cleanSymbol = normalizeSymbol(symbol);
        const msg = `Bakiye yetersiz.`;
        console.log(
          `[Pilot] \u26a0\ufe0f ${cleanSymbol} BUY ATLANDI: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`,
        );
        await logSystemEvent(
          userId,
          "SYSTEM",
          "TRADE_SKIPPED",
          `TRADE_SKIPPED: ${cleanSymbol} atlandı: ${msg}`,
        );
        return { executed: false, data: { message: msg } };
      }

      const baseQty = allocUsdt / currentPrice;

      const tpPerc =
        botConfig.timeframe_settings?.pilot_tp_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc =
        botConfig.timeframe_settings?.pilot_sl_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice,
        signal.targets || {},
        tpPerc,
        slPerc,
        true, // New Buy is Long
      );

      console.log(
        `[Pilot] \u2708\ufe0f Executing NEW BUY for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Alloc: $${allocUsdt.toFixed(2)}`,
      );

      // P4.2: Dynamic pilot settings from botConfig timeframe_settings
      const tfSettings = botConfig.timeframe_settings || {};
      const trailingBuy =
        tfSettings.pilot_trailing_buy ??
        botConfig.pilot_trailing_buy ??
        DEFAULT_BOT_CONFIG.pilot_trailing_buy;
      const trailingBuyDev = Number(
        tfSettings.pilot_trailing_buy_dev ??
          botConfig.pilot_trailing_buy_dev ??
          DEFAULT_BOT_CONFIG.pilot_trailing_buy_dev,
      );
      const tpTrailing =
        tfSettings.pilot_tp_trailing ??
        botConfig.pilot_tp_trailing ??
        DEFAULT_BOT_CONFIG.pilot_tp_trailing;
      const tpDev = Number(
        tfSettings.pilot_tp_deviation ??
          botConfig.pilot_tp_deviation ??
          DEFAULT_BOT_CONFIG.pilot_tp_deviation,
      );
      const slTrailing =
        tfSettings.pilot_sl_trailing ??
        botConfig.pilot_sl_trailing ??
        DEFAULT_BOT_CONFIG.pilot_sl_trailing;
      const slDev = Number(
        tfSettings.pilot_sl_deviation ??
          botConfig.pilot_sl_deviation ??
          DEFAULT_BOT_CONFIG.pilot_sl_deviation,
      );

      const res = await handleSmartTrade(
        {
          mode: "TRADE",
          symbol,
          amount: baseQty.toFixed(8),
          buyPrice: currentPrice.toString(),
          buyType: "MARKET",
          useExisting: false, // Brand new asset, we MUST buy
          user_id: userId,
          trailingBuy,
          trailingBuyDev,
          takeProfit: {
            price: finalTpPrice.toString(),
            trailing: Boolean(tpTrailing),
            deviation: tpDev,
          },
          stopLoss: {
            price: finalSlPrice.toString(),
            trailing: Boolean(slTrailing),
            deviation: slDev,
          },
          timeframe,
          source: "pilot_auto",
          aiScore:
            typeof signal.indicators?.aiScore === "number"
              ? signal.indicators.aiScore
              : null,
          mtfVerdict: signal.indicators?.mtfVerdict || null,
        },
        mode,
      );
      return {
        executed: true,
        data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" },
      };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a RE-ENTRY buy using USDT proceeds from a previous pilot sale.
   */
  static async executeReEntryBuy(
    symbol: string,
    botConfig: BotConfig,
    userId: number,
    mode: TradingMode,
    timeframe: string,
    signal: any,
    reEntryUsdt: number,
  ) {
    try {
      const symbolKey = normalizeSymbol(symbol);
      const record = await consumeReEntry(userId, symbolKey);
      const allocUsdt = record?.lastSaleUsdt || reEntryUsdt;

      if (allocUsdt < 5) {
        const cleanSymbol = normalizeSymbol(symbol);
        const msg = `Bakiye yetersiz.`;
        console.log(
          `[Pilot] \u26a0\ufe0f ${cleanSymbol} RE-ENTRY ATLANDI: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`,
        );
        await logSystemEvent(
          userId,
          "SYSTEM",
          "TRADE_SKIPPED",
          `TRADE_SKIPPED: ${cleanSymbol} atlandı: ${msg}`,
        );
        return { executed: false, data: { message: msg } };
      }

      const currentPrice = await getPrice(symbol);
      const baseQty = allocUsdt / currentPrice;

      const tpPerc =
        botConfig.timeframe_settings?.pilot_tp_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc =
        botConfig.timeframe_settings?.pilot_sl_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice,
        signal.targets || {},
        tpPerc,
        slPerc,
        true, // Re-entry is Long
      );

      console.log(
        `[Pilot] \u267b\ufe0f Executing RE-ENTRY BUY for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | USDT: $${allocUsdt.toFixed(2)}`,
      );

      // P4.2: Dynamic pilot settings from botConfig timeframe_settings
      const tfSettings = botConfig.timeframe_settings || {};
      const trailingBuy =
        tfSettings.pilot_trailing_buy ??
        botConfig.pilot_trailing_buy ??
        DEFAULT_BOT_CONFIG.pilot_trailing_buy;
      const trailingBuyDev = Number(
        tfSettings.pilot_trailing_buy_dev ??
          botConfig.pilot_trailing_buy_dev ??
          DEFAULT_BOT_CONFIG.pilot_trailing_buy_dev,
      );
      const tpTrailing =
        tfSettings.pilot_tp_trailing ??
        botConfig.pilot_tp_trailing ??
        DEFAULT_BOT_CONFIG.pilot_tp_trailing;
      const tpDev = Number(
        tfSettings.pilot_tp_deviation ??
          botConfig.pilot_tp_deviation ??
          DEFAULT_BOT_CONFIG.pilot_tp_deviation,
      );
      const slTrailing =
        tfSettings.pilot_sl_trailing ??
        botConfig.pilot_sl_trailing ??
        DEFAULT_BOT_CONFIG.pilot_sl_trailing;
      const slDev = Number(
        tfSettings.pilot_sl_deviation ??
          botConfig.pilot_sl_deviation ??
          DEFAULT_BOT_CONFIG.pilot_sl_deviation,
      );

      const res = await handleSmartTrade(
        {
          mode: "TRADE",
          symbol,
          amount: baseQty.toFixed(8),
          buyPrice: currentPrice.toString(),
          buyType: "MARKET",
          useExisting: false,
          user_id: userId,
          trailingBuy,
          trailingBuyDev,
          takeProfit: {
            price: finalTpPrice.toString(),
            trailing: Boolean(tpTrailing),
            deviation: tpDev,
          },
          stopLoss: {
            price: finalSlPrice.toString(),
            trailing: Boolean(slTrailing),
            deviation: slDev,
          },
          timeframe,
          source: "pilot_auto",
          aiScore:
            typeof signal.indicators?.aiScore === "number"
              ? signal.indicators.aiScore
              : null,
          mtfVerdict: signal.indicators?.mtfVerdict || null,
        },
        mode,
      );
      return {
        executed: true,
        data: {
          ...(res as any),
          type: "SMART_TRADE",
          source: "pilot_auto",
          reEntry: true,
        },
      };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * CDT (Cover-to-Trade) RE-ENTRY Buy:
   * COVER satışından hafızada tutulan miktar kadar LONG pozisyon açar.
   */
  static async executeCoverReEntryBuy(
    symbol: string,
    botConfig: BotConfig,
    userId: number,
    mode: TradingMode,
    timeframe: string,
    signal: any,
    coverQty: number,
  ) {
    try {
      const currentPrice = await getPrice(symbol);

      if (coverQty <= 0 || coverQty * currentPrice < 5) {
        const msg = "CDT Re-Entry miktarı yetersiz (min $5).";
        console.log(
          `[Pilot] ⚠️ ${symbol} CDT RE-ENTRY ATLANDI: Qty=${coverQty.toFixed(8)}`,
        );
        await logSystemEvent(
          userId,
          "SYSTEM",
          "TRADE_SKIPPED",
          `TRADE_SKIPPED: ${symbol} CDT Re-Entry atlandı: ${msg}`,
        );
        return { executed: false, data: { message: msg } };
      }

      const tpPerc =
        botConfig.timeframe_settings?.pilot_tp_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
      const slPerc =
        botConfig.timeframe_settings?.pilot_sl_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;
      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice,
        signal.targets || {},
        tpPerc,
        slPerc,
        true,
      );

      console.log(
        `[Pilot] ♻️ CDT Re-Entry BUY: ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Qty: ${coverQty.toFixed(8)}`,
      );

      const tfSettings = botConfig.timeframe_settings || {};
      const trailingBuy =
        tfSettings.pilot_trailing_buy ??
        botConfig.pilot_trailing_buy ??
        DEFAULT_BOT_CONFIG.pilot_trailing_buy;
      const trailingBuyDev = Number(
        tfSettings.pilot_trailing_buy_dev ??
          botConfig.pilot_trailing_buy_dev ??
          DEFAULT_BOT_CONFIG.pilot_trailing_buy_dev,
      );
      const tpTrailing =
        tfSettings.pilot_tp_trailing ??
        botConfig.pilot_tp_trailing ??
        DEFAULT_BOT_CONFIG.pilot_tp_trailing;
      const tpDev = Number(
        tfSettings.pilot_tp_deviation ??
          botConfig.pilot_tp_deviation ??
          DEFAULT_BOT_CONFIG.pilot_tp_deviation,
      );
      const slTrailing =
        tfSettings.pilot_sl_trailing ??
        botConfig.pilot_sl_trailing ??
        DEFAULT_BOT_CONFIG.pilot_sl_trailing;
      const slDev = Number(
        tfSettings.pilot_sl_deviation ??
          botConfig.pilot_sl_deviation ??
          DEFAULT_BOT_CONFIG.pilot_sl_deviation,
      );

      const res = await handleSmartTrade(
        {
          mode: "TRADE",
          symbol,
          amount: coverQty.toFixed(8),
          buyPrice: currentPrice.toString(),
          buyType: "MARKET",
          useExisting: false,
          user_id: userId,
          trailingBuy,
          trailingBuyDev,
          takeProfit: {
            price: finalTpPrice.toString(),
            trailing: Boolean(tpTrailing),
            deviation: tpDev,
          },
          stopLoss: {
            price: finalSlPrice.toString(),
            trailing: Boolean(slTrailing),
            deviation: slDev,
          },
          timeframe,
          source: "pilot_auto",
          aiScore:
            typeof signal.indicators?.aiScore === "number"
              ? signal.indicators.aiScore
              : null,
          mtfVerdict: signal.indicators?.mtfVerdict || null,
        },
        mode,
      );

      return {
        executed: true,
        data: {
          ...(res as any),
          type: "SMART_TRADE",
          source: "pilot_auto",
          coverReEntry: true,
        },
      };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a COVER mode SmartTrade to sell and buy back lower.
   */
  static async executeCover(
    symbol: string,
    botConfig: BotConfig,
    userId: number,
    mode: TradingMode,
    timeframe: string,
    targetQty: number,
    signal: any,
  ) {
    try {
      const currentPrice = await getPrice(symbol);
      const tpPerc =
        botConfig.timeframe_settings?.cover_tp_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.cover_tp_percent;
      const slPerc =
        botConfig.timeframe_settings?.cover_sl_percent ??
        DEFAULT_TIMEFRAME_SETTINGS.cover_sl_percent;

      const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
        currentPrice,
        signal.targets || {},
        tpPerc,
        slPerc,
        false, // Cover is Short
      );

      console.log(
        `[Pilot] \u2708\ufe0f Creating SmartTrade SELL (COVER) for ${symbol} | Entry: ${currentPrice} | TP: ${finalTpPrice.toFixed(4)} | SL: ${finalSlPrice.toFixed(4)} | Qty: ${targetQty.toFixed(8)}`,
      );

      // Dynamic COVER settings from botConfig timeframe_settings
      const tfSettings = botConfig.timeframe_settings || {};
      const tpTrailing =
        tfSettings.cover_tp_trailing ??
        botConfig.pilot_tp_trailing ??
        DEFAULT_TIMEFRAME_SETTINGS.cover_tp_trailing;
      const tpDev = Number(
        tfSettings.cover_tp_deviation ??
          botConfig.pilot_tp_deviation ??
          DEFAULT_TIMEFRAME_SETTINGS.cover_tp_deviation,
      );
      const slTrailing =
        tfSettings.cover_sl_trailing ??
        botConfig.pilot_sl_trailing ??
        DEFAULT_TIMEFRAME_SETTINGS.cover_sl_trailing;
      const slDev = Number(
        tfSettings.cover_sl_deviation ??
          botConfig.pilot_sl_deviation ??
          DEFAULT_TIMEFRAME_SETTINGS.cover_sl_deviation,
      );

      const res = await handleSmartTrade(
        {
          mode: "COVER",
          symbol,
          amount: targetQty.toFixed(8),
          buyPrice: currentPrice.toString(),
          buyType: "MARKET",
          useExisting: true,
          user_id: userId,
          takeProfit: {
            price: finalTpPrice.toString(),
            trailing: Boolean(tpTrailing),
            deviation: tpDev,
          },
          stopLoss: {
            price: finalSlPrice.toString(),
            trailing: Boolean(slTrailing),
            deviation: slDev,
          },
          timeframe,
          source: "pilot_auto",
          aiScore:
            typeof signal.indicators?.aiScore === "number"
              ? signal.indicators.aiScore
              : null,
          mtfVerdict: signal.indicators?.mtfVerdict || null,
        },
        mode,
      );

      // CDT: COVER satışını hafizaya al (BUY sinyali için geri alım)
      if ((res as any)?.success) {
        registerCoverSale(userId, symbol, targetQty, (res as any)?.dbId || 0);
      }

      return {
        executed: true,
        data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" },
      };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  static async recordSignalResult(p: {
    userId: number;
    symbol: string;
    signal: any;
    timestamp: number;
    executed: boolean;
    executionResult: any;
    mode: TradingMode;
    scanTimeframe: string;
    aiScore: number;
    botConfig: BotConfig; // Added
    recentSignals: any[];
    activeSmartTrades?: any[];
    vetoReason?: string;
  }) {
    const {
      userId,
      symbol,
      signal,
      timestamp,
      executed,
      executionResult,
      mode,
      scanTimeframe,
      aiScore,
      botConfig,
    } = p;
    let finalVetoReason: string | undefined = p.vetoReason;

    if (!finalVetoReason && signal.reason && signal.reason.includes("🛑")) {
      finalVetoReason = signal.reason.split("🛑")[1].trim();
    }

    // Fallback: If not executed and no veto reason yet, use executionResult.message
    if (!executed && !finalVetoReason && executionResult?.message) {
      finalVetoReason = executionResult.message;
    }

    const mergedResult = {
      ...(executionResult || {}),
      confidence: aiScore,
      is_whale: !!signal.indicators?.whaleDetected,
      insight: buildInsight(signal.signal, signal.indicators),
      meta: {
        rawSignal: signal,
        vetoReason: finalVetoReason,
        mode,
      },
    };

    await createStrategySignal({
      user_id: userId,
      symbol,
      timeframe: scanTimeframe,
      signal_type: signal.signal || "NONE",
      side: signal.signal,
      price: signal.price || 0,
      timestamp: timestamp,
      executed,
      execution_result: {
        ...mergedResult,
        scanTimeframe,
        pilotTimeframe: botConfig.pilot_timeframe || "4h",
      },
      trading_mode: mode,
      veto_reason: finalVetoReason,
      payload: signal,
    });
  }

  /**
   * Force-closes an active SmartTrade (used for Matrix mode flipping).
   *
   * SMART FLIP GUARDS:
   * 1. Stop Loss Guard: If price hasn't crossed the stop, DON'T flip. TSL will handle it.
   * 2. Catastrophe Guard: If loss exceeds CATASTROPHE_LOSS_PCT, flip regardless (emergency exit).
   * 3. Profit-Only Mode: Only flip if the trade is in profit (locks gains).
   */
  static async closeSmartTrade(
    record: any,
    userId: number,
    mode: TradingMode,
    reason: string = "MATRIX_FLIP_EXIT",
  ) {
    const symbol = record.symbol;
    try {
      const currentPrice = await getPrice(symbol);
      const qty = parseFloat(String(record.qty || 0));

      if (qty <= 0) {
        await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = (meta::jsonb || '{"exitReason": "ZERO_QTY_GHOST_ORDER"}'::jsonb) WHERE id = ${record.id}`;
        return;
      }

      // ── SMART FLIP GUARD ─────────────────────────────────────────────────────
      // We ONLY close a trade if one of the following conditions is met:
      // 1. Price has already crossed the stop loss (TSL/SL territory)
      // 2. Loss exceeds the catastrophe threshold (emergency exit)
      // 3. OR it's a "profit-only flip" and we're in profit
      //
      // If none of these: DO NOT FLIP. Let the SL/TSL mechanism handle the exit.
      // Rationale: User set a stop for a reason. They accepted that risk.
      // Flipping before the stop = overriding user's risk management.
      // -----------------------------------------------------------------
      const meta =
        typeof record.meta === "string"
          ? JSON.parse(record.meta)
          : record.meta || {};
      const payload = meta.payload || {};
      const tradeMode =
        meta.mode || (record.side === "BUY" ? "TRADE" : "COVER");
      const isLong = tradeMode === "TRADE";
      const entryPrice = parseFloat(String(record.price));

      const activeStopLoss = meta.activeStopLoss
        ? parseFloat(String(meta.activeStopLoss))
        : parseFloat(payload?.stopLoss?.price || "0");

      // Calculate current PnL %
      const pnlPct =
        entryPrice > 0
          ? isLong
            ? ((currentPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - currentPrice) / entryPrice) * 100
          : 0;

      const CATASTROPHE_LOSS_PCT = -4.0; // Emergency flip regardless of SL: -4% loss
      const isInCatastrophicLoss = pnlPct < CATASTROPHE_LOSS_PCT;

      // Check if price has crossed the stop loss
      let slCrossed = false;
      if (activeStopLoss > 0) {
        slCrossed = isLong
          ? currentPrice <= activeStopLoss // Long: SL below price
          : currentPrice >= activeStopLoss; // Short: SL above price
      }

      const isInProfit = pnlPct > 0;

      // GUARD LOGIC: Block flip unless one of the conditions is met
      if (!slCrossed && !isInCatastrophicLoss) {
        // If price is still within acceptable risk range → DON'T FLIP
        // Let TSL/SL handle the exit naturally
        const slDistPct =
          activeStopLoss > 0
            ? Math.abs((currentPrice - activeStopLoss) / activeStopLoss) * 100
            : 0;
        console.log(
          `[Pilot] 🛡️ FLIP GUARD: ${symbol} | ${tradeMode} | PnL: ${pnlPct.toFixed(2)}% | Stop: $${activeStopLoss.toFixed(4)} | Dist to SL: ${slDistPct.toFixed(2)}% | Price is within risk range → FLIP BLOCKED. Let TSL/SL handle it.`,
        );
        return; // <── KEY: Do NOT close, do NOT flip
      }

      let flipReason = reason;
      if (isInCatastrophicLoss) {
        flipReason = `MATRIX_FLIP_EXIT (Felaket: ${pnlPct.toFixed(2)}%)`;
        console.log(
          `[Pilot] 🚨 CATASTROPHE EXIT: ${symbol} | PnL: ${pnlPct.toFixed(2)}% < ${CATASTROPHE_LOSS_PCT}% threshold`,
        );
      } else if (slCrossed) {
        flipReason = `MATRIX_FLIP_EXIT (SL Aşıldı: $${activeStopLoss.toFixed(4)})`;
        console.log(
          `[Pilot] ⛔ SL CONFIRMED FLIP: ${symbol} | Price $${currentPrice} crossed SL $${activeStopLoss}`,
        );
      }

      console.log(
        `[Pilot] ↪️ Closing SmartTrade for ${symbol} (${flipReason}) | PnL: ${pnlPct.toFixed(2)}%`,
      );
      // ─────────────────────────────────────────────────────────────────────────

      await executeExit(
        {
          id: record.id,
          user_id: userId,
          symbol: symbol,
          side: record.side,
          qty: record.qty,
          price: record.price,
          meta: record.meta,
          trading_mode: mode,
        },
        currentPrice,
        flipReason,
        record.meta,
        qty,
      );
      console.log(
        `[Pilot] ✅ Successfully closed ${symbol} | Reason: ${flipReason}`,
      );
    } catch (err) {
      console.error(
        `[Pilot] ❌ Failed to close SmartTrade for ${symbol}:`,
        err,
      );
      await sql`UPDATE orders SET status = 'CLOSED', updated_at = ${Date.now()}, meta = (meta::jsonb || '{"exitError": "FAILED_TO_EXIT_API"}'::jsonb) WHERE id = ${record.id}`;
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
    const {
      symbol,
      signal,
      scanTimeframe,
      botConfig,
      userId,
      mode,
      holdingsMap,
      recentSignals,
      activeSmartTrades,
    } = params;
    const timestamp = Date.now();

    // P4.2: Timeframe Isolation Guard (Updated to allow UI logging while preventing trades)
    // Only allow trade execution if the scanTimeframe matches the user's pilot config.
    const pilotTf = botConfig.pilot_timeframe || "4h";
    const timeframeMismatch = scanTimeframe !== pilotTf;
    let tfVetoReason: string | undefined = undefined;

    if (timeframeMismatch) {
      tfVetoReason = `Otopilot Zaman Dilimi Uyuşmazlığı (İzleme: ${scanTimeframe}, Pilot: ${pilotTf})`;
      console.log(
        `[Pilot] \ud83d\udee1 Signal captured for UI but trade execution blocked: ${symbol} (${scanTimeframe})`,
      );
      // We do NOT return early anymore, we let it flow to recordSignalResult
    }

    // 1. Deduplication check
    const recentExecuted = recentSignals.find(
      (s) =>
        s.symbol === symbol &&
        (s.signal_type === "BUY" || s.signal_type === "SELL") &&
        s.executed === true,
    );
    if (recentExecuted) return;

    // 2. Matrix vs Hedge Logic
    const activeForSymbol = activeSmartTrades.filter(
      (t) => normalizeSymbol(t.symbol) === normalizeSymbol(symbol),
    );
    const buyTradeForSymbol = activeForSymbol.find(
      (t) => t.meta?.mode === "TRADE",
    );
    const sellTradeForSymbol = activeForSymbol.find(
      (t) => t.meta?.mode === "COVER",
    );

    // Rule 4: Hedge mode global limit (Max 1 Long, Max 1 Short across ALL symbols)
    const globalBuyTrade = activeSmartTrades.find(
      (t) => t.meta?.mode === "TRADE",
    );
    const globalSellTrade = activeSmartTrades.find(
      (t) => t.meta?.mode === "COVER",
    );

    const pilotMode = botConfig.pilot_mode || "matrix";

    if (signal.signal === "BUY") {
      // Matrix Mode: Only check the current symbol
      if (pilotMode === "matrix" && buyTradeForSymbol) {
        console.log(
          `[Pilot] 🛡️ ${symbol} için zaten aktif bir ALIM (TRADE) işlemi var. Sinyal atlanıyor.`,
        );
        return;
      }
      // Hedge Mode: Check across ALL symbols (Rule 4)
      if (pilotMode === "hedge" && globalBuyTrade) {
        console.log(
          `[Pilot] 🛡️ Hedge Modu: Halihazırda aktif bir ALIM (TRADE) işlemi var (${globalBuyTrade.symbol}). Yeni işlem açılmıyor.`,
        );
        return;
      }

      if (sellTradeForSymbol && pilotMode === "matrix") {
        const source = sellTradeForSymbol.meta?.payload?.source || "manual";
        if (source === "pilot_auto") {
          // FIX-A: MATRIX_FLIP_EXIT Konfirmasyon Süresi
          // İşlem yeterince uzun süre açık kalmadıysa flip yapma. (Önceden 3 dakikaydı, TSL vurmasını engelliyordu)
          const tradeAge =
            Date.now() - (Number(sellTradeForSymbol.created_at) || 0);
          const MIN_FLIP_AGE_MS = 60 * 60 * 1000; // 60 dakika
          if (tradeAge < MIN_FLIP_AGE_MS) {
            console.log(
              `[Pilot] ⏳ ${symbol} Matrix Flip engellendi: İşlem henüz ${Math.round(tradeAge / 60000)}dk açık (min: ${MIN_FLIP_AGE_MS / 60000}dk). Sinyal atlanıyor.`,
            );
            await this.recordSignalResult({
              ...params,
              timestamp,
              executed: false,
              executionResult: {},
              aiScore: 0,
              vetoReason: `Matrix Flip çok erken (${Math.round(tradeAge / 60000)}dk < ${MIN_FLIP_AGE_MS / 60000}dk)`,
            });
            return;
          }
          console.log(
            `[Pilot] ↪️ ${symbol} Matrix Modu: Aktif SATIŞ (COVER) kapatılıyor...`,
          );
          await this.closeSmartTrade(sellTradeForSymbol, userId, mode);
          // COVER kapandı → asset geri alındı, holdingsMap'e ekle
          const flipQty = Number(sellTradeForSymbol.qty || 0);
          if (flipQty > 0) {
            const sym = normalizeSymbol(symbol);
            holdingsMap.set(sym, { free: flipQty, locked: 0 });
            holdingsMap.set(symbol, { free: flipQty, locked: 0 });
          }
          // CDT haritasini da temizle (cover kapandi)
          clearCoverSale(userId, symbol);
        } else {
          console.log(
            `[Pilot] 🛡️ ${symbol}: Aktif SATIŞ (MANUEL) bulundu, Matrix Flip ile kapatılmıyor.`,
          );
        }
      }
    } else if (signal.signal === "SELL") {
      // Matrix Mode: Only check the current symbol
      if (pilotMode === "matrix" && sellTradeForSymbol) {
        console.log(
          `[Pilot] 🛡️ ${symbol} için zaten aktif bir SATIŞ (COVER) işlemi var. Sinyal atlanıyor.`,
        );
        return;
      }
      // Hedge Mode: Check across ALL symbols (Rule 4)
      if (pilotMode === "hedge" && globalSellTrade) {
        console.log(
          `[Pilot] 🛡️ Hedge Modu: Halihazırda aktif bir SATIŞ (COVER) işlemi var (${globalSellTrade.symbol}). Yeni işlem açılmıyor.`,
        );
        return;
      }

      if (buyTradeForSymbol && pilotMode === "matrix") {
        const source = buyTradeForSymbol.meta?.payload?.source || "manual";
        if (source === "pilot_auto") {
          // FIX-A: MATRIX_FLIP_EXIT Konfirmasyon Süresi
          const tradeAge =
            Date.now() - (Number(buyTradeForSymbol.created_at) || 0);
          const MIN_FLIP_AGE_MS = 60 * 60 * 1000; // 60 dakika
          if (tradeAge < MIN_FLIP_AGE_MS) {
            console.log(
              `[Pilot] ⏳ ${symbol} Matrix Flip engellendi: İşlem henüz ${Math.round(tradeAge / 60000)}dk açık (min: ${MIN_FLIP_AGE_MS / 60000}dk). Sinyal atlanıyor.`,
            );
            await this.recordSignalResult({
              ...params,
              timestamp,
              executed: false,
              executionResult: {},
              aiScore: 0,
              vetoReason: `Matrix Flip çok erken (${Math.round(tradeAge / 60000)}dk < ${MIN_FLIP_AGE_MS / 60000}dk)`,
            });
            return;
          }
          console.log(
            `[Pilot] ↪️ ${symbol} Matrix Modu: Aktif ALIŞ (TRADE) kapatılıyor...`,
          );
          await this.closeSmartTrade(buyTradeForSymbol, userId, mode);
          holdingsMap.delete(normalizeSymbol(symbol));
          holdingsMap.delete(symbol);
        } else {
          console.log(
            `[Pilot] 🛡️ ${symbol}: Aktif ALIŞ (MANUEL) bulundu, Matrix Flip ile kapatılmıyor.`,
          );
        }
      }
    }

    if (!signal.signal) {
      if (signal.reason && signal.reason.includes("🛑")) {
        const cleanSymbol = normalizeSymbol(symbol);
        const reasonParts = signal.reason.split("🛑");
        const reasonText = reasonParts.slice(1).join("🛑").trim();
        await logSystemEvent(
          userId,
          "SYSTEM",
          "NEGATIVE",
          `🛑 OTOPİLOT VETO [${cleanSymbol}]: ${reasonText}`,
        );
      }
      await this.recordSignalResult({
        ...params,
        timestamp,
        executed: false,
        executionResult: {},
        aiScore: 0,
      });
      return;
    }

    // 3. Ensure Re-Entry map is loaded from DB (P4.2 Fix)
    await PilotExecutor.ensureReEntryMapLoaded(userId);

    const aiScore =
      typeof signal.indicators?.aiScore === "number"
        ? signal.indicators.aiScore
        : 0;
    console.log(
      `[Pilot] Signal for ${symbol}: ${signal.signal} | Score: ${aiScore}`,
    );

    // 4. Calculate Allocation
    const alloc = this.calculateAllocation(
      userId,
      symbol,
      holdingsMap,
      botConfig,
      signal.signal,
    );

    let executed = false;
    let executionResult: Record<string, unknown> = {};

    // 4. Execution Routing
    const cleanSymbol = normalizeSymbol(symbol);
    if (timeframeMismatch) {
      // P4.2: Skip execution but proceed to logging
      executionResult = { message: tfVetoReason };
    } else if (
      !alloc.hasHolding &&
      !alloc.isNewBuy &&
      !alloc.isReEntry &&
      !alloc.isCoverReEntry
    ) {
      const skipMsg = botConfig.pilot_only_holdings
        ? "Portföyü Tara aktif olduğu için ve varlık bulunmadığı için atlandı."
        : "Varlık bakiyesi yetersiz olduğu için atlandı.";

      console.log(`[Pilot] 🛡️ ${cleanSymbol} ATLANDI: ${skipMsg}`);

      await logSystemEvent(
        userId,
        "SYSTEM",
        `Sinyal geldi [${cleanSymbol}]`,
        `${skipMsg} | AI Skoru: ${aiScore} | Portföy Ayarı: ${botConfig.pilot_only_holdings ? "Sadece Portföy" : "Tümü"}`,
      );
      executionResult = { message: skipMsg };
    } else {
      await logSystemEvent(
        userId,
        "SYSTEM",
        "POSITIVE",
        `🎯 MATRIX V5 SİNYALİ: ${cleanSymbol} [${signal.signal === "BUY" ? "GO_LONG" : "GO_SHORT"}]: AI Skoru: ${aiScore} | ${signal.signal === "BUY" ? "YUKARI 📈" : "AŞAĞI 📉"}`,
      );

      if (signal.signal === "BUY") {
        // MTF veto artık YALNIZCA strategies.ts → applyMtfVeto() tarafında uygulanıyor.
        // Burada tekrar kontrol yapılMAZ — çift veto sinyalleri gereksiz yere engelliyordu.
        if (alloc.isReEntry) {
          await logSystemEvent(
            userId,
            "SYSTEM",
            `Sinyal geldi [${cleanSymbol}], Re-Entry (Geri Alım) modunda işleme giriliyor.`,
            `AI Skoru: ${aiScore}.`,
          );
          const result = await this.executeReEntryBuy(
            symbol,
            botConfig,
            userId,
            mode,
            scanTimeframe,
            signal,
            alloc.reEntryUsdt,
          );
          executed = result.executed;
          executionResult = result.data;
        } else if (
          alloc.isCoverReEntry &&
          (botConfig as any).pilot_cdt_reentry !== false
        ) {
          // CDT Re-entry: COVER'dan satılan miktar kadar LONG aç
          await logSystemEvent(
            userId,
            "SYSTEM",
            `Sinyal geldi [${cleanSymbol}], CDT Re-Entry (Cover→Trade) modunda işleme giriliyor.`,
            `Miktar: ${alloc.coverReEntryQty.toFixed(8)} | AI Skoru: ${aiScore}.`,
          );
          clearCoverSale(userId, symbol);
          const result = await this.executeCoverReEntryBuy(
            symbol,
            botConfig,
            userId,
            mode,
            scanTimeframe,
            signal,
            alloc.coverReEntryQty,
          );
          executed = result.executed;
          executionResult = result.data;
        } else if (alloc.isNewBuy) {
          await logSystemEvent(
            userId,
            "SYSTEM",
            `Sinyal geldi [${cleanSymbol}], Yeni Varlık modunda işleme giriliyor.`,
            `AI Skoru: ${aiScore}.`,
          );
          const result = await this.executeNewBuy(
            symbol,
            botConfig,
            userId,
            mode,
            scanTimeframe,
            signal,
            holdingsMap,
          );
          executed = result.executed;
          executionResult = result.data;
        } else {
          // 📦 EXISTING ASSET MANAGEMENT (No Ek Alım / Portföy Odaklı)
          // Eğer cüzdanda varlık varsa ancak aktif bir SmartTrade yoksa (manuel alım veya takip dışı),
          // otopilot bu varlığı 'useExisting: true' ile devralır. Ek bakiye harcamaz.
          await logSystemEvent(
            userId,
            "SYSTEM",
            `Sinyal geldi [${cleanSymbol}], Mevcut varlık otopilot denetimine alınıyor.`,
            `Varlık Denetimi: Aktif. Ek Alım: Hayır (Pas geçildi). AI Skoru: ${aiScore}`,
          );

          const currentPrice = await getPrice(symbol);
          const tpPerc =
            botConfig.timeframe_settings?.pilot_tp_percent ??
            DEFAULT_TIMEFRAME_SETTINGS.pilot_tp_percent;
          const slPerc =
            botConfig.timeframe_settings?.pilot_sl_percent ??
            DEFAULT_TIMEFRAME_SETTINGS.pilot_sl_percent;
          const { finalTpPrice, finalSlPrice } = this.validatePilotTargets(
            currentPrice,
            signal.targets || {},
            tpPerc,
            slPerc,
            true,
          );

          const finalAmount =
            alloc.targetQty > 0 ? alloc.targetQty.toString() : "0";
          if (finalAmount === "0") {
            console.warn(
              `[Pilot] ⚠️ ${symbol} için miktar 0 olarak hesaplandı, işlem atlanıyor.`,
            );
            return;
          }

          const res = await handleSmartTrade(
            {
              mode: "TRADE",
              symbol,
              amount: finalAmount,
              buyPrice: currentPrice.toString(),
              buyType: "MARKET",
              useExisting: true, // KRİTİK: Mevcut varlığı kullan, USDT harcama
              user_id: userId,
              takeProfit: {
                price: finalTpPrice.toString(),
                trailing: Boolean(
                  botConfig.timeframe_settings?.pilot_tp_trailing ??
                  botConfig.pilot_tp_trailing ??
                  DEFAULT_BOT_CONFIG.pilot_tp_trailing,
                ),
                deviation: Number(
                  botConfig.timeframe_settings?.pilot_tp_deviation ??
                    botConfig.pilot_tp_deviation ??
                    DEFAULT_BOT_CONFIG.pilot_tp_deviation,
                ),
              },
              stopLoss: {
                price: finalSlPrice.toString(),
                trailing: Boolean(
                  botConfig.timeframe_settings?.pilot_sl_trailing ??
                  botConfig.pilot_sl_trailing ??
                  DEFAULT_BOT_CONFIG.pilot_sl_trailing,
                ),
                deviation: Number(
                  botConfig.timeframe_settings?.pilot_sl_deviation ??
                    botConfig.pilot_sl_deviation ??
                    DEFAULT_BOT_CONFIG.pilot_sl_deviation,
                ),
              },
              timeframe: scanTimeframe,
              source: "pilot_auto",
              aiScore:
                typeof signal.indicators?.aiScore === "number"
                  ? signal.indicators.aiScore
                  : null,
              mtfVerdict: signal.indicators?.mtfVerdict || null,
            },
            mode,
          );

          executed = true;
          executionResult = {
            ...(res as any),
            type: "SMART_TRADE_ADOPTED",
            source: "pilot_auto",
          };
        }
      } else if (signal.signal === "SELL" && alloc.hasHolding) {
        // [FINAL GUARD] MTF Veto Check (Secondary defense)
        // Strateji seviyesinde engellenmemiş olsa bile, burada son bir kez kontrol yapıyoruz.
        if (
          botConfig.pilot_mtf_veto &&
          signal.indicators?.mtfWeightedScore !== undefined
        ) {
          const mtfScore = Number(signal.indicators.mtfWeightedScore);
          const mtfShortThreshold = Math.abs(
            Number(botConfig.pilot_mtf_short_threshold || 20),
          );
          const coverThreshold = -mtfShortThreshold;
          const nearestScore = Number(signal.indicators.nearestScore || 0);

          const isNearestOpposite = nearestScore > 20;

          if (mtfScore > coverThreshold || isNearestOpposite) {
            const cause = isNearestOpposite
              ? `Yakın P. ${nearestScore} > 20 (Zıt Yön)`
              : `Skor ${mtfScore} > ${coverThreshold}`;
            const msg = `🛑 MTF GUARD Veto [${cleanSymbol}]: ${cause}. Boğa trendinde COVER (Short) engellendi.`;
            console.warn(`[PilotExecutor] ${msg}`);
            await logSystemEvent(userId, "SYSTEM", "NEGATIVE", msg);
            await this.recordSignalResult({
              ...params,
              timestamp,
              executed: false,
              executionResult: { message: `MTF Guard Veto: ${cause}` },
              aiScore,
            });
            return;
          }
        }

        await logSystemEvent(
          userId,
          "SYSTEM",
          `Sinyal geldi [${cleanSymbol}], Satış (COVER) modunda çıkış yapılıyor.`,
          `AI Skoru: ${aiScore}.`,
        );
        const result = await this.executeCover(
          symbol,
          botConfig,
          userId,
          mode,
          scanTimeframe,
          alloc.targetQty,
          signal,
        );
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
      botConfig, // Added
      aiScore,
      recentSignals,
      activeSmartTrades,
      vetoReason: !executed ? (executionResult?.message as string) : undefined,
    });

    if (executed) {
      recentSignals.push({
        symbol,
        signal_type: signal.signal,
        executed: true,
        timestamp: Date.now(),
      });
    }
  }
}
