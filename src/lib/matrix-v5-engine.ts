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
  f4Multiplier: number;
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
  // === MATRIX HORIZON FAZ 2: Ek SMC Alanlar ===
  bosStrength: "STRONG" | "WEAK" | "NONE";    // BOS guc seviyesi
  chochConfirmed: boolean;                      // CHoCH volum ile onaylandi mi
  sweepUp: boolean;                             // Yukari stop hunt tespit
  sweepDown: boolean;                           // Asagi stop hunt tespit
  structureScore: number;                       // 0-100 yapı skoru
}

export interface LiquidityResult {
  eqHighs: boolean;
  eqLows: boolean;
  // === MATRIX HORIZON FAZ 2: SMC Genisletilmis Likidite ===
  eqlCount: number;          // Esit tepe (Equal High) sayisi
  eqhCount: number;          // Esit dip (Equal Low) sayisi
  inPremium: boolean;        // Fiyat premium bolgede mi (>%61.8 EQ)
  inDiscount: boolean;       // Fiyat discount bolgede mi (<%.38.2 EQ)
  equilibrium: number;       // EQ orta nokta
  liquidityHuntUp: boolean;  // Yukari likidite avlanmasi ihtimali
  liquidityHuntDown: boolean; // Asagi likidite avlanmasi ihtimali
  nearestOBHigh: number;     // En yakin Bullish OB tepesi
  nearestOBLow: number;      // En yakin Bullish OB dibi
  smcBias: "BULLISH" | "BEARISH" | "NEUTRAL"; // SMC genel yanlilik
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

  // === MATRIX HORIZON FAZ 3: Projeksiyon ve AI NLP ===
  aiSummary: string;           // Turkce AI karar ozeti
  projectionBias: "BULLISH" | "BEARISH" | "NEUTRAL"; // Projeksiyon yonu
  projectionConfidence: number;  // 0-100 projeksiyon guven skoru
  kellyFraction: number;         // Kelly Kriteri pozisyon orani (0-1)

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
    // === MATRIX HORIZON FAZ 4: Adaptif Öğrenme Rate ===
    emaWinRate: 0.5,      // Exponential Moving Average bazlı win rate
    learningRate: 0.15,   // Başlangıç öğrenme oranı (λ)
    recentStreak: 0,      // Art arda kazanç/kayıp serisi (+pozitif, -negatif)
    signalQualitySum: 0,  // Sinyal kalite ağırlıkları kümülatif
    regimeShiftCount: 0,  // Piyasa rejim değişim sayısı
    lastRegime: "NEUTRAL" as string,
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
      f4Multiplier: d(config.f4Multiplier, 1.2, "f4Multiplier"),
      f4SlopeThreshold: d(config.f4SlopeThreshold, 0.01, "f4SlopeThreshold"),
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
    // Priority: 1. Runtime configOverrides (overrides param) 2. Global Engine Config
    return {
      f4Length: overrides.f4Length ?? currentConfig.f4Length ?? 10,
      f4Multiplier: overrides.f4Multiplier ?? currentConfig.f4Multiplier ?? 1.2,
      whaleVolumeMultiplier: overrides.whaleVolumeMultiplier ?? currentConfig.whaleVolumeMultiplier ?? 1.8,
      minAiScore: overrides.minAiScore ?? currentConfig.minAiScore ?? 65,
      minConfluenceScore: overrides.minConfluenceScore ?? currentConfig.minConfluenceScore ?? 60,
      f4SlopeThreshold: overrides.f4SlopeThreshold ?? currentConfig.f4SlopeThreshold ?? 0.01,
      f4LookbackBars: overrides.f4LookbackBars ?? currentConfig.f4LookbackBars ?? 30,
    };
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
      "1Mo": 2592000,
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
    const len = closes.length;
    if (len < 10) return { classification: 0, evidence: "YOK", bias: "Sapma Yok", direction: 0 };

    // 1. Dinamik Horizon Seçimi (Veriye Göre Adım Adım)
    const horizon = Math.min(60, Math.floor(len / 4));
    if (horizon < 5) return { classification: 0, evidence: "YOK", bias: "Sapma Yok", direction: 0 };

    // 2. Returns (Getiriler) tabanlı İstatistiksel ADM Hesaplaması
    const returns: number[] = [];
    const maxSampleBars = Math.min(756, len - 1);
    
    // Geçmiş getirilerin dağılımı
    for (let i = 0; i < maxSampleBars - horizon && i + horizon < len; i++) {
        const idx = len - 1 - i;
        const prevIdx = idx - horizon;
        if (prevIdx < 0) break;
        const r = (closes[idx] - closes[prevIdx]) / closes[prevIdx];
        returns.push(r);
    }

