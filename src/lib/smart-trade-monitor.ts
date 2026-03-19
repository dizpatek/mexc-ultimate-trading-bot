import { sql } from "@/lib/postgres";
import { getPrice } from "./mexc-wrapper";
import {
  executeEntry,
  executeExit,
  executePartialTP,
  saveTradeUpdate,
} from "./smart-trade-execution";
import { MatrixV5Engine, MatrixV5Config } from "./matrix-v5-engine";
import { fetchKlines, batchFetchPrices } from "./mexc";
import { calculateTrailingExitTarget, calculateTrailingBuyTarget } from "./trading-logic";
import { getBotConfig, resolveTradeMode, logSystemEvent } from "./db";

// Cache for klines to avoid redundant API calls in the same monitor cycle
interface KlineCacheItem {
  klines: { close: number; high: number; low: number; volume: number }[];
  timestamp: number;
}
type KlineCache = Record<string, KlineCacheItem>;

let lastRun = 0;
const MONITOR_INTERVAL = 1000; // Reduced from 5s to 1s for high-speed response
const AI_ANALYSIS_INTERVAL = 60000;
const CONCURRENCY_LIMIT = 20; // Increased from 5 to 20 for faster batch processing

// MatrixV5Engine is now instantiated per-trade inside processTradeMonitoring 
// to ensure thread-safety during concurrent processing.
let isDbRepaired = false;
let repairPromise: Promise<void> | null = null;

async function performRepair() {
  try {
    await sql`UPDATE orders SET meta = replace(meta, '}{', ',')::text WHERE meta LIKE '%}{%'`;
    isDbRepaired = true;
    console.log("[SmartMonitor] Database metadata repair successful.");
  } catch (e) {
    console.error("[SmartMonitor] Database repair failed (will retry):", e);
    repairPromise = null; // P4.1 & P4.2: Reset to allow retry on next cycle
    throw e;
  }
}

// Global initialization task (P4.3: Robust non-blocking wrap)
function ensureInitialized() {
  if (isDbRepaired) {
    return Promise.resolve();
  }
  if (!repairPromise) repairPromise = performRepair();
  return repairPromise;
}

export async function monitorSmartTrades(tradingMode: "test" | "production" = "test") {
  const now = Date.now();
  if (now - lastRun < MONITOR_INTERVAL) return;
  lastRun = now;

  // console.log("[SmartMonitor] Starting monitoring cycle...");
  // P4.4: Removed frequent logSystemEvent to reduce DB noise. 
  // We only log if something actually HAPPENS (error, state change, etc).

  const cycleCache: KlineCache = {};

  try {
    await ensureInitialized();

    // ── Fetch bot config once per cycle (not per trade) ──
    let pilotEnabled = true;
    try {
      const botConfig = await getBotConfig();
      pilotEnabled = !!botConfig?.auto_trade;
      // Store tradeMode for engine analyze calls
      const tradeMode = resolveTradeMode(botConfig);
      // P4.5: Type-safe context passing instead of untyped Record
      (cycleCache as { __tradeMode?: string }).__tradeMode = tradeMode;
    } catch {
      // If config fetch fails, default to SAFE (no exit)
      pilotEnabled = false;
    }

    const { rows } = await sql`
            SELECT id, user_id, symbol, side, qty, price, meta, status, trading_mode 
            FROM orders 
            WHERE meta::jsonb->>'smartTrade' = 'true' 
            AND trading_mode = ${tradingMode}
            AND status IN ('FILLED', 'PENDING', 'PARTIALLY_FILLED')
        `;

    if (rows.length === 0) return;
    const trades = rows as unknown as MonitoredTrade[];

    // ── HIGH SPEED: Pre-fetch ALL prices in one call ──
    // Instead of each trade calling getPrice() (even with batching), 
    // we fetch everything once at start of cycle.
    const symbolSet = new Set(trades.map(t => t.symbol));
    const priceMap = await batchFetchPrices(Array.from(symbolSet));

    for (let i = 0; i < trades.length; i += CONCURRENCY_LIMIT) {
      const chunk = trades.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.allSettled(
        chunk.map((trade) => {
          const currentPrice = priceMap[trade.symbol];
          return processTradeMonitoring(trade, pilotEnabled, cycleCache, currentPrice).catch((err) =>
            console.error(`[SmartMonitor] Error for trade ${trade.id}:`, err),
          );
        }),
      );
    }
  } catch (error) {
    console.error("[SmartMonitor] Critical error in cycle:", error);
  }
}

