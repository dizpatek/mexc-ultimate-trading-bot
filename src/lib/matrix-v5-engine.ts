/**
 * Matrix V5 Intelligent Engine
 * Ported from "Matrix F4 V5 Intelligent" Pine Script
 *
 * V5 Enhancements over V3:
 * 1. TF-Adaptive Indicator Scaling (tfAdaptFactor)
 * 2. 10+ New Indicators (RSI, MACD, SuperTrend, StochRSI, ADX, VWAP, EMA Ribbon, Ichimoku)
 * 3. 6-Category Confluence Engine (Tech, Momentum, Volume, Trend, Market, Timing)
 * 4. Prediction Engine (Probability-based direction forecasting)
 * 5. Enhanced Whale Engine (TF-adaptive thresholds)
 * 6. ADM (Asset Drift Model) & VPA (Volume Price Analysis)
 * 7. GIGA MASTER AI Score (Combined formula)
 */
import { evaluateSAE, SAEInput } from "./engine/signal-arbitration";

// ===========================
// TYPES & INTERFACES
// ===========================

export interface MatrixV5Config {
  f4Length: number;
  fiboLength: number;
  f4SlopeThreshold: number;
  whaleVolumeMultiplier: number;
  minAiScore: number;
  minConfluenceScore: number;
  useWhaleEngine: boolean;
  tradeMode: "Scalp" | "Swing";
  // Confluence Weights
  confluenceWeightTech: number;
  confluenceWeightMomentum: number;
  confluenceWeightVol: number;
  confluenceWeightTrend: number;
  confluenceWeightMarket: number;
  confluenceWeightTiming: number;
  // Indicator Settings
  rsiPeriod: number;
  rsiOB: number;
  rsiOS: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stFactor: number;
  stAtrPeriod: number;
  stochRsiLen: number;
  stochK: number;
  stochD: number;
  adxPeriod: number;
  adxThreshold: number;
  // V5.3/V5.4 Additions
  f4PowerLossThreshold: number;
  f4LookbackBars: number;
  f4SqueezeThreshold: number;
  useTrendSafety: boolean;
  riskTolerance: number;
  maFast: number;
  maSlow: number;
  maSignal: number;
  mtfThreshold: number;
  useHeikinAshi: boolean;
  minPowerLoss: number;
  // Squeeze logic separation
  longSqueezeThreshold: number;
  shortSqueezeThreshold: number;
}

export type MarketRegime = "RISK_ON" | "RISK_OFF" | "NEUTRAL";
export type VolatilityRegime = "SQUEEZE" | "EXPLOSION" | "HIGH_VOL" | "NORMAL";
export type RegimePrediction =
  | "ACCELERATING_TREND"
  | "DECELERATING_TREND"
  | "ACCELERATING_DROP"
  | "BOTTOM_FINDING"
  | "RANGE"
  | "STOPPING_VOLUME"
  | "PRE_EXPLOSION"
  | "DIP_OPPORTUNITY"
  | "EXHAUSTION"
  | "EARLY_REVERSAL_UP"
  | "EARLY_REVERSAL_DOWN"
  | "TRANSITION";
export type SystemDecision = "GO_LONG" | "GO_SHORT" | "WAIT";
export type ConfluenceStatus =
  | "MÜKEMMEL"
  | "GÜÇLÜ"
  | "ORTA"
  | "ZAYIF"
  | "YETERSİZ";

export interface V5IndicatorState {
  name: string;
  value: string;
  state: string;
  color: "green" | "red" | "gray" | "orange";
  numericValue?: number;
}

export interface ConfluenceBreakdown {
  techScore: number;
  momentumScore: number;
  volumeScore: number;
  trendScore: number;
  marketScore: number;
  timingScore: number;
  totalScore: number;
  status: ConfluenceStatus;
}

export interface PredictionResult {
  upProb: number;
  downProb: number;
  text: string;
  direction: "UP" | "DOWN" | "FLAT";
}

export interface ADMResult {
  classification: number; // -2, -1, 0, 1, 2
  evidence: "GÜÇLÜ" | "ZAYIF" | "YOK";
  bias: string; // "Pozitif Sapma", "Negatif Sapma", etc.
  direction: number; // -1, 0, 1
}

export interface VPAResult {
  buyVolume: number;
  sellVolume: number;
  delta: number;
  netPressure: number; // -100 to +100
  state: "ALIM BASKISI" | "SATIM BASKISI" | "NÖTR";
}

export interface OrderBlock {
  high: number;
  low: number;
  time: number;
  index: number;
  type: "BULLISH" | "BEARISH";
}

export interface FairValueGap {
  top: number;
  bottom: number;
  type: "BULLISH" | "BEARISH";
}

export interface SMCResult {
  swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  internalTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  bos: boolean;
  choch: boolean;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
}

export interface LiquidityResult {
  eqHighs: boolean;
  eqLows: boolean;
}

// Legacy V3 compat
export interface AiScoreComponents {
  whaleConfirmed: number;
  regimeAlignment: number;
  volumePower: number;
  trendAlignment: number;
  mtfConsensus: number;
  momentumAccel: number;
  volatilityRegime: number;
  zScore: number;
  bayesianWinRate: number;
  trapPenalty: number;
}

export interface MatrixV5Result {
  symbol: string;
  // Legacy V3 fields (backward compat)
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  slope: number;
  acceleration: number;
  whaleDetected: boolean;
  whaleStatus:
    | "RALLY_PREP"
    | "DISTRIBUTION"
    | "TRAP"
    | "BUY_ACTIVE"
    | "SELL_ACTIVE"
    | "NEUTRAL";
  signal: "BUY" | "SELL" | null;
  f4Value: number;
  f4FiboValue: number;
  aiScore: number;
  aiComponents: AiScoreComponents;
  marketRegime: MarketRegime;
  volatilityRegime: VolatilityRegime;
  regimePrediction: RegimePrediction;
  systemDecision: SystemDecision;
  zScoreValue: number;
  mtfConsensus: string; // "4/5 GÜÇLÜ BOĞA" format
  earlyReversal: "UP" | "DOWN" | null;
  fastSlope: number;
  fastAcceleration: number;
  deathRisk: boolean;
  whaleTrust: number;
  fundingRate: number;
  fundingImpact: number;

  // V5 New Fields
  confluenceScore: number;
  confluenceBreakdown: ConfluenceBreakdown;
  prediction: PredictionResult;
  adm: ADMResult;
  vpa: VPAResult;
  v5Indicators: V5IndicatorState[];
  momentumState: string;
  momentumColor: string;
  whaleSignalText: string;
  marketPhaseText: string;
  capitalFlowText: string;
  capitalPhase: string;
  tfAdaptFactor: number;

  // SMC & Structure
  smc: SMCResult;
  liquidity: LiquidityResult;
  systemRestMode: boolean;
  vixBottom: boolean;
  inPremium: boolean;
  inDiscount: boolean;
  swingTrend: string; // duplicate for ease
  targets: { t1: number; t2: number; sl: number };

  // V5.3/V5.4 New Fields
  f4Power: number; // ATR Normalized F4 Momentum [-100, 100]
  f4PowerLoss: number; // Güç kaybı yüzdesi (0-100)
  f4EarlyBuy: boolean; // Erken alış sinyali (Fibo divergence)
  f4EarlySell: boolean; // Erken satış sinyali (Fibo divergence)
  f4ConfirmedBuy: boolean; // Onaylanmış alış (çizgi renk değişimi)
  f4ConfirmedSell: boolean; // Onaylanmış satış (çizgi renk değişimi)
  liquidityZone: string; // Aktif likidite bölgesi
  liquidityBonus: number; // Likidite bonusu (0 veya 10)
  mtfWeightedScore: number; // Ağırlıklı MTF skoru
  dynamicWeights: {
    tech: number;
    momentum: number;
    market: number;
    trend: number;
  };
  indicatorBullCount: number;
  /** @deprecated Use indicatorBullCount for single-TF indicator consensus */
  mtfBullCount: number;
}

// ===========================
// ENGINE CLASS
// ===========================

export class MatrixV5Engine {
  private config: MatrixV5Config;
  private bayesianMetrics = {
    totalSignals: 0,
    winSignals: 0,
    currentWinRate: 0.5,
  };
  private buyFired = false;
  private sellFired = false;
  private lastF4SlopeSign = 0;
  private lastSignalBarIndex = 0;

  constructor(config: Partial<MatrixV5Config> = {}) {
    const d = (val: unknown, def: number, name?: string) => {
      if (val === undefined) return def;
      if (typeof val !== "number" || isNaN(val)) {
        if (name) console.warn(`Matrix V5: Invalid value for ${name}, using default: ${def}`);
        return def;
      }
      return val as number;
    };

    this.config = {
      f4Length: d(config.f4Length, 10, "f4Length"),
      fiboLength: d(config.fiboLength, 20, "fiboLength"),
      f4SlopeThreshold: d(config.f4SlopeThreshold, 0.01, "f4SlopeThreshold"), // Mapping "Slope Multiplier 0.01"
      whaleVolumeMultiplier: d(config.whaleVolumeMultiplier, 1.8, "whaleVolumeMultiplier"),
      minAiScore: d(config.minAiScore, 65, "minAiScore"),
      minConfluenceScore: d(config.minConfluenceScore, 60, "minConfluenceScore"),
      useWhaleEngine: config.useWhaleEngine ?? true,
      useTrendSafety: config.useTrendSafety ?? true,
      riskTolerance: d(config.riskTolerance, 0.5, "riskTolerance"),
      tradeMode: config.tradeMode || "Scalp",
      confluenceWeightTech: d(config.confluenceWeightTech, 30, "confluenceWeightTech"),
      confluenceWeightMomentum: d(config.confluenceWeightMomentum, 15, "confluenceWeightMomentum"),
      confluenceWeightVol: d(config.confluenceWeightVol, 20, "confluenceWeightVol"),
      confluenceWeightTrend: d(config.confluenceWeightTrend, 15, "confluenceWeightTrend"),
      confluenceWeightMarket: d(config.confluenceWeightMarket, 15, "confluenceWeightMarket"),
      confluenceWeightTiming: d(config.confluenceWeightTiming, 5, "confluenceWeightTiming"),
      rsiPeriod: d(config.rsiPeriod, 14, "rsiPeriod"),
      rsiOB: d(config.rsiOB, 70, "rsiOB"),
      rsiOS: d(config.rsiOS, 30, "rsiOS"),
      maFast: d(config.maFast, 12, "maFast"),
      maSlow: d(config.maSlow, 26, "maSlow"),
      maSignal: d(config.maSignal, 9, "maSignal"),
      macdFast: d(config.macdFast, 12, "macdFast"),
      macdSlow: d(config.macdSlow, 26, "macdSlow"),
      macdSignal: d(config.macdSignal, 9, "macdSignal"),
      stFactor: d(config.stFactor, 3, "stFactor"),
      stAtrPeriod: d(config.stAtrPeriod, 10, "stAtrPeriod"),
      stochRsiLen: d(config.stochRsiLen, 14, "stochRsiLen"),
      stochK: d(config.stochK, 3, "stochK"),
      stochD: d(config.stochD, 3, "stochD"),
      adxPeriod: d(config.adxPeriod, 14, "adxPeriod"),
      adxThreshold: d(config.adxThreshold, 20, "adxThreshold"),
      f4PowerLossThreshold: d(config.f4PowerLossThreshold, 90, "f4PowerLossThreshold"),
      f4LookbackBars: d(config.f4LookbackBars, 30, "f4LookbackBars"),
      f4SqueezeThreshold: d(config.f4SqueezeThreshold, 20, "f4SqueezeThreshold"),
      mtfThreshold: d(config.mtfThreshold, 80, "mtfThreshold"),
      useHeikinAshi: config.useHeikinAshi ?? true,
      minPowerLoss: d(config.minPowerLoss, 90, "minPowerLoss"),
      longSqueezeThreshold: d(config.longSqueezeThreshold, 20, "longSqueezeThreshold"),
      shortSqueezeThreshold: d(config.shortSqueezeThreshold, 20, "shortSqueezeThreshold"),
    };
  }

