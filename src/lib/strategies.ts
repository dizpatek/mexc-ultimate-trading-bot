import { getKlines } from "./mexc";
import { calculateRSI, calculateMACD, calculateSMA } from "./indicators";
import { getBotConfig, resolveTradeMode } from "./db";

// Simple logger replacement to avoid dependency on winston for now
const logger = {
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => console.log(msg, meta),
};

// P4.3: Cache for MTF checks to avoid reaching API limits during bulk scans
const mtfResultsCache = new Map<string, { result: number | null; timestamp: number }>();
const pendingRequests = new Map<string, Promise<number | null>>();
const MTF_CACHE_TTL = 30000; // 30 seconds


export interface StrategySignal {
  symbol: string;
  strategy: string;
  signal: "BUY" | "SELL" | null;
  price: number;
  reason: string;
  indicators: Record<string, unknown>;
  targets?: { t1: number; t2: number; sl: number };
  timestamp: number;
}

export interface StrategyParameters {
  rsiPeriod?: number;
  overboughtLevel?: number;
  oversoldLevel?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  f4Length?: number;
  whaleVolumeMultiplier?: number;
  minAiScore?: number;
  timeframe?: string;
  mtfVeto?: boolean;
  mtfThreshold?: number;
  [key: string]: string | number | boolean | undefined;
}

// Base Strategy Class
abstract class BaseStrategy {
  symbol: string;
  parameters: StrategyParameters;

  constructor(symbol: string, parameters: StrategyParameters = {}) {
    this.symbol = symbol;
    this.parameters = parameters;
  }