interface MonitoredTrade {
  id: number;
  user_id: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  meta: Record<string, unknown>;
  status: string;
  trading_mode: "test" | "production";
}

interface TPTarget {
  price: string;
  volume: string;
}

interface TakeProfitPayload {
  price: string;
  type?: string;
  trailing?: boolean;
  deviation?: number;
  isSplit?: boolean;
  targets?: TPTarget[];
}

interface StopLossPayload {
  price: string;
  type?: string;
  trailing?: boolean;
  deviation?: number;
  timeout?: boolean;
  timeoutSeconds?: number;
  breakeven?: boolean;
}

interface TradePayload {
  symbol: string;
  mode?: "TRADE" | "COVER";
  amount: string;
  buyPrice: string;
  buyType: string;
  trailingBuy?: boolean;
  trailingBuyDev?: number;
  takeProfit?: TakeProfitPayload | null;
  stopLoss?: StopLossPayload | null;
  timeframe?: string;
}

interface TradeMeta extends Record<string, unknown> {
  payload?: TradePayload;
  highestPrice?: number;
  lowestPrice?: number;
  tpTriggered?: boolean;
  lastAiScore?: number;
  monitorLogs?: string[];
  lastAiRunAt?: number;
  monitorError?: string;
  filledTargets?: number[];
  slMovedToBreakeven?: boolean;
  slTimeoutStart?: number | null;
  initialQty?: string;
  activeStopLoss?: number;
  activeTakeProfit?: number;
  entryTriggered?: boolean;
  entryReason?: string;
  entryResult?: unknown;
  exitReason?: string;
  exitResult?: unknown;
  exitPrice?: number | string;
  closedAt?: number;
  filledAt?: number;
}

