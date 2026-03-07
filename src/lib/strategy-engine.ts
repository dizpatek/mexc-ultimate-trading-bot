import {
  getStrategiesByUser,
  createStrategySignal,
  Strategy,
  getBotConfig,
  BotConfig,
  logSystemEvent,
} from "./db";
import {
  createStrategy,
  StrategyParameters,
  MatrixV5Strategy,
} from "./strategies";
import { handleBuySignal, handleSellSignal } from "./trade";
import { getHoldings } from "./mexc-wrapper";

const DEFAULT_USER_ID = 1; // Assuming single user mode for now or iterate all users in future

export async function runActiveStrategies() {
  console.log("[StrategyEngine] Starting strategy execution cycle...");
  await logSystemEvent(
    DEFAULT_USER_ID,
    "SYSTEM",
    "STRATEGY_CYCLE_START",
    "Bağlantılar tazeleniyor ve analiz döngüsü başlatıldı.",
  );

  try {
    // 1. Fetch active strategies
    // In a multi-user system, we'd fetch all active strategies across all users.
    // For now, we'll just fetch for the default user.
    const strategies = await getStrategiesByUser(DEFAULT_USER_ID);
    const activeStrategies = strategies.filter((s: Strategy) => s.active);

    if (activeStrategies.length === 0) {
      console.log("[StrategyEngine] No active strategies found.");
      return;
    }

    console.log(
      `[StrategyEngine] Processing ${activeStrategies.length} active strategies...`,
    );
    await logSystemEvent(
      DEFAULT_USER_ID,
      "SYSTEM",
      "ACTIVE_STRATEGIES",
      `${activeStrategies.length} aktif strateji analiz ediliyor.`,
    );

    // 1.5. Check Global Bot Config for execution rights
    const botConfig = await getBotConfig();

    // 1.8. RUN MASTER PILOT (Standardized monitoring for all holdings/assets)
    if (botConfig.auto_trade) {
      console.log(
        `[StrategyEngine] ✈️ OTOMATİK PİLOT AKTİF. İzlenen varlıklar taranıyor...`,
      );
      await runPilotCycle(botConfig);
    }

    for (const strategy of activeStrategies) {
      await processStrategy(strategy, botConfig);
    }

    await logSystemEvent(
      DEFAULT_USER_ID,
      "SYSTEM",
      "STRATEGY_CYCLE_COMPLETE",
      "Tüm strateji ve pilot kontrolleri başarıyla tamamlandı. Bir sonraki döngü bekleniyor.",
    );
  } catch (error) {
    console.error("[StrategyEngine] Critical error in execution cycle:", error);
  }
}

async function processStrategy(strategy: Strategy, botConfig: BotConfig) {
  try {
    const symbol = strategy.symbol;
    console.log(`[StrategyEngine] Analyzing ${strategy.name} (${symbol})...`);

    // Instantiate strategy - cast parameters to StrategyParameters
    const parameters = (strategy.parameters || {}) as StrategyParameters;
    const strategyInstance = createStrategy(
      strategy.strategy_type,
      symbol,
      parameters,
    );

    // Analyze market
    const signal = await strategyInstance.analyze();

    if (!signal || !signal.signal) {
      // No signal, do nothing
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
      console.log(
        `[StrategyEngine] ⏸ Auto-Pilot is OFF. Signal for ${strategy.name} logged but NOT executed.`,
      );
      await createStrategySignal({
        strategy_id: strategy.id,
        signal_type: signal.signal,
        price:
          signal.indicators.f4Slope !== undefined
            ? Number(signal.indicators.f4Slope)
            : undefined,
        timestamp: Date.now(),
        executed: false,
        execution_result: { message: "Otomatik Pilot Kapalı (Pilot OFF)" },
      });
      return;
    }

    // Check Savunma Modu for BUY signals
    if (signal.signal === "BUY" && botConfig.defense_mode) {
      console.log(
        `[StrategyEngine] 🛡 Defense Mode is ON. BUY signal for ${strategy.name} blocked.`,
      );
      await createStrategySignal({
        strategy_id: strategy.id,
        signal_type: signal.signal,
        price:
          signal.indicators.f4Slope !== undefined
            ? Number(signal.indicators.f4Slope)
            : undefined,
        timestamp: Date.now(),
        executed: false,
        execution_result: { message: "Savunma Modu Aktif (Defense ON)" },
      });
      return;
    }

    try {
      if (signal.signal === "BUY") {
        const res = await handleBuySignal({
          pair: symbol,
          risk: riskPerTrade,
          balancePercent: 10, // Example: Use 10% of available USDT per trade
        });
        executionResult = res as Record<string, unknown>;
        executed = true;
      } else if (signal.signal === "SELL") {
        const res = await handleSellSignal({
          pair: symbol,
          percent: 100, // Sell 100% of holdings for this pair
        });
        executionResult = res as Record<string, unknown>;
        executed = true;
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

    // Log Signal & Execution
    await createStrategySignal({
      strategy_id: strategy.id,
      signal_type: signal.signal,
      price:
        signal.indicators.f4Slope !== undefined
          ? Number(signal.indicators.f4Slope)
          : undefined,
      timestamp: Date.now(),
      executed: executed,
      execution_result: executionResult,
    });
  } catch (error: unknown) {
    console.error(
      `[StrategyEngine] Error processing strategy ${strategy.id}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function runPilotCycle(botConfig: BotConfig) {
  try {
    const holdings = (await getHoldings(DEFAULT_USER_ID)) as Array<{
      asset?: string;
      symbol?: string;
    }>;
    // Add some major pairs to monitor if holding is low, or just monitor holdings
    const coinsToMonitor = Array.from(
      new Set([
        ...holdings.map((h) =>
          h.asset ? `${h.asset}USDT` : String(h.symbol || "").replace("/", ""),
        ),
      ]),
    ).filter((s) => s !== "USDTUSDT" && s !== "USDT" && s !== "undefinedUSDT");

    const scanTimeframe = "4h";
    console.log(
      `[PilotEngine] Monitoring ${coinsToMonitor.length} assets on ${scanTimeframe}...`,
    );
    await logSystemEvent(
      DEFAULT_USER_ID,
      "SYSTEM",
      "PILOT_SCAN",
      `${coinsToMonitor.length} varlık pilot taramasında (${scanTimeframe}).`,
    );


    for (const symbol of coinsToMonitor) {
      try {
        const strategy = new MatrixV5Strategy(symbol, {
          timeframe: "1m",
          minAiScore: botConfig.ai_threshold || 65,
        });

        const signal = await strategy.analyze();
        if (signal) {
          const isWhale = !!signal.indicators?.whaleDetected;

          if (signal.signal) {
            if (signal.signal === "BUY") {
              await handleBuySignal({ pair: symbol, userId: DEFAULT_USER_ID });
            } else if (signal.signal === "SELL") {
              await handleSellSignal({ pair: symbol, userId: DEFAULT_USER_ID });
            }
          }

          // Log Signal/Event to database
          await createStrategySignal({
            strategy_id: undefined,
            symbol: symbol,
            signal_type: signal.signal || (isWhale ? "WHALE" : "INFO"),
            price: signal.targets?.t1,
            timestamp: Date.now(),
            executed: !!signal.signal,
            execution_result: {
              message:
                signal.reason || `Pilot ON: ${symbol} için analiz tamamlandı.`,
            },
          });
        }
        
      } catch (err) {
        console.error(`[PilotEngine] Failed to analyze ${symbol}:`, err);
      }
    }

  } catch (error) {
    console.error("[PilotEngine] Critical error:", error);
  }
}