  /**
   * Calculates autonomous parameters based on tradeMode and volatility (ATR)
   */
  private getAutonomousConfig(atr: number, basePrice: number, currentConfig: MatrixV5Config, overrides: Partial<MatrixV5Config>) {
    const isScalp = currentConfig.tradeMode === "Scalp";
    const volatilityFactor = atr / basePrice; // Relative volatility
    const volAdjustment = volatilityFactor > 0.02 ? 1.2 : volatilityFactor < 0.005 ? 0.8 : 1.0;

    // Helper to prioritize overrides safely
    // Priority: 1. Runtime configOverrides (overrides param) 2. Dynamic Autonomous Logic 3. Global Engine Config
    const getVal = (autoVal: number, key: keyof MatrixV5Config): number => {
      const val = currentConfig[key];
      return (key in overrides && typeof val === "number") ? val : autoVal;
    };

    if (isScalp) {
      return {
        f4Length: getVal(11, "f4Length"), // Mapping "Scalp Length 11"
        fiboLength: getVal(Math.round(11 * volAdjustment), "fiboLength"),
        whaleVolumeMultiplier: getVal(3.0, "whaleVolumeMultiplier"), // Mapping "Scalp Volume Factor 3"
        minAiScore: getVal(60, "minAiScore"), 
        minConfluenceScore: getVal(55, "minConfluenceScore"), 
        f4SlopeThreshold: getVal(0.01, "f4SlopeThreshold"), 
        lookback: 30,
      };
    } else {
      // Swing Mode
      return {
        f4Length: getVal(10, "f4Length"), // Mapping "Swing Length 10"
        fiboLength: getVal(Math.round(10 * volAdjustment), "fiboLength"),
        whaleVolumeMultiplier: getVal(1.2, "whaleVolumeMultiplier"), // Mapping "Swing Volume Factor 1.2"
        minAiScore: getVal(70, "minAiScore"), 
        minConfluenceScore: getVal(65, "minConfluenceScore"), 
        f4SlopeThreshold: getVal(0.01, "f4SlopeThreshold"), 
        lookback: 30,
      };
    }
  }

  // ===========================
  // HELPER CALCULATIONS
  // ===========================

  private calculateSMA(source: number[], length: number): number {
    if (source.length < length || length <= 0) return 0;
    let sum = 0;
    for (let i = source.length - length; i < source.length; i++) {
      sum += source[i];
    }
    return sum / length;
  }

  private calculateEMA(source: number[], length: number): number {
    if (source.length < length || length <= 0)
      return source[source.length - 1] || 0;
    const k = 2 / (length + 1);
    let ema = source.slice(0, length).reduce((a, b) => a + b, 0) / length;
    for (let i = length; i < source.length; i++) {
      ema = source[i] * k + ema * (1 - k);
    }
    return ema;
  }

