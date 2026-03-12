import { MatrixV5Strategy } from "@/lib/strategies";
import { fetchKlines } from "@/lib/mexc";
import {
  createStrategySignalsBulk,
  getRecentSignalsBulk,
  StrategySignalInput,
} from "@/lib/db";
import { getAccountInfo } from "@/lib/mexc-wrapper";
import { getBotConfig, resolveTradeMode, BotConfig } from "@/lib/db";


const DEFAULT_SCAN_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
];

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export interface ScanResult {
  symbol: string;
  signalType: string;
  price: number;
  detail: string;
  aiScore: number;
  inserted: boolean;
  vetoReason?: string;
}

export class SignalScanner {
  static async resolveScanSymbols(
    userId: number,
    mode: "test" | "production" = "test",
  ): Promise<string[]> {
    const account = await getAccountInfo(userId, mode);
    const holdingsSymbols = (account?.balances || [])
      .filter(
        (b: { free: string; locked: string }) =>
          parseFloat(b.free) + parseFloat(b.locked) > 0,
      )
      .map((b: { asset: string }) => `${b.asset}USDT`)
      .filter((s: string) => !s.startsWith("USDT") && !s.startsWith("USDC"));

    // Production mode optimization: Only scan what the user actually OWNS
    if (mode === "production") {
      return Array.from(new Set(holdingsSymbols)).slice(0, 50);
    }

    // Test/Demo mode: Scan holdings + major pairs
    return Array.from(
      new Set([...holdingsSymbols, ...DEFAULT_SCAN_SYMBOLS]),
    ).slice(0, 60);
  }

  static async runScan(symbols: string[], targetTimeframe?: string, mode: "test" | "production" = "test"): Promise<ScanResult[]> {
    const allResults: ScanResult[] = [];
    const allSignalsToInsert: StrategySignalInput[] = [];
    
    // Use targetTimeframe if provided, otherwise default to a conservative set
    const TIMEFRAMES = targetTimeframe ? [targetTimeframe] : ["1h", "4h"];

    // P4.3: Pre-fetch botConfig once for the entire scan to reduce DB load
    let botConfig: BotConfig | undefined;
    try {
      botConfig = await getBotConfig();
    } catch { /* defaults handled in scanSymbol */ }


    // P4.1: Fetch all recent signals for the entire set in one go to prevent N+1 queries
    const recentSignals = await getRecentSignalsBulk(symbols, DEDUP_WINDOW_MS, mode);


    // Group by symbol_timeframe for O(1) lookup
    const recentSignalsMap = new Map<string, string[]>();
    recentSignals.forEach((s) => {
      const key = `${s.symbol}_${s.timeframe || "1h"}`;
      const list = recentSignalsMap.get(key) || [];
      list.push(s.signal_type);
      recentSignalsMap.set(key, list);
    });

    const scanTasks: Array<{symbol: string, tf: string, existingTypes: string[]}> = [];
    for (const symbol of symbols) {
      for (const tf of TIMEFRAMES) {
        const key = `${symbol}_${tf}`;
        scanTasks.push({
          symbol,
          tf,
          existingTypes: recentSignalsMap.get(key) || []
        });
      }
    }

    // P3.2 PERFORMANCE: Bounded parallel scan (concurrency: 8)
    const CONCURRENCY = 8;
    for (let i = 0; i < scanTasks.length; i += CONCURRENCY) {
      const chunk = scanTasks.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(t => this.scanSymbol(t.symbol, t.existingTypes, t.tf, mode, botConfig))
      );

      chunkResults.forEach((res, index) => {
        const task = chunk[index];
        if (res.status === "fulfilled") {
          allResults.push(...res.value.results);
          allSignalsToInsert.push(...res.value.signalsToInsert);
        } else {
          console.error(`[SignalScanner] Error scanning ${task.symbol} on ${task.tf}:`, res.reason);
        }
      });
    }

    if (allSignalsToInsert.length > 0) {
      await createStrategySignalsBulk(allSignalsToInsert);
    }

    return allResults;
  }

  private static async scanSymbol(
    symbol: string,
    existingTypes: string[],
    interval: string = "4h",
    tradingMode: "test" | "production" = "test",
    botConfig?: BotConfig
  ): Promise<{
    results: ScanResult[];
    signalsToInsert: StrategySignalInput[];
  }> {
    const results: ScanResult[] = [];
    const signalsToInsert: StrategySignalInput[] = [];

    try {
      const config = botConfig || await getBotConfig();

      // P4.1 Optimizer: Pre-fetch klines here and pass to strategy if possible, 
      // but since MatrixV5Strategy expects to fetch its own for analysis consistency,
      // we at least ensure we don't fetch the EXACT same 1-candle kline twice.
      const strategy = new MatrixV5Strategy(symbol, {
        timeframe: interval,
        minAiScore: config.ai_threshold || 65,
        mtfVeto: config.pilot_mtf_veto,
        mtfThreshold: config.pilot_mtf_threshold
      });

      const signal = await strategy.analyze();
      if (!signal) return { results, signalsToInsert };

      const timestamp = Date.now();
      const currentPrice = signal.price || 0;
      
      // Fetch actual volume from recent klines for better metadata
      // P4.1 Optimizer: We still need volume, but the strategy.analyze already fetched klines.
      // Ideally we'd expose volume from StrategySignal, but for now we note the redundancy.
      const recentKlines = await fetchKlines(symbol, interval, 1);
      const volume = recentKlines?.[0]?.volume || 0;

      let signalType = signal.signal || (signal.indicators.whaleDetected ? "WHALE" : "INFO");
      
      // Check for veto
      let vetoReason: string | undefined = undefined;
      if (signal.reason && signal.reason.includes("🛑")) {
        vetoReason = signal.reason.split("🛑")[1].trim();
      }

      // If already exists, skip
      if (existingTypes.includes(signalType)) {
        const detailPrefix = vetoReason ? `VETOED: ${vetoReason}` : signal.reason;
        results.push({
          symbol,
          signalType,
          price: currentPrice,
          detail: `${detailPrefix} (deduplicated)`,
          aiScore: Number(signal.indicators.aiScore) || 0,
          inserted: false,
          vetoReason
        });
        return { results, signalsToInsert };
      }

      const detailWithTimeframe = vetoReason ? `🛑 VETOED: ${vetoReason} (${interval})` : `${signal.reason} (${interval})`;

      results.push({
        symbol,
        signalType,
        price: currentPrice,
        detail: detailWithTimeframe,
        aiScore: Number(signal.indicators.aiScore) || 0,
        inserted: true,
        vetoReason
      });

      signalsToInsert.push({
        symbol,
        signal_type: signalType,
        price: currentPrice,
        volume: volume,
        timestamp,
        executed: false,
        execution_result: { ...signal.indicators, reason: signal.reason, targets: (signal as any).targets, aiScore: (signal.indicators as any).aiScore },
        timeframe: interval,
        trading_mode: tradingMode,
        veto_reason: vetoReason
      });

      return { results, signalsToInsert };
    } catch (err) {
      console.error(`[SignalScanner] scanSymbol failure for ${symbol}:`, err);
      return { results, signalsToInsert };
    }
  }
}
