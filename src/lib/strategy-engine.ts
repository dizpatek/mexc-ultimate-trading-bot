import {
  getStrategiesByUser,
  createStrategySignal,
  Strategy,
  getBotConfig,
  BotConfig,
  logSystemEvent,
  getActiveOrderSymbols,
  getRecentSignalsBulk,
  getActiveSmartTrades,
  acquireLock,
  releaseLock,
  markSignalExecuted,
  resolveTradeMode,
} from "./db";
import {
  createStrategy,
  StrategyParameters,
  MatrixV5Strategy,
} from "./strategies";
import { handleBuySignal, handleSellSignal } from "./trade";
import { handleSmartTrade } from "./smart-trade";
import { getHoldings, getPrice, getBalance, getTopAssets } from "./mexc-wrapper";
import type { TradingMode } from "./trading-mode";
import { PilotExecutor } from "./pilot-executor";

// Removed DEFAULT_USER_ID constant for strict multi-user compatibility
const DEDUP_WINDOW_MS = 300000; // 5 minutes signal deduplication window

export async function runActiveStrategies(isImmediate = false, executionUserId: number, mode: TradingMode = "test") {
  const userId = executionUserId;
  const lockId = `strategy_engine_lock_${userId}_${mode}`;
  const owner = `process_${process.pid}_${Date.now()}`;

  // Use persistent DB lock instead of local variable (Fix P4.3 / Distributed Race Condition)
  const locked = await acquireLock(lockId, owner, 90000); // Reduced to 1.5 mins for safety (P4.2)
  if (!locked) {
    console.log(`[StrategyEngine] Cycle lock ${lockId} busy. Skipping...`);
    return;
  }
  
  console.log(`[StrategyEngine] Starting strategy execution cycle... (isImmediate: ${isImmediate}, user: ${userId}, mode: ${mode})`);
  
  try {
    await logSystemEvent(
      userId,
      "SYSTEM",
      "STRATEGY_CYCLE_START",
      `Bağlantılar tazeleniyor ve analiz döngüsü başlatıldı. (Kullanıcı: ${userId}, Mod: ${mode})`,
    );
    // 1. Fetch active strategies
    const strategies = await getStrategiesByUser(userId);
    const rawActiveStrategies = strategies.filter((s: Strategy) => s.active);

    // 2. Load Global Bot Config (Pilot etc)
    const botConfig = await getBotConfig();
    if (!botConfig) {
      console.log("[StrategyEngine] Bot config could not be loaded. Aborting cycle.");
      return;
    }

    // MANDATORY PORTFOLIO FILTERING (Strict User Rule: ONLY scan portfolio)
    const holdings = (await getHoldings(userId, mode)) as Array<{ asset?: string; symbol?: string; }>;
    const holdingPairs = holdings.map((h) => {
      const asset = h.asset || (h.symbol?.includes("/") ? h.symbol.split("/")[0] : h.symbol);
      if (!asset) return "";
      let s = `${asset}USDT`.toUpperCase().replace(/\//g, "");
      if (s.endsWith("USDTUSDT")) s = s.replace("USDTUSDT", "USDT");
      return s;
    }).filter(s => s && s !== "USDT");

    // 3. Run Master Pilot (Global scanning) if enabled
    if (botConfig.auto_trade) {
      await runPilotCycle(botConfig, userId, isImmediate, mode, holdingPairs, holdings);
    }

    const activeStrategies = rawActiveStrategies.filter(s => holdingPairs.includes(s.symbol));

    if (activeStrategies.length === 0) {
      console.log("[StrategyEngine] No custom active strategies found.");
      return;
    }

    // 4. Process custom active strategies
    console.log(
      `[StrategyEngine] Processing ${activeStrategies.length} custom active strategies...`,
    );
    await logSystemEvent(
      userId,
      "SYSTEM",
      "ACTIVE_STRATEGIES",
      `${activeStrategies.length} aktif strateji analiz ediliyor.`,
    );


    // Fetch recent signals for custom strategies deduplication
    const customSymbols = activeStrategies.map(s => s.symbol);
    const customRecentSignals = await getRecentSignalsBulk(customSymbols, DEDUP_WINDOW_MS, mode);

    for (const strategy of activeStrategies) {
      await processStrategy(strategy, botConfig, userId, mode, customRecentSignals);
    }

    await logSystemEvent(
      userId,
      "SYSTEM",
      "STRATEGY_CYCLE_COMPLETE",
      "Tüm strateji ve pilot kontrolleri başarıyla tamamlandı. Bir sonraki döngü bekleniyor.",
    );
  } catch (error) {
    console.error("[StrategyEngine] Critical error in execution cycle:", error);
  } finally {
    await releaseLock(lockId, owner);
  }
}


async function processStrategy(
  strategy: Strategy, 
  botConfig: BotConfig, 
  userId: number,
  mode: TradingMode = "test",
  recentSignals: any[] = []
) {
  try {
    const symbol = strategy.symbol;

    // Deduplication check: Was there a recent executed signal for this asset?
    const hasRecentSignal = recentSignals.some(s => 
      s.symbol === symbol && 
      (s.signal_type === "BUY" || s.signal_type === "SELL")
    );

    if (hasRecentSignal) {
      console.log(`[StrategyEngine] 🛡 Deduplication: ${symbol} için son ${DEDUP_WINDOW_MS/60000}dk içinde işlem sinyali var. Atlanıyor.`);
      return;
    }

    console.log(`[StrategyEngine] Analyzing ${strategy.name} (${symbol}) for User: ${userId}...`);

    // Instantiate strategy - cast parameters to StrategyParameters
    // Inherit global defaults to fix old custom strategies lacking these fields
    const parameters = {
      mtfVeto: botConfig.pilot_mtf_veto,
      mtfThreshold: botConfig.pilot_mtf_threshold,
      minAiScore: botConfig.ai_threshold || 65,
      f4Length: botConfig.f4_length,
      whaleVolumeMultiplier: botConfig.whale_multiplier,
      f4PowerLossThreshold: botConfig.f4_power_loss_threshold,
      f4LookbackBars: botConfig.f4_lookback_bars,
      f4SqueezeThreshold: botConfig.f4_squeeze_threshold,
      minPowerLoss: botConfig.min_power_loss,
      ...(strategy.parameters || {})
    } as StrategyParameters;
    
    const strategyInstance = createStrategy(
      strategy.strategy_type,
      symbol,
      parameters,
    );

    // Analyze market
    const signal = await strategyInstance.analyze();

    if (!signal || !signal.signal) {
      // No signal, but we want to log that it was analyzed
      await logSystemEvent(userId, "SYSTEM", "SIGNAL_ANALYSIS", `${symbol} analiz edildi: Uygun sinyal yok.`);
      return;
    }

    // Determine trade parameters
    const riskPerTrade = 0.01;
    let executionResult: Record<string, unknown> = {
      executed: false,
      reason: "Simulation mode or error",
    };
    let executed = false;

    // Check Otomatik Pilot
    if (!botConfig.auto_trade) {
      const msg = "Otomatik Pilot Kapalı (Pilot OFF)";
      console.log(`[StrategyEngine] ⏸ ${msg}. Signal for ${strategy.name} logged but NOT executed.`);
      await logSystemEvent(userId, "SYSTEM", "NEGATIVE", `⏸ OTOMATİK PİLOT DEVRE DIŞI: ${strategy.name} sinyali engellendi.`);
      await createStrategySignal({
        strategy_id: strategy.id,
        symbol: signal.symbol,
        signal_type: signal.signal,
        price: signal.price || 0,
        timestamp: Date.now(),
        executed: false,
        execution_result: { message: msg, f4Slope: signal.indicators.f4Slope },
      });
      return;
    }

    // Check Savunma Modu for BUY signals
    if (signal.signal === "BUY" && botConfig.defense_mode) {
      const msg = "Savunma Modu Aktif (Defense ON)";
      console.log(`[StrategyEngine] 🛡 ${msg}. BUY signal for ${strategy.name} blocked.`);
      await logSystemEvent(userId, "SYSTEM", "NEGATIVE", `🛡 SAVUNMA MODU AKTİF: ${strategy.name} BUY sinyali engellendi.`);
      await createStrategySignal({
        strategy_id: strategy.id,
        symbol: signal.symbol,
        signal_type: signal.signal,
        price: signal.price || 0,
        timestamp: Date.now(),
        executed: false,
        execution_result: { message: msg, f4Slope: signal.indicators.f4Slope },
      });
      return;
    }

    try {
      if (signal.signal === "BUY") {
        const res = await handleBuySignal({
          pair: symbol,
          risk: riskPerTrade,
          balancePercent: 10, // Example: Use 10% of available USDT per trade
          userId: userId,
          mode: mode,
          tp: signal.targets?.t1,
          sl: signal.targets?.sl,
        });
        executionResult = res as Record<string, unknown>;
        executed = true;
      } else if (signal.signal === "SELL") {
        const res = await handleSellSignal({
          pair: symbol,
          percent: 100, // Sell 100% of holdings for this pair
          userId: userId,
          mode: mode,
          tp: signal.targets?.t1,
          sl: signal.targets?.sl,
        });
        executionResult = res as Record<string, unknown>;
        executed = true;
      }
      
      if (executed) {
        recentSignals.push({ symbol, signal_type: signal.signal, timestamp: Date.now() });
      }
    } catch (tradeError: unknown) {
      console.error(
        `[StrategyEngine] Trade execution failed for ${strategy.name}:`,
        tradeError instanceof Error ? tradeError.message : String(tradeError),
      );
      executionResult = {
        error:
          tradeError instanceof Error ? tradeError.message : String(tradeError),
      };
    }

    // Record signal in DB
    await createStrategySignal({
      strategy_id: strategy.id,
      symbol: strategy.symbol,
      signal_type: signal.signal,
      price: signal.price || 0,
      timestamp: Date.now(),
      executed: executed,
      execution_result: { ...executionResult, aiScore: signal.indicators.aiScore },
      trading_mode: mode,
    });
  } catch (error: unknown) {
    console.error(
      `[StrategyEngine] Error processing strategy ${strategy.id}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runPilotCycle(
  botConfig: BotConfig, 
  userId: number, 
  isImmediate: boolean = false, 
  mode: TradingMode = "test",
  holdingPairs: string[],
  holdings: any[]
) {
  try {
    // Load re-entry map from DB ONCE per cycle instead of per-symbol (Performance Fix P4.2)
    await PilotExecutor.ensureReEntryMapLoaded();

    const activeSmartTrades = await getActiveSmartTrades(userId, mode);
    const activeOrderSymbols = activeSmartTrades.map(t => t.symbol);
    
    // SCAN RANGE: Even if pilot_only_holdings is ON, we include a minimal set of Top Assets 
    // to ensure the bot can discover new entry opportunities as requested by the user.
    let assetsToScan = [...holdingPairs];
    const topAssetsCount = botConfig.pilot_only_holdings ? 20 : 60; // Discovery vs Full Market
    
    const topAssets = await getTopAssets(topAssetsCount);
    const topSymbols = topAssets.map(a => a.symbol.replace("/", ""));
    
    assetsToScan = Array.from(new Set([...assetsToScan, ...topSymbols]));
    console.log(`[PilotEngine] 🌐 Scan set prepared: ${assetsToScan.length} assets (Holdings + Top ${topAssetsCount}).`);

    const finalCoins = assetsToScan.filter((s) => 
      s !== "USDTUSDT" && 
      s !== "USDT" && 
      s !== "undefinedUSDT" && 
      s.length > 4
      // MATRIX Modu için aktif olanları DA tarıyoruz ki ters sinyal gelince kapatabilelim.
      // SADECE HEDGE modunda ve aynı yönde işlem varsa belki atlanabilir ama PilotExecutor içinde kontrol etmek daha sağlıklı.
    );

    console.log(`[PilotEngine] 🔍 Monitoring ${finalCoins.length} assets.`);

    // P4.2: Hybrid Multi-Timeframe Scanning
    // We scan 1m for ultra-fast "Early" signals and the configured pilot_timeframe for trend signals.
    let mainTf = botConfig.pilot_timeframe || "4h";
    if (mainTf.toLowerCase() === "1mo") mainTf = "1M";
    
    // Timeframes to scan: Always include 1m if Scalp mode or if user specifically needs fast signals
    const timeframesToScan = (mainTf === "1m") ? ["1m"] : ["1m", mainTf];

    console.log(
      `[PilotEngine] Monitoring ${finalCoins.length} assets on ${timeframesToScan.join(", ")}...`,
    );
    await logSystemEvent(
      userId,
      "SYSTEM",
      "PILOT_SCAN",
      `${finalCoins.length} varlık pilot taramasında (${timeframesToScan.join(", ")}).`,
    );

    // Run parallel analysis for monitored assets in batches
    // Pre-map holdings for O(1) lookup performance across all chunks
    const holdingsMap = new Map<string, any>();
    for (const h of holdings) {
      if (h.asset) {
        holdingsMap.set(`${h.asset}USDT`, h);
        holdingsMap.set(h.asset, h); // Enables lookups like .get("USDT")
      }
      if (h.symbol) holdingsMap.set(h.symbol.replace("/", ""), h);
    }

    // Fetch recent signals to prevent duplicate rapid-fire trades
    const recentSignals = await getRecentSignalsBulk(finalCoins, DEDUP_WINDOW_MS, mode);

    let noSignalCount = 0;
    const CHUNK_SIZE = 100;

    // P4.2: Iterate through all enabled timeframes (e.g. 1m and 4h)
    for (const tf of timeframesToScan) {
      console.log(`[PilotEngine] 🕒 Scanning ${finalCoins.length} coins on ${tf}...`);
      for (let i = 0; i < finalCoins.length; i += CHUNK_SIZE) {
        const chunk = finalCoins.slice(i, i + CHUNK_SIZE);
        const chunkNoSignal = await processPilotChunk(
          chunk, 
          tf, 
          botConfig, 
          userId, 
          isImmediate, 
          mode, 
          holdingsMap, 
          recentSignals, 
          activeSmartTrades
        );
        noSignalCount += chunkNoSignal;
      }
    }

    if (noSignalCount > 0) {
      await logSystemEvent(userId, "SYSTEM", "SIGNAL_ANALYSIS", `SIGNAL_ANALYSIS: ${noSignalCount} varlık analiz edildi: Uygun sinyal yok.`);
    }

  } catch (error) {
    console.error("[PilotEngine] Critical error:", error);
  }
}

async function processPilotChunk(
  chunk: string[], 
  scanTimeframe: string, 
  botConfig: BotConfig, 
  userId: number, 
  isImmediate: boolean,
  mode: TradingMode = "test",
  holdingsMap: Map<string, any> = new Map(),
  recentSignals: any[] = [],
  activeSmartTrades: any[] = []
): Promise<number> {
  let noSignalCount = 0;
  // P4.2: Optimized for performance - Analyze in parallel, but process execution sequentially
  // This restores the speed of concurrent network requests while maintaining thread-safe deduplication.
  const analysisResults = await Promise.allSettled(
    chunk.map(async (symbol) => {
      const symbolLockId = `pilot_lock_${symbol}`;
      const symbolOwner = `worker_${process.pid}_${Date.now()}`;
      
      const symbolLocked = await acquireLock(symbolLockId, symbolOwner, 30000);
      if (!symbolLocked) return { symbol, skipped: "LOCKED" };

      try {
        // High-level "very recent" check before analysis to save API weight
        const veryRecentAny = recentSignals.find(s => 
          s.symbol === symbol && 
          (s.signal_type === "BUY" || s.signal_type === "SELL") &&
          Date.now() - Number(s.timestamp) < 60000
        );
        if (veryRecentAny) {
          await releaseLock(symbolLockId, symbolOwner);
          return { symbol, skipped: "COOLDOWN" };
        }

        const strategy = new MatrixV5Strategy(symbol, {
          timeframe: scanTimeframe,
          minAiScore: botConfig.ai_threshold || 65,
          tradeMode: resolveTradeMode(botConfig),
          mtfVeto: botConfig.pilot_mtf_veto,
          mtfThreshold: botConfig.pilot_mtf_threshold,
          f4Length: botConfig.f4_length,
          whaleVolumeMultiplier: botConfig.whale_multiplier,
          f4PowerLossThreshold: botConfig.f4_power_loss_threshold,
          f4LookbackBars: botConfig.f4_lookback_bars,
          f4SqueezeThreshold: botConfig.f4_squeeze_threshold,
          minPowerLoss: botConfig.min_power_loss,
          fiboLength: botConfig.fibo_length
        });

        const signal = await strategy.analyze();
        return { symbol, signal, lockInfo: { symbolLockId, symbolOwner } };
      } catch (err) {
        console.error(`[PilotEngine] Analysis error for ${symbol}:`, err);
        await releaseLock(symbolLockId, symbolOwner);
        return { symbol, error: err };
      }
    })
  );

  // Process execution sequentially
  for (const res of analysisResults) {
    if (res.status === 'rejected' || !res.value) continue;
    const { symbol, signal, skipped, lockInfo, error } = res.value;
    
      if (error || !signal) {
        if (!error) noSignalCount++;
        continue;
      }

      // Log structural analysis only if it's significiant
      if (signal.indicators?.structure) {
        const s = signal.indicators.structure as any;
        if (s.bos || s.choch) {
          await logSystemEvent(userId, "SYSTEM", "NEUTRAL", `📐 Yapısal Analiz: ${symbol}: BOS: ${!!s.bos} | CHoCH: ${!!s.choch} | Trend: ${s.trend || 'NEUTRAL'}`);
        }
      }

    try {
      await PilotExecutor.handleSignal({
        symbol,
        signal,
        scanTimeframe,
        botConfig,
        userId,
        mode,
        holdingsMap,
        recentSignals,
        activeSmartTrades,
        lockInfo
      });
    } catch (err) {
      console.error(`[PilotEngine] Failed to process ${symbol} after analysis:`, err);
    } finally {
      if (lockInfo) {
        await releaseLock(lockInfo.symbolLockId, lockInfo.symbolOwner);
      }
    }
  }
  return noSignalCount;
}

/**
 * Helper to process the execution phase of a Pilot signal sequentially.
 * Addresses Kluster's quality feedback (P4.2/P4.3) by modularizing the execution logic.
 * Note: Symbols filtered by 'pilot_only_holdings' are assumed to be handled at the 
 * parent loop level (runPilotCycle) to minimize redundant checks here.
 */