  private calculateStdDev(source: number[], length: number): number {
    if (source.length < length || length <= 0) return 0;
    const slice = source.slice(source.length - length);
    const mean = slice.reduce((a, b) => a + b, 0) / length;
    const variance =
      slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / length;
    return Math.sqrt(variance);
  }

  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    length: number,
  ): number {
    if (highs.length < length + 1 || length <= 0) return 0;
    let trSum = 0;
    for (let i = highs.length - length; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - (closes[i - 1] || closes[i]));
      const lc = Math.abs(lows[i] - (closes[i - 1] || closes[i]));
      trSum += Math.max(hl, hc, lc);
    }
    return trSum / length;
  }

  private calculateLinReg(
    source: number[],
    length: number,
    offset: number = 0,
  ): number {
    if (source.length < length + offset || length <= 0) return 0;
    const end = source.length - 1 - offset;
    const start = end - length + 1;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;
    for (let i = 0; i < length; i++) {
      sumX += i;
      sumY += source[start + i];
      sumXY += i * source[start + i];
      sumXX += i * i;
    }
    const denom = length * sumXX - sumX * sumX;
    if (denom === 0) return 0;
    const slopeVal = (length * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slopeVal * sumX) / length;
    return intercept + slopeVal * (length - 1);
  }

  private calculateHeikinAshi(
    opens: number[],
    highs: number[],
    lows: number[],
    closes: number[]
  ): { opens: number[]; highs: number[]; lows: number[]; closes: number[] } {
    const len = closes.length;
    if (len === 0) return { opens: [], highs: [], lows: [], closes: [] };
    
    const haOpens = new Array(len);
    const haCloses = new Array(len);
    const haHighs = new Array(len);
    const haLows = new Array(len);

    // Initial HA candle
    haCloses[0] = (opens[0] + highs[0] + lows[0] + closes[0]) / 4;
    haOpens[0] = (opens[0] + closes[0]) / 2; 
    haHighs[0] = Math.max(highs[0], haOpens[0], haCloses[0]);
    haLows[0] = Math.min(lows[0], haOpens[0], haCloses[0]);

    for (let i = 1; i < len; i++) {
      haCloses[i] = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
      haOpens[i] = (haOpens[i - 1] + haCloses[i - 1]) / 2;
      haHighs[i] = Math.max(highs[i], haOpens[i], haCloses[i]);
      haLows[i] = Math.min(lows[i], haOpens[i], haCloses[i]);
    }

    return { opens: haOpens, highs: haHighs, lows: haLows, closes: haCloses };
  }

  // ===========================
  // V5 INDICATOR CALCULATIONS
  // ===========================

  private calculateRSI(closes: number[], length: number): number {
    if (closes.length < length + 1) return 50;
    let avgGain = 0,
      avgLoss = 0;
    for (let i = closes.length - length; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= length;
    avgLoss /= length;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private calculateMACD(
    closes: number[],
    fast: number,
    slow: number,
    signal: number,
  ): { line: number; signal: number; hist: number } {
    const fastEma = this.calculateEMA(closes, fast);
    const slowEma = this.calculateEMA(closes, slow);
    const macdLine = fastEma - slowEma;
    // Build MACD series for signal line
    const macdSeries: number[] = [];
    const kFast = 2 / (fast + 1),
      kSlow = 2 / (slow + 1);
    let emaF = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
    let emaS = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow;
    for (let i = Math.max(fast, slow); i < closes.length; i++) {
      emaF = closes[i] * kFast + emaF * (1 - kFast);
      emaS = closes[i] * kSlow + emaS * (1 - kSlow);
      macdSeries.push(emaF - emaS);
    }
    const signalLine =
      macdSeries.length >= signal ? this.calculateEMA(macdSeries, signal) : 0;
    return { line: macdLine, signal: signalLine, hist: macdLine - signalLine };
  }

  private calculateSuperTrend(
    highs: number[],
    lows: number[],
    closes: number[],
    factor: number,
    atrPeriod: number,
  ): { value: number; direction: number; bull: boolean } {
    const atr = this.calculateATR(highs, lows, closes, atrPeriod);
    const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
    const upperBand = hl2 + factor * atr;
    const lowerBand = hl2 - factor * atr;
    const currentClose = closes[closes.length - 1];
    const bull = currentClose > lowerBand;
    return {
      value: bull ? lowerBand : upperBand,
      direction: bull ? -1 : 1,
      bull,
    };
  }

  private calculateStochRSI(
    closes: number[],
    rsiLen: number,
    stochLen: number,
    kPeriod: number,
    dPeriod: number,
  ): { k: number; d: number } {
    // Build RSI series
    void kPeriod;
    void dPeriod; // Suppress unused for now
    const rsiSeries: number[] = [];
    for (let i = rsiLen + 1; i <= closes.length; i++) {
      const slice = closes.slice(i - rsiLen - 1, i);
      rsiSeries.push(this.calculateRSI(slice, rsiLen));
    }
    if (rsiSeries.length < stochLen) return { k: 50, d: 50 };
    // Stochastic on RSI
    const recentRsi = rsiSeries.slice(rsiSeries.length - stochLen);
    const highest = Math.max(...recentRsi);
    const lowest = Math.min(...recentRsi);
    const stochRaw =
      highest !== lowest
        ? ((rsiSeries[rsiSeries.length - 1] - lowest) / (highest - lowest)) *
          100
        : 50;
    // Simplified K & D (would need series for proper SMA)
    return { k: stochRaw, d: stochRaw }; // Approximation
  }

  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    length: number,
  ): { adx: number; diPlus: number; diMinus: number } {
    if (highs.length < length + 1) return { adx: 0, diPlus: 0, diMinus: 0 };
    let smoothDMPlus = 0,
      smoothDMMinus = 0,
      smoothTR = 0;
    for (let i = highs.length - length; i < highs.length; i++) {
      const upMove = highs[i] - (highs[i - 1] || highs[i]);
      const downMove = (lows[i - 1] || lows[i]) - lows[i];
      const dmPlus = upMove > downMove && upMove > 0 ? upMove : 0;
      const dmMinus = downMove > upMove && downMove > 0 ? downMove : 0;
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - (closes[i - 1] || closes[i])),
        Math.abs(lows[i] - (closes[i - 1] || closes[i])),
      );
      smoothDMPlus += dmPlus;
      smoothDMMinus += dmMinus;
      smoothTR += tr;
    }
    const diPlus = smoothTR > 0 ? (smoothDMPlus / smoothTR) * 100 : 0;
    const diMinus = smoothTR > 0 ? (smoothDMMinus / smoothTR) * 100 : 0;
    const dx =
      diPlus + diMinus > 0
        ? (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100
        : 0;
    return { adx: dx, diPlus, diMinus };
  }

  private calculateEMASeries(source: number[], length: number): number[] {
    if (source.length < length || length <= 0) return Array(source.length).fill(0);
    const k = 2 / (length + 1);
    const emaSeries: number[] = Array(source.length).fill(0);
    let ema = source[0] || 0;
    emaSeries[0] = ema;
    for (let i = 1; i < source.length; i++) {
      ema = source[i] * k + ema * (1 - k);
      emaSeries[i] = ema;
    }
    return emaSeries;
  }

  private calculateSMASeries(source: number[], length: number): number[] {
    if (source.length < length || length <= 0) return Array(source.length).fill(0);
    const smaSeries: number[] = Array(source.length).fill(0);
    let sum = 0;
    for (let i = 0; i < length; i++) sum += source[i];
    smaSeries[length - 1] = sum / length;
    for (let i = length; i < source.length; i++) {
        sum += source[i] - (source[i - length] || 0);
        smaSeries[i] = sum / length;
    }
    return smaSeries;
  }

  private calculateWaveTrend(
    highs: number[],
    lows: number[],
    closes: number[],
    n1: number,
    n2: number,
  ): { wt1: number; wt2: number; prevWt1: number; prevWt2: number } {
    const ap = highs.map((h, i) => (h + lows[i] + closes[i]) / 3);
    const esa = this.calculateEMASeries(ap, n1);
    const d = this.calculateEMASeries(ap.map((v, i) => Math.abs(v - esa[i])), n1);
    const ci = ap.map((v, i) => d[i] !== 0 ? (v - esa[i]) / (0.015 * d[i]) : 0);
    const wt1Series = this.calculateEMASeries(ci, n2);
    const wt2Series = this.calculateSMASeries(wt1Series, 4);
    
    
    return {
      wt1: wt1Series[wt1Series.length - 1],
      wt2: wt2Series[wt2Series.length - 1],
      prevWt1: wt1Series.length >= 2 ? wt1Series[wt1Series.length - 2] : 0,
      prevWt2: wt2Series.length >= 2 ? wt2Series[wt2Series.length - 2] : 0
    };
  }

  private calculateVixFix(
    closes: number[],
    highs: number[],
    lows: number[],
    pd: number,
    bbl: number,
    mult: number,
    lb: number,
    ph: number,
    pl: number
  ): boolean {
    const len = closes.length;
    if (len < Math.max(pd, bbl, lb)) return false;
    
    // wvf = ((highest(close, pd) - low) / (highest(close, pd))) * 100
    if (len < pd) return false;
    
    const wvf: number[] = new Array(len).fill(0);
    
    // O(N) Rolling Maximum implementation using a deque
    const deque: number[] = []; // Stores indices of elements in descending order of value
    for (let i = 0; i < len; i++) {
        // Remove indices out of current window
        if (deque.length > 0 && deque[0] <= i - pd) {
            deque.shift();
        }
        // Remove indices of elements smaller than current element
        while (deque.length > 0 && closes[deque[deque.length - 1]] <= closes[i]) {
            deque.pop();
        }
        deque.push(i);
        
        if (i >= pd - 1) {
            const highest = closes[deque[0]];
            wvf[i] = highest !== 0 ? ((highest - lows[i]) / highest) * 100 : 0;
        }
    }
    
    const currentWvf = wvf[len - 1];
    const midLine = this.calculateSMA(wvf, bbl);
    const sDev = this.calculateStdDev(wvf, bbl);
    const upperBand = midLine + mult * sDev;
    
    // O(N) Rolling Maximum for rangeHigh
    const rangeDeque: number[] = [];
    let rangeHigh = 0;
    for (let i = Math.max(0, len - lb); i < len; i++) {
        while (rangeDeque.length > 0 && wvf[rangeDeque[rangeDeque.length - 1]] <= wvf[i]) {
            rangeDeque.pop();
        }
        rangeDeque.push(i);
    }
    if (rangeDeque.length > 0) {
        rangeHigh = wvf[rangeDeque[0]] * ph;
    }
    
    return currentWvf >= upperBand || currentWvf >= rangeHigh;
  }

  // ===========================
  // TF ADAPTATION
  // ===========================

  public getTfAdaptFactor(intervalStr: string): number {
    const seconds = this.intervalToSeconds(intervalStr);
    if (seconds <= 60) return 0.5;
    if (seconds <= 300) return 0.7;
    if (seconds <= 900) return 0.85;
    if (seconds <= 3600) return 1.0;
    if (seconds <= 14400) return 1.3;
    return 1.6;
  }

  private intervalToSeconds(interval: string): number {
    const map: Record<string, number> = {
      "1m": 60,
      "3m": 180,
      "5m": 300,
      "15m": 900,
      "30m": 1800,
      "1h": 3600,
      "2h": 7200,
      "4h": 14400,
      "6h": 21600,
      "8h": 28800,
      "12h": 43200,
      "1d": 86400,
      "1w": 604800,
    };
    return map[interval] || 3600;
  }

  private adaptPeriod(basePeriod: number, tfAdapt: number): number {
    return Math.max(Math.round(basePeriod * tfAdapt), 3);
  }

  // ===========================
  // F4 CALCULATION (Pine Script Port)
  // ===========================

  private calculateF4(
    closes: number[],
    highs: number[],
    lows: number[],
    length: number,
    alpha: number,
  ): number {
    const series = this.calculateF4Series(closes, highs, lows, length, alpha);
    return series[series.length - 1] || 0;
  }

  private calculateF4Series(
    closes: number[],
    highs: number[],
    lows: number[],
    length: number,
    alpha: number,
  ): number[] {
    const source = closes.map((c, i) => (highs[i] + lows[i] + 2 * c) / 4);
    const e1 = this.buildEMASeries(source, length);
    const e2 = this.buildEMASeries(e1, length);
    const e3 = this.buildEMASeries(e2, length);
    const e4 = this.buildEMASeries(e3, length);
    const e5 = this.buildEMASeries(e4, length);
    const e6 = this.buildEMASeries(e5, length);

    const c1 = -alpha * alpha * alpha;
    const c2 = 3 * alpha * alpha + 3 * alpha * alpha * alpha;
    const c3 = -6 * alpha * alpha - 3 * alpha - 3 * alpha * alpha * alpha;
    const c4 = 1 + 3 * alpha + alpha * alpha * alpha + 3 * alpha * alpha;

    return source.map((_, i) => c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i]);
  }

  private buildEMASeries(source: number[], length: number): number[] {
    if (source.length === 0) return [];
    const k = 2 / (length + 1);
    const result: number[] = new Array(source.length);

    // Standard initialization: SMA for the first 'length' items
    let sum = 0;
    const initialLen = Math.min(length, source.length);
    for (let i = 0; i < initialLen; i++) {
      sum += source[i];
      result[i] = source[i];
    }
    result[initialLen - 1] = sum / initialLen;

    for (let i = initialLen; i < source.length; i++) {
        result[i] = source[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  }

  // ===========================
  // ADM (Asset Drift Model)
  // ===========================

  private calculateADM(closes: number[], vpa?: VPAResult, _fastSlope?: number): ADMResult {
    const horizon = 60;
    const sampleBars = Math.min(756, closes.length - 1);

    // --- Full statistical ADM (prefers 70+ candles) ---
    if (closes.length >= horizon + 10) {
      const returns: number[] = [];
      for (let i = 0; i < sampleBars - horizon && i + horizon < closes.length; i++) {
        const r = (closes[closes.length - 1 - i] - closes[closes.length - 1 - i - horizon]) /
          closes[closes.length - 1 - i - horizon];
        returns.push(r);
      }
      if (returns.length >= 10) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
        const sd = Math.sqrt(variance);
        const se = sd / Math.sqrt(returns.length);
        const tStat = se > 1e-10 ? mean / se : 0;
        const annDrift = mean * (252 / horizon);
        const direction = mean > 0 ? 1 : mean < 0 ? -1 : 0;
        const statSig = Math.abs(tStat) > 2.0;
        const econSig = Math.abs(annDrift) >= 0.03;
        let classCode = 0;
        if (!statSig) classCode = 0;
        else if (!econSig) classCode = 1;
        else classCode = 2;
        const classification = classCode === 2 ? direction * 2 : classCode === 1 ? direction : 0;
        const evidence: ADMResult["evidence"] = classCode === 2 ? "GÜÇLÜ" : classCode === 1 ? "ZAYIF" : "YOK";
        const bias = classification >= 2 ? "Pozitif Sapma" : classification <= -2 ? "Negatif Sapma" :
          classification === 1 ? "Pozitif (Zayıf)" : classification === -1 ? "Negatif (Zayıf)" : "Sapma Yok";
        return { classification, evidence, bias, direction };
      }
    }

    // --- Fallback: VPA net pressure + short-term price drift (when closes insufficient) ---
    if (vpa) {
      const np = vpa.netPressure;
      let driftSignal = 0;
      if (closes.length >= 10) {
        const safeLen = closes.length;
        const recent5 = closes.slice(Math.max(0, safeLen - 5));
        const prev5 = closes.slice(Math.max(0, safeLen - 10), Math.max(0, safeLen - 5));
        if (recent5.length >= 3 && prev5.length >= 3) {
          const r5Avg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
          const p5Avg = prev5.reduce((a, b) => a + b, 0) / prev5.length;
          driftSignal = p5Avg > 0 ? ((r5Avg - p5Avg) / p5Avg) * 100 : 0;
        }
      }
      const combined = np * 0.6 + driftSignal * 0.4;
      const cls = combined > 40 ? 2 : combined > 10 ? 1 : combined < -40 ? -2 : combined < -10 ? -1 : 0;
      const evidence: ADMResult["evidence"] = Math.abs(combined) > 40 ? "GÜÇLÜ" : Math.abs(combined) > 10 ? "ZAYIF" : "YOK";
      const bias = combined > 10 ? "Pozitif Sapma" : combined < -10 ? "Negatif Sapma" : "Nötr Sapma";
      return { classification: cls, evidence, bias, direction: cls > 0 ? 1 : cls < 0 ? -1 : 0 };
    }

    return { classification: 0, evidence: "YOK", bias: "Sapma Yok", direction: 0 };
  }

  // ===========================
  // VPA (Volume Price Analysis)
  // ===========================

  private calculateVPA(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
  ): VPAResult {
    const len = closes.length;
    if (len < 2)
      return {
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        netPressure: 0,
        state: "NÖTR",
      };

    const range = highs[len - 1] - lows[len - 1];
    const buyPct =
      range === 0 ? 0.5 : (closes[len - 1] - lows[len - 1]) / range;
    const totalVol = volumes[len - 1];
    const buyVol = totalVol * buyPct;
    const sellVol = totalVol * (1 - buyPct);
    const delta = buyVol - sellVol;
    const netPressure = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;

    return {
      buyVolume: buyVol,
      sellVolume: sellVol,
      delta,
      netPressure,
      state:
        netPressure > 50
          ? "ALIM BASKISI"
          : netPressure < 50
            ? "SATIM BASKISI"
            : "NÖTR",
    };
  }

  private calculateRibbon(closes: number[], tfAdapt: number) {
    const ema8 = this.calculateEMA(closes, this.adaptPeriod(8, tfAdapt));
    const ema13 = this.calculateEMA(closes, this.adaptPeriod(13, tfAdapt));
    const ema21 = this.calculateEMA(closes, Math.max(this.adaptPeriod(21, tfAdapt), 5));
    const ema34 = this.calculateEMA(closes, Math.max(this.adaptPeriod(34, tfAdapt), 5));
    const ema55 = this.calculateEMA(closes, Math.max(this.adaptPeriod(55, tfAdapt), 8));
    
    const ribbonBull = ema8 > ema13 && ema13 > ema21 && ema21 > ema34 && ema34 > ema55;
    const ribbonBear = ema8 < ema13 && ema13 < ema21 && ema21 < ema34 && ema34 < ema55;
    
    const ribbonState = ribbonBull ? "TAM HIZALANMA ↑" : ribbonBear ? "TAM HIZALANMA ↓" : ema8 > ema55 ? "BOĞA EĞİLİM" : "AYI EĞİLİM";
    const ribbonColor: V5IndicatorState["color"] = ribbonBull ? "green" : ribbonBear ? "red" : ema8 > ema55 ? "green" : "red";
    
    return { ema8, ema13, ema21, ema34, ema55, ribbonBull, ribbonBear, ribbonState, ribbonColor };
  }

  private calculateV5Indicators(
    closes: number[],
    highs: number[],
    lows: number[],
    activeConfig: MatrixV5Config,
    tfAdapt: number,
    adaptedRsiLen: number,
    adaptedMacdFast: number,
    adaptedMacdSlow: number,
    adaptedMacdSignal: number,
    adaptedStAtr: number,
    adaptedAdxLen: number,
    currentPrice: number,
    len: number
  ) {
    const rsi = this.calculateRSI(closes, adaptedRsiLen);
    const rsiState = rsi >= activeConfig.rsiOB ? "AŞIRI ALIM" : rsi <= activeConfig.rsiOS ? "AŞIRI SATIM" : rsi > 55 ? "ALIM BASKISI" : rsi < 45 ? "SATIM BASKISI" : "NÖTR";
    const rsiColor: V5IndicatorState["color"] = rsi >= activeConfig.rsiOB ? "red" : rsi <= activeConfig.rsiOS ? "green" : rsi > 55 ? "green" : rsi < 45 ? "red" : "gray";

    const macd = this.calculateMACD(closes, adaptedMacdFast, adaptedMacdSlow, adaptedMacdSignal);
    const macdBull = macd.hist > 0;
    const macdState = macd.hist > 0 && macd.hist > (closes[len - 2] ? macd.hist : 0) ? "GÜÇLÜ BOĞA" : macd.hist > 0 ? "BOĞA" : macd.hist < 0 ? "AYI" : "NÖTR";
    const macdColor: V5IndicatorState["color"] = macd.hist > 0 ? "green" : "red";

    const st = this.calculateSuperTrend(highs, lows, closes, activeConfig.stFactor, adaptedStAtr);
    const stState = st.bull ? "YUKARI TREND" : "AŞAĞI TREND";
    const stColor: V5IndicatorState["color"] = st.bull ? "green" : "red";

    const stochRsi = this.calculateStochRSI(closes, adaptedRsiLen, activeConfig.stochRsiLen, activeConfig.stochK, activeConfig.stochD);
    const stochState = stochRsi.k > 80 ? "AŞIRI ALIM" : stochRsi.k < 20 ? "AŞIRI SATIM" : stochRsi.k > stochRsi.d ? "BOĞA" : "AYI";
    const stochColor: V5IndicatorState["color"] = stochRsi.k > 80 ? "red" : stochRsi.k < 20 ? "green" : stochRsi.k > stochRsi.d ? "green" : "red";

    const adx = this.calculateADX(highs, lows, closes, adaptedAdxLen);
    const adxTrending = adx.adx > activeConfig.adxThreshold;
    const adxState = !adxTrending ? "YATAY (RANGE)" : adx.diPlus > adx.diMinus ? "GÜÇLÜ BOĞA" : "GÜÇLÜ AYI";
    const adxColor: V5IndicatorState["color"] = !adxTrending ? "gray" : adx.diPlus > adx.diMinus ? "green" : "red";

    const vwap = this.calculateSMA(closes, 20);
    const vwapAbove = currentPrice > vwap;
    const vwapState = vwapAbove ? "ÜZERİNDE (BOĞA)" : "ALTINDA (AYI)";
    const vwapColor: V5IndicatorState["color"] = vwapAbove ? "green" : "red";

    const ribbonData = this.calculateRibbon(closes, tfAdapt);
    const { ribbonBull, ribbonBear, ribbonState, ribbonColor, ema8, ema55 } = ribbonData;

    // Ichimoku
    const ichiTenkanLen = Math.max(this.adaptPeriod(9, tfAdapt), 3);
    const ichiKijunLen = Math.max(this.adaptPeriod(26, tfAdapt), 5);
    const ichiSenkouLen = Math.max(this.adaptPeriod(52, tfAdapt), 10);
    const tenkan = (Math.max(...highs.slice(Math.max(0, len - ichiTenkanLen))) + Math.min(...lows.slice(Math.max(0, len - ichiTenkanLen)))) / 2;
    const kijun = (Math.max(...highs.slice(Math.max(0, len - ichiKijunLen))) + Math.min(...lows.slice(Math.max(0, len - ichiKijunLen)))) / 2;
    const senkouA = (tenkan + kijun) / 2;
    const senkouB = (Math.max(...highs.slice(Math.max(0, len - ichiSenkouLen))) + Math.min(...lows.slice(Math.max(0, len - ichiSenkouLen)))) / 2;
    const ichiAbove = currentPrice > Math.max(senkouA, senkouB);
    const ichiBelow = currentPrice < Math.min(senkouA, senkouB);
    const ichiState = ichiAbove ? "KUMO ÜSTÜ (BOĞA)" : ichiBelow ? "KUMO ALTI (AYI)" : "KUMO İÇİNDE";
    const ichiColor: V5IndicatorState["color"] = ichiAbove ? "green" : ichiBelow ? "red" : "gray";

    const v5Indicators: V5IndicatorState[] = [
      { name: "RSI", value: rsi.toFixed(1), state: rsiState, color: rsiColor, numericValue: rsi },
      { name: "MACD", value: macd.hist.toFixed(4), state: macdState, color: macdColor, numericValue: macd.hist },
      { name: "Supertrend", value: st.value.toFixed(2), state: stState, color: stColor },
      { name: "StochRSI", value: stochRsi.k.toFixed(1), state: stochState, color: stochColor, numericValue: stochRsi.k },
      { name: "ADX", value: adx.adx.toFixed(1), state: adxState, color: adxColor, numericValue: adx.adx },
      { name: "VWAP", value: vwap.toFixed(2), state: vwapState, color: vwapColor },
      { name: "EMA Ribbon", value: "", state: ribbonState, color: ribbonColor },
      { name: "Ichimoku", value: "", state: ichiState, color: ichiColor },
    ];

    const prevStochRsi = this.calculateStochRSI(closes.slice(0, -1), adaptedRsiLen, activeConfig.stochRsiLen, activeConfig.stochK, activeConfig.stochD);

    return { 
      v5Indicators, rsi, macdBull, macd, st, stochRsi, adx, adxTrending, vwapAbove, 
      ribbonState, ribbonBull, ribbonBear, ichiAbove, ichiBelow,
      rsiState, rsiColor, macdState, macdColor, stState, stColor, 
      stochState, stochColor, adxState, adxColor, vwapState, vwapColor,
      ichiState, ichiColor, vwap, ema8, ema55,
      prevStochK: prevStochRsi.k,
      prevStochD: prevStochRsi.d
    };
  }

  private calculateConfluenceScore(
    activeConfig: MatrixV5Config,
    rsi: number,
    macdBull: boolean,
    macdHist: number,
    stochK: number,
    stochD: number,
    adx: any,
    ribbonBull: boolean,
    ribbonBear: boolean,
    ema8: number,
    ema55: number,
    ichiAbove: boolean,
    ichiBelow: boolean,
    vwapAbove: boolean,
    whaleStatus: string,
    currentVolume: number,
    volSMA: number,
    isGreen: boolean,
    stBull: boolean,
    volatilityRegime: string,
    marketRegime: string,
    earlyReversal: any,
    slope: number,
    trendUp: boolean,
    liquidityBonus: number,
    dynamicWeights: any,
    saeThreshold: number
  ): ConfluenceBreakdown {
    // Tech Score
    const techF4Dir = slope > 0 ? 10 : 0; // Simplified for extraction
    const techTrend = slope > 0 ? 10 : 0;
    const techStructure = trendUp ? 10 : 0;
    const techScore = Math.min(40, techF4Dir + techTrend + techStructure + 5);

    // Momentum Score
    const momRSI = rsi > 50 && rsi < activeConfig.rsiOB ? 10 : rsi <= activeConfig.rsiOS ? 8 : rsi >= activeConfig.rsiOB ? 2 : 5;
    const momMACD = macdBull && macdHist > 0 ? 10 : macdHist > 0 ? 7 : 2;
    const momStoch = stochK < 20 ? 9 : stochK > 80 ? 2 : stochK > stochD ? 8 : 4;
    const momentumScore = Math.min(30, Math.max(0, momRSI + momMACD + momStoch));

    // Volume Score
    const volWhaleScore = whaleStatus === "BUY_ACTIVE" ? 15 : whaleStatus === "SELL_ACTIVE" ? 0 : 7;
    const volFlowScore = currentVolume > volSMA * 1.5 ? (isGreen ? 10 : 3) : 5;
    const volumeScore = Math.min(25, Math.max(0, volWhaleScore + volFlowScore));

    // Trend Score
    const adxTrending = adx.adx > activeConfig.adxThreshold;
    const trendADX = adxTrending && adx.diPlus > adx.diMinus ? 10 : adxTrending ? 3 : 5;
    const trendRibbon = ribbonBull ? 10 : ribbonBear ? 0 : ema8 > ema55 ? 7 : 3;
    const trendIchi = ichiAbove ? 10 : ichiBelow ? 0 : 5;
    const trendST = stBull ? 10 : 0;
    const trendScore = Math.min(40, Math.max(0, trendADX + trendRibbon + trendIchi + trendST));

    // Market Score
    const mktScore = Math.min(25, Math.max(0, (marketRegime === "RISK_ON" ? 15 : 5) + (trendUp ? 10 : 0)));

    // Timing Score
    const timScore = Math.min(10, Math.max(0, (volatilityRegime === "SQUEEZE" ? 3 : volatilityRegime === "EXPLOSION" ? 5 : 4) + (earlyReversal ? 5 : 3)));

    const confluenceScore = Math.max(0, Math.min(100,
      (techScore / 40) * dynamicWeights.tech +
      (momentumScore / 30) * dynamicWeights.momentum +
      (volumeScore / 25) * activeConfig.confluenceWeightVol +
      (trendScore / 40) * dynamicWeights.trend +
      (mktScore / 25) * dynamicWeights.market +
      (timScore / 10) * activeConfig.confluenceWeightTiming +
      liquidityBonus));

    const confluenceStatus: ConfluenceStatus = confluenceScore >= saeThreshold ? "MÜKEMMEL" : confluenceScore >= 65 ? "GÜÇLÜ" : confluenceScore >= 50 ? "ORTA" : confluenceScore >= saeThreshold - 20 ? "ZAYIF" : "YETERSİZ";

    return { techScore, momentumScore, volumeScore, trendScore, marketScore: mktScore, timingScore: timScore, totalScore: confluenceScore, status: confluenceStatus };
  }

  // ===========================
  // SMC & STRUCTURE (V5)
  // ===========================

  private calculateRegimes(
    closes: number[],
    tfAdapt: number,
    isStoppingVolume: boolean,
    slope: number
  ) {
    const len = closes.length;
    const ema50 = this.calculateEMA(closes, Math.max(50, this.adaptPeriod(50, tfAdapt)));
    const ema200 = this.calculateEMA(closes, Math.min(len - 1, 200));
    const trendUp = ema50 > ema200;

    const adaptedBBLen = this.adaptPeriod(20, tfAdapt);
    const adaptedZLen = this.adaptPeriod(50, tfAdapt);

    const bbStdev = this.calculateStdDev(closes, adaptedBBLen);
    const bbSMA = this.calculateSMA(closes, adaptedBBLen);
    const currentBBW = bbSMA > 0 ? (4 * bbStdev) / bbSMA : 0;

    const bbwHistory: number[] = [];
    const windowLen = adaptedBBLen;
    
    if (len >= windowLen && windowLen > 0) {
        // Optimized O(N) rolling variance
        let sum = 0;
        let sumSq = 0;
        
        // Circular buffer or full scan for the needed portion
        const historyStart = Math.max(0, len - adaptedZLen - windowLen);
        for (let i = historyStart; i < historyStart + windowLen; i++) {
            sum += closes[i];
            sumSq += closes[i] * closes[i];
        }

        for (let i = historyStart + windowLen; i <= len; i++) {
            const mean = sum / windowLen;
            const variance = (sumSq / windowLen) - (mean * mean);
            const stdDev = variance > 0 ? Math.sqrt(variance) : 0;
            bbwHistory.push(mean > 0 ? (4 * stdDev) / mean : 0);

            if (i < len) {
                const oldVal = closes[i - windowLen];
                const newVal = closes[i];
                sum += newVal - oldVal;
                sumSq += (newVal * newVal) - (oldVal * oldVal);
            }
        }
    }

    if (bbwHistory.length < 2) {
      return {
        volatilityRegime: "NORMAL" as VolatilityRegime,
        marketRegime: "NEUTRAL" as MarketRegime,
        regimePrediction: "RANGE" as RegimePrediction,
        bbwZScore: 0,
        trendUp,
        adaptedZLen,
        ema50,
        ema200
      };
    }

    const bbwSMA = this.calculateSMA(bbwHistory, Math.min(adaptedZLen, bbwHistory.length));
    const bbwStdDev = this.calculateStdDev(bbwHistory, Math.min(adaptedZLen, bbwHistory.length));

    const bbwZScore = bbwStdDev > 0 ? (currentBBW - bbwSMA) / bbwStdDev : 0;

    let volatilityRegime: VolatilityRegime = "NORMAL";
    if (bbwZScore < -1.0) volatilityRegime = "SQUEEZE";
    else if (bbwZScore > 2.0 && currentBBW > bbwSMA * 1.5) volatilityRegime = "EXPLOSION";
    else if (bbwZScore > 1.5) volatilityRegime = "HIGH_VOL";

    let marketRegime: MarketRegime = "NEUTRAL";
    if (trendUp && volatilityRegime !== "HIGH_VOL") marketRegime = "RISK_ON";
    else if (!trendUp && volatilityRegime === "HIGH_VOL") marketRegime = "RISK_OFF";

    let regimePrediction: RegimePrediction = "RANGE";
    if (volatilityRegime === "SQUEEZE") regimePrediction = "PRE_EXPLOSION";
    else if (volatilityRegime === "EXPLOSION" && marketRegime === "RISK_ON") regimePrediction = "ACCELERATING_TREND";
    else if (volatilityRegime === "EXPLOSION" && marketRegime === "RISK_OFF") regimePrediction = "ACCELERATING_DROP";
    else if (marketRegime === "RISK_ON" && slope > 0) regimePrediction = "ACCELERATING_TREND";
    else if (marketRegime === "RISK_OFF" && slope < 0) regimePrediction = "ACCELERATING_DROP";
    else if (isStoppingVolume && slope < 0) regimePrediction = "BOTTOM_FINDING";
    else if (isStoppingVolume && slope > 0) regimePrediction = "EXHAUSTION";

    return { volatilityRegime, marketRegime, regimePrediction, bbwZScore, trendUp, adaptedZLen, ema50, ema200 };
  }

  private calculateWhaleStatus(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    intervalSec: number,
    activeConfig: MatrixV5Config,
    currentPrice: number
  ) {
    const len = closes.length;
    const volSMA = this.calculateSMA(volumes, 20);
    const tfWhaleMultiplier = intervalSec <= 60 ? 1.3 : intervalSec <= 300 ? 1.5 : intervalSec <= 3600 ? 1.8 : intervalSec <= 14400 ? 2.2 : 2.5;
    const adaptiveWhaleVolMult = Math.max(activeConfig.whaleVolumeMultiplier, tfWhaleMultiplier);
    const currentVolume = volumes[len - 1];
    const isWhale = activeConfig.useWhaleEngine && currentVolume > volSMA * adaptiveWhaleVolMult;
    const stoppingVolMult = intervalSec <= 300 ? 2.5 : intervalSec <= 3600 ? 3.0 : 3.5;
    const isStoppingVolume = currentVolume > volSMA * stoppingVolMult;

    const recentHighs = highs.slice(Math.max(0, len - 20));
    const recentLows = lows.slice(Math.max(0, len - 20));
    const highest20 = Math.max(...recentHighs);
    const lowest20 = Math.min(...recentLows);
    const openPrice = closes[len - 2] || currentPrice;
    const isGreen = currentPrice > openPrice;

    const fakeBreakoutUp = isWhale && highs[len - 1] >= highest20 && currentPrice < highest20;
    const fakeBreakoutDown = isWhale && lows[len - 1] <= lowest20 && currentPrice > lowest20;

    let whaleStatus = "NEUTRAL";
    if (fakeBreakoutUp || fakeBreakoutDown) whaleStatus = "TRAP";
    else if (isWhale && isGreen) whaleStatus = "BUY_ACTIVE";
    else if (isWhale && !isGreen) whaleStatus = "SELL_ACTIVE";

    let whaleSignalText = "";
    if (whaleStatus === "TRAP") whaleSignalText = "FAKE HAREKET ⚠️";
    else if (whaleStatus === "BUY_ACTIVE") whaleSignalText = "BALİNA TOPLUYOR 🐋";
    else if (whaleStatus === "SELL_ACTIVE") whaleSignalText = "BALİNA BOŞALTIYOR 🐋";

    return { whaleStatus, whaleSignalText, isStoppingVolume, isWhale, fakeBreakoutUp, fakeBreakoutDown, currentVolume, volSMA };
  }

  private calculateSMC(
    highs: number[],
    lows: number[],
    closes: number[],
    tfAdaptFactor: number = 1.0,
    intervalSec: number = 3600
  ): SMCResult {
    const len = closes.length;
    if (len < 50)
      return {
        swingTrend: "NEUTRAL",
        internalTrend: "NEUTRAL",
        bos: false,
        choch: false,
        orderBlocks: [],
        fvgs: [],
      };

    const swingLen = Math.max(5, Math.round(20 * tfAdaptFactor));
    const currentHigh = highs[len - 1];
    const currentLow = lows[len - 1];
    const currentClose = closes[len - 1];

    // Basic Pivot High/Low for structure
    const lastHigh = Math.max(...highs.slice(len - swingLen - 1, len - 1));
    const lastLow = Math.min(...lows.slice(len - swingLen - 1, len - 1));

    // EMAs for Trend Persistence (V5.4 Enhancement)
    const ema8 = this.calculateEMA(closes, this.adaptPeriod(8, tfAdaptFactor));
    const ema21 = this.calculateEMA(closes, this.adaptPeriod(21, tfAdaptFactor));
    const ema55 = this.calculateEMA(closes, this.adaptPeriod(55, tfAdaptFactor));
    const emaAlignmentBull = ema8 > ema21 && ema21 > ema55;
    const emaAlignmentBear = ema8 < ema21 && ema21 < ema55;

    let bos = false;
    let choch = false;
    let swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

    if (currentClose > lastHigh) {
      if (emaAlignmentBull) bos = true;
      else choch = true;
      swingTrend = "BULLISH";
    } else if (currentClose < lastLow) {
      if (emaAlignmentBear) bos = true;
      else choch = true;
      swingTrend = "BEARISH";
    } else {
      // P4.1: Persist trend based on EMA alignment if no fresh breakout
      if (emaAlignmentBull) swingTrend = "BULLISH";
      else if (emaAlignmentBear) swingTrend = "BEARISH";
    }

    // FVG Detection (3 bar pattern)
    const fvgs: FairValueGap[] = [];
    for (let i = len - 10; i < len - 1; i++) {
      if (highs[i] > lows[i - 2] && lows[i] < highs[i - 2]) continue; // Not a gap
      if (lows[i] > highs[i - 2]) {
        fvgs.push({ top: lows[i], bottom: highs[i - 2], type: "BULLISH" });
      } else if (highs[i] < lows[i - 2]) {
        fvgs.push({ top: lows[i - 2], bottom: highs[i], type: "BEARISH" });
      }
    }

    // Order Block Detection (Simplified)
    const orderBlocks: OrderBlock[] = [];
    if (bos || swingTrend !== "NEUTRAL") {
      orderBlocks.push({
        high: currentHigh,
        low: currentLow,
        time: Date.now(), // Fixed to original Date.now() to preserve historical behavior
        index: len - 1,
        type: swingTrend === "BULLISH" ? "BULLISH" : "BEARISH",
      });
    }

    return {
      swingTrend,
      internalTrend: swingTrend,
      bos,
      choch,
      orderBlocks: orderBlocks.slice(-5),
      fvgs: fvgs.slice(-5),
    };
  }

  private calculateLiquidity(highs: number[], lows: number[]): LiquidityResult {
    const len = highs.length;
    if (len < 20) return { eqHighs: false, eqLows: false };

    const threshold = 0.001; // 0.1% for equality
    const h1 = highs[len - 1],
      h2 = highs[len - 2];
    const l1 = lows[len - 1],
      l2 = lows[len - 2];

    const eqHighs = Math.abs(h1 - h2) / ((h1 + h2) / 2) < threshold;
    const eqLows = Math.abs(l1 - l2) / ((l1 + l2) / 2) < threshold;

    return { eqHighs, eqLows };
  }

  // ===========================
  // BAYESIAN & SYSTEM HEALTH
  // ===========================

  private updateBayesianTrust(isCorrect: boolean) {
    this.bayesianMetrics.totalSignals++;
    if (isCorrect) this.bayesianMetrics.winSignals++;
    this.bayesianMetrics.currentWinRate =
      this.bayesianMetrics.winSignals / this.bayesianMetrics.totalSignals;
  }

  // ===========================
  // MAIN ANALYZE METHOD
  // ===========================

  private calculateCapitalFlow(
    currentVolume: number,
    volSMA: number,
    atrVal: number,
    atrSMA: number,
    trendStrength: number,
    slope: number,
  ): { phase: string; text: string } {
    // Capital Phase (Sermaye Akışı)
    // Normalize all three components to center around 1.0 during normal conditions
    const volRatio = currentVolume / Math.max(volSMA, 1);
    const atrRatio = atrVal / Math.max(atrSMA, 0.0001);
    const trendRatio = (trendStrength * 100) / 2.0; // Assume 2% trend gap is "normal" (ratio = 1.0)

    const assetScore = volRatio * 0.4 + atrRatio * 0.3 + trendRatio * 0.3;

    let capitalPhaseValue = "ROTASYON";
    let capitalFlowTextValue = "ROTASYON / YATAY";

    if (assetScore > 1.6 && slope > 0) {
      capitalPhaseValue = "GİRİŞ";
      capitalFlowTextValue = "GÜÇLÜ POZİTİF AKIŞ 🚀";
    } else if (assetScore > 1.6 && slope < 0) {
      capitalPhaseValue = "ÇIKIŞ";
      capitalFlowTextValue = "GÜÇLÜ NEGATİF AKIŞ 📉";
    } else if (assetScore > 1.1 && slope > 0) {
      capitalPhaseValue = "GİRİŞ";
      capitalFlowTextValue = "POZİTİF AKIŞ ✅";
    } else if (assetScore > 1.1 && slope < 0) {
      capitalPhaseValue = "ÇIKIŞ";
      capitalFlowTextValue = "NEGATİF AKIŞ ⚠️";
    } else if (assetScore < 0.8) {
      capitalPhaseValue = "NO_CAPITAL";
      capitalFlowTextValue = "PARA YOK ❌";
    }

    return { phase: capitalPhaseValue, text: capitalFlowTextValue };
  }

  public analyze(
    closes: number[],
    highs: number[],
    lows: number[],
    volumes: number[],
    interval: string = "4h",
    riskMode: "safe" | "normal" | "aggressive" = "normal",
    fundingRate: number = 0,
    configOverrides: Partial<MatrixV5Config> = {},
    opens: number[] = [],
  ): MatrixV5Result {
    // Determine the configuration for this specific analysis run (Thread-safe)
    // Always branch from the base engine config to avoid side effects
    const activeConfig = { ...this.config, ...configOverrides };

    const len = closes.length;

    // Apply Heikin Ashi conversion if requested
    let finalCloses = closes;
    let finalHighs = highs;
    let finalLows = lows;

    if (activeConfig.useHeikinAshi && opens.length === closes.length) {
      const ha = this.calculateHeikinAshi(opens, highs, lows, closes);
      finalCloses = ha.closes;
      finalHighs = ha.highs;
      finalLows = ha.lows;
    }

    if (len < 50) {
      console.warn(
        "Matrix V5: Insufficient data (<50 candles). Results may be inaccurate.",
      );
    }

    // 0. Initialize Dynamic Autonomous Parameters
    const currentPrice = closes[len - 1]; // ALWAYS use real close for current price
    const atrValue = this.calculateATR(finalHighs, finalLows, finalCloses, 14);
    const autoParams = this.getAutonomousConfig(atrValue, currentPrice, activeConfig, configOverrides);

    // 1. F4 TREND ENGINE (Dynamic per tradeMode)
    const f4Len = autoParams.f4Length;
    const f4WholeSeries = this.calculateF4Series(finalCloses, finalHighs, finalLows, f4Len, 0.95); // Using constant UI alpha
    const f4Value = f4WholeSeries[f4WholeSeries.length - 1];
    const fiboWholeSeries = this.calculateF4Series(finalCloses, finalHighs, finalLows, autoParams.fiboLength, 0.95); // Using constant UI alpha
    const f4FiboValue = fiboWholeSeries[fiboWholeSeries.length - 1];

    const tfAdapt = this.getTfAdaptFactor(interval);

    // V5.4 Add F4 Power calculation (ATR normalized)
    const f4ValuePrev5 = f4WholeSeries[f4WholeSeries.length - 6] || f4Value;
    const f4PowerRaw = atrValue > 0 ? ((f4Value - f4ValuePrev5) / atrValue) * 100 : 0;
    const f4Power = Math.max(-100, Math.min(100, f4PowerRaw));

    // Slope via LinReg - Indicators use HA if enabled
    const adaptSlopeLen = this.adaptPeriod(20, tfAdapt);
    const currentLinReg = this.calculateLinReg(finalCloses, adaptSlopeLen, 0);
    const prevLinReg = this.calculateLinReg(finalCloses, adaptSlopeLen, 1);
    const prevLinReg2 = this.calculateLinReg(finalCloses, adaptSlopeLen, 2);

    const haClose = finalCloses[len - 1];

    const rawSlope = currentLinReg - prevLinReg;
    const prevRawSlope = prevLinReg - prevLinReg2;
    const slope = haClose > 0 ? (rawSlope / haClose) * 100 : 0;
    const baseAcceleration =
      haClose > 0 ? ((rawSlope - prevRawSlope) / haClose) * 100 : 0;

    // Fast Momentum
    const fastLinReg0 = this.calculateLinReg(finalCloses, 5, 0);
    const fastLinReg1 = this.calculateLinReg(finalCloses, 5, 1);
    const fastLinReg2 = this.calculateLinReg(finalCloses, 5, 2);
    const fastSlope =
      haClose > 0 ? ((fastLinReg0 - fastLinReg1) / haClose) * 100 : 0;
    const fastAcceleration =
      haClose > 0
        ? ((fastLinReg0 - fastLinReg1 - (fastLinReg1 - fastLinReg2)) /
            haClose) *
          100
        : 0;

    let earlyReversal: "UP" | "DOWN" | null = null;
    if (fastAcceleration > 0.01 && rawSlope < 0) earlyReversal = "UP";
    else if (fastAcceleration < -0.01 && rawSlope > 0) earlyReversal = "DOWN";

    let trend: MatrixV5Result["trend"] = "NEUTRAL";
    if (slope > activeConfig.f4SlopeThreshold) trend = "BULLISH";
    else if (slope < -activeConfig.f4SlopeThreshold) trend = "BEARISH";

    // 2. V5 INDICATORS (TF-ADAPTIVE)
    const adaptedRsiLen = this.adaptPeriod(activeConfig.rsiPeriod, tfAdapt);
    const adaptedMacdFast = this.adaptPeriod(activeConfig.macdFast, tfAdapt);
    const adaptedMacdSlow = Math.max(this.adaptPeriod(activeConfig.macdSlow, tfAdapt), 5);
    const adaptedMacdSignal = this.adaptPeriod(activeConfig.macdSignal, tfAdapt);
    const adaptedStAtr = this.adaptPeriod(activeConfig.stAtrPeriod, tfAdapt);
    const adaptedAdxLen = this.adaptPeriod(activeConfig.adxPeriod, tfAdapt);

    const v5IndicatorData = this.calculateV5Indicators(
      finalCloses,
      finalHighs,
      finalLows,
      activeConfig,
      tfAdapt,
      adaptedRsiLen,
      adaptedMacdFast,
      adaptedMacdSlow,
      adaptedMacdSignal,
      adaptedStAtr,
      adaptedAdxLen,
      currentPrice,
      len
    );
    const { 
      v5Indicators, rsi, macdBull, macd, st, stochRsi, adx, adxTrending, vwapAbove, 
      ribbonState, ribbonBull, ribbonBear, ichiAbove, ichiBelow,
      rsiState, rsiColor, macdState, macdColor, stState, stColor, 
      stochState, stochColor, adxState, adxColor, vwapState, vwapColor,
      ichiState, ichiColor, vwap, ema8, ema55
    } = v5IndicatorData;

    // ===============================
    // 3. WHALE ENGINE (V5: TF-Adaptive)
    // ===============================
    const intervalSec = this.intervalToSeconds(interval);
    const whaleData = this.calculateWhaleStatus(finalHighs, finalLows, finalCloses, volumes, intervalSec, activeConfig, currentPrice);
    
    let whaleStatus = whaleData.whaleStatus as MatrixV5Result["whaleStatus"];
    let whaleSignalText = whaleData.whaleSignalText;
    const { isStoppingVolume, isWhale, fakeBreakoutUp, fakeBreakoutDown, currentVolume, volSMA } = whaleData;

    // ===============================
    // 4. MARKET CONTEXT (Regime & Volatility)
    // ===============================
    const context = this.evaluateMarketContext(finalCloses, finalHighs, finalLows, tfAdapt, isStoppingVolume, slope, currentPrice, len, activeConfig, whaleData, haClose);
    let { 
        volatilityRegime, marketRegime, regimePrediction, trendUp, adaptedZLen, 
        ema50, ema200, isGreen, atrVal, atrSMA, whaleHighVol, zScore, 
        momentumState, momentumColor, acceleration: ctxAcceleration 
    } = context;
    // Update local variables from context
    whaleStatus = context.whaleStatus;
    whaleSignalText = context.whaleSignalText;

    // ===============================
    // 5. V5.4 F4 EARLY WARNING SYSTEM (Power Loss + Lead Confluence)
    // ===============================
    const f4Data = this.calculateF4Signals(f4WholeSeries, activeConfig, autoParams, volatilityRegime, finalHighs, finalLows, finalCloses, earlyReversal, stochRsi, v5IndicatorData, len);
    const { 
        f4PowerLoss, hasEarlyBuyLead, hasEarlySellLead, 
        hasConfirmedBuyLead, hasConfirmedSellLead 
    } = f4Data;

    // ===============================
    // 6. LIQUIDITY ZONE DETECTION (SMC)
    // ===============================
    const smc = this.calculateSMC(finalHighs, finalLows, finalCloses, tfAdapt, intervalSec);
    const liquidityData = this.evaluateLiquidity(currentPrice, smc);
    const { liquidityBonus, liquidityZone } = liquidityData;

    // ===============================
    // 7. PREDICTION ENGINE & CONFLUENCE
    // ===============================
    const saeThreshold = 75;
    const confluenceBreakdown = this.calculateConfluenceScore(
      activeConfig,
      rsi,
      macdBull,
      macd.hist,
      stochRsi.k,
      stochRsi.d,
      adx,
      ribbonBull,
      ribbonBear,
      ema8,
      ema55,
      ichiAbove,
      ichiBelow,
      vwapAbove,
      whaleStatus,
      currentVolume,
      volSMA,
      isGreen,
      st.bull,
      volatilityRegime,
      marketRegime,
      earlyReversal,
      slope,
      trendUp,
      liquidityBonus,
      { tech: 25, momentum: 25, market: 25, trend: 25 },
      saeThreshold
    );

    const predictionData = this.evaluatePredictions(confluenceBreakdown.totalScore, isGreen);
    const { prediction, predictionUpProb, predictionDownProb } = predictionData;

    // ===============================
    // 8. SIGNAL ARBITRATION (SAE) & DECISION
    // ===============================
    const vpa = this.calculateVPA(finalCloses, finalHighs, finalLows, volumes);
    const arbitration = this.performSignalArbitration(
      confluenceBreakdown.totalScore, 
      predictionUpProb, 
      predictionDownProb, 
      saeThreshold, 
      autoParams, 
      riskMode, 
      smc, 
      whaleStatus, 
      zScore, 
      vpa, 
      f4Power, 
      ribbonState, 
      volatilityRegime, 
      hasEarlyBuyLead, 
      hasConfirmedBuyLead, 
      hasEarlySellLead, 
      hasConfirmedSellLead, 
      len
    );
    const { systemDecision, tradeSignal, finalAiScore } = arbitration;

    // ===============================
    // 9. PHASE & PHASES
    // ===============================
    const trendStrength = Math.abs(ema50 - ema200) / haClose;
    const phaseData = this.evaluateMarketPhases(
      ema50, ema200, haClose, isStoppingVolume, zScore, baseAcceleration, 
      volatilityRegime, earlyReversal, slope, whaleHighVol, trendUp, currentVolume, 
      volSMA, atrVal, atrSMA, trendStrength, macdBull, st, rsi, adx, isWhale, 
      fakeBreakoutUp, fakeBreakoutDown, marketRegime, whaleStatus
    );
    const { regimePrediction: finalRegimePrediction, marketPhaseText: marketPhaseTextValue, capitalFlowText: capitalFlowTextValue, capitalPhase: capitalPhaseValue, mtfConsensusStr, components, bullIndicators } = phaseData;

    // ===============================
    // 10. TARGET CALCULATIONS (ATR-Based)
    // ===============================
    const adaptedAtrLen = this.adaptPeriod(14, tfAdapt);
    const targets = this.calculateTargets(finalHighs, finalLows, finalCloses, adaptedAtrLen, currentPrice, systemDecision, predictionUpProb, predictionDownProb).targets;

    return this.assembleResult(
      currentPrice, tradeSignal, f4Value, f4FiboValue, finalAiScore, components, 
      marketRegime, volatilityRegime, finalRegimePrediction, systemDecision, zScore, 
      mtfConsensusStr, earlyReversal, fastSlope, fastAcceleration, confluenceBreakdown, 
      prediction, smc, highs, lows, vpa, v5Indicators, momentumState, momentumColor, 
      whaleSignalText, marketPhaseTextValue, capitalFlowTextValue, capitalPhaseValue, 
      fundingRate, tfAdapt, targets, f4Power, f4PowerLoss, hasEarlyBuyLead, hasEarlySellLead, 
      hasConfirmedBuyLead, hasConfirmedSellLead, liquidityZone, liquidityBonus, bullIndicators, isWhale,
      whaleStatus as MatrixV5Result["whaleStatus"], closes
    );
  }

  private assembleResult(
    currentPrice: number, tradeSignal: string | null, f4Value: number, 
    f4FiboValue: number, finalAiScore: number, components: any, 
    marketRegime: MarketRegime, volatilityRegime: VolatilityRegime, 
    regimePrediction: RegimePrediction, systemDecision: SystemDecision, 
    zScoreValue: number, mtfConsensus: string, earlyReversal: string | null, 
    fastSlope: number, fastAcceleration: number, confluenceBreakdown: ConfluenceBreakdown, 
    prediction: PredictionResult, smc: SMCResult, highs: number[], lows: number[], 
    vpa: VPAResult, v5Indicators: V5IndicatorState[], momentumState: string, 
    momentumColor: string, whaleSignalText: string, marketPhaseTextValue: string, 
    capitalFlowTextValue: string, capitalPhaseValue: string, fundingRate: number, 
    tfAdapt: number, targets: any, f4Power: number, f4PowerLoss: number, 
    hasEarlyBuyLead: boolean, hasEarlySellLead: boolean, 
    hasConfirmedBuyLead: boolean, hasConfirmedSellLead: boolean, 
    liquidityZone: string, liquidityBonus: number, bullIndicators: number, isWhale: boolean,
    whaleStatus: MatrixV5Result["whaleStatus"] = "NEUTRAL", closes: number[] = []
  ): MatrixV5Result {
    const payload: MatrixV5Result = {
      symbol: "BTCUSDT", // Placeholder, usually set by strategy
      trend: f4Value > 0 ? "BULLISH" : "BEARISH",
      slope: fastSlope,
      acceleration: fastAcceleration,
      whaleDetected: isWhale,
      whaleStatus,
      signal: tradeSignal as any,
      f4Value,
      f4FiboValue,
      aiScore: finalAiScore,
      aiComponents: components,
      marketRegime,
      volatilityRegime,
      regimePrediction,
      systemDecision,
      zScoreValue,
      mtfConsensus,
      earlyReversal: earlyReversal as any,
      fastSlope,
      fastAcceleration,
      deathRisk: this.bayesianMetrics.currentWinRate < 0.4 && this.bayesianMetrics.totalSignals > 5,
      whaleTrust: this.calculateWhaleTrust(zScoreValue, whaleStatus),
      confluenceScore: confluenceBreakdown.totalScore,
      confluenceBreakdown,
      prediction,
      adm: this.calculateADM(closes, vpa, fastSlope),
      vpa,
      v5Indicators,
      momentumState,
      momentumColor,
      whaleSignalText,
      marketPhaseText: marketPhaseTextValue,
      capitalFlowText: capitalFlowTextValue,
      capitalPhase: capitalPhaseValue,
      fundingRate,
      fundingImpact: Math.round(fundingRate * 100000) / 1000,
      tfAdaptFactor: tfAdapt,
      smc,
      liquidity: this.calculateLiquidity(highs, lows),
      systemRestMode: confluenceBreakdown.totalScore < 30 && volatilityRegime === "NORMAL",
      vixBottom: volatilityRegime === "SQUEEZE" && zScoreValue < -1.5,
      inPremium: zScoreValue > 1.5,
      inDiscount: zScoreValue < -1.5,
      swingTrend: smc.swingTrend,
      targets,
      f4Power,
      f4PowerLoss,
      f4EarlyBuy: hasEarlyBuyLead,
      f4EarlySell: hasEarlySellLead,
      f4ConfirmedBuy: hasConfirmedBuyLead,
      f4ConfirmedSell: hasConfirmedSellLead,
      liquidityZone,
      liquidityBonus,
      mtfWeightedScore: 0,
      dynamicWeights: { tech: 25, momentum: 25, market: 25, trend: 25 },
      mtfBullCount: bullIndicators,
      indicatorBullCount: bullIndicators,
    };
    return payload;
  }

  private evaluateLiquidity(currentPrice: number, smc: any) {
    let inBullishOB = false, inBearishOB = false;
    let inBullishFVG = false, inBearishFVG = false;

    for (const ob of smc.orderBlocks.slice(0, 5)) {
      if (ob.type === "BULLISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
      if (ob.type === "BEARISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
    }
    for (const fvg of smc.fvgs.slice(0, 5)) {
      if (fvg.type === "BULLISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
      if (fvg.type === "BEARISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
    }

    const liquidityBonus = inBullishOB || inBullishFVG || inBearishOB || inBearishFVG ? 10 : 0;
    const liquidityZone = inBullishOB ? "OB BOĞA" : inBearishOB ? "OB AYI" : inBullishFVG ? "FVG BOĞA" : inBearishFVG ? "FVG AYI" : "YOK";
    return { liquidityBonus, liquidityZone };
  }

  private evaluateMarketContext(closes: number[], highs: number[], lows: number[], tfAdapt: number, isStoppingVolume: boolean, slope: number, currentPrice: number, len: number, activeConfig: MatrixV5Config, whaleData: any, haClose: number) {
    const regimeData = this.calculateRegimes(closes, tfAdapt, isStoppingVolume, slope);
    const isGreen = haClose > (closes[len - 2] || haClose);
    const adaptedAtrLen = this.adaptPeriod(14, tfAdapt);
    const atrVal = this.calculateATR(highs, lows, closes, adaptedAtrLen);
    const atrSMA = this.calculateSMA(
      highs.map((h, i) => Math.max(h - lows[i], Math.abs(h - (closes[i - 1] || closes[i])), Math.abs(lows[i] - (closes[i - 1] || closes[i])))).slice(Math.max(0, len - adaptedAtrLen * 2)),
      adaptedAtrLen
    );
    const whaleHighVol = atrVal > atrSMA;
    const adaptedZLen = regimeData.adaptedZLen;
    const zScoreSMA = this.calculateSMA(closes, adaptedZLen);
    const zScoreStdev = this.calculateStdDev(closes, adaptedZLen);
    const zScore = zScoreStdev > 0 ? (haClose - zScoreSMA) / zScoreStdev : 0;

    let whaleStatus = whaleData.whaleStatus;
    let whaleSignalText = whaleData.whaleSignalText;
    if (Math.abs(zScore) > 2.0 && whaleStatus === "NEUTRAL") {
      whaleStatus = isGreen ? "BUY_ACTIVE" : "SELL_ACTIVE";
      whaleSignalText = isGreen ? "Z-DAĞILIM ALIMI 🐋" : "Z-DAĞILIM SATIŞI 🐋";
    }

    const acceleration = (slope - (closes[len - 2] ? (closes[len - 1] - closes[len - 2]) / closes[len - 1] * 100 : slope));
    const momentumState = slope > 0 && acceleration > 0 ? "HIZLANIYOR 🚀" : slope > 0 && acceleration <= 0 ? "YAVAŞLIYOR ⚠️" : slope < 0 && acceleration < 0 ? "ÇÖKÜŞ 💀" : slope < 0 && acceleration >= 0 ? "DİP OLUŞUMU 🔄" : "NÖTR";
    const momentumColor = slope > 0 && acceleration > 0 ? "green" : slope < 0 && acceleration < 0 ? "red" : "gray";

    return { ...regimeData, isGreen, atrVal, atrSMA, whaleHighVol, zScore, whaleStatus, whaleSignalText, momentumState, momentumColor, acceleration };
  }

  private calculateF4Signals(f4WholeSeries: number[], activeConfig: MatrixV5Config, autoParams: any, volatilityRegime: VolatilityRegime, highs: number[], lows: number[], closes: number[], earlyReversal: string | null, stochRsi: any, v5IndicatorData: any, currentBarIndex: number) {
    const f4Value = f4WholeSeries[f4WholeSeries.length - 1];
    const prevF4Value = f4WholeSeries[f4WholeSeries.length - 2] || f4Value;
    const f4Slope = f4Value - prevF4Value;
    const f4SlopeSign = Math.sign(f4Slope);
    
    if (f4SlopeSign !== this.lastF4SlopeSign) {
        this.buyFired = false;
        this.sellFired = false;
        this.lastF4SlopeSign = f4SlopeSign;
    }

    const wt = this.calculateWaveTrend(highs, lows, closes, activeConfig.stochRsiLen, activeConfig.stochRsiLen);
    const wtCrossUp = wt.wt1 > wt.wt2 && wt.prevWt1 <= wt.prevWt2;
    const wtCrossDn = wt.wt1 < wt.wt2 && wt.prevWt1 >= wt.prevWt2;
    const isVixBottom = this.calculateVixFix(closes, highs, lows, 22, 20, 2.0, 50, 0.85, 1.01);
    
    const prevStochK = (v5IndicatorData as any).prevStochK;
    const prevStochD = (v5IndicatorData as any).prevStochD;
    const stochCrossUp = stochRsi.k > stochRsi.d && prevStochK <= prevStochD;
    const stochCrossDn = stochRsi.k < stochRsi.d && prevStochK >= prevStochD;

    const buyLeadConfluence = (earlyReversal === "UP" ? 1 : 0) + (wtCrossUp ? 1 : 0) + (isVixBottom ? 1 : 0) + (stochRsi.k < 30 ? 1 : 0);
    const sellLeadConfluence = (earlyReversal === "DOWN" ? 1 : 0) + (wtCrossDn ? 1 : 0) + (stochRsi.k > 70 ? 1 : 0);

    const f4SlopeStrength = Math.abs(f4Slope);
    const slopeHistory: number[] = [];
    const lb = Math.min(autoParams.lookback, f4WholeSeries.length - 2);
    for (let i = 0; i < lb; i++) {
        const idx = f4WholeSeries.length - 1 - i;
        slopeHistory.push(Math.abs(f4WholeSeries[idx] - (f4WholeSeries[idx - 1] || f4WholeSeries[idx])));
    }
    const f4SlopeMax = slopeHistory.length > 0 ? Math.max(...slopeHistory, f4SlopeStrength) : f4SlopeStrength;
    const f4PowerLoss = f4SlopeMax > 0.00001 ? ((f4SlopeMax - f4SlopeStrength) / f4SlopeMax) * 100 : 0;
    
    const minLoss = activeConfig.minPowerLoss ?? 90;
    
    // Directional Squeeze Logic - Respecting absolute user mandate of 90+ Power Loss
    const longSqueezeThr = Math.max(minLoss, activeConfig.longSqueezeThreshold ?? 20);
    const shortSqueezeThr = Math.max(minLoss, activeConfig.shortSqueezeThreshold ?? 20);
    
    const buySqueezeThreshold = volatilityRegime === "SQUEEZE" ? shortSqueezeThr : Math.max(minLoss, activeConfig.f4PowerLossThreshold);
    const sellSqueezeThreshold = volatilityRegime === "SQUEEZE" ? longSqueezeThr : Math.max(minLoss, activeConfig.f4PowerLossThreshold);

    const f4AnticipatoryBuy = f4Slope < 0 && (buyLeadConfluence >= 1 || f4PowerLoss >= 99.0) && f4PowerLoss >= minLoss;
    const f4AnticipatorySell = f4Slope > 0 && (sellLeadConfluence >= 1 || f4PowerLoss >= 99.0) && f4PowerLoss >= minLoss;

    const f4EarlyBuy = (f4Slope < 0 && f4PowerLoss >= buySqueezeThreshold) || f4AnticipatoryBuy;
    const f4EarlySell = (f4Slope > 0 && f4PowerLoss >= sellSqueezeThreshold) || f4AnticipatorySell;
    
    // P4.1: Confirmed signals MUST also satisfy the Power Loss threshold as per user mandate
    const f4ConfirmedBuy = f4Value > prevF4Value && prevF4Value <= (f4WholeSeries[f4WholeSeries.length - 3] || prevF4Value) && f4PowerLoss >= minLoss;
    const f4ConfirmedSell = f4Value < prevF4Value && prevF4Value >= (f4WholeSeries[f4WholeSeries.length - 3] || prevF4Value) && f4PowerLoss >= minLoss;

    return { f4PowerLoss, buySqueezeThreshold, sellSqueezeThreshold, hasEarlyBuyLead: f4EarlyBuy, hasEarlySellLead: f4EarlySell, hasConfirmedBuyLead: f4ConfirmedBuy, hasConfirmedSellLead: f4ConfirmedSell };
  }

  private performSignalArbitration(confluenceScore: number, predictionUpProb: number, predictionDownProb: number, saeThreshold: number, autoParams: any, riskMode: string, smc: any, whaleStatus: string, zScore: number, vpa: any, f4Power: number, ribbonState: string, volatilityRegime: VolatilityRegime, hasEarlyBuyLead: boolean, hasConfirmedBuyLead: boolean, hasEarlySellLead: boolean, hasConfirmedSellLead: boolean, barIndex: number) {
    let currentMinAi = autoParams.minAiScore;
    let currentMinConf = autoParams.minConfluenceScore;
    if (riskMode === "safe") { currentMinAi += 10; currentMinConf += 12; }
    else if (riskMode === "aggressive") { currentMinAi -= 15; currentMinConf -= 15; }

    let rawSystemDecision: SystemDecision = (confluenceScore >= currentMinConf && predictionUpProb >= saeThreshold) ? "GO_LONG" : (confluenceScore >= currentMinConf && predictionDownProb >= saeThreshold) ? "GO_SHORT" : "WAIT";
    
    // F4 Priority Sync (Global) - Treat F4 labels as actionable even if trend is opposite
    const isF4BuyPriority = hasEarlyBuyLead || hasConfirmedBuyLead;
    const isF4SellPriority = hasEarlySellLead || hasConfirmedSellLead;
    const isF4Priority = isF4BuyPriority || isF4SellPriority;

    if (isF4BuyPriority && rawSystemDecision === "WAIT") rawSystemDecision = "GO_LONG";
    if (isF4SellPriority && rawSystemDecision === "WAIT") rawSystemDecision = "GO_SHORT";

    const saeResult = evaluateSAE({ 
      smc, 
      whaleStatus, 
      zScore, 
      vpa, 
      f4Power, 
      f4EarlyBuy: hasEarlyBuyLead,
      f4EarlySell: hasEarlySellLead,
      f4ConfirmedBuy: hasConfirmedBuyLead,
      f4ConfirmedSell: hasConfirmedSellLead,
      ribbonState, 
      volatilityRegime, 
      currentWinRate: this.bayesianMetrics.currentWinRate, 
      rawSystemDecision,
      isF4Priority 
    });
    
    let systemDecision: SystemDecision = saeResult.finalDecision as SystemDecision;
    const longCondition = systemDecision === "GO_LONG";
    const shortCondition = systemDecision === "GO_SHORT";

    let finalAiScore = Math.max(5, Math.min(99, confluenceScore * 0.4 + Math.max(predictionUpProb, predictionDownProb) * 0.4 + 20) + saeResult.aiPenalty);
    
    // Global F4 Boost: If F4 confirms, we force highest priority
    if (isF4Priority && saeResult.finalDecision !== "NO_TRADE") {
        finalAiScore = 100;
    } else if (saeResult.finalDecision === "NO_TRADE") {
        finalAiScore = 0;
    }

    let tradeSignal: "BUY" | "SELL" | null = null;
    
    // [URGENT] F4 Mandate: Signal ONLY if F4 is active
    const isF4Buy = hasEarlyBuyLead || hasConfirmedBuyLead;
    const isF4Sell = hasEarlySellLead || hasConfirmedSellLead;

    if (isF4Buy && finalAiScore >= currentMinAi && !this.buyFired) {
        tradeSignal = "BUY";
        this.buyFired = true;
        this.lastSignalBarIndex = barIndex;
    } else if (isF4Sell && finalAiScore >= currentMinAi && !this.sellFired) {
        tradeSignal = "SELL";
        this.sellFired = true;
        this.lastSignalBarIndex = barIndex;
    }

    return { systemDecision, tradeSignal, finalAiScore };
  }

  private evaluatePredictions(confluenceScore: number, isGreen: boolean): { prediction: PredictionResult; predictionUpProb: number; predictionDownProb: number } {
    const predictionUpProb = Math.min(99, Math.max(0, confluenceScore + (isGreen ? 5 : -5))); 
    const predictionDownProb = 100 - predictionUpProb;
    const predictionText = predictionUpProb >= 70 ? "YUKARI 📈" : predictionDownProb >= 70 ? "AŞAĞI 📉" : "YATAY";
    const prediction: PredictionResult = { upProb: predictionUpProb, downProb: predictionDownProb, text: predictionText, direction: predictionUpProb >= 70 ? "UP" : predictionDownProb >= 70 ? "DOWN" : "FLAT" };
    return { prediction, predictionUpProb, predictionDownProb };
  }

  private evaluateMarketPhases(ema50: number, ema200: number, currentPrice: number, isStoppingVolume: boolean, zScore: number, acceleration: number, volatilityRegime: VolatilityRegime, earlyReversal: string | null, slope: number, whaleHighVol: boolean, trendUp: boolean, currentVolume: number, volSMA: number, atrVal: number, atrSMA: number, trendStrength: number, macdBull: boolean, st: any, rsi: number, adx: any, isWhale: boolean, fakeBreakoutUp: boolean, fakeBreakoutDown: boolean, marketRegime: string, whaleStatus: string) {
    const trendStrengthVal = Math.abs(ema50 - ema200) / currentPrice;
    let regimePredictionValue: RegimePrediction = "TRANSITION";
    if (isStoppingVolume) regimePredictionValue = "STOPPING_VOLUME";
    else if (Math.abs(zScore) > 2.0 && acceleration < 0) regimePredictionValue = "EXHAUSTION";
    else if (volatilityRegime === "SQUEEZE") regimePredictionValue = "PRE_EXPLOSION";
    else if (earlyReversal === "UP") regimePredictionValue = "EARLY_REVERSAL_UP";
    else if (earlyReversal === "DOWN") regimePredictionValue = "EARLY_REVERSAL_DOWN";
    else if (slope > 0 && acceleration > 0 && whaleHighVol) regimePredictionValue = "ACCELERATING_TREND";
    else if (slope > 0 && acceleration <= 0) regimePredictionValue = "DECELERATING_TREND";
    else if (slope < 0 && acceleration < 0 && whaleHighVol) regimePredictionValue = "ACCELERATING_DROP";
    else if (slope < 0 && acceleration >= 0) regimePredictionValue = "BOTTOM_FINDING";
    else if (trendStrengthVal < 0.005) regimePredictionValue = "RANGE";

    let marketPhaseTextValue = "KONSOLİDASYON";
    if (whaleStatus === "BUY_ACTIVE" && volatilityRegime === "SQUEEZE") marketPhaseTextValue = "AKÜMÜLASYON 💎";
    else if (whaleStatus === "SELL_ACTIVE" && volatilityRegime === "SQUEEZE") marketPhaseTextValue = "DAĞITIM ⚠️";
    else if (trendUp && whaleHighVol) marketPhaseTextValue = "YUKARI TREND 🚀";
    else if (!trendUp && whaleHighVol) marketPhaseTextValue = "AŞAĞI TREND 📉";

    const capital = this.calculateCapitalFlow(currentVolume, volSMA, atrVal, atrSMA, trendStrength, slope);
    const bullIndicators = [slope > 0, macdBull, st.bull, rsi > 50, adx.diPlus > adx.diMinus].filter(Boolean).length;
    const mtfConsensusStr = `${bullIndicators}/5 ${bullIndicators >= 4 ? "GÜÇLÜ BOĞA" : bullIndicators <= 1 ? "GÜÇLÜ AYI" : bullIndicators >= 3 ? "BOĞA" : "KARIŞIK"}`;

    const components: AiScoreComponents = {
      whaleConfirmed: isWhale && !fakeBreakoutUp && !fakeBreakoutDown ? 15 : 0,
      regimeAlignment: marketRegime === "RISK_ON" && whaleStatus === "BUY_ACTIVE" ? 15 : 0,
      volumePower: isWhale ? 10 : 0,
      trendAlignment: trendUp ? 10 : 0,
      mtfConsensus: bullIndicators >= 3 ? 15 : 5,
      momentumAccel: (slope > 0 && acceleration > 0) || (slope < 0 && acceleration < 0) ? 10 : 0,
      volatilityRegime: volatilityRegime === "SQUEEZE" ? 10 : 0,
      zScore: Math.abs(zScore) > 2.5 ? 10 : Math.abs(zScore) > 1.5 ? 5 : 0,
      bayesianWinRate: Math.round(this.bayesianMetrics.currentWinRate * 10),
      trapPenalty: fakeBreakoutUp || fakeBreakoutDown ? -15 : 0,
    };
    return { regimePrediction: regimePredictionValue, marketPhaseText: marketPhaseTextValue, capitalFlowText: capital.text, capitalPhase: capital.phase, mtfConsensusStr, components, bullIndicators };
  }

  private calculateTargets(highs: number[], lows: number[], closes: number[], adaptedAtrLen: number, currentPrice: number, systemDecision: string, predictionUpProb: number, predictionDownProb: number) {
    const atrTarget = this.calculateATR(highs, lows, closes, adaptedAtrLen);
    const direction = systemDecision === "GO_LONG" ? 1 : systemDecision === "GO_SHORT" ? -1 : predictionUpProb > predictionDownProb ? 1 : -1;
    const targets = { t1: currentPrice + direction * atrTarget * 1.5, t2: currentPrice + direction * atrTarget * 3.0, sl: currentPrice - direction * atrTarget * 1.2, buyDev: atrTarget * 0.6 };
    return { targets };
  }

  private calculateWhaleTrust(zScore: number, whaleStatus: string): number {
    let whaleTrust = this.bayesianMetrics.currentWinRate;
    if (Math.abs(zScore) >= 2.4) {
      const rawExtremity = (Math.abs(zScore) - 2.4) / 1.0;
      if (whaleStatus === "BUY_ACTIVE" || whaleStatus === "SELL_ACTIVE") whaleTrust = Math.max(0.80, Math.min(1.0, 0.80 + rawExtremity * 0.20));
      else whaleTrust = Math.min(0.20, Math.max(0, 0.20 - rawExtremity * 0.20));
    }
    return whaleTrust;
  }

}