async function processTradeMonitoring(
  trade: MonitoredTrade, 
  pilotEnabled: boolean, 
  cycleCache: KlineCache,
  preFetchedPrice?: number
) {
  const {
    id,
    symbol,
    price: rawEntryPrice,
    qty: rawQty,
    meta: rawMeta,
  } = trade;
  const entryPrice = Number(rawEntryPrice);
  let currentQty = Number(rawQty);
  const meta = (
    typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta
  ) as TradeMeta;

  try {
    // Use pre-fetched price if available, fallback to getPrice for robustness
    const currentPrice = preFetchedPrice || await getPrice(symbol);
    if (!currentPrice || isNaN(currentPrice)) return;

    let isDirty = false;
    const aiResult = await runAiAnalysis(symbol, meta, cycleCache);
    if (aiResult) {
      meta.lastAiScore = aiResult.aiScore;
      meta.monitorLogs = aiResult.aiLogs;
      meta.lastAiRunAt = Date.now();
      isDirty = true;
    }

    let shouldExit = false;
    let exitReason = "";
    const stateUpdates = {
      highestPrice: (meta.highestPrice as number) || entryPrice,
      lowestPrice: (meta.lowestPrice as number) || entryPrice,
      tpTriggered: !!meta.tpTriggered,
    };

    if (trade.status === "PENDING") {
      const result = await handlePendingTrade(
        trade,
        currentPrice,
        stateUpdates,
        meta,
      );
      if (
        result.newHighest !== stateUpdates.highestPrice ||
        result.newLowest !== stateUpdates.lowestPrice
      )
        isDirty = true;
      if (Object.keys(result.metaUpdates).length > 0) isDirty = true;

      stateUpdates.highestPrice = result.newHighest;
      stateUpdates.lowestPrice = result.newLowest;
      shouldExit = result.shouldExit;
      exitReason = result.exitReason;
      Object.assign(meta, result.metaUpdates);
      if (shouldExit) return;
    } else {
      const result = await evaluateActiveTrade(
        trade,
        currentPrice,
        entryPrice,
        currentQty,
        stateUpdates,
        meta,
      );
      if (
        result.newHighest !== stateUpdates.highestPrice ||
        result.newLowest !== stateUpdates.lowestPrice ||
        result.newQty !== currentQty ||
        result.tpTriggered !== stateUpdates.tpTriggered ||
        result.hasSlChanged
      )
        isDirty = true;
      if (Object.keys(result.metaUpdates).length > 0) isDirty = true;

      stateUpdates.highestPrice = result.newHighest;
      stateUpdates.lowestPrice = result.newLowest;
      stateUpdates.tpTriggered = result.tpTriggered;
      shouldExit = result.shouldExit;
      exitReason = result.exitReason;
      currentQty = result.newQty;
      Object.assign(meta, result.metaUpdates);
    }

    Object.assign(meta, { ...stateUpdates, lastUpdate: Date.now() });

    // ── PILOT MODE GATE ──────────────────────────────────────────────────────
    // pilotEnabled is resolved once per cycle in monitorSmartTrades().
    if (!pilotEnabled && shouldExit) {
      console.log(
        `[SmartMonitor] ✈️ PİLOT KAPALI — Trade #${id} için "${exitReason}" tetiklenmeliydi, ancak dış müdahale devre dışı. Sadece fiyat güncelleniyor.`
      );
      
      // P3.5: Persist the status in metadata so UI can show the "Vetoed" state
      meta.pilotVetoReason = exitReason;
      isDirty = true;
      
      // P3.6: Log to the Global System Console (CombatLog)
      await logSystemEvent(trade.user_id, "WARN", `✈️ PİLOT KAPALI: ${symbol}`, exitReason);

      shouldExit = false;
      exitReason = "";
    }

    // P4.3: Separate Persistence Side-Effects
    if (shouldExit) {
      await executeExit(trade, currentPrice, exitReason, meta, currentQty);
    } else if (isDirty) {
      // P4.4: Selective update to reduce DB pressure
      // Only save if price moved significantly (> 0.01%) for display accuracy
      const lastSavedPrice = Number(meta.lastPrice) || 0;
      const priceChangePct = lastSavedPrice > 0 ? Math.abs((currentPrice - lastSavedPrice) / lastSavedPrice) : 1;
      
      if (priceChangePct > 0.0001) {
         meta.lastPrice = currentPrice;
         await saveTradeUpdate(id, currentQty, meta);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await handleMonitorError(id, msg);
  }
}

function resetRepairState() {
  isDbRepaired = false;
  repairPromise = null;
}

async function handleMonitorError(id: number, msg: string) {
  if (msg.includes("22P02") || msg.includes("syntax error")) {
    resetRepairState(); // Standardized reset
  }

  const userFriendlyMsg = mapTechnicalError(msg);
  console.error(`[SmartMonitor] Error for trade ${id}:`, msg);

  // Log technical error but store user-friendly version in DB
  await sql`
        UPDATE orders 
        SET meta = (jsonb_set(meta::jsonb, '{monitorError}', ${JSON.stringify(userFriendlyMsg)}::jsonb))::text, 
            updated_at = ${Date.now()}
        WHERE id = ${id}
    `;
}

async function runAiAnalysis(symbol: string, meta: Record<string, unknown>, cycleCache: KlineCache) {
  const lastAiRun = (meta.lastAiRunAt as number) || 0;
  if (Date.now() - lastAiRun <= AI_ANALYSIS_INTERVAL) return null;

  // Extract timeframe from payload, default to 1m
  const payload = meta.payload as TradePayload | undefined;
  const timeframe = payload?.timeframe || "1m";

  const cacheKey = `${symbol}-${timeframe}`;
  const now = Date.now();
  
  try {
    let klines = cycleCache[cacheKey] ? cycleCache[cacheKey].klines : null;

    if (!klines) {
      klines = await fetchKlines(symbol, timeframe, 200);
      if (klines) {
        cycleCache[cacheKey] = { klines, timestamp: now };
      }
    }

    if (klines && klines.length >= 50) {
      const engine = new MatrixV5Engine(); // P3.2: Thread-safe instance per trade
      type KlineData = { close: number; high: number; low: number; volume: number };
      const cycleTradeMode = (cycleCache as { __tradeMode?: "Scalp" | "Swing" }).__tradeMode || "Scalp";
      const configOverrides: Partial<MatrixV5Config> = { tradeMode: cycleTradeMode };
      const res = engine.analyze(
        klines.map((k: KlineData) => k.close),
        klines.map((k: KlineData) => k.high),
        klines.map((k: KlineData) => k.low),
        klines.map((k: KlineData) => k.volume),
        timeframe,
        "normal",
        0, // P3.1: Explicit fundingRate for correct positional parsing
        configOverrides
      );
      return {
        aiScore: res.aiScore,
        aiLogs: [
          `Trend: ${res.trend}`,
          `Regime: ${res.regimePrediction}`,
          `Decision: ${res.systemDecision}`,
        ],
      };
    }
  } catch (err) {
    console.warn(`[SmartMonitor] AI fail ${symbol}:`, err);
  }
  return null;
}

function mapTechnicalError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("insufficient")) return "Bakiye Yetersiz";
  if (lower.includes("mexc") || lower.includes("network"))
    return "Borsa Bağlantı Hatası";
  if (lower.includes("database") || lower.includes("sql"))
    return "Sistem Veri Hatası";
  return msg;
}

