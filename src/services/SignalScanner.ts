import { MatrixV5Engine } from "@/lib/matrix-v5-engine";
import { fetchKlines } from "@/lib/mexc";
import {
  createStrategySignalsBulk,
  getRecentSignalsBulk,
  StrategySignalInput,
} from "@/lib/db";
import { getAccountInfo } from "@/lib/mexc-wrapper";

const engine = new MatrixV5Engine();

const DEFAULT_SCAN_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "BNBUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "POLUSDT",
  "SHIBUSDT",
  "LTCUSDT",
  "TRXUSDT",
  "UNIUSDT",
  "ATOMUSDT",
  "OPUSDT",
  "ARBUSDT",
  "APTUSDT",
  "FILUSDT",
  "NEARUSDT",
  "HBARUSDT",
  "ETCUSDT",
  "AAVEUSDT",
  "RENDERUSDT",
];

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export interface ScanResult {
  symbol: string;
  signalType: string;
  price: number;
  detail: string;
  aiScore: number;
  inserted: boolean;
}

interface EngineResult {
  aiScore: number;
  systemDecision: string;
  prediction?: { text?: string };
  trend: string;
  whaleStatus: string;
  whaleSignalText?: string;
  smc: { bos: boolean; choch: boolean; swingTrend: string };
  inPremium: boolean;
  inDiscount: boolean;
  f4EarlyBuy: boolean;
  f4ConfirmedBuy: boolean;
  f4EarlySell: boolean;
  f4ConfirmedSell: boolean;
  slope: number;
  acceleration: number;
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