    if (returns.length < 5) {
        return { classification: 0, evidence: "YOK", bias: "Sapma Yok", direction: 0 };
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
    const sd = Math.sqrt(variance);
    const se = sd / Math.sqrt(returns.length);
    const tStat = se > 1e-10 ? mean / se : 0;
    
    // Yıllıklandırılmış Drift Oranı (Standart 252 İş Günü Modeli Adaptasyonu)
    const annDrift = mean * (252 / horizon);
    const direction = mean > 0 ? 1 : mean < 0 ? -1 : 0;
    
    // T-İstatistiğine Bağlı Güvenilirlik Testi
    // |tStat| > 1.96 = 95% Güven, |tStat| > 2.58 = 99% Güven
    const statSig = Math.abs(tStat) > 1.96;
    const strongStatSig = Math.abs(tStat) > 2.58;
    
    // Ekonomik Açıdan Anlamlılık (%5+ yıllıklandırılmış sapma)
    const econSig = Math.abs(annDrift) >= 0.05;
    
    let classification = 0;
    let evidence: ADMResult["evidence"] = "YOK";

    if (strongStatSig && econSig) {
        classification = direction * 2;
        evidence = "GÜÇLÜ";
    } else if (statSig || econSig) {
        classification = direction;
        evidence = "ZAYIF";
    }

    // Bias Yorumu (Profesyonel Standart)
    const bias = classification === 2 ? "Güçlü Pozitif Sapma" : 
                 classification === -2 ? "Güçlü Negatif Sapma" :
                 classification === 1 ? "Pozitif (Zayıf)" : 
                 classification === -1 ? "Negatif (Zayıf)" : "Sapma Yok";

    return { classification, evidence, bias, direction };
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
    if (len < 20) {
      return {
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        netPressure: 50,
        state: "NÖTR",
      };
    }

    // Gerçek Wyckoff VPA (Volume Price Analysis) Hesaplaması
    const currentHigh = highs[len - 1];
    const currentLow = lows[len - 1];
    const currentClose = closes[len - 1];
    const currentOpen = closes[len - 2] || currentClose;
    const currentVol = volumes[len - 1];

    const spread = currentHigh - currentLow;
    
    // Average Spread & Volume (20 periods)
    let sumSpread = 0;
    let sumVol = 0;
    for (let i = len - 20; i < len; i++) {
        sumSpread += highs[i] - lows[i];
        sumVol += volumes[i];
    }
    const avgSpread = sumSpread / 20;
    const avgVol = sumVol / 20;

    const relVol = avgVol > 0 ? currentVol / avgVol : 1;
    const relSpread = avgSpread > 0 ? spread / avgSpread : 1;
    const isUp = currentClose > currentOpen;
    const closePosition = spread > 0 ? (currentClose - currentLow) / spread : 0.5;

    // Anomaliler ve Modlar
    const isHighVol = relVol > 1.5;
    const isUltraHighVol = relVol > 2.5;

    let state: VPAResult["state"] = "NÖTR";
    let pressureMod = 50;

    if (isUp) {
        if (isHighVol && closePosition < 0.4) {
            state = "SATIM BASKISI"; // Exhaustion / Satıcıların devreye girmesi
            pressureMod = 30;
        } else if (isUltraHighVol && relSpread < 0.8 && closePosition > 0.5) {
            state = "ALIM BASKISI"; // Bullish absorption
            pressureMod = 80;
        } else if (isHighVol && closePosition > 0.6) {
            state = "ALIM BASKISI"; // Güçlü boğa mumu
            pressureMod = 70;
        } else if (relVol < 0.7 && relSpread < 0.7) {
            state = "NÖTR"; // No demand
            pressureMod = 45;
        } else {
            pressureMod = 55;
        }
    } else {
        if (isHighVol && closePosition > 0.6) {
            state = "ALIM BASKISI"; // Stopping Volume / Alıcıların devreye girmesi
            pressureMod = 75;
        } else if (isUltraHighVol && relSpread < 0.8 && closePosition < 0.5) {
            state = "SATIM BASKISI"; // Bearish absorption
            pressureMod = 20;
        } else if (isHighVol && closePosition < 0.4) {
            state = "SATIM BASKISI"; // Güçlü ayı mumu
            pressureMod = 30;
        } else if (relVol < 0.7 && relSpread < 0.7) {
            state = "NÖTR"; // No supply
            pressureMod = 55;
        } else {
            pressureMod = 45;
        }
    }

    // Kısa vadeli trendi yumuşatarak Net Pressure hesapla (5 barlık kümülatif delta v2)
    let buyVolAcc = 0;
    let sellVolAcc = 0;
    for (let i = len - 5; i < len; i++) {
        const _spread = highs[i] - lows[i];
        const _buyPct = _spread === 0 ? 0.5 : (closes[i] - lows[i]) / _spread;
        buyVolAcc += volumes[i] * _buyPct;
        sellVolAcc += volumes[i] * (1 - _buyPct);
    }

    const netPressure = (buyVolAcc + sellVolAcc) > 0 
        ? ((buyVolAcc / (buyVolAcc + sellVolAcc)) * 100 * 0.7) + (pressureMod * 0.3) 
        : 50;

    const buyPct = spread === 0 ? 0.5 : (currentClose - currentLow) / spread;
    const currentBuyVol = currentVol * buyPct;
    const currentSellVol = currentVol * (1 - buyPct);

    return {
      buyVolume: currentBuyVol,
      sellVolume: currentSellVol,
      delta: currentBuyVol - currentSellVol,
      netPressure: Math.min(100, Math.max(0, netPressure)),
      state,
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
    saeThreshold: number,
    // === MATRIX HORIZON FAZ 1: Makro & Sentiment Carpanlari ===
    sentimentScore: number = 0,
    btcDominance: number = 50,
    usdtDominance: number = 5,
    fundingRate: number = 0
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

    // 5. Market Score: Regime + Altcoin Season Context
    let mktScoreRaw = (marketRegime === "RISK_ON" ? 15 : 5) + (trendUp ? 10 : 0);
    
    // Impact of BTC Dominance: High BTC.D is usually bad for alts unless BTC is pumping
    if (btcDominance > 55) mktScoreRaw -= 5;
    else if (btcDominance < 45) mktScoreRaw += 5;

    // Impact of Sentiment: Extremes are contra-indicators or momentum boosters
    if (sentimentScore > 70) mktScoreRaw += 5; // Greed follows trend
    else if (sentimentScore < -50) mktScoreRaw -= 5; // Fear risk

    const mktScore = Math.min(30, Math.max(0, mktScoreRaw));

    // 6. Timing Score: Volatility + Funding Impact
    let timScoreRaw = (volatilityRegime === "SQUEEZE" ? 3 : volatilityRegime === "EXPLOSION" ? 5 : 4) + (earlyReversal ? 5 : 3);
    
    // Funding Rate Impact: High positive funding = leverage risk for longs
    if (fundingRate > 0.01) timScoreRaw -= 2;
    else if (fundingRate < -0.01) timScoreRaw += 2;

    const timScore = Math.min(15, Math.max(0, timScoreRaw));

    // ─── FINAL AGGREGATION ───
    const confluenceScore = Math.max(0, Math.min(100,
      (techScore / 40) * dynamicWeights.tech +
      (momentumScore / 30) * dynamicWeights.momentum +
      (volumeScore / 25) * activeConfig.confluenceWeightVol +
      (trendScore / 40) * dynamicWeights.trend +
      (mktScore / 30) * dynamicWeights.market +
      (timScore / 15) * activeConfig.confluenceWeightTiming +
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
    const empty: SMCResult = {
      swingTrend: "NEUTRAL", internalTrend: "NEUTRAL",
      bos: false, choch: false, orderBlocks: [], fvgs: [],
      bosStrength: "NONE", chochConfirmed: false,
      sweepUp: false, sweepDown: false, structureScore: 0,
    };
    if (len < 50) return empty;

    // === MATRIX HORIZON FAZ 2: Gercek SMC Algoritmasi ===

    // --- 1. Swing High/Low Tespiti (Zigzag benzeri) ---
    const swingLen = Math.max(3, Math.round(10 * tfAdaptFactor));
    const swingHighs: { idx: number; price: number }[] = [];
    const swingLows:  { idx: number; price: number }[] = [];

    const lookback = Math.min(len - 1, 100);
    const startIdx = len - lookback;

    for (let i = startIdx + swingLen; i < len - swingLen; i++) {
      let isHigh = true, isLow = true;
      for (let j = i - swingLen; j <= i + swingLen; j++) {
        if (j === i) continue;
        if (highs[j] >= highs[i]) isHigh = false;
        if (lows[j]  <= lows[i])  isLow  = false;
      }
      if (isHigh) swingHighs.push({ idx: i, price: highs[i] });
      if (isLow)  swingLows.push({ idx: i, price: lows[i] });
    }

    const lastSH = swingHighs[swingHighs.length - 1];
    const prevSH = swingHighs[swingHighs.length - 2];
    const lastSL = swingLows[swingLows.length - 1];
    const prevSL = swingLows[swingLows.length - 2];

    const currentClose = closes[len - 1];
    const currentHigh  = highs[len - 1];
    const currentLow   = lows[len - 1];

    // --- 2. BOS / CHoCH Tespiti ---
    // BOS: Fiyat, onceki Swing High/Low'u kiriyor VE EMA hizalama mevcut
    // CHoCH: Fiyat, onceki Swing High/Low'u kiriyor ANCAK EMA'ya karsi
    const ema8  = this.calculateEMA(closes, this.adaptPeriod(8, tfAdaptFactor));
    const ema21 = this.calculateEMA(closes, this.adaptPeriod(21, tfAdaptFactor));
    const ema55 = this.calculateEMA(closes, this.adaptPeriod(55, tfAdaptFactor));
    const emaAlignBull = ema8 > ema21 && ema21 > ema55;
    const emaAlignBear = ema8 < ema21 && ema21 < ema55;

    let bos = false, choch = false;
    let bosStrength: "STRONG" | "WEAK" | "NONE" = "NONE";
    let swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

    if (lastSH && currentClose > lastSH.price) {
      swingTrend = "BULLISH";
      if (emaAlignBull) {
        bos = true;
        // BOS guc: onceki iki swing high da kirildiysa STRONG
        bosStrength = (prevSH && currentClose > prevSH.price) ? "STRONG" : "WEAK";
      } else {
        choch = true; // Karsi trend kirilimi = CHoCH
      }
    } else if (lastSL && currentClose < lastSL.price) {
      swingTrend = "BEARISH";
      if (emaAlignBear) {
        bos = true;
        bosStrength = (prevSL && currentClose < prevSL.price) ? "STRONG" : "WEAK";
      } else {
        choch = true;
      }
    } else {
      if (emaAlignBull)      swingTrend = "BULLISH";
      else if (emaAlignBear) swingTrend = "BEARISH";
    }

    // --- 3. Internal Trend (Kisa Vadeli Yapi) ---
    const shortSwingLen = Math.max(2, Math.round(5 * tfAdaptFactor));
    const recentHigh = Math.max(...highs.slice(len - shortSwingLen - 1, len - 1));
    const recentLow  = Math.min(...lows.slice(len - shortSwingLen - 1, len - 1));
    let internalTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (currentClose > recentHigh)      internalTrend = "BULLISH";
    else if (currentClose < recentLow)  internalTrend = "BEARISH";

    // --- 4. Stop Hunt / Sweep Tespiti ---
    // Sweep: Mum önce Swing H/L'yi geçiyor ama inside kapatıyor
    const sweepUp   = lastSH ? (currentHigh > lastSH.price && currentClose < lastSH.price) : false;
    const sweepDown = lastSL ? (currentLow  < lastSL.price && currentClose > lastSL.price) : false;

    // --- 5. Order Block Tespiti (Gelismis: Son imbalance oncesi mum) ---
    const orderBlocks: OrderBlock[] = [];
    const obLookback = Math.min(30, len - 3);
    for (let i = len - obLookback; i < len - 2; i++) {
      if (i < 1) continue;
      const c0 = closes[i - 1], c1 = closes[i];
      const bodySize = Math.abs(c1 - c0);
      const rangeSize = highs[i] - lows[i];
      if (rangeSize === 0) continue;
      // Guclu mum (vucudu>=%60 range) + ardindan zit yon hareketi
      const isStrong = bodySize / rangeSize >= 0.6;
      if (!isStrong) continue;

      const isBullOB  = c1 > c0 && highs[i + 1] < highs[i]; // Yukari mum + sonraki daha dusuk
      const isBearOB  = c1 < c0 && lows[i + 1]  > lows[i];  // Asagi mum + sonraki daha yuksek

      if (isBullOB) orderBlocks.push({ high: highs[i], low: lows[i], time: Date.now(), index: i, type: "BULLISH" });
      if (isBearOB) orderBlocks.push({ high: highs[i], low: lows[i], time: Date.now(), index: i, type: "BEARISH" });
    }

    // --- 6. FVG Tespiti (3 mum bosluk) ---
    const fvgs: FairValueGap[] = [];
    const fvgLookback = Math.min(20, len - 3);
    for (let i = len - fvgLookback; i < len - 1; i++) {
      if (i < 2) continue;
      const gap1 = highs[i - 2]; // 1. mum high
      const gap2 = lows[i];      // 3. mum low
      const gap3 = lows[i - 2];  // 1. mum low
      const gap4 = highs[i];     // 3. mum high
      if (gap2 > gap1) {  // Bullish FVG: [i-2].high < [i].low
        fvgs.push({ top: gap2, bottom: gap1, type: "BULLISH" });
      } else if (gap4 < gap3) {  // Bearish FVG: [i].high < [i-2].low
        fvgs.push({ top: gap3, bottom: gap4, type: "BEARISH" });
      }
    }

    // --- 7. CHoCH Hacim Dogrulama ---
    // Hacim verisi olmadigi icin yapisal dogrulama kullan:
    // CHoCH, BOS'un karsisi + iki ardisik mum ayni yone dogru kapatiliyorsa "confirmed"
    const chochConfirmed = choch && closes[len - 1] > closes[len - 2]
      ? swingTrend === "BULLISH"
      : choch && closes[len - 1] < closes[len - 2]
        ? swingTrend === "BEARISH"
        : false;

    // --- 8. Yapisal Skor (0-100) ---
    let structureScore = 0;
    if (bos)            structureScore += bosStrength === "STRONG" ? 40 : 25;
    if (chochConfirmed) structureScore += 20;
    if (sweepUp || sweepDown) structureScore += 15;
    if (swingTrend === internalTrend && swingTrend !== "NEUTRAL") structureScore += 25;
    structureScore = Math.min(100, structureScore);

    return {
      swingTrend,
      internalTrend,
      bos,
      choch,
      orderBlocks: orderBlocks.slice(-8),
      fvgs: fvgs.slice(-8),
      bosStrength,
      chochConfirmed,
      sweepUp,
      sweepDown,
      structureScore,
    };
  }

  private calculateLiquidity(highs: number[], lows: number[]): LiquidityResult {
    const len = highs.length;
    const empty: LiquidityResult = {
      eqHighs: false, eqLows: false,
      eqlCount: 0, eqhCount: 0,
      inPremium: false, inDiscount: false, equilibrium: 0,
      liquidityHuntUp: false, liquidityHuntDown: false,
      nearestOBHigh: 0, nearestOBLow: 0,
      smcBias: "NEUTRAL",
    };
    if (len < 20) return empty;

    // === MATRIX HORIZON FAZ 2: Gercek Likidite Analizi ===

    // --- 1. EQL (Equal Lows) / EQH (Equal Highs) Tespiti ---
    const threshold = 0.0015; // %0.15 esitlik esigi
    const lookback = Math.min(50, len - 1);
    let eqlCount = 0; // Equal Lows sayisi (likidite havuzu asagida)
    let eqhCount = 0; // Equal Highs sayisi (likidite havuzu yukarda)

    for (let i = len - lookback; i < len - 1; i++) {
      const h1 = highs[i], h2 = highs[i + 1];
      const l1 = lows[i],  l2 = lows[i + 1];
      if (h1 > 0 && Math.abs(h1 - h2) / ((h1 + h2) / 2) < threshold) eqhCount++;
      if (l1 > 0 && Math.abs(l1 - l2) / ((l1 + l2) / 2) < threshold) eqlCount++;
    }

    const eqHighs = eqhCount >= 2;
    const eqLows  = eqlCount >= 2;

    // --- 2. Premium / Discount / Equilibrium ---
    // Bakis penceresi: son [lookback] mumlarin yuksek ve dusugu
    const windowHighs = highs.slice(len - lookback);
    const windowLows  = lows.slice(len - lookback);
    const rangeHigh = Math.max(...windowHighs);
    const rangeLow  = Math.min(...windowLows);
    const equilibrium = (rangeHigh + rangeLow) / 2;
    const currentPrice = lows[len - 1]; // Kapanisin alt kismi
    const rangeSize = rangeHigh - rangeLow;

    // Fibonacci 61.8% / 38.2% seviyeleri
    const fib618 = rangeLow + rangeSize * 0.618;
    const fib382 = rangeLow + rangeSize * 0.382;

    const inPremium  = currentPrice >= fib618;
    const inDiscount = currentPrice <= fib382;

    // --- 3. Likidite Avlanma Tehlikesi ---
    // EQH mevcut + fiyat yaklasiyorsa: yukari stop hunt riski
    // EQL mevcut + fiyat yaklasiyorsa: asagi stop hunt riski
    const nearEQH = eqHighs && Math.abs(highs[len - 1] - rangeHigh) / Math.max(rangeHigh, 1) < 0.005;
    const nearEQL = eqLows  && Math.abs(lows[len - 1]  - rangeLow)  / Math.max(rangeLow,  1) < 0.005;

    // --- 4. SMC Genel Yanlilik ---
    let smcBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if      (inDiscount && eqLows)   smcBias = "BULLISH"; // Discount + EQL = potansiyel alim bolgesi
    else if (inPremium  && eqHighs)  smcBias = "BEARISH"; // Premium + EQH = potansiyel satim bolgesi
    else if (inDiscount)             smcBias = "BULLISH";
    else if (inPremium)              smcBias = "BEARISH";

    return {
      eqHighs, eqLows, eqlCount, eqhCount,
      inPremium, inDiscount, equilibrium,
      liquidityHuntUp:   nearEQH,
      liquidityHuntDown: nearEQL,
      nearestOBHigh: rangeHigh,
      nearestOBLow:  rangeLow,
      smcBias,
    };
  }

  // ===========================
  // BAYESIAN & SYSTEM HEALTH
  // ===========================

  private updateBayesianTrust(
    isCorrect: boolean,
    signalQuality: number = 0.5, // 0-1 sinyal kalitesi (confluenceScore / 100)
    currentRegime: string = "NEUTRAL"
  ) {
    // === MATRIX HORIZON FAZ 4: Adaptif Bayes Öğrenme Motoru ===

    const m = this.bayesianMetrics;
    m.totalSignals++;
    if (isCorrect) m.winSignals++;

    // 1. Geleneksel kümülatif WinRate (referans)
    m.currentWinRate = m.winSignals / m.totalSignals;

    // 2. Streak takibi (art arda sonuçlar)
    if (isCorrect) {
      m.recentStreak = Math.max(0, m.recentStreak) + 1;
    } else {
      m.recentStreak = Math.min(0, m.recentStreak) - 1;
    }

    // 3. Rejim değişimi tespiti — öğrenme hızını sıfırla
    if (currentRegime !== m.lastRegime) {
      m.regimeShiftCount++;
      // Rejim degisince gecmis bilgiyi eskitmeye bas
      m.emaWinRate = (m.emaWinRate + 0.5) / 2; // Prior'a doğru çek
      m.learningRate = Math.min(0.30, m.learningRate * 1.5); // Daha hızlı adapte ol
      m.lastRegime = currentRegime;
    }

    // 4. Dinamik öğrenme oranı (λ):
    //    - Az sinyal varsa: hızlı öğren (yüksek λ)
    //    - Çok sinyal varsa: yavaş öğren, deneyime güven (düşük λ)
    //    - Kaliteli sinyal: daha güçlü güncelleme
    //    - Streak: trend varsa momentum ekle
    const baseLambda = Math.max(0.04, 0.25 / Math.sqrt(Math.max(1, m.totalSignals)));
    const qualityMult = 0.5 + signalQuality; // 0.5 - 1.5 arası
    const streakMult  = Math.abs(m.recentStreak) >= 3
      ? (isCorrect ? 1.2 : 0.8)  // Uzun kazanç serisi → güven arttır
      : 1.0;

    m.learningRate = Math.max(0.03, Math.min(0.35, baseLambda * qualityMult * streakMult));

    // 5. EMA WinRate hesabı (kaliteli, adaptif tahmin)
    const observation = isCorrect ? 1.0 : 0.0;
    m.emaWinRate = m.learningRate * (observation * qualityMult) + (1 - m.learningRate) * m.emaWinRate;
    m.emaWinRate = Math.max(0.20, Math.min(0.90, m.emaWinRate)); // Aşırı uçlara sürüklenme önlemi

    // 6. Kümülatif kalite skoru
    m.signalQualitySum += signalQuality;
  }

  // EMA WinRate'i disen bileşenler için public accessor
  public getBayesianWinRate(): number {
    return this.bayesianMetrics.emaWinRate;
  }

  public getBayesianLearningRate(): number {
    return this.bayesianMetrics.learningRate;
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
    // === MATRIX HORIZON FAZ 0: Makro & Sentiment Entegrasyonu ===
    sentimentScore: number = 0,  // -100 (Asiri Korku) -> +100 (Asiri Acgozluluk)
    btcDominance: number = 50,   // % BTC Dominance
    usdtDominance: number = 5,   // % USDT.D
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
      // Matrix V5: Data < 50 candles. Silent in production logs to avoid spamming.
    }

    // 0. Initialize Dynamic Autonomous Parameters
    const currentPrice = closes[len - 1]; // ALWAYS use real close for current price
    const atrValue = this.calculateATR(finalHighs, finalLows, finalCloses, 14);
    const autoParams = this.getAutonomousConfig(atrValue, currentPrice, activeConfig, configOverrides);

    // 1. F4 TREND ENGINE (Dynamic per tradeMode)
    const f4Len = autoParams.f4Length;
    const f4WholeSeries = this.calculateF4Series(finalCloses, finalHighs, finalLows, f4Len, 0.95); // Using constant UI alpha
    const f4Value = f4WholeSeries[f4WholeSeries.length - 1];
    const f4FiboValue = 0; // Deprecated, keeping fixed 0 for result structure safety

    const tfAdapt = this.getTfAdaptFactor(interval);

    // V5.4 Add F4 Power calculation (ATR normalized) + Multiplier
    const f4ValuePrev5 = f4WholeSeries[f4WholeSeries.length - 6] || f4Value;
    const f4PowerRaw = atrValue > 0 ? ((f4Value - f4ValuePrev5) / atrValue) * 100 * activeConfig.f4Multiplier : 0;
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
      saeThreshold,
      sentimentScore,
      btcDominance,
      usdtDominance,
      fundingRate
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
      deathRisk: this.bayesianMetrics.emaWinRate < 0.4 && this.bayesianMetrics.totalSignals > 5,
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
      // === MATRIX HORIZON FAZ 3: Projeksiyon ve AI NLP alanlari ===
      aiSummary: "",
      projectionBias: "NEUTRAL" as const,
      projectionConfidence: 50,
      kellyFraction: 0.05,
    };
    return payload;
  }

  private evaluateLiquidity(currentPrice: number, smc: any) {
    let inBullishOB = false, inBearishOB = false;
    let inBullishFVG = false, inBearishFVG = false;
    let nearOBDist = Infinity;

    // === MATRIX HORIZON FAZ 2: Gelismis Likidite Degerlendirmesi ===
    for (const ob of smc.orderBlocks.slice(0, 8)) {
      if (ob.type === "BULLISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
      if (ob.type === "BEARISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
      const obMid = (ob.high + ob.low) / 2;
      const dist  = Math.abs(currentPrice - obMid) / Math.max(currentPrice, 1);
      if (dist < nearOBDist) nearOBDist = dist;
    }
    for (const fvg of smc.fvgs.slice(0, 8)) {
      if (fvg.type === "BULLISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
      if (fvg.type === "BEARISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
    }

    let liquidityBonus = 0;
    if (inBullishOB || inBearishOB) liquidityBonus += 15;
    if (inBullishFVG || inBearishFVG) liquidityBonus += 10;
    if (smc.sweepUp || smc.sweepDown) liquidityBonus += 5;
    if (nearOBDist < 0.01) liquidityBonus += 5;
    liquidityBonus = Math.min(25, liquidityBonus);
    if (smc.bos && smc.bosStrength === "STRONG") liquidityBonus = Math.min(25, liquidityBonus + 5);

    const liquidityZone = inBullishOB ? "OB BOGA (" + (smc.bosStrength || "-") + ")"
      : inBearishOB  ? "OB AYI (" + (smc.bosStrength || "-") + ")"
      : inBullishFVG ? "FVG BOGA"
      : inBearishFVG ? "FVG AYI"
      : smc.sweepUp  ? "SWEEP YUKARI"
      : smc.sweepDown ? "SWEEP ASAGI"
      : "YOK";

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

    // === MATRIX HORIZON FAZ 0: Yonsel F4 Power Loss ===
    // Eski mutlak deger mantigi V-Turn'lerde gec tetikleniyordu.
    // Yeni: Sadece mevcut trend yonundeki slope zayiflamasini olcer.
    const slopeHistory: number[] = [];
    const lb = Math.min(autoParams.f4LookbackBars || activeConfig.f4LookbackBars, f4WholeSeries.length - 2);
    for (let i = 0; i < lb; i++) {
        const idx = f4WholeSeries.length - 1 - i;
        slopeHistory.push(f4WholeSeries[idx] - (f4WholeSeries[idx - 1] || f4WholeSeries[idx]));
    }
    let f4PowerLoss: number;
    if (f4Slope >= 0) {
        const peakSlope = slopeHistory.length > 0 ? Math.max(...slopeHistory, f4Slope) : f4Slope;
        f4PowerLoss = peakSlope > 0.00001 ? ((peakSlope - f4Slope) / peakSlope) * 100 : 0;
    } else {
        const troughSlope = slopeHistory.length > 0 ? Math.min(...slopeHistory, f4Slope) : f4Slope;
        f4PowerLoss = troughSlope < -0.00001 ? ((f4Slope - troughSlope) / Math.abs(troughSlope)) * 100 : 0;
    }
    f4PowerLoss = Math.max(0, Math.min(100, f4PowerLoss));
    const f4SlopeStrength = Math.abs(f4Slope);
    
    const minLoss = activeConfig.minPowerLoss ?? 90;
    
    // Directional Squeeze Logic - Respecting absolute user mandate of 90+ Power Loss
    const longSqueezeThr = Math.max(minLoss, activeConfig.longSqueezeThreshold ?? 20);
    const shortSqueezeThr = Math.max(minLoss, activeConfig.shortSqueezeThreshold ?? 20);
    
    const buySqueezeThreshold = volatilityRegime === "SQUEEZE" ? shortSqueezeThr : Math.max(minLoss, activeConfig.f4PowerLossThreshold);
    const sellSqueezeThreshold = volatilityRegime === "SQUEEZE" ? longSqueezeThr : Math.max(minLoss, activeConfig.f4PowerLossThreshold);

    const f4AnticipatoryBuy = f4Slope < 0 && (buyLeadConfluence >= 1 || f4PowerLoss >= 99.0) && f4PowerLoss >= minLoss;
    const f4AnticipatorySell = f4Slope > 0 && (sellLeadConfluence >= 1 || f4PowerLoss >= 99.0) && f4PowerLoss >= minLoss;

    // === MATRIX HORIZON FAZ 1: Trend Takip (Continuation) Sinyalleri ===
    // Eğer trend çok güçlüyse ve güç kaybı yoksa (re-acceleration), re-entry için sinyal üretir.
    const isStrongBull = f4Value > 50 && f4Slope > 0 && f4PowerLoss < 15;
    const isStrongBear = f4Value < -50 && f4Slope < 0 && f4PowerLoss < 15;
    
    // Confluence desteği varsa trend takip sinyali tetiklenir
    const f4ContinuationBuy = isStrongBull && (stochRsi.k > 50 || earlyReversal === "UP");
    const f4ContinuationSell = isStrongBear && (stochRsi.k < 50 || earlyReversal === "DOWN");

    let f4EarlyBuy = (f4Slope < 0 && f4PowerLoss >= buySqueezeThreshold) || f4AnticipatoryBuy || f4ContinuationBuy;
    let f4EarlySell = (f4Slope > 0 && f4PowerLoss >= sellSqueezeThreshold) || f4AnticipatorySell || f4ContinuationSell;

    // MATRIX HORIZON FAZ 4: Aşırı dip/tepe koruması (Dibi satma, tepeyi alma)
    if (f4Value < -70) {
      f4EarlySell = false;
    }
    if (f4Value > 70) {
      f4EarlyBuy = false;
    }

    
    // Confirmed signals are pure trend changes (color changes of the F4 line).
    // They do NOT require "power loss" because at the moment of reversal, power loss resets.
    // [SYNCHRONIZED] Confirmed signals are disabled by user request to focus only on Early signals.
    const f4ConfirmedBuy = false; 
    const f4ConfirmedSell = false;

    return { f4PowerLoss, buySqueezeThreshold, sellSqueezeThreshold, hasEarlyBuyLead: f4EarlyBuy, hasEarlySellLead: f4EarlySell, hasConfirmedBuyLead: f4ConfirmedBuy, hasConfirmedSellLead: f4ConfirmedSell };
  }

  private performSignalArbitration(confluenceScore: number, predictionUpProb: number, predictionDownProb: number, saeThreshold: number, autoParams: any, riskMode: string, smc: any, whaleStatus: string, zScore: number, vpa: any, f4Power: number, ribbonState: string, volatilityRegime: VolatilityRegime, hasEarlyBuyLead: boolean, hasConfirmedBuyLead: boolean, hasEarlySellLead: boolean, hasConfirmedSellLead: boolean, barIndex: number) {
    let currentMinAi = autoParams.minAiScore;
    let currentMinConf = autoParams.minConfluenceScore;
    if (riskMode === "safe") { currentMinAi += 10; currentMinConf += 12; }
    else if (riskMode === "aggressive") { currentMinAi -= 15; currentMinConf -= 15; }

    let rawSystemDecision: SystemDecision = (confluenceScore >= currentMinConf && predictionUpProb >= saeThreshold) ? "GO_LONG" : (confluenceScore >= currentMinConf && predictionDownProb >= saeThreshold) ? "GO_SHORT" : "WAIT";
    
    // F4 Priority Sync (Global) - Treat F4 labels as actionable even if trend is opposite
    // [OPTIMIZATION] Only prioritize Early leads for faster entry (Confirmed leads ignored for priority)
    const isF4BuyPriority = hasEarlyBuyLead;
    const isF4SellPriority = hasEarlySellLead;
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
        // [MODIFIED] Keep the calculated score even if no trade is recommended
        // finalAiScore remains as calculated on line 2175
    }

    let tradeSignal: "BUY" | "SELL" | null = null;
    
    // [URGENT] F4 Mandate: Signal ONLY if F4 Early is active (Confirmed disabled by user request)
    const isF4Buy = hasEarlyBuyLead;
    const isF4Sell = hasEarlySellLead;

    if (isF4Buy && finalAiScore >= currentMinAi && !this.buyFired) {
        tradeSignal = "BUY";
        systemDecision = "GO_LONG"; // Sync decision
        this.buyFired = true;
        this.lastSignalBarIndex = barIndex;
    } else if (isF4Sell && finalAiScore >= currentMinAi && !this.sellFired) {
        tradeSignal = "SELL";
        systemDecision = "GO_SHORT"; // Sync decision
        this.sellFired = true;
        this.lastSignalBarIndex = barIndex;
    }

    if (tradeSignal === "BUY") {
        systemDecision = "GO_LONG";
    } else if (tradeSignal === "SELL") {
        systemDecision = "GO_SHORT";
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
    const mtfConsensusStr = `${bullIndicators}/5 ${bullIndicators >= 4 ? "GÜÇLÜ UYUM" : bullIndicators <= 1 ? "GÜÇLÜ AYI" : bullIndicators >= 3 ? "BOĞA UYUM" : "KARIŞIK"}`;

    const components: AiScoreComponents = {
      whaleConfirmed: isWhale && !fakeBreakoutUp && !fakeBreakoutDown ? 15 : 0,
      regimeAlignment: marketRegime === "RISK_ON" && whaleStatus === "BUY_ACTIVE" ? 15 : 0,
      volumePower: isWhale ? 10 : 0,
      trendAlignment: trendUp ? 10 : 0,
      mtfConsensus: bullIndicators >= 3 ? 15 : 5,
      momentumAccel: (slope > 0 && acceleration > 0) || (slope < 0 && acceleration < 0) ? 10 : 0,
      volatilityRegime: volatilityRegime === "SQUEEZE" ? 10 : 0,
      zScore: Math.abs(zScore) > 2.5 ? 10 : Math.abs(zScore) > 1.5 ? 5 : 0,
      bayesianWinRate: Math.round(this.bayesianMetrics.emaWinRate * 10),
      trapPenalty: fakeBreakoutUp || fakeBreakoutDown ? -15 : 0,
    };
    return { regimePrediction: regimePredictionValue, marketPhaseText: marketPhaseTextValue, capitalFlowText: capital.text, capitalPhase: capital.phase, mtfConsensusStr, components, bullIndicators };
  }

  private calculateTargets(highs: number[], lows: number[], closes: number[], adaptedAtrLen: number, currentPrice: number, systemDecision: string, predictionUpProb: number, predictionDownProb: number) {
    // === MATRIX HORIZON FAZ 3: ATR + LinReg Gelismis Projeksiyon ===
    const atrTarget = this.calculateATR(highs, lows, closes, adaptedAtrLen);
    const direction = systemDecision === "GO_LONG" ? 1 : systemDecision === "GO_SHORT" ? -1 : predictionUpProb > predictionDownProb ? 1 : -1;

    // LinReg egim projeksiyon destegi: Mevcut egim 5 bar icin tahmin
    const lr0 = this.calculateLinReg(closes, 20, 0);
    const lr1 = this.calculateLinReg(closes, 20, 1);
    const lrSlope = lr0 - lr1; // Per-bar egim
    const lrProjection5 = currentPrice + lrSlope * 5; // 5 bar ilerisi linreg tahmini
    const lrProjection10 = currentPrice + lrSlope * 10;

    // Fibonacci ATR carpanlari ile hedefler
    const t1Fib   = currentPrice + direction * atrTarget * 1.618; // Fib 1.618
    const t2Fib   = currentPrice + direction * atrTarget * 2.618; // Fib 2.618
    const slFib   = currentPrice - direction * atrTarget * 1.0;   // 1x ATR stop
    const buyDev  = atrTarget * 0.5;

    // Projeksiyon guven skoru: LinReg yonu ile systemDecision uyumlu mu?
    const lrBull = lrSlope > 0;
    const decBull = direction > 0;
    const projectionConfidence = lrBull === decBull
      ? Math.min(100, 60 + Math.abs(lrSlope / Math.max(atrTarget, 0.0001)) * 20)
      : Math.max(20, 40 - Math.abs(lrSlope / Math.max(atrTarget, 0.0001)) * 10);

    const projectionBias: "BULLISH" | "BEARISH" | "NEUTRAL" = lrSlope > atrTarget * 0.05
      ? "BULLISH" : lrSlope < -atrTarget * 0.05 ? "BEARISH" : "NEUTRAL";

    const targets = { t1: t1Fib, t2: t2Fib, sl: slFib, buyDev, lrProjection5, lrProjection10 };
    return { targets, projectionConfidence, projectionBias };
  }

  // === MATRIX HORIZON FAZ 3: AI NLP Karar Ozeti Uretimi ===
  private generateAiSummary(
    trend: string,
    slope: number,
    confluenceScore: number,
    mtfConsensus: string,
    whaleStatus: string,
    systemDecision: string,
    f4PowerLoss: number,
    volatilityRegime: string,
    marketRegime: string,
    smcBias: string,
    sentimentScore: number,
    sweepUp: boolean,
    sweepDown: boolean,
    projectionBias: string,
    projectionConfidence: number
  ): string {
    const parts: string[] = [];

    // 1. Genel trend degerlendirmesi
    if (trend === "BULLISH" && slope > 0.05)
      parts.push("F4 guclu yukari trendi destekliyor");
    else if (trend === "BEARISH" && slope < -0.05)
      parts.push("F4 guclu asagi baski altinda");
    else if (trend === "BULLISH")
      parts.push("Zayif yukari egim mevcut");
    else if (trend === "BEARISH")
      parts.push("Zayif asagi egim mevcut");
    else
      parts.push("Yatay / kararsiz piyasa");

    // 2. Guc kaybi uyarisi
    if (f4PowerLoss > 70)
      parts.push("F4 guc kaybi kritik seviyede (" + f4PowerLoss.toFixed(0) + "%) — dikkat");
    else if (f4PowerLoss > 45)
      parts.push("F4 guc kaybediyor (" + f4PowerLoss.toFixed(0) + "%)");

    // 3. Konfluens degerlendirmesi
    if (confluenceScore >= 75)
      parts.push("Mukemmel konfluens (" + confluenceScore.toFixed(0) + ")");
    else if (confluenceScore >= 60)
      parts.push("Guclu konfluens (" + confluenceScore.toFixed(0) + ")");
    else if (confluenceScore < 45)
      parts.push("Zayif konfluens — islem onerilmez");

    // 4. Balina & Hacim
    if (whaleStatus === "BUY_ACTIVE") parts.push("Balina alim baskisi aktif");
    else if (whaleStatus === "SELL_ACTIVE") parts.push("Balina satim baskisi aktif");
    else if (whaleStatus === "DISTRIBUTION") parts.push("Dagitim fazindayiz — dikkat");

    // 5. SMC yapisi
    if (sweepUp) parts.push("Yukari stop-hunt tespit edildi — dikkatli al");
    else if (sweepDown) parts.push("Asagi stop-hunt tespit edildi — dikkatli sat");
    if (smcBias === "BULLISH") parts.push("SMC: Discount bolgesi / potansiyel alim noktasi");
    else if (smcBias === "BEARISH") parts.push("SMC: Premium bolgesi / potansiyel satim noktasi");

    // 6. Volatilite
    if (volatilityRegime === "SQUEEZE")
      parts.push("Bollinger Squeeze aktif — patlama bekleniyor");
    else if (volatilityRegime === "EXPLOSION")
      parts.push("Yuksek volatilite — risk yonetimi kritik");

    // 7. Makro / Sentiment
    if (sentimentScore < -50) parts.push("Piyasa asiri korkuda — kontrarian firsat olabilir");
    else if (sentimentScore > 70) parts.push("Asiri acgozluluk — tepe riski mevcut");

    // 8. Nihai karar
    const decisionText = systemDecision === "GO_LONG"
      ? "AL sinyali aktif"
      : systemDecision === "GO_SHORT"
        ? "SAT sinyali aktif"
        : "Bekleme modu onerilen";

    parts.push(decisionText + " | Projeksiyon: " + projectionBias + " (" + projectionConfidence.toFixed(0) + "% guven)");

    return parts.join(" • ");
  }

  // === MATRIX HORIZON FAZ 4: Kelly Kriteri Pozisyon Boyutlandirma ===
  private calculateKellyFraction(
    currentWinRate: number,
    confluenceScore: number,
    f4PowerLoss: number,
    volatilityRegime: string
  ): number {
    // Temel Kelly: f = (bp - q) / b, b = risk/reward = 1.5
    const b = 1.5; // Ortalama R:R
    const p = Math.min(0.85, Math.max(0.30, currentWinRate));
    const q = 1 - p;
    const rawKelly = (b * p - q) / b;

    // Confluence ve F4 Power Loss ile dinamik ayarlama
    const confMult = confluenceScore >= 75 ? 1.0 : confluenceScore >= 60 ? 0.75 : 0.5;
    const plMult   = f4PowerLoss > 70 ? 0.3 : f4PowerLoss > 45 ? 0.6 : 1.0;
    const volMult  = volatilityRegime === "EXPLOSION" ? 0.5 : volatilityRegime === "HIGH_VOL" ? 0.7 : 1.0;

    // Yarisik Kelly (Half-Kelly) — risk azaltma standardi
    const kelly = (rawKelly * confMult * plMult * volMult) / 2;
    return Math.max(0.01, Math.min(0.25, kelly)); // Max %25 pozisyon
  }

  private calculateWhaleTrust(zScore: number, whaleStatus: string): number {
    // === MATRIX HORIZON FAZ 4: emaWinRate (adaptif) kullan ===
    let whaleTrust = this.bayesianMetrics.emaWinRate;
    if (Math.abs(zScore) >= 2.4) {
      const rawExtremity = (Math.abs(zScore) - 2.4) / 1.0;
      if (whaleStatus === "BUY_ACTIVE" || whaleStatus === "SELL_ACTIVE") whaleTrust = Math.max(0.80, Math.min(1.0, 0.80 + rawExtremity * 0.20));
      else whaleTrust = Math.min(0.20, Math.max(0, 0.20 - rawExtremity * 0.20));
    }
    return whaleTrust;
  }

}