// P4.3: Refactored evaluateActiveTrade into sub-evaluators
async function evaluateActiveTrade(
  trade: MonitoredTrade,
  currentPrice: number,
  entryPrice: number,
  qty: number,
  state: { highestPrice: number; lowestPrice: number; tpTriggered: boolean },
  meta: TradeMeta,
) {
  const payload = meta.payload || ({} as TradePayload);
  const metaUpdates: Partial<TradeMeta> = {};

  const newHighest = Math.max(state.highestPrice, currentPrice);
  const newLowest = Math.min(state.lowestPrice, currentPrice);
  let shouldExit = false;
  let exitReason = "";
  let tpTriggered = state.tpTriggered;
  let newQty = qty;

  // 1. Evaluate Stop Loss
  const slResult = evaluateStopLoss(
    trade.id,
    trade.side,
    currentPrice,
    entryPrice,
    newHighest,
    newLowest,
    payload,
    meta,
  );

  // BUG FIX: Her halükarda State'i güncelle (Timeout sayaçları ve dinamik TSL değerlerinin kaybolmaması için)
  Object.assign(metaUpdates, slResult.metaUpdates);

  if (slResult.shouldExit) {
    exitReason = slResult.reason || "STOP LOSS";
    shouldExit = true;
  }
  const hasSlChanged = slResult.hasSlChanged;

  // 2. Evaluate Take Profit (only if SL not hit)
  if (!shouldExit) {
    const tpResult = evaluateTakeProfit(
      trade,
      currentPrice,
      entryPrice,
      newQty,
      newHighest,
      newLowest,
      tpTriggered,
      payload,
      meta,
    );
    if (tpResult.shouldExit) {
      shouldExit = true;
      exitReason = tpResult.reason;
    }
    tpTriggered = tpResult.tpTriggered;
    newQty = tpResult.newQty;
    Object.assign(metaUpdates, tpResult.metaUpdates);

    // P4.4: Execution of partial TP moved to caller (Side-Effect separation)
    if (tpResult.partialExecution) {
      const result = await executePartialTP(
        trade,
        currentPrice,
        newQty,
        tpResult.partialExecution,
        meta,
        metaUpdates,
        tpTriggered,
      );
      newQty = result.newQty;
      tpTriggered = result.tpTriggered;
    }
  }

  return {
    newHighest,
    newLowest,
    shouldExit,
    exitReason,
    tpTriggered,
    newQty,
    metaUpdates,
    hasSlChanged,
  };
}