    return Array.from(
      new Set([...holdingsSymbols, ...DEFAULT_SCAN_SYMBOLS]),
    ).slice(0, 60);
  }

  static async runScan(symbols: string[]): Promise<ScanResult[]> {
    const allResults: ScanResult[] = [];
    const allSignalsToInsert: StrategySignalInput[] = [];
    const batchSize = 3; // Reduced batch size to accommodate multiple timeframes per symbol
    const TIMEFRAMES = ["1m", "15m", "1h", "4h", "1d", "1w"]; // 1M excluded to prevent insufficient klines

    // P4.1: Fetch all recent signals for the entire set in one go to prevent N+1 queries
    const recentSignals = await getRecentSignalsBulk(symbols, DEDUP_WINDOW_MS);

    // Group by symbol_timeframe for O(1) lookup
    const recentSignalsMap = new Map<string, string[]>();
    recentSignals.forEach((s) => {
      const key = `${s.symbol}_${s.timeframe || "1m"}`;
      const list = recentSignalsMap.get(key) || [];
      list.push(s.signal_type);
      recentSignalsMap.set(key, list);
    });

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = [];

      // For each symbol in the batch, scan ALL timeframes concurrently
      for (const symbol of batch) {
        for (const tf of TIMEFRAMES) {
          const key = `${symbol}_${tf}`;
          const existingTypes = recentSignalsMap.get(key) || [];
          batchPromises.push(
            this.scanSymbol(symbol, existingTypes, tf).catch((err) => {
              console.error(
                `[SignalScanner] Error scanning ${symbol} on ${tf}:`,
                err.message,
              );
              return { results: [], signalsToInsert: [] };
            }),
          );
        }
      }

      const batchResults = await Promise.all(batchPromises);

      for (const item of batchResults) {
        allResults.push(...item.results);
        allSignalsToInsert.push(...item.signalsToInsert);
      }
    }

    if (allSignalsToInsert.length > 0) {
      await createStrategySignalsBulk(allSignalsToInsert);
    }

    return allResults;
  }

  private static async scanSymbol(
    symbol: string,
    existingTypes: string[],
    interval: string = "1m",
  ): Promise<{
    results: ScanResult[];
    signalsToInsert: StrategySignalInput[];
  }> {
    const results: ScanResult[] = [];
    const klines = await fetchKlines(symbol, interval, 200);
    if (!klines || klines.length < 50) return { results, signalsToInsert: [] };

    const closes = klines.map((k) => k.close);
    const highs = klines.map((k) => k.high);
    const lows = klines.map((k) => k.low);
    const volumes = klines.map((k) => k.volume);

    const result = engine.analyze(
      closes,
      highs,
      lows,
      volumes,
      interval,
      "normal",
    ) as unknown as EngineResult;
    const currentPrice = closes[closes.length - 1];
    const volume = volumes[volumes.length - 1];

    const candidates = this.evaluateSignals(symbol, result);

    const newSignals = candidates.filter(
      (c) => !existingTypes.includes(c.signalType),
    );
    const deduplicatedSignals = candidates.filter((c) =>
      existingTypes.includes(c.signalType),
    );

    for (const sig of deduplicatedSignals) {
      results.push({
        symbol,
        signalType: sig.signalType,
        price: currentPrice,
        detail: `${sig.signalType} (deduplicated)`,
        aiScore: result.aiScore,
        inserted: false,
      });
    }

    const signalsToInsert = newSignals.map((sig) => {
      const detailWithTimeframe = {
        ...sig.detail,
        detail: `${sig.detail.detail} (${interval})`,
      };

      results.push({
        symbol,
        signalType: sig.signalType,
        price: currentPrice,
        detail: String(detailWithTimeframe.detail),
        aiScore: result.aiScore,
        inserted: true,
      });

      return {
        symbol,
        signal_type: sig.signalType,
        price: currentPrice,
        volume: volume || 0,
        timestamp: Date.now(),
        executed: false,
        execution_result: detailWithTimeframe,
        timeframe: interval,
      };
    });

    return { results, signalsToInsert };
  }

  private static evaluateSignals(
    _symbol: string,
    result: EngineResult,
  ): { signalType: string; detail: Record<string, unknown> }[] {
    const signals: { signalType: string; detail: Record<string, unknown> }[] =
      [];

    if (result.aiScore >= 75 && result.systemDecision !== "WAIT") {
      const signalType =
        result.systemDecision === "GO_LONG"
          ? "BUY"
          : result.systemDecision === "GO_SHORT"
            ? "SELL"
            : "AI_ANALYSIS";
      signals.push({
        signalType,
        detail: {
          detail: `AI Skoru: ${result.aiScore} | ${result.prediction?.text || result.systemDecision} | Trend: ${result.trend}`,
          aiScore: result.aiScore,
          trend: result.trend,
        },
      });
    }

    if (result.whaleStatus && result.whaleStatus !== "NEUTRAL") {
      signals.push({
        signalType: "WHALE",
        detail: {
          detail: ` Whale: ${result.whaleSignalText || result.whaleStatus}`,
          whaleStatus: result.whaleStatus,
        },
      });
    }

    if (result.smc?.bos || result.smc?.choch) {
      const structureType = result.smc.bos ? "BOS" : "CHoCH";
      signals.push({
        signalType: structureType,
        detail: {
          detail: ` ${structureType}: ${result.smc.swingTrend} | Premium: ${result.inPremium ? "EVET" : "HAYIR"} | Discount: ${result.inDiscount ? "EVET" : "HAYIR"}`,
          smc: {
            bos: result.smc.bos,
            choch: result.smc.choch,
            swingTrend: result.smc.swingTrend,
          },
        },
      });
    }

    if (result.f4EarlyBuy || result.f4ConfirmedBuy) {
      const type = result.f4ConfirmedBuy ? "F4_CONFIRMED_BUY" : "F4_EARLY_BUY";
      signals.push({
        signalType: type,
        detail: {
          detail: ` F4 ${type.replace(/_/g, " ").replace("F4 ", "")}: Slope=${result.slope?.toFixed(4)} | Accel=${result.acceleration?.toFixed(4)}`,
        },
      });
    }

    if (result.f4EarlySell || result.f4ConfirmedSell) {
      const type = result.f4ConfirmedSell
        ? "F4_CONFIRMED_SELL"
        : "F4_EARLY_SELL";
      signals.push({
        signalType: type,
        detail: {
          detail: ` F4 ${type.replace(/_/g, " ").replace("F4 ", "")}: Slope=${result.slope?.toFixed(4)} | Accel=${result.acceleration?.toFixed(4)}`,
        },
      });
    }

    return signals;
  }
}
