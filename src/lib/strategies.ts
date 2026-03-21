import { getKlines } from "./mexc";
import { calculateRSI, calculateMACD, calculateSMA, getLatestIndicators } from "./indicators";
import { getBotConfig, resolveTradeMode } from "./db";

// Simple logger replacement to avoid dependency on winston for now
const logger = {
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => console.log(msg, meta),
};

import { getMtfConsensus } from "./mtf-engine";


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
  mtfLongThreshold?: number;
  mtfShortThreshold?: number;
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
      f4Multiplier: this.parameters.f4_multiplier ? Number(this.parameters.f4_multiplier) : 1.0,
      whaleVolumeMultiplier: this.parameters.whaleVolumeMultiplier ? Number(this.parameters.whaleVolumeMultiplier) : undefined,
      mtfThreshold: this.parameters.mtfThreshold ? Number(this.parameters.mtfThreshold) : 80,
      f4SlopeThreshold: 0.01,
      f4PowerLossThreshold: this.parameters.f4PowerLossThreshold ? Number(this.parameters.f4PowerLossThreshold) : 90,
      f4LookbackBars: this.parameters.f4LookbackBars ? Number(this.parameters.f4LookbackBars) : 30,
      longSqueezeThreshold: this.parameters.f4SqueezeThreshold ? Number(this.parameters.f4SqueezeThreshold) : 20,
      shortSqueezeThreshold: this.parameters.f4SqueezeThreshold ? Number(this.parameters.f4SqueezeThreshold) : 20,
      minPowerLoss: this.parameters.minPowerLoss ? Number(this.parameters.minPowerLoss) : 90,
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
        | "1d"
        | "1Mo";
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
      const originalSignal = signalType; // Save original intent

      let reasonText = `[MatrixV5] ${result.whaleSignalText ? result.whaleSignalText + " | " : ""}AI: ${result.aiScore} | ⚡ F4: ${Math.round(result.f4Power)}%`;

      // [URGENT] F4 Mandate: Only generate signals if F4 is active
      const isF4Active = !!(result.f4EarlyBuy || result.f4ConfirmedBuy || result.f4EarlySell || result.f4ConfirmedSell);
      if (!isF4Active) {
        return null;
      }

      // V5.5 Optimization: True MTF Consensus Veto
      let mtfScore = 50;
      let mtfVerdictText = "ATLANDI";

      if (originalSignal) {
        const engineBullCount = result.indicatorBullCount ?? result.mtfBullCount ?? 0;
        const consensus = await getMtfConsensus(this.symbol, timeframeStr, engineBullCount);
        mtfScore = consensus.score;
        mtfVerdictText = consensus.verdictText;

        const isEarly = !!(result.f4EarlyBuy || result.f4EarlySell);
        const veto = this.applyMtfVeto(originalSignal, mtfScore, mtfVerdictText, isEarly);
        signalType = veto.signal; // Can become null
        reasonText += veto.reasonExtension;
      }

      // Visibility Optimization: If vetoed, we still return the signal but marked as VETOED
      const isVetoed = originalSignal && !signalType;

      // Final check: if we have no signal (BUY/SELL) and no Whale, return null unless AI is very high OR it was vetoed
      if (!signalType && !result.whaleDetected && result.aiScore < 80 && !isVetoed) {
        return null;
      }

      return {
        symbol: this.symbol,
        strategy: "matrix_v5",
        signal: signalType, // This will be null if vetoed, but reasonText will have 🛑
        price: closes[closes.length - 1],
        reason: reasonText,
        indicators: {
          aiScore: Number(result.aiScore) || 0,
          confluence: Number(result.confluenceScore) || 0,
          regime: String(result.regimePrediction || ""),
          prediction: String(result.prediction?.text || ""),
          whaleDetected: !!result.whaleDetected,
          whaleStatus: String(result.whaleStatus || ""),
          mtfWeightedScore: Number(mtfScore) || 50,
          mtfVerdict: String(mtfVerdictText || "N/A"),
          fundingRate: Number(result.fundingRate) || 0,
          fundingImpact: String(result.fundingImpact || ""),
          f4PowerLoss: Number(result.f4PowerLoss) || 0,
          f4Power: Number(result.f4Power) || 0,
          f4EarlyBuy: !!result.f4EarlyBuy,
          f4EarlySell: !!result.f4EarlySell,
          f4ConfirmedBuy: !!result.f4ConfirmedBuy,
          f4ConfirmedSell: !!result.f4ConfirmedSell,
          originalIntent: originalSignal || "" // Hidden metadata, ensure not null
        },
        targets: result.targets || { t1: 0, t2: 0, sl: 0 },
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
   * Applies Multi-Timeframe Veto logic based on consensus score.
   */
  private applyMtfVeto(
    signal: "BUY" | "SELL" | null,
    mtfScore: number,
    mtfVerdictText: string,
    isEarly: boolean = false
  ): { signal: "BUY" | "SELL" | null; reasonExtension: string } {
    const mtfVetoEnabled = this.parameters.mtfVeto !== false;
    
    // Yeni asimetrik eşikler (UI'dan gelen veya fallback)
    const mtfLongThreshold = Number(this.parameters.mtfLongThreshold || this.parameters.mtfThreshold) || 70;
    const mtfShortThreshold = Number(this.parameters.mtfShortThreshold || (100 - mtfLongThreshold)) || 30;

    let finalSignal = signal;
    let reasonExtension = "";

    if (mtfVetoEnabled) {
      if (signal === "BUY" && mtfScore < mtfLongThreshold) {
        reasonExtension = ` | 🛑 MTF Long Veto: Boğa Gücü (%${mtfScore.toFixed(0)}) yetersiz. (Gerekli: %${mtfLongThreshold}+, ${mtfVerdictText})`;
        finalSignal = null;
      } else if (signal === "SELL" && mtfScore > mtfShortThreshold) {
        const bearPower = (100 - mtfScore).toFixed(0);
        const bearRequired = (100 - mtfShortThreshold).toFixed(0);
        reasonExtension = ` | 🛑 MTF Short Veto: Ayı Gücü (%${bearPower}) yetersiz. (Gerekli: %${bearRequired}+, ${mtfVerdictText})`;
        finalSignal = null;
      } else if (isEarly) {
        // [STRICT] If it's early but trend is strongly opposite, veto it anyway
        if (signal === "BUY" && mtfScore < 50) {
          reasonExtension = ` | 🛑 MTF Trend Veto: Erken sinyal ama trend AYI/ZAYIF (%${mtfScore.toFixed(0)}), LONG iptal.`;
          finalSignal = null;
        } else if (signal === "SELL" && mtfScore > 50) {
          reasonExtension = ` | 🛑 MTF Trend Veto: Erken sinyal ama trend BOĞA/GÜÇLÜ (%${mtfScore.toFixed(0)}), SHORT iptal.`;
          finalSignal = null;
        } else {
          reasonExtension = ` | ⚡ Erken Giriş Onayı (MTF ${mtfVerdictText})`;
        }
      }
    } else {
      reasonExtension = ` | ℹ️ MTF Check: ${mtfVerdictText} (Veto Devre Dışı)`;
    }
    return { signal: finalSignal, reasonExtension };
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
      f4Alpha: { type: "number", default: 0.95, min: 0.1, max: 0.99 },
      f4SlopeThreshold: { type: "number", default: 0.01, min: 0.001, max: 1.0 },
    },
  },
};