function evaluateStopLoss(
  tradeId: number,
  side: string,
  currentPrice: number,
  entryPrice: number,
  highest: number,
  lowest: number,
  payload: TradePayload,
  meta: TradeMeta,
) {
  const isLong = side === "BUY";
  const metaUpdates: Partial<TradeMeta> = {};
  let slPrice = payload.stopLoss?.price
    ? parseFloat(payload.stopLoss.price)
    : 0;
  const filledTargets = (meta.filledTargets as number[]) || [];

  // Breakeven Logic
  if (payload.stopLoss?.breakeven && filledTargets.length > 0) {
    slPrice = entryPrice;
    metaUpdates.slMovedToBreakeven = true;
  } else if (meta.slMovedToBreakeven) {
    slPrice = entryPrice;
  }

  // CRITICAL: Strictly check trailing is explicitly true (not truthy).
  // The payload always includes `deviation` even when trailing is OFF,
  // so we MUST check `trailing === true` to avoid false positive activation.
  // Also handle legacy data where trailing might be stored as string "true"/"false".
  const rawTrailing = payload.stopLoss?.trailing;
  const isTrailingSLEnabled =
    rawTrailing === true || rawTrailing === ("true" as unknown);

  // FIX: TSL only activates AFTER at least one TP is hit (tpTriggered).
  // This prevents early trailing and misleading "TSL BAŞLADI" messages.
  const isTpAlreadyHit = !!meta.tpTriggered;

  if (isTrailingSLEnabled && slPrice > 0 && isTpAlreadyHit) {
    // NEW TRAILING SL PATH: Trails using the initial SL distance dynamically.
    const sl = payload.stopLoss!;
    const isCover = payload.mode === "COVER";

    // Calculate inherent TSL Deviation percentage. 
    // Prioritize explicit TSL deviation from settings, fallback to initial SL distance.
    const tslDevSetting = payload.stopLoss?.deviation;
    const distRatio = (typeof tslDevSetting === 'number' && tslDevSetting > 0)
      ? (tslDevSetting / 100)
      : Math.abs((entryPrice - slPrice) / entryPrice);

    const prevSl = (meta.activeStopLoss as number) || slPrice;

    let finalSL = prevSl;

    // Cover modunda trailing buy gibi: fiyat DÜŞTÜKÇE takip et (lowest küçüldükçe SL'yi aşağı çek)
    // Trade modunda bildiğimiz trailing stop: fiyat ÇIKTIKÇE takip et (highest büyüdükçe SL'yi yukarı çek)
    const trailSL = calculateTrailingExitTarget(payload.mode || "TRADE", highest, lowest, entryPrice, distRatio * 100);
    
    if (isCover) {
      finalSL = prevSl > 0 ? Math.min(trailSL, prevSl) : trailSL;
    } else {
      finalSL = prevSl > 0 ? Math.max(trailSL, prevSl) : trailSL;
    }

    // MINIMUM DISTANCE GUARD: SL must be at least 0.1% from entry price
    // Reduced from 0.8% to 0.1% to allow tight scalping stops.
    const minDistPct = 0.001; // 0.1%
    if (isLong) {
      const minSL = entryPrice * (1 - minDistPct);
      if (finalSL > minSL) finalSL = minSL;
    } else {
      const maxSL = entryPrice * (1 + minDistPct);
      if (finalSL < maxSL) finalSL = maxSL;
    }

    // Log when TSL upgrades the stop explicitly
    if (finalSL !== prevSl && !meta.tslActivated) {
      console.log(
        `[SmartMonitor] TSL ACTIVATED: Trade ${tradeId} | Side: ${side} | Base SL: ${slPrice} | Dist: ${(distRatio * 100).toFixed(2)}% | New SL: ${finalSL}`,
      );
      metaUpdates.tslActivated = true;
    }

    metaUpdates.activeStopLoss = finalSL;
    const hasSlChanged = finalSL !== prevSl;

    const slHit =
      finalSL > 0 &&
      (isLong ? currentPrice <= finalSL : currentPrice >= finalSL);

    // Diagnostic Log: When price is near SL or hit
    if (
      finalSL > 0 &&
      (Math.abs(currentPrice - finalSL) / finalSL < 0.01 || slHit)
    ) {
      console.log(
        `[SmartMonitor] SL EVAL (TSL-PATH): Trade ${tradeId} | ${side} | Price: ${currentPrice} | SL: ${finalSL.toFixed(2)} | Hit: ${slHit}`,
      );
    }

    if (slHit) {
      // Volatility Buffer: Don't trigger SL in the first 30 seconds unless price is 1.2x beyond SL
      const filledAt = Number(meta.filledAt || 0);
      const durationMs = Date.now() - filledAt;
      const bufferMs = 30_000; // 30 seconds
      const slThreshold = Math.abs(entryPrice - (finalSL || slPrice)) / entryPrice;
      const currentDrop = Math.abs(currentPrice - entryPrice) / entryPrice;

      if (filledAt > 0 && durationMs < bufferMs && currentDrop < slThreshold * 1.2) {
        console.log(
          `[SmartMonitor] TSL WARMUP: Trade ${tradeId} | SL hit but within buffer period (${Math.round(durationMs / 1000)}s). Skipping exit.`,
        );
        return { shouldExit: false, reason: "", metaUpdates, hasSlChanged };
      }

      const timeoutSeconds = sl.timeoutSeconds ? Number(sl.timeoutSeconds) : 0;
      if (sl.timeout && timeoutSeconds > 0) {
        if (!meta.slTimeoutStart) {
          metaUpdates.slTimeoutStart = Date.now();
          console.log(
            `[SmartMonitor] SL TIMEOUT START: Trade ${tradeId} @ ${currentPrice}`,
          );
          return { shouldExit: false, reason: "", metaUpdates };
        }
        const slTimeoutStart = meta.slTimeoutStart as number;
        if (Date.now() - slTimeoutStart >= timeoutSeconds * 1000) {
          return {
            shouldExit: true,
            reason: `Trailing SL + Timeout sonrası kapandı ($${finalSL.toFixed(2)})`,
            metaUpdates,
          };
        }
      } else {
        console.log(
          `[SmartMonitor] 🚨 TSL EXIT: Trade ${tradeId} | ${side} | Price: ${currentPrice} | TSL: ${finalSL.toFixed(2)} | Highest: ${highest} | Lowest: ${lowest}`,
        );
        return {
          shouldExit: true,
          reason: `Trailing Stop Loss vuruldu (TSL: $${finalSL.toFixed(2)})`,
          metaUpdates,
          hasSlChanged,
        };
      }
    } else if (meta.slTimeoutStart) {
      metaUpdates.slTimeoutStart = null;
    }
    return { shouldExit: false, reason: "", metaUpdates, hasSlChanged };
  } else if (slPrice > 0) {
    // FIXED (NON-TRAILING) SL PATH
    metaUpdates.activeStopLoss = slPrice;
    const hasSlChanged = (meta.activeStopLoss as number) !== slPrice;
    const slHit = isLong ? currentPrice <= slPrice : currentPrice >= slPrice;

    // Volatility Buffer: Don't trigger SL in the first 30 seconds unless price is 1.2x beyond SL
    const filledAt = Number(meta.filledAt || 0);
    const durationMs = Date.now() - filledAt;
    const bufferMs = 30_000; // 30 seconds
    const slThreshold = Math.abs(entryPrice - slPrice) / entryPrice;
    const currentDrop = Math.abs(currentPrice - entryPrice) / entryPrice;

    if (filledAt > 0 && durationMs < bufferMs && currentDrop < slThreshold * 1.2) {
      console.log(
        `[SmartMonitor] SL PREVENTED BY BUFFER (FIXED): Trade ${tradeId} | Duration: ${Math.round(durationMs / 1000)}s | Drop: ${(currentDrop * 100).toFixed(2)}% | SL: ${(slThreshold * 100).toFixed(2)}%`,
      );
      return { shouldExit: false, reason: "", metaUpdates, hasSlChanged };
    }

    // Diagnostic Log: When price is near fixed SL
    if (Math.abs(currentPrice - slPrice) / slPrice < 0.01 || slHit) {
      console.log(
        `[SmartMonitor] FIXED SL EVAL: Trade ${tradeId} | ${side} | Price: ${currentPrice} | SL: ${slPrice} | Hit: ${slHit}`,
      );
    }

    if (slHit) {
      console.log(
        `[SmartMonitor] 🛑 FIXED SL EXIT: Trade ${tradeId} | ${side} | Price: ${currentPrice} | SL: ${slPrice}`,
      );
      return {
        shouldExit: true,
        reason: `Sabit Stop Loss'a ulaşıldı ($${slPrice.toFixed(2)})`,
        metaUpdates,
        hasSlChanged,
      };
    }
    return { shouldExit: false, reason: "", metaUpdates, hasSlChanged };
  }
  return { shouldExit: false, reason: "", metaUpdates, hasSlChanged: false };
}