  async getHistoricalData(limit: number = 100): Promise<number[]> {
    try {
      const timeframe = (this.parameters.timeframe as string) || "1h";
      const klines = await getKlines(this.symbol, timeframe, limit);
      // Klines: [time, open, high, low, close, volume, ...]
      return klines.map((k) => parseFloat(String(k[4]))); // Close prices
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get historical data for ${this.symbol}`, {
        error: message,
      });
      throw error;
    }
  }

  abstract analyze(): Promise<StrategySignal | null>;
}

// RSI Strategy
class RSIStrategy extends BaseStrategy {
  constructor(symbol: string, parameters: StrategyParameters = {}) {
    super(symbol, {
      rsiPeriod: 14,
      overboughtLevel: 70,
      oversoldLevel: 30,
      ...parameters,
    });
  }

  async analyze(): Promise<StrategySignal | null> {
    const prices = await this.getHistoricalData(200); // Need enough data for RSI
    const rsiValues = calculateRSI(prices, this.parameters.rsiPeriod || 14);

    if (rsiValues.length === 0) return null;

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2];

    let signal: "BUY" | "SELL" | null = null;
    let reason = "";
    const oversold = this.parameters.oversoldLevel!;
    const overbought = this.parameters.overboughtLevel!;

    // Oversold condition: RSI crosses above oversold level
    if (previousRSI <= oversold && currentRSI > oversold) {
      signal = "BUY";
      reason = `RSI crossed above ${oversold} (${currentRSI.toFixed(2)})`;
    }
    // Overbought condition: RSI crosses below overbought level
    else if (previousRSI >= overbought && currentRSI < overbought) {
      signal = "SELL";
      reason = `RSI crossed below ${overbought} (${currentRSI.toFixed(2)})`;
    }

    return {
      symbol: this.symbol,
      strategy: "rsi",
      signal,
      price: prices[prices.length - 1],
      reason,
      indicators: {
        rsi: currentRSI,
      },
      timestamp: Date.now(),
    };
  }
}

// MACD Strategy
class MACDStrategy extends BaseStrategy {
  constructor(symbol: string, parameters: StrategyParameters = {}) {
    super(symbol, {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      ...parameters,
    });
  }

  async analyze(): Promise<StrategySignal | null> {
    const prices = await this.getHistoricalData(200);
    const macd = calculateMACD(
      prices,
      this.parameters.fastPeriod,
      this.parameters.slowPeriod,
      this.parameters.signalPeriod,
    );

    if (macd.histogram.length < 2) return null;

    const currentHistogram = macd.histogram[macd.histogram.length - 1];
    const previousHistogram = macd.histogram[macd.histogram.length - 2];

    let signal: "BUY" | "SELL" | null = null;
    let reason = "";

    // Bullish crossover: histogram crosses above zero
    if (previousHistogram <= 0 && currentHistogram > 0) {
      signal = "BUY";
      reason = `MACD histogram crossed above zero (${currentHistogram.toFixed(6)})`;
    }
    // Bearish crossover: histogram crosses below zero
    else if (previousHistogram >= 0 && currentHistogram < 0) {
      signal = "SELL";
      reason = `MACD histogram crossed below zero (${currentHistogram.toFixed(6)})`;
    }

    return {
      symbol: this.symbol,
      strategy: "macd",
      signal,
      price: prices[prices.length - 1],
      reason,
      indicators: {
        macd: {
          macdLine: macd.macdLine[macd.macdLine.length - 1],
          signalLine: macd.signalLine[macd.signalLine.length - 1],
          histogram: currentHistogram,
        },
      },
      timestamp: Date.now(),
    };
  }
}

// Moving Average Crossover Strategy
class MACrossoverStrategy extends BaseStrategy {
  constructor(symbol: string, parameters: StrategyParameters = {}) {
    super(symbol, {
      fastPeriod: 20,
      slowPeriod: 50,
      ...parameters,
    });
  }

  async analyze(): Promise<StrategySignal | null> {
    const prices = await this.getHistoricalData(200);
    const fastMA = calculateSMA(prices, this.parameters.fastPeriod || 20);
    const slowMA = calculateSMA(prices, this.parameters.slowPeriod || 50);

    if (fastMA.length < 2 || slowMA.length < 2) return null;

    const currentFast = fastMA[fastMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousSlow = slowMA[slowMA.length - 2];

    let signal: "BUY" | "SELL" | null = null;
    let reason = "";

    // Golden cross: fast MA crosses above slow MA
    if (previousFast <= previousSlow && currentFast > currentSlow) {
      signal = "BUY";
      reason = `Fast MA (${this.parameters.fastPeriod}) crossed above Slow MA (${this.parameters.slowPeriod})`;
    }
    // Death cross: fast MA crosses below slow MA
    else if (previousFast >= previousSlow && currentFast < currentSlow) {
      signal = "SELL";
      reason = `Fast MA (${this.parameters.fastPeriod}) crossed below Slow MA (${this.parameters.slowPeriod})`;
    }

    return {
      symbol: this.symbol,
      strategy: "ma_crossover",
      signal,
      price: prices[prices.length - 1],
      reason,
      indicators: {
        fastMA: currentFast,
        slowMA: currentSlow,
      },
      timestamp: Date.now(),
    };
  }
}

import { MatrixV5Engine } from "./matrix-v5-engine";
import { runFullOrchestraAnalysis, buildOrchestraPrompt } from "./orchestrator-analysis";
import { fetchGroqAnalysis } from "./ai-provider";
import { fetchFundingRate } from "./market-data";

// Matrix V5 Strategy - Ultra Intelligent
// Matrix V5 Strategy - Ultra Intelligent
export class MatrixV5Strategy extends BaseStrategy {
  private engine: MatrixV5Engine;

  constructor(symbol: string, parameters: StrategyParameters = {}) {
    super(symbol, {
      f4Length: 10,
      whaleVolumeMultiplier: 1.8,
      minAiScore: 65,
      ...parameters,
    });

    this.engine = new MatrixV5Engine({
      f4Length: this.parameters.f4Length ? Number(this.parameters.f4Length) : undefined,
      whaleVolumeMultiplier: this.parameters.whaleVolumeMultiplier ? Number(this.parameters.whaleVolumeMultiplier) : undefined,
      mtfThreshold: this.parameters.mtfThreshold ? Number(this.parameters.mtfThreshold) : 80,
    });
  }

  async analyze(): Promise<StrategySignal | null> {
    const limit = 500;

    try {
      const timeframeStr = ((this.parameters.timeframe as string) || "1h") as
        | "1m"
        | "5m"
        | "15m"
        | "1h"
        | "4h"
        | "1d";
      const klines = await getKlines(this.symbol, timeframeStr, limit);
      if (!klines || klines.length < 200) return null;

      const opens = klines.map((k) => parseFloat(String(k[1])));
      const highs = klines.map((k) => parseFloat(String(k[2])));
      const lows = klines.map((k) => parseFloat(String(k[3])));
      const closes = klines.map((k) => parseFloat(String(k[4])));
      const volumes = klines.map((k) => parseFloat(String(k[5])));

      const riskMode =
        (this.parameters.riskMode as "safe" | "normal" | "aggressive") ||
        "normal";
      const tradeMode = (this.parameters.tradeMode as "Scalp" | "Swing") || "Scalp";

      const fundingRate = await fetchFundingRate(this.symbol);

      const result = this.engine.analyze(
        closes,
        highs,
        lows,
        volumes,
        timeframeStr,
        riskMode,
        fundingRate || 0,
        { tradeMode, mtfThreshold: Number(this.parameters.mtfThreshold) || 80 },
        opens
      );

      let signalType: "BUY" | "SELL" | null = result.signal;
      let reasonText = `[MatrixV5] ${result.whaleSignalText ? result.whaleSignalText + " | " : ""}AI: ${result.aiScore} | ⚡ F4: ${Math.round(result.f4Power)}%`;

      // [URGENT] F4 Mandate: Only generate signals if F4 is active
      const isF4Active = !!(result.f4EarlyBuy || result.f4ConfirmedBuy || result.f4EarlySell || result.f4ConfirmedSell);
      if (!isF4Active) {
        return null;
      }

      // V5.5 Optimization: True MTF Consensus Veto
      let mtfScore = 50;
      let mtfVerdictText = "ATLANDI";

      if (signalType) {
        const consensus = await this.getMtfConsensus(timeframeStr, result);
        mtfScore = consensus.score;
        mtfVerdictText = consensus.verdictText;

        const veto = this.applyMtfVeto(signalType, mtfScore, mtfVerdictText);
        signalType = veto.signal;
        reasonText += veto.reasonExtension;
      }

      // Final check: if we have no signal (BUY/SELL) and no Whale, return null unless AI is very high
      if (!signalType && !result.whaleDetected && result.aiScore < 80) {
        if (reasonText.includes("🛑 MTF Veto")) {
          signalType = "NONE" as any;
        } else {
          return null;
        }
      }

      return {
        symbol: this.symbol,
        strategy: "matrix_v5",
        signal: signalType,
        price: closes[closes.length - 1],
        reason: reasonText,
        indicators: {
          aiScore: result.aiScore,
          confluence: result.confluenceScore,
          regime: result.regimePrediction,
          prediction: result.prediction.text,
          whaleDetected: result.whaleDetected,
          whaleStatus: result.whaleStatus,
          mtfWeightedScore: mtfScore,
          mtfVerdict: mtfVerdictText,
          fundingRate: result.fundingRate,
          fundingImpact: result.fundingImpact,
          f4PowerLoss: result.f4PowerLoss,
          f4Power: result.f4Power,
          f4EarlyBuy: result.f4EarlyBuy,
          f4EarlySell: result.f4EarlySell,
          f4ConfirmedBuy: result.f4ConfirmedBuy,
          f4ConfirmedSell: result.f4ConfirmedSell,
        },
        targets: result.targets,
        timestamp: Date.now(),
      };


    } catch (error: unknown) {
      console.error(
        `[MatrixV5Strategy] Analyze Error for ${this.symbol}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Calculates MTF Consensus score by scanning multiple timeframes.
   */
  private async getMtfConsensus(currentTimeframe: string, engineResult: any): Promise<{ score: number; verdictText: string }> {
    const tfsToScan: ("15m" | "1h" | "4h" | "1d")[] = ["15m", "1h", "4h", "1d"];
    const tfsToFetch = tfsToScan.filter((tf) => tf !== currentTimeframe);

    const engineBullCount = (engineResult as any).indicatorBullCount ?? (engineResult as any).mtfBullCount ?? 0;
    let mtfBullCount = engineBullCount >= 3 ? 1 : 0;
    let mtfTotal = 1;

    try {
      const mtfResults = await Promise.all(
        tfsToFetch.map(async (tf) => {
          return await this.performLiteMtfCheck(tf);
        })
      );

      for (const res of mtfResults) {
        if (res !== null) {
          mtfBullCount += res;
          mtfTotal++;
        }
      }
    } catch (err) {
      console.error(`[MTF-Lite] Parallel check failed for ${this.symbol}:`, err);
    }

    const score = mtfTotal > 0 ? (mtfBullCount / mtfTotal) * 100 : 50;
    const verdictText = `${mtfBullCount}/${mtfTotal} TF Sinyal`;
    return { score, verdictText };
  }

  /**
   * Applies Multi-Timeframe Veto logic based on consensus score.
   */
  private applyMtfVeto(
    signal: "BUY" | "SELL" | null,
    mtfScore: number,
    mtfVerdictText: string
  ): { signal: "BUY" | "SELL" | null; reasonExtension: string } {
    const mtfVetoEnabled = this.parameters.mtfVeto !== false; // Default to true if not explicitly false
    const mtfThreshold = Number(this.parameters.mtfThreshold) || 80;
    let finalSignal = signal;
    let reasonExtension = "";

    if (mtfVetoEnabled) {
      if (signal === "BUY" && mtfScore < mtfThreshold) {
        reasonExtension = ` | 🛑 MTF Veto: Trend (${mtfVerdictText}) zayıf (Threshold: ${mtfThreshold}%).`;
        finalSignal = null;
      } else if (signal === "SELL" && mtfScore > 100 - mtfThreshold) {
        reasonExtension = ` | 🛑 MTF Veto: Trend (${mtfVerdictText}) zayıf (Threshold: ${mtfThreshold}%).`;
        finalSignal = null;
      }
    } else {
      reasonExtension = ` | ℹ️ MTF Check: ${mtfVerdictText} (Veto Disabled)`;
    }
    return { signal: finalSignal, reasonExtension };
  }

  /**
   * P4.2: Separating lite trend detection logic for better quality.
   * Optimized with request deduplication to prevent rate-limit flooding.
   */
  private async performLiteMtfCheck(tf: string): Promise<number | null> {
    const cacheKey = `${this.symbol}_${tf}`;
    
    // 1. Check Memory Cache
    const cached = mtfResultsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MTF_CACHE_TTL) {
      return cached.result;
    }

    // 2. Check for Pending Request (Deduplication)
    const existingPromise = pendingRequests.get(cacheKey);
    if (existingPromise) return existingPromise;

    // 3. Perform Fetch with Lock
    const fetchPromise = (async () => {
      try {
        const klines = await getKlines(this.symbol, tf, 50);
        if (klines && klines.length >= 21) {
          const closes = klines.map((k) => parseFloat(String(k[4])));
          const lastClose = closes[closes.length - 1];
          const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const result = lastClose > ema20 ? 1 : 0;
          mtfResultsCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }
      } catch (e) {
        console.warn(`[MTF-Lite] Fetch error for ${this.symbol} on ${tf}:`, e);
      } finally {
        pendingRequests.delete(cacheKey);
      }
      return null;
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }
}

// Strategy Factory
export function createStrategy(
  type: string,
  symbol: string,
  parameters: StrategyParameters = {},
): BaseStrategy {
  switch (type) {
    case "rsi":
      return new RSIStrategy(symbol, parameters);
    case "macd":
      return new MACDStrategy(symbol, parameters);
    case "ma_crossover":
      return new MACrossoverStrategy(symbol, parameters);
    case "matrix_v3": // V3 is now superseded by V5 but kept for backward-compat mapping
    case "matrix_v5":
      return new MatrixV5Strategy(symbol, parameters);
    default:
      throw new Error(`Unknown strategy type: ${type}`);
  }
}

// Available strategies
export const AVAILABLE_STRATEGIES: Record<
  string,
  { name: string; description: string; parameters: Record<string, unknown> }
> = {
  rsi: {
    name: "RSI Strategy",
    description: "Generates signals based on RSI overbought/oversold levels",
    parameters: {
      rsiPeriod: { type: "number", default: 14, min: 2, max: 50 },
      overboughtLevel: { type: "number", default: 70, min: 50, max: 90 },
      oversoldLevel: { type: "number", default: 30, min: 10, max: 50 },
    },
  },
  macd: {
    name: "MACD Strategy",
    description: "Generates signals based on MACD histogram crossovers",
    parameters: {
      fastPeriod: { type: "number", default: 12, min: 5, max: 50 },
      slowPeriod: { type: "number", default: 26, min: 10, max: 100 },
      signalPeriod: { type: "number", default: 9, min: 5, max: 50 },
    },
  },
  ma_crossover: {
    name: "MA Crossover Strategy",
    description: "Generates signals based on moving average crossovers",
    parameters: {
      fastPeriod: { type: "number", default: 20, min: 5, max: 100 },
      slowPeriod: { type: "number", default: 50, min: 10, max: 200 },
    },
  },
  matrix_v3: {
    name: "Matrix F4 Ultimate V3",
    description:
      "Advanced trend following with Whale Volume & Linear Regression Momentum",
    parameters: {
      f4Length: { type: "number", default: 10, min: 5, max: 50 },
      whaleVolumeMultiplier: {
        type: "number",
        default: 1.8,
        min: 1.1,
        max: 5.0,
      },
      minAiScore: { type: "number", default: 65, min: 0, max: 100 },
    },
  },
  matrix_v5: {
    name: "Matrix F4 Ultimate V5",
    description:
      "Ultra Advanced GIGA MASTER AI Engine with TF-Adaptive Indicators",
    parameters: {
      f4Length: { type: "number", default: 10, min: 5, max: 50 },
      whaleVolumeMultiplier: {
        type: "number",
        default: 1.8,
        min: 1.1,
        max: 5.0,
      },
      mtfThreshold: { type: "number", default: 80, min: 0, max: 100 },
    },
  },
};