function evaluateTakeProfit(
  trade: MonitoredTrade,
  currentPrice: number,
  entryPrice: number,
  qty: number,
  highest: number,
  lowest: number,
  triggered: boolean,
  payload: TradePayload,
  meta: TradeMeta,
) {
  const side = trade.side as string;
  const isLong = side === "BUY";
  const metaUpdates: Partial<TradeMeta> = {};
  let tpTriggered = triggered;
  const newQty = qty;

  if (!payload.takeProfit?.price && !payload.takeProfit?.targets?.length)
    return { shouldExit: false, reason: "", tpTriggered, newQty, metaUpdates };

  const targets =
    payload.takeProfit.isSplit && payload.takeProfit.targets
      ? payload.takeProfit.targets
      : [{ price: payload.takeProfit.price, volume: "100" }];
  const sorted = [...targets].sort((a, b) =>
    isLong
      ? parseFloat(a.price) - parseFloat(b.price)
      : parseFloat(b.price) - parseFloat(a.price),
  );
  const filledTargets = (meta.filledTargets as number[]) || [];

  for (let i = 0; i < sorted.length; i++) {
    if (filledTargets.includes(i)) continue;
    const target = sorted[i];
    const tpPrice = parseFloat(target.price);
    const isLast = i === sorted.length - 1;

    const rawTpTrailing = payload.takeProfit.trailing;
    const isTpTrailingEnabled =
      (rawTpTrailing === true || rawTpTrailing === ("true" as unknown)) &&
      typeof payload.takeProfit.deviation === "number" &&
      payload.takeProfit.deviation !== 0;

    const isTrailingActive = isLast && isTpTrailingEnabled && tpTriggered;
    const priceCrossedTp = isLong
      ? currentPrice >= tpPrice
      : currentPrice <= tpPrice;

    if (priceCrossedTp || isTrailingActive) {
      if (isTpTrailingEnabled && isLast) {
        if (!tpTriggered) {
          tpTriggered = metaUpdates.tpTriggered = true;
          console.log(
            `[SmartMonitor] TP TRAILING TRIGGERED: Trade ${trade.id} | ${side} | Price: ${currentPrice} | TP Target: ${tpPrice}`,
          );
        }

        const prevTp = (meta.activeTakeProfit as number) || tpPrice;
        const devPercent = payload.takeProfit.deviation!;
        const trailExit = calculateTrailingExitTarget(payload.mode || "TRADE", highest, lowest, entryPrice, devPercent);

        // Monotonicity for TP:
        const finalTp =
          prevTp > 0
            ? isLong
              ? Math.max(trailExit, prevTp)
              : Math.min(trailExit, prevTp)
            : trailExit;

        metaUpdates.activeTakeProfit = finalTp;
        const tpExited = isLong
          ? currentPrice <= finalTp
          : currentPrice >= finalTp;

        // Diagnostic Log
        if (Math.abs(currentPrice - finalTp) / finalTp < 0.01 || tpExited) {
          console.log(
            `[SmartMonitor] TTP EVAL: Trade ${trade.id} | ${side} | Price: ${currentPrice} | TTP Exit: ${finalTp.toFixed(2)} | Hit: ${tpExited}`,
          );
        }

        if (tpExited) {
          return {
            shouldExit: true,
            reason: `Trailing TP vuruldu (TTP: $${finalTp.toFixed(2)})`,
            tpTriggered,
            newQty,
            metaUpdates,
          };
        }
      } else if (payload.takeProfit.isSplit && !isLast) {
        const sellQty = Math.min(
          parseFloat(meta.initialQty || String(qty)) *
            (parseFloat(String(target.volume)) / 100),
          newQty,
        );
        console.log(
          `[SmartMonitor] PARTIAL TP: Trade ${trade.id} | Qty: ${sellQty} | Target: ${i}`,
        );
        // P4.4: Return Execution Instruction instead of performing it
        return {
          shouldExit: false,
          reason: "",
          tpTriggered: true, // Hitting any target activates TSL
          newQty,
          metaUpdates: { ...metaUpdates, tpTriggered: true },
          partialExecution: { qty: sellQty, targetIndex: i },
        };
      } else {
        console.log(
          `[SmartMonitor] FIXED TP HIT: Trade ${trade.id} @ ${currentPrice}`,
        );
        return {
          shouldExit: true,
          reason: `Sabit TP'ye ulaşıldı`,
          tpTriggered,
          newQty,
          metaUpdates,
        };
      }
    } else break;
  }
  return { shouldExit: false, reason: "", tpTriggered, newQty, metaUpdates };
}

async function handlePendingTrade(
  trade: MonitoredTrade,
  currentPrice: number,
  state: { highestPrice: number; lowestPrice: number },
  meta: TradeMeta,
) {
  const { side, price: entryPrice } = trade;
  const payload = meta.payload || ({} as TradePayload);
  const targetEntry = parseFloat(payload.buyPrice) || entryPrice;
  const isTrailing = !!payload.trailingBuy;
  const dev = (payload.trailingBuyDev as number) || 1.0;

  let entryTriggered = meta.entryTriggered || false;
  let newHighest = state.highestPrice;
  let newLowest = state.lowestPrice;
  let shouldExit = false;
  let exitReason = "";
  const metaUpdates: Partial<TradeMeta> = {};

  if (side === "BUY") newLowest = Math.min(newLowest, currentPrice);
  else newHighest = Math.max(newHighest, currentPrice);

  if (!entryTriggered) {
    // Evaluate condition for entry: For BUY (Trade), we look for currentPrice <= targetEntry. For SELL (Cover), we look for currentPrice >= targetEntry or if it's already lower than target (market short)
    const conditionMet =
      side === "BUY"
        ? currentPrice <= targetEntry
        : currentPrice >= targetEntry;

    if (conditionMet) {
      // SLIPPAGE GUARD (Validation Window):
      // If the price is already > 2% beyond our target entry during the first trigger detection,
      // it's a "fast gap". We wait for the next cycle to avoid a bad market entry.
      const slippage = Math.abs(currentPrice - targetEntry) / targetEntry;
      if (slippage > 0.02) {
        console.warn(
          `[SmartMonitor] Slippage Guard: Price gap detected for trade ${trade.id} (${(slippage * 100).toFixed(2)}%). Waiting for stability.`,
        );
        metaUpdates.monitorError = "VOLATILITY_GAP_PROTECTION";
        return {
          newHighest,
          newLowest,
          shouldExit: false,
          exitReason: "",
          metaUpdates,
        };
      }

      entryTriggered = true;
      metaUpdates.actionLog = metaUpdates.actionLog || [];
      
      if (!isTrailing) {
        shouldExit = true;
        exitReason =
          side === "BUY"
            ? "Limit giriş (BUY) tetiklendi"
            : "Limit giriş (SELL/COVER) tetiklendi";
      } else {
        if (side === "BUY") {
          newLowest = currentPrice;
          newHighest = currentPrice;
        } else {
          newHighest = currentPrice;
          newLowest = currentPrice;
        }
        metaUpdates.highestPrice = newHighest;
        metaUpdates.lowestPrice = newLowest;
      }
    }
  }

  if (entryTriggered && isTrailing) {
    const trailingTgt = calculateTrailingBuyTarget(payload.mode || "TRADE", newHighest, newLowest, entryPrice, dev);
    // mode: TRADE (Longs, tracking lowest, wait for rise to target)
    if (payload.mode !== "COVER") {
        newLowest = Math.min(newLowest, currentPrice);
        metaUpdates.lowestPrice = newLowest;
        if (currentPrice >= trailingTgt) {
            shouldExit = true;
            exitReason = `Trailing buy gerçekleşti @ ${currentPrice}`;
        }
    } else {
        // mode: COVER (Shorts, tracking highest, wait for drop to target)
        newHighest = Math.max(newHighest, currentPrice);
        metaUpdates.highestPrice = newHighest;
        if (currentPrice <= trailingTgt) {
            shouldExit = true;
            exitReason = `Trailing Satış (Cover) gerçekleşti @ ${currentPrice}`;
        }
    }
    
    // Save state back to DB on each trailing tick if no exit yet, but only if significant difference to avoid I/O spam
    if (!shouldExit && (newHighest !== meta.highestPrice || newLowest !== meta.lowestPrice)) {
       const pctChangeHigh = meta.highestPrice ? Math.abs(newHighest - (meta.highestPrice as number)) / (meta.highestPrice as number) : 1;
       const pctChangeLow = meta.lowestPrice ? Math.abs(newLowest - (meta.lowestPrice as number)) / (meta.lowestPrice as number) : 1;
       if (pctChangeHigh > 0.005 || pctChangeLow > 0.005) { // 0.5% change threshold
         await saveTradeUpdate(trade.id, Number(meta.executedQty) || 0, { ...meta, ...metaUpdates });
       }
    }
  }

  metaUpdates.entryTriggered = entryTriggered;
  if (shouldExit) await executeEntry(trade, currentPrice, exitReason, { ...meta, ...metaUpdates });
  return { newHighest, newLowest, shouldExit, exitReason, metaUpdates };
}
