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

// ===========================
// TYPES & INTERFACES
// ===========================

export interface MatrixV5Config {
    f4Length: number;
    f4Alpha: number;
    fiboLength: number;
    fiboAlpha: number;
    f4SlopeThreshold: number;
    whaleVolumeMultiplier: number;
    minAiScore: number;
    minConfluenceScore: number;
    useWhaleEngine: boolean;
    tradeMode: 'Scalp' | 'Swing';
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
}

export type MarketRegime = 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
export type VolatilityRegime = 'SQUEEZE' | 'EXPLOSION' | 'HIGH_VOL' | 'NORMAL';
export type RegimePrediction =
    'ACCELERATING_TREND' | 'DECELERATING_TREND' |
    'ACCELERATING_DROP' | 'BOTTOM_FINDING' |
    'RANGE' | 'STOPPING_VOLUME' | 'PRE_EXPLOSION' |
    'DIP_OPPORTUNITY' | 'EXHAUSTION' | 'EARLY_REVERSAL_UP' | 'EARLY_REVERSAL_DOWN' | 'TRANSITION';
export type SystemDecision = 'GO_LONG' | 'GO_SHORT' | 'WAIT';
export type ConfluenceStatus = 'MÜKEMMEL' | 'GÜÇLÜ' | 'ORTA' | 'ZAYIF' | 'YETERSİZ';

export interface V5IndicatorState {
    name: string;
    value: string;
    state: string;
    color: 'green' | 'red' | 'gray' | 'orange';
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
    direction: 'UP' | 'DOWN' | 'FLAT';
}

export interface ADMResult {
    classification: number;       // -2, -1, 0, 1, 2
    evidence: 'GÜÇLÜ' | 'ZAYIF' | 'YOK';
    bias: string;                 // "Pozitif Sapma", "Negatif Sapma", etc.
    direction: number;            // -1, 0, 1
}

export interface VPAResult {
    buyVolume: number;
    sellVolume: number;
    delta: number;
    netPressure: number;          // -100 to +100
    state: 'ALIM BASKISI' | 'SATIM BASKISI' | 'NÖTR';
}

export interface OrderBlock {
    high: number;
    low: number;
    time: number;
    index: number;
    type: 'BULLISH' | 'BEARISH';
}

export interface FairValueGap {
    top: number;
    bottom: number;
    type: 'BULLISH' | 'BEARISH';
}

export interface SMCResult {
    swingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    internalTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
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
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    slope: number;
    acceleration: number;
    whaleDetected: boolean;
    whaleStatus: 'RALLY_PREP' | 'DISTRIBUTION' | 'TRAP' | 'BUY_ACTIVE' | 'SELL_ACTIVE' | 'NEUTRAL';
    signal: 'BUY' | 'SELL' | null;
    f4Value: number;
    f4FiboValue: number;
    aiScore: number;
    aiComponents: AiScoreComponents;
    marketRegime: MarketRegime;
    volatilityRegime: VolatilityRegime;
    regimePrediction: RegimePrediction;
    systemDecision: SystemDecision;
    zScoreValue: number;
    mtfConsensus: string;         // "4/5 GÜÇLÜ BOĞA" format
    earlyReversal: 'UP' | 'DOWN' | null;
    fastSlope: number;
    fastAcceleration: number;
    deathRisk: boolean;
    whaleTrust: number;

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
    targets: { t1: number; t2: number; sl: number; };

    // V5.3/V5.4 New Fields
    f4PowerLoss: number;          // Güç kaybı yüzdesi (0-100)
    f4EarlyBuy: boolean;          // Erken alış sinyali (Fibo divergence)
    f4EarlySell: boolean;         // Erken satış sinyali (Fibo divergence)
    f4ConfirmedBuy: boolean;      // Onaylanmış alış (çizgi renk değişimi)
    f4ConfirmedSell: boolean;     // Onaylanmış satış (çizgi renk değişimi)
    liquidityZone: string;        // Aktif likidite bölgesi
    liquidityBonus: number;       // Likidite bonusu (0 veya 10)
    mtfWeightedScore: number;     // Ağırlıklı MTF skoru
    dynamicWeights: { tech: number; momentum: number; market: number; trend: number };
}

// ===========================
// ENGINE CLASS
// ===========================

export class MatrixV5Engine {
    private config: MatrixV5Config;
    private bayesianMetrics = { totalSignals: 0, winSignals: 0, currentWinRate: 0.5 };

    constructor(config: Partial<MatrixV5Config> = {}) {
        this.config = {
            f4Length: config.f4Length || 10,
            f4Alpha: config.f4Alpha || 3.7,
            fiboLength: config.fiboLength || 5,
            fiboAlpha: config.fiboAlpha || 0.618,
            f4SlopeThreshold: config.f4SlopeThreshold || 0.01,
            whaleVolumeMultiplier: config.whaleVolumeMultiplier || 1.8,
            minAiScore: config.minAiScore || 65,
            minConfluenceScore: config.minConfluenceScore || 60,
            useWhaleEngine: config.useWhaleEngine ?? true,
            tradeMode: config.tradeMode || 'Scalp',
            confluenceWeightTech: config.confluenceWeightTech || 30,
            confluenceWeightMomentum: config.confluenceWeightMomentum || 15,
            confluenceWeightVol: config.confluenceWeightVol || 20,
            confluenceWeightTrend: config.confluenceWeightTrend || 15,
            confluenceWeightMarket: config.confluenceWeightMarket || 15,
            confluenceWeightTiming: config.confluenceWeightTiming || 5,
            rsiPeriod: config.rsiPeriod || 14,
            rsiOB: config.rsiOB || 70,
            rsiOS: config.rsiOS || 30,
            macdFast: config.macdFast || 12,
            macdSlow: config.macdSlow || 26,
            macdSignal: config.macdSignal || 9,
            stFactor: config.stFactor || 3.0,
            stAtrPeriod: config.stAtrPeriod || 10,
            stochRsiLen: config.stochRsiLen || 14,
            stochK: config.stochK || 3,
            stochD: config.stochD || 3,
            adxPeriod: config.adxPeriod || 14,
            adxThreshold: config.adxThreshold || 25,
            // V5.3/V5.4
            f4PowerLossThreshold: config.f4PowerLossThreshold || 50,
            f4LookbackBars: config.f4LookbackBars || 10,
            f4SqueezeThreshold: config.f4SqueezeThreshold || 40,
        };
    }

    // ===========================
    // HELPER CALCULATIONS
    // ===========================

    private calculateSMA(source: number[], length: number): number {
        if (source.length < length || length <= 0) return 0;
        const slice = source.slice(source.length - length);
        return slice.reduce((a, b) => a + b, 0) / length;
    }

    private calculateEMA(source: number[], length: number): number {
        if (source.length < length || length <= 0) return source[source.length - 1] || 0;
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
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / length;
        return Math.sqrt(variance);
    }

    private calculateATR(highs: number[], lows: number[], closes: number[], length: number): number {
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

    private calculateLinReg(source: number[], length: number, offset: number = 0): number {
        if (source.length < length + offset || length <= 0) return 0;
        const end = source.length - 1 - offset;
        const start = end - length + 1;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < length; i++) {
            sumX += i; sumY += source[start + i]; sumXY += i * source[start + i]; sumXX += i * i;
        }
        const denom = length * sumXX - sumX * sumX;
        if (denom === 0) return 0;
        const slopeVal = (length * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slopeVal * sumX) / length;
        return intercept + slopeVal * (length - 1);
    }

    // ===========================
    // V5 INDICATOR CALCULATIONS
    // ===========================

    private calculateRSI(closes: number[], length: number): number {
        if (closes.length < length + 1) return 50;
        let avgGain = 0, avgLoss = 0;
        for (let i = closes.length - length; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }
        avgGain /= length; avgLoss /= length;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateMACD(closes: number[], fast: number, slow: number, signal: number): { line: number; signal: number; hist: number } {
        const fastEma = this.calculateEMA(closes, fast);
        const slowEma = this.calculateEMA(closes, slow);
        const macdLine = fastEma - slowEma;
        // Build MACD series for signal line
        const macdSeries: number[] = [];
        const kFast = 2 / (fast + 1), kSlow = 2 / (slow + 1);
        let emaF = closes.slice(0, fast).reduce((a, b) => a + b, 0) / fast;
        let emaS = closes.slice(0, slow).reduce((a, b) => a + b, 0) / slow;
        for (let i = Math.max(fast, slow); i < closes.length; i++) {
            emaF = closes[i] * kFast + emaF * (1 - kFast);
            emaS = closes[i] * kSlow + emaS * (1 - kSlow);
            macdSeries.push(emaF - emaS);
        }
        const signalLine = macdSeries.length >= signal
            ? this.calculateEMA(macdSeries, signal)
            : 0;
        return { line: macdLine, signal: signalLine, hist: macdLine - signalLine };
    }

    private calculateSuperTrend(highs: number[], lows: number[], closes: number[], factor: number, atrPeriod: number): { value: number; direction: number; bull: boolean } {
        const atr = this.calculateATR(highs, lows, closes, atrPeriod);
        const hl2 = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
        const upperBand = hl2 + factor * atr;
        const lowerBand = hl2 - factor * atr;
        const currentClose = closes[closes.length - 1];
        const bull = currentClose > lowerBand;
        return { value: bull ? lowerBand : upperBand, direction: bull ? -1 : 1, bull };
    }

    private calculateStochRSI(closes: number[], rsiLen: number, stochLen: number, kPeriod: number, dPeriod: number): { k: number; d: number } {
        // Build RSI series
        void kPeriod; void dPeriod; // Suppress unused for now
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
        const stochRaw = highest !== lowest ? ((rsiSeries[rsiSeries.length - 1] - lowest) / (highest - lowest)) * 100 : 50;
        // Simplified K & D (would need series for proper SMA)
        return { k: stochRaw, d: stochRaw }; // Approximation
    }

    private calculateADX(highs: number[], lows: number[], closes: number[], length: number): { adx: number; diPlus: number; diMinus: number } {
        if (highs.length < length + 1) return { adx: 0, diPlus: 0, diMinus: 0 };
        let smoothDMPlus = 0, smoothDMMinus = 0, smoothTR = 0;
        for (let i = highs.length - length; i < highs.length; i++) {
            const upMove = highs[i] - (highs[i - 1] || highs[i]);
            const downMove = (lows[i - 1] || lows[i]) - lows[i];
            const dmPlus = upMove > downMove && upMove > 0 ? upMove : 0;
            const dmMinus = downMove > upMove && downMove > 0 ? downMove : 0;
            const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - (closes[i - 1] || closes[i])), Math.abs(lows[i] - (closes[i - 1] || closes[i])));
            smoothDMPlus += dmPlus; smoothDMMinus += dmMinus; smoothTR += tr;
        }
        const diPlus = smoothTR > 0 ? (smoothDMPlus / smoothTR) * 100 : 0;
        const diMinus = smoothTR > 0 ? (smoothDMMinus / smoothTR) * 100 : 0;
        const dx = (diPlus + diMinus) > 0 ? Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100 : 0;
        return { adx: dx, diPlus, diMinus };
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
            '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
            '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '8h': 28800,
            '12h': 43200, '1d': 86400, '1w': 604800,
        };
        return map[interval] || 3600;
    }

    private adaptPeriod(basePeriod: number, tfAdapt: number): number {
        return Math.max(Math.round(basePeriod * tfAdapt), 3);
    }

    // ===========================
    // F4 CALCULATION (Pine Script Port)
    // ===========================

    private calculateF4(closes: number[], highs: number[], lows: number[], length: number, alpha: number): number {
        // F4 = c1*e6 + c2*e5 + c3*e4 + c4*e3
        const source = closes.map((c, i) => (highs[i] + lows[i] + 2 * c) / 4);
        const e1Series = this.buildEMASeries(source, length);
        const e2Series = this.buildEMASeries(e1Series, length);
        const e3 = this.calculateEMA(e2Series, length);
        const e3Series = this.buildEMASeries(e2Series, length);
        const e4 = this.calculateEMA(e3Series, length);
        const e4Series = this.buildEMASeries(e3Series, length);
        const e5 = this.calculateEMA(e4Series, length);
        const e5Series = this.buildEMASeries(e4Series, length);
        const e6 = this.calculateEMA(e5Series, length);

        const c1 = -alpha * alpha * alpha;
        const c2 = 3 * alpha * alpha + 3 * alpha * alpha * alpha;
        const c3 = -6 * alpha * alpha - 3 * alpha - 3 * alpha * alpha * alpha;
        const c4 = 1 + 3 * alpha + alpha * alpha * alpha + 3 * alpha * alpha;

        return c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3;
    }

    private buildEMASeries(source: number[], length: number): number[] {
        if (source.length < length) return [...source];
        const k = 2 / (length + 1);
        const result: number[] = [];
        let ema = source.slice(0, length).reduce((a, b) => a + b, 0) / length;
        for (let i = 0; i < source.length; i++) {
            if (i < length) { result.push(source[i]); continue; }
            ema = source[i] * k + ema * (1 - k);
            result.push(ema);
        }
        return result;
    }

    // ===========================
    // ADM (Asset Drift Model)
    // ===========================

    private calculateADM(closes: number[]): ADMResult {
        const horizon = 60;
        const sampleBars = Math.min(756, closes.length - 1);
        if (closes.length < horizon + 10) return { classification: 0, evidence: 'YOK', bias: 'Sapma Yok', direction: 0 };

        // Collect returns
        const returns: number[] = [];
        for (let i = 0; i < sampleBars - horizon && i + horizon < closes.length; i++) {
            const r = (closes[closes.length - 1 - i] - closes[closes.length - 1 - i - horizon]) / closes[closes.length - 1 - i - horizon];
            returns.push(r);
        }
        if (returns.length < 10) return { classification: 0, evidence: 'YOK', bias: 'Sapma Yok', direction: 0 };

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
        if (returns.length < 10) classCode = 0;
        else if (!statSig) classCode = 0;
        else if (!econSig) classCode = 1;
        else classCode = 2;

        const classification = classCode === 2 ? direction * 2 : classCode === 1 ? direction : 0;
        const evidence: ADMResult['evidence'] = classCode === 2 ? 'GÜÇLÜ' : classCode === 1 ? 'ZAYIF' : 'YOK';
        const bias = classification >= 2 ? 'Pozitif Sapma' : classification <= -2 ? 'Negatif Sapma' : classification === 1 ? 'Pozitif (Zayıf)' : classification === -1 ? 'Negatif (Zayıf)' : 'Sapma Yok';

        return { classification, evidence, bias, direction };
    }

    // ===========================
    // VPA (Volume Price Analysis)
    // ===========================

    private calculateVPA(closes: number[], highs: number[], lows: number[], volumes: number[]): VPAResult {
        const len = closes.length;
        if (len < 2) return { buyVolume: 0, sellVolume: 0, delta: 0, netPressure: 0, state: 'NÖTR' };

        const range = highs[len - 1] - lows[len - 1];
        const buyPct = range === 0 ? 0.5 : (closes[len - 1] - lows[len - 1]) / range;
        const totalVol = volumes[len - 1];
        const buyVol = totalVol * buyPct;
        const sellVol = totalVol * (1 - buyPct);
        const delta = buyVol - sellVol;
        const netPressure = totalVol > 0 ? (delta / totalVol) * 100 : 0;

        return {
            buyVolume: buyVol,
            sellVolume: sellVol,
            delta,
            netPressure,
            state: netPressure > 20 ? 'ALIM BASKISI' : netPressure < -20 ? 'SATIM BASKISI' : 'NÖTR'
        };
    }

    // ===========================
    // SMC & STRUCTURE (V5)
    // ===========================

    private calculateSMC(highs: number[], lows: number[], closes: number[]): SMCResult {
        const len = closes.length;
        if (len < 50) return { swingTrend: 'NEUTRAL', internalTrend: 'NEUTRAL', bos: false, choch: false, orderBlocks: [], fvgs: [] };

        const swingLen = 20;
        const currentHigh = highs[len - 1];
        const currentLow = lows[len - 1];
        const currentClose = closes[len - 1];

        // Basic Pivot High/Low for structure
        const lastHigh = Math.max(...highs.slice(len - swingLen - 1, len - 1));
        const lastLow = Math.min(...lows.slice(len - swingLen - 1, len - 1));

        let bos = currentClose > lastHigh || currentClose < lastLow;
        const choch = false; // logic would go here
        let swingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

        if (currentClose > lastHigh) {
            bos = true;
            swingTrend = 'BULLISH';
        } else if (currentClose < lastLow) {
            bos = true;
            swingTrend = 'BEARISH';
        }

        // FVG Detection (3 bar pattern)
        const fvgs: FairValueGap[] = [];
        for (let i = len - 10; i < len - 1; i++) {
            if (highs[i] > lows[i - 2] && lows[i] < highs[i - 2]) continue; // Not a gap
            if (lows[i] > highs[i - 2]) {
                fvgs.push({ top: lows[i], bottom: highs[i - 2], type: 'BULLISH' });
            } else if (highs[i] < lows[i - 2]) {
                fvgs.push({ top: lows[i - 2], bottom: highs[i], type: 'BEARISH' });
            }
        }

        // Order Block Detection (Simplified)
        const orderBlocks: OrderBlock[] = [];
        if (bos) {
            orderBlocks.push({
                high: currentHigh,
                low: currentLow,
                time: Date.now(),
                index: len - 1,
                type: swingTrend === 'BULLISH' ? 'BULLISH' : 'BEARISH'
            });
        }

        return {
            swingTrend,
            internalTrend: swingTrend,
            bos,
            choch,
            orderBlocks: orderBlocks.slice(-5),
            fvgs: fvgs.slice(-5)
        };
    }

    private calculateLiquidity(highs: number[], lows: number[]): LiquidityResult {
        const len = highs.length;
        if (len < 20) return { eqHighs: false, eqLows: false };

        const threshold = 0.001; // 0.1% for equality
        const h1 = highs[len - 1], h2 = highs[len - 2];
        const l1 = lows[len - 1], l2 = lows[len - 2];

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
        this.bayesianMetrics.currentWinRate = this.bayesianMetrics.winSignals / this.bayesianMetrics.totalSignals;
    }

    // ===========================
    // MAIN ANALYZE METHOD
    // ===========================

    public analyze(
        closes: number[], highs: number[], lows: number[], volumes: number[],
        interval: string = '4h',
        riskMode: 'safe' | 'normal' | 'aggressive' = 'normal'
    ): MatrixV5Result {
        const len = closes.length;
        if (len < 50) {
            console.warn("Matrix V5: Insufficient data (<50 candles). Results may be inaccurate.");
        }

        const currentPrice = closes[len - 1];
        const tfAdapt = this.getTfAdaptFactor(interval);

        // ===============================
        // 1. F4 TREND ENGINE
        // ===============================
        const f4Len = this.config.f4Length;
        const f4Alpha = this.config.f4Alpha;
        const f4Value = this.calculateF4(closes, highs, lows, f4Len, f4Alpha);
        const f4FiboValue = this.calculateF4(closes, highs, lows, this.config.fiboLength, this.config.fiboAlpha);

        // Slope via LinReg
        const adaptSlopeLen = this.adaptPeriod(20, tfAdapt);
        const currentLinReg = this.calculateLinReg(closes, adaptSlopeLen, 0);
        const prevLinReg = this.calculateLinReg(closes, adaptSlopeLen, 1);
        const prevLinReg2 = this.calculateLinReg(closes, adaptSlopeLen, 2);

        const rawSlope = currentLinReg - prevLinReg;
        const prevRawSlope = prevLinReg - prevLinReg2;
        const slope = currentPrice > 0 ? (rawSlope / currentPrice) * 100 : 0;
        const acceleration = currentPrice > 0 ? ((rawSlope - prevRawSlope) / currentPrice) * 100 : 0;

        // Fast Momentum
        const fastLinReg0 = this.calculateLinReg(closes, 5, 0);
        const fastLinReg1 = this.calculateLinReg(closes, 5, 1);
        const fastLinReg2 = this.calculateLinReg(closes, 5, 2);
        const fastSlope = currentPrice > 0 ? ((fastLinReg0 - fastLinReg1) / currentPrice) * 100 : 0;
        const fastAcceleration = currentPrice > 0 ? (((fastLinReg0 - fastLinReg1) - (fastLinReg1 - fastLinReg2)) / currentPrice) * 100 : 0;

        let earlyReversal: 'UP' | 'DOWN' | null = null;
        if (fastAcceleration > 0.01 && rawSlope < 0) earlyReversal = 'UP';
        else if (fastAcceleration < -0.01 && rawSlope > 0) earlyReversal = 'DOWN';

        let trend: MatrixV5Result['trend'] = 'NEUTRAL';
        if (slope > this.config.f4SlopeThreshold) trend = 'BULLISH';
        else if (slope < -this.config.f4SlopeThreshold) trend = 'BEARISH';

        // ===============================
        // 2. V5 INDICATORS (TF-ADAPTIVE)
        // ===============================
        const adaptedRsiLen = this.adaptPeriod(this.config.rsiPeriod, tfAdapt);
        const adaptedMacdFast = this.adaptPeriod(this.config.macdFast, tfAdapt);
        const adaptedMacdSlow = Math.max(this.adaptPeriod(this.config.macdSlow, tfAdapt), 5);
        const adaptedMacdSignal = this.adaptPeriod(this.config.macdSignal, tfAdapt);
        const adaptedStAtr = this.adaptPeriod(this.config.stAtrPeriod, tfAdapt);
        const adaptedAdxLen = this.adaptPeriod(this.config.adxPeriod, tfAdapt);

        // RSI
        const rsi = this.calculateRSI(closes, adaptedRsiLen);
        const rsiState = rsi >= this.config.rsiOB ? 'AŞIRI ALIM' : rsi <= this.config.rsiOS ? 'AŞIRI SATIM' : rsi > 50 ? 'BOĞA' : rsi < 50 ? 'AYI' : 'NÖTR';
        const rsiColor: V5IndicatorState['color'] = rsi >= this.config.rsiOB ? 'red' : rsi <= this.config.rsiOS ? 'green' : rsi > 55 ? 'green' : rsi < 45 ? 'red' : 'gray';

        // MACD
        const macd = this.calculateMACD(closes, adaptedMacdFast, adaptedMacdSlow, adaptedMacdSignal);
        const macdBull = macd.hist > 0;
        const macdState = macd.hist > 0 && macd.hist > (closes[len - 2] ? macd.hist : 0) ? 'GÜÇLÜ BOĞA' : macd.hist > 0 ? 'BOĞA' : macd.hist < 0 ? 'AYI' : 'NÖTR';
        const macdColor: V5IndicatorState['color'] = macd.hist > 0 ? 'green' : 'red';

        // SuperTrend
        const st = this.calculateSuperTrend(highs, lows, closes, this.config.stFactor, adaptedStAtr);
        const stState = st.bull ? 'YUKARI TREND' : 'AŞAĞI TREND';
        const stColor: V5IndicatorState['color'] = st.bull ? 'green' : 'red';

        // StochRSI
        const stochRsi = this.calculateStochRSI(closes, adaptedRsiLen, this.config.stochRsiLen, this.config.stochK, this.config.stochD);
        const stochState = stochRsi.k > 80 ? 'AŞIRI ALIM' : stochRsi.k < 20 ? 'AŞIRI SATIM' : stochRsi.k > stochRsi.d ? 'BOĞA' : 'AYI';
        const stochColor: V5IndicatorState['color'] = stochRsi.k > 80 ? 'red' : stochRsi.k < 20 ? 'green' : stochRsi.k > stochRsi.d ? 'green' : 'red';

        // ADX
        const adx = this.calculateADX(highs, lows, closes, adaptedAdxLen);
        const adxTrending = adx.adx > this.config.adxThreshold;
        const adxState = !adxTrending ? 'YATAY (RANGE)' : adx.diPlus > adx.diMinus ? 'GÜÇLÜ BOĞA' : 'GÜÇLÜ AYI';
        const adxColor: V5IndicatorState['color'] = !adxTrending ? 'gray' : adx.diPlus > adx.diMinus ? 'green' : 'red';

        // VWAP (simplified - using SMA as proxy since we don't have intraday volume profile)
        const vwap = this.calculateSMA(closes, 20);
        const vwapAbove = currentPrice > vwap;
        const vwapState = vwapAbove ? 'ÜZERİNDE (BOĞA)' : 'ALTINDA (AYI)';
        const vwapColor: V5IndicatorState['color'] = vwapAbove ? 'green' : 'red';

        // EMA Ribbon
        const ema8 = this.calculateEMA(closes, this.adaptPeriod(8, tfAdapt));
        const ema13 = this.calculateEMA(closes, this.adaptPeriod(13, tfAdapt));
        const ema21 = this.calculateEMA(closes, Math.max(this.adaptPeriod(21, tfAdapt), 5));
        const ema34 = this.calculateEMA(closes, Math.max(this.adaptPeriod(34, tfAdapt), 5));
        const ema55 = this.calculateEMA(closes, Math.max(this.adaptPeriod(55, tfAdapt), 8));
        const ribbonBull = ema8 > ema13 && ema13 > ema21 && ema21 > ema34 && ema34 > ema55;
        const ribbonBear = ema8 < ema13 && ema13 < ema21 && ema21 < ema34 && ema34 < ema55;
        const ribbonState = ribbonBull ? 'TAM HIZALANMA ↑' : ribbonBear ? 'TAM HIZALANMA ↓' : ema8 > ema55 ? 'BOĞA EĞİLİM' : 'AYI EĞİLİM';
        const ribbonColor: V5IndicatorState['color'] = ribbonBull ? 'green' : ribbonBear ? 'red' : ema8 > ema55 ? 'green' : 'red';

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
        const ichiState = ichiAbove ? 'KUMO ÜSTÜ (BOĞA)' : ichiBelow ? 'KUMO ALTI (AYI)' : 'KUMO İÇİNDE';
        const ichiColor: V5IndicatorState['color'] = ichiAbove ? 'green' : ichiBelow ? 'red' : 'gray';

        const v5Indicators: V5IndicatorState[] = [
            { name: 'RSI', value: rsi.toFixed(1), state: rsiState, color: rsiColor, numericValue: rsi },
            { name: 'MACD', value: macd.hist.toFixed(4), state: macdState, color: macdColor, numericValue: macd.hist },
            { name: 'Supertrend', value: st.value.toFixed(2), state: stState, color: stColor },
            { name: 'StochRSI', value: stochRsi.k.toFixed(1), state: stochState, color: stochColor, numericValue: stochRsi.k },
            { name: 'ADX', value: adx.adx.toFixed(1), state: adxState, color: adxColor, numericValue: adx.adx },
            { name: 'VWAP', value: vwap.toFixed(2), state: vwapState, color: vwapColor },
            { name: 'EMA Ribbon', value: '', state: ribbonState, color: ribbonColor },
            { name: 'Ichimoku', value: '', state: ichiState, color: ichiColor },
        ];

        // ===============================
        // 3. WHALE ENGINE (V5: TF-Adaptive)
        // ===============================
        const volSMA = this.calculateSMA(volumes, 20);
        const intervalSec = this.intervalToSeconds(interval);
        const tfWhaleMultiplier = intervalSec <= 60 ? 1.3 : intervalSec <= 300 ? 1.5 : intervalSec <= 3600 ? 1.8 : intervalSec <= 14400 ? 2.2 : 2.5;
        const adaptiveWhaleVolMult = Math.max(this.config.whaleVolumeMultiplier, tfWhaleMultiplier);
        const currentVolume = volumes[len - 1];
        const isWhale = this.config.useWhaleEngine && currentVolume > volSMA * adaptiveWhaleVolMult;
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

        let whaleStatus: MatrixV5Result['whaleStatus'] = 'NEUTRAL';
        if (fakeBreakoutUp || fakeBreakoutDown) whaleStatus = 'TRAP';
        else if (isWhale && isGreen) whaleStatus = 'BUY_ACTIVE';
        else if (isWhale && !isGreen) whaleStatus = 'SELL_ACTIVE';

        let whaleSignalText = '';
        if (whaleStatus === 'TRAP') whaleSignalText = 'FAKE HAREKET ⚠️';
        else if (whaleStatus === 'BUY_ACTIVE') whaleSignalText = 'BALİNA TOPLUYOR 🐋';
        else if (whaleStatus === 'SELL_ACTIVE') whaleSignalText = 'BALİNA BOŞALTIYOR 🐋';

        // ===============================
        // 4. REGIME & VOLATILITY
        // ===============================
        const ema50 = this.calculateEMA(closes, Math.max(50, this.adaptPeriod(50, tfAdapt)));
        const ema200 = this.calculateEMA(closes, Math.min(closes.length - 1, 200));
        const trendUp = ema50 > ema200;

        const adaptedBBLen = this.adaptPeriod(20, tfAdapt);
        const adaptedZLen = this.adaptPeriod(50, tfAdapt);
        const adaptedAtrLen = this.adaptPeriod(14, tfAdapt);

        const bbStdev = this.calculateStdDev(closes, adaptedBBLen);
        const bbSMA = this.calculateSMA(closes, adaptedBBLen);
        const currentBBW = bbSMA > 0 ? (4 * bbStdev) / bbSMA : 0;

        // Build BBW history for Z-Score
        const bbwHistory: number[] = [];
        for (let i = adaptedBBLen; i <= len; i++) {
            const slice = closes.slice(i - adaptedBBLen, i);
            const s = this.calculateStdDev(slice, adaptedBBLen);
            const m = this.calculateSMA(slice, adaptedBBLen);
            bbwHistory.push(m > 0 ? (4 * s) / m : 0);
        }
        const bbwSMA = this.calculateSMA(bbwHistory, Math.min(adaptedZLen, bbwHistory.length));
        const bbwStdev = this.calculateStdDev(bbwHistory, Math.min(adaptedZLen, bbwHistory.length));
        const bbwZScore = bbwStdev > 0 ? (currentBBW - bbwSMA) / bbwStdev : 0;

        const atrVal = this.calculateATR(highs, lows, closes, adaptedAtrLen);
        const atrSMA = this.calculateSMA(
            highs.map((h, i) => Math.max(h - lows[i], Math.abs(h - (closes[i - 1] || closes[i])), Math.abs(lows[i] - (closes[i - 1] || closes[i])))).slice(Math.max(0, len - adaptedAtrLen * 2)),
            adaptedAtrLen
        );
        const whaleHighVol = atrVal > atrSMA;

        let volatilityRegime: VolatilityRegime = 'NORMAL';
        if (bbwZScore < -1.0) volatilityRegime = 'SQUEEZE';
        else if (bbwZScore > 1.5) volatilityRegime = 'HIGH_VOL';

        let marketRegime: MarketRegime = 'NEUTRAL';
        if (trendUp && volatilityRegime !== 'HIGH_VOL') marketRegime = 'RISK_ON';
        else if (!trendUp && whaleHighVol) marketRegime = 'RISK_OFF';

        // Z-Score
        const zScoreSMA = this.calculateSMA(closes, adaptedZLen);
        const zScoreStdev = this.calculateStdDev(closes, adaptedZLen);
        const zScore = zScoreStdev > 0 ? (currentPrice - zScoreSMA) / zScoreStdev : 0;

        // Momentum State
        const momentumState = slope > 0 && acceleration > 0 ? 'HIZLANIYOR 🚀' :
            slope > 0 && acceleration <= 0 ? 'YAVAŞLIYOR ⚠️' :
            slope < 0 && acceleration < 0 ? 'ÇÖKÜŞ 💀' :
            slope < 0 && acceleration >= 0 ? 'DİP OLUŞUMU 🔄' : 'NÖTR';
        const momentumColor = slope > 0 && acceleration > 0 ? 'green' : slope < 0 && acceleration < 0 ? 'red' : 'gray';

        // ===============================
        // 5. V5.4 F4 EARLY WARNING SYSTEM (Fibo Divergence + Power Loss)
        // ===============================
        // F4 slope: direction of main line
        const prevF4Value = this.calculateF4(closes.slice(0, -1), highs.slice(0, -1), lows.slice(0, -1), f4Len, f4Alpha);
        const f4Slope = f4Value - prevF4Value;
        // F4 slope SMA (3-bar smoothing)
        const f4SlopeSMA = f4Slope; // Simplified: single bar available server-side

        // Fibo slope: direction of Fibo line (faster, leading indicator)
        const prevFiboValue = this.calculateF4(closes.slice(0, -1), highs.slice(0, -1), lows.slice(0, -1), this.config.fiboLength, this.config.fiboAlpha);
        const fiboSlope = f4FiboValue - prevFiboValue;

        // Fibo Divergence: Fibo reversed but F4 hasn't yet
        const fiboDivergingBuy = fiboSlope > 0 && f4SlopeSMA < 0;  // Fibo turned up, F4 still falling
        const fiboDivergingSell = fiboSlope < 0 && f4SlopeSMA > 0; // Fibo turned down, F4 still rising

        // Power Loss Calculation
        const f4SlopeStrength = Math.abs(f4SlopeSMA);
        // Build slope history for max calculation
        const slopeHistory: number[] = [];
        for (let i = 0; i < Math.min(this.config.f4LookbackBars, closes.length - 2); i++) {
            const prevI = this.calculateF4(closes.slice(0, -(i + 1)), highs.slice(0, -(i + 1)), lows.slice(0, -(i + 1)), f4Len, f4Alpha);
            const prevI2 = this.calculateF4(closes.slice(0, -(i + 2)), highs.slice(0, -(i + 2)), lows.slice(0, -(i + 2)), f4Len, f4Alpha);
            slopeHistory.push(Math.abs(prevI - prevI2));
        }
        const f4SlopeMax = slopeHistory.length > 0 ? Math.max(...slopeHistory, f4SlopeStrength) : f4SlopeStrength;
        const f4PowerLoss = f4SlopeMax > 0.00001 ? ((f4SlopeMax - f4SlopeStrength) / f4SlopeMax * 100) : 0;

        // V5.3: Volatility Adaptive Threshold — lower in squeeze
        const dynPowerLossThreshold = volatilityRegime === 'SQUEEZE'
            ? this.config.f4SqueezeThreshold
            : this.config.f4PowerLossThreshold;

        // Dynamic flat filter
        const dynamicThreshold = atrVal * this.config.f4SlopeThreshold;
        const f4NotFlat = f4SlopeStrength > dynamicThreshold || Math.abs(fiboSlope) > dynamicThreshold;

        // V5.4 Dual-layer triggering
        const halfThreshold = dynPowerLossThreshold * 0.5;

        // Early Buy: Fibo divergence + half threshold OR classic power loss
        const f4EarlyBuyFibo = fiboDivergingBuy && f4PowerLoss >= halfThreshold && f4NotFlat;
        const f4EarlyBuyClassic = f4SlopeSMA < 0 && f4PowerLoss >= dynPowerLossThreshold && f4NotFlat;
        const f4EarlyBuy = f4EarlyBuyFibo || f4EarlyBuyClassic;

        // Early Sell: Fibo divergence + half threshold OR classic power loss
        const f4EarlySellFibo = fiboDivergingSell && f4PowerLoss >= halfThreshold && f4NotFlat;
        const f4EarlySellClassic = f4SlopeSMA > 0 && f4PowerLoss >= dynPowerLossThreshold && f4NotFlat;
        const f4EarlySell = f4EarlySellFibo || f4EarlySellClassic;

        // Confirmed signals (line color change — second confirmation)
        const f4ConfirmedBuy = f4Value > prevF4Value && prevF4Value <= (this.calculateF4(
            closes.slice(0, -2), highs.slice(0, -2), lows.slice(0, -2), f4Len, f4Alpha) || 0) && f4NotFlat;
        const f4ConfirmedSell = f4Value < prevF4Value && prevF4Value >= (this.calculateF4(
            closes.slice(0, -2), highs.slice(0, -2), lows.slice(0, -2), f4Len, f4Alpha) || prevF4Value) && f4NotFlat;

        // ===============================
        // 5b. LIQUIDITY ZONE DETECTION (OB/FVG Bonus)
        // ===============================
        const smc = this.calculateSMC(highs, lows, closes);
        let inBullishOB = false, inBearishOB = false;
        let inBullishFVG = false, inBearishFVG = false;

        for (const ob of smc.orderBlocks.slice(0, 5)) {
            if (ob.type === 'BULLISH' && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
            if (ob.type === 'BEARISH' && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
        }
        for (const fvg of smc.fvgs.slice(0, 5)) {
            if (fvg.type === 'BULLISH' && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
            if (fvg.type === 'BEARISH' && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
        }

        const liquidityBonus = (inBullishOB || inBullishFVG || inBearishOB || inBearishFVG) ? 10 : 0;
        const liquidityZone = inBullishOB ? 'OB BOĞA' : inBearishOB ? 'OB AYI' :
            inBullishFVG ? 'FVG BOĞA' : inBearishFVG ? 'FVG AYI' : 'YOK';

        // ===============================
        // 5c. V5.3 DYNAMIC WEIGHTING (Risk-Off Proxy)
        // ===============================
        // Without real DXY data, use volatility as risk-off proxy
        const isRiskOffProxy = volatilityRegime === 'HIGH_VOL' || marketRegime === 'RISK_OFF';
        const dynWeightTech = isRiskOffProxy ? 15 : this.config.confluenceWeightTech;
        const dynWeightMomentum = isRiskOffProxy ? 10 : this.config.confluenceWeightMomentum;
        const dynWeightMarket = isRiskOffProxy ? 25 : this.config.confluenceWeightMarket;
        const dynWeightTrend = isRiskOffProxy ? 20 : this.config.confluenceWeightTrend;

        const dynamicWeights = {
            tech: dynWeightTech,
            momentum: dynWeightMomentum,
            market: dynWeightMarket,
            trend: dynWeightTrend
        };

        // ===============================
        // 5d. V5.3 MTF WEIGHTED VOTING
        // ===============================
        // Daily trend direction (slope > 0 = bull)
        const dailyTrendBull = slope > 0 && trendUp;
        // Count lower TF bull indicators (our proxy for multi-TF)
        const lowerTFBullCount = [macdBull, st.bull, rsi > 50, adx.diPlus > adx.diMinus].filter(Boolean).length;
        // If daily trend is opposite, penalize lower TF score by 50%
        const mtfScoreRaw = dailyTrendBull ? (lowerTFBullCount + 1) : lowerTFBullCount * 0.5;
        const mtfWeightedScore = Math.round(mtfScoreRaw);

        // ===============================
        // 5e. CONFLUENCE ENGINE (6 Categories + V5.4 Enhancements)
        // ===============================
        // Tech Score (F4 + WaveTrend proxy + SMC proxy + MTF proxy)
        const techF4Dir = f4Value > prevF4Value ? 10 : 0;
        const techTrend = slope > 0 ? 10 : 0;
        const techStructure = trendUp ? 10 : 0;
        const techScore = Math.min(40, techF4Dir + techTrend + techStructure + 5);

        // Momentum Score (RSI + MACD + StochRSI)
        const momRSI = rsi > 50 && rsi < this.config.rsiOB ? 10 : rsi <= this.config.rsiOS ? 8 : rsi >= this.config.rsiOB ? 2 : 5;
        const momMACD = macdBull && macd.hist > 0 ? 10 : macd.hist > 0 ? 7 : 2;
        const momStoch = stochRsi.k < 20 ? 9 : stochRsi.k > 80 ? 2 : stochRsi.k > stochRsi.d ? 8 : 4;
        const momentumScore = Math.min(30, Math.max(0, momRSI + momMACD + momStoch));

        // Volume Score
        const volWhaleScore = whaleStatus === 'BUY_ACTIVE' ? 15 : whaleStatus === 'SELL_ACTIVE' ? 0 : 7;
        const volFlowScore = currentVolume > volSMA * 1.5 ? (isGreen ? 10 : 3) : 5;
        const volumeScore = Math.min(25, Math.max(0, volWhaleScore + volFlowScore));

        // Trend Score (ADX + EMA Ribbon + Ichimoku + SuperTrend)
        const trendADX = adxTrending && adx.diPlus > adx.diMinus ? 10 : adxTrending ? 3 : 5;
        const trendRibbon = ribbonBull ? 10 : ribbonBear ? 0 : ema8 > ema55 ? 7 : 3;
        const trendIchi = ichiAbove ? 10 : ichiBelow ? 0 : 5;
        const trendST = st.bull ? 10 : 0;
        const trendScore = Math.min(40, Math.max(0, trendADX + trendRibbon + trendIchi + trendST));

        // Market Score (simplified without external data)
        const mktScore = Math.min(25, Math.max(0, (marketRegime === 'RISK_ON' ? 15 : 5) + (trendUp ? 10 : 0)));

        // Timing Score
        const timScore = Math.min(10, Math.max(0,
            (volatilityRegime === 'SQUEEZE' ? 3 : (volatilityRegime as string) === 'EXPLOSION' ? 5 : 4) +
            (earlyReversal ? 5 : 3)
        ));

        // V5.4: Confluence with Dynamic Weights + Liquidity Bonus (capped at 100)
        const confluenceScore = Math.max(0, Math.min(100,
            (techScore / 40 * dynWeightTech) +
            (momentumScore / 30 * dynWeightMomentum) +
            (volumeScore / 25 * this.config.confluenceWeightVol) +
            (trendScore / 40 * dynWeightTrend) +
            (mktScore / 25 * dynWeightMarket) +
            (timScore / 10 * this.config.confluenceWeightTiming) +
            liquidityBonus
        ));

        const confluenceStatus: ConfluenceStatus = confluenceScore >= 80 ? 'MÜKEMMEL' : confluenceScore >= 65 ? 'GÜÇLÜ' : confluenceScore >= 50 ? 'ORTA' : confluenceScore >= 35 ? 'ZAYIF' : 'YETERSİZ';

        const confluenceBreakdown: ConfluenceBreakdown = {
            techScore, momentumScore, volumeScore, trendScore,
            marketScore: mktScore, timingScore: timScore,
            totalScore: confluenceScore, status: confluenceStatus
        };

        // ===============================
        // 6. PREDICTION ENGINE
        // ===============================
        let baseUpProb = 50.0;
        baseUpProb += slope > 0 ? 10 : -10;
        baseUpProb += acceleration > 0 ? 8 : -8;
        baseUpProb += zScore < -1.5 ? 10 : zScore > 1.5 ? -10 : 0;
        baseUpProb += volatilityRegime === 'SQUEEZE' ? 5 : 0;
        baseUpProb += rsi <= this.config.rsiOS ? 8 : rsi >= this.config.rsiOB ? -8 : 0;
        baseUpProb += st.bull ? 5 : -5;
        baseUpProb += ribbonBull ? 5 : ribbonBear ? -5 : 0;

        const predictionUpProb = Math.max(5, Math.min(95, baseUpProb));
        const predictionDownProb = 100 - predictionUpProb;
        
        // V5.4 Alignment: Prediction text threshold now matches decision threshold (55%)
        // If decision is WAIT, we generally force YATAY unless it's a very strong exhaustion/early signal
        const predictionTextThreshold = 55;
        let predictionText = 'YATAY';
        
        if (predictionUpProb >= predictionTextThreshold) predictionText = 'YUKARI 📈';
        else if (predictionDownProb >= predictionTextThreshold) predictionText = 'AŞAĞI 📉';

        const prediction: PredictionResult = {
            upProb: predictionUpProb, downProb: predictionDownProb,
            text: predictionText,
            direction: predictionUpProb >= 65 ? 'UP' : predictionDownProb >= 65 ? 'DOWN' : 'FLAT'
        };

        // ===============================
        // 7. ADM & VPA
        // ===============================
        const adm = this.calculateADM(closes);
        const vpa = this.calculateVPA(closes, highs, lows, volumes);

        // ===============================
        // 8. AI SCORE (GIGA MASTER)
        // ===============================
        let aiRaw = (confluenceScore * 0.4) +
            (Math.max(predictionUpProb, predictionDownProb) * 0.4) +
            (timScore / 10 * 100 * 0.2);

        // V5 Indicator Bonuses
        if (rsi <= this.config.rsiOS) aiRaw += 8;
        else if (rsi >= this.config.rsiOB) aiRaw -= 5;
        if (st.bull) aiRaw += 5; else aiRaw -= 3;
        if (ribbonBull) aiRaw += 7; else if (ribbonBear) aiRaw -= 5;
        if (ichiAbove) aiRaw += 5; else if (ichiBelow) aiRaw -= 3;
        if (adxTrending) aiRaw += 3;
        if (vwapAbove) aiRaw += 3; else aiRaw -= 2;

        // Penalties
        if (fakeBreakoutUp || fakeBreakoutDown) aiRaw -= 15;
        if (isStoppingVolume) aiRaw -= 10;
        if (adm.classification >= 2) aiRaw += 5;
        else if (adm.classification <= -2) aiRaw -= 5;

        // Risk Mode Bias: Provide numerical feedback for mode changes
        if (riskMode === 'safe') aiRaw -= 12;
        else if (riskMode === 'aggressive') aiRaw += 12;

        const aiScore = Math.max(5, Math.min(99, aiRaw));

        // ===============================
        // 9. SMC & SYSTEM HEALTH (smc already calculated in section 5b)
        // ===============================
        const liquidity = this.calculateLiquidity(highs, lows);
        const whaleTrust = this.bayesianMetrics.currentWinRate;
        const deathRisk = this.bayesianMetrics.currentWinRate < 0.4 && this.bayesianMetrics.totalSignals > 5;
        const systemRestModeValue = (confluenceScore < 40 && volatilityRegime === 'NORMAL');

        // ===============================
        // 10. SYSTEM DECISION & RISK THRESHOLDS
        // ===============================
        let currentMinAi = this.config.minAiScore;
        let currentMinConf = this.config.minConfluenceScore;

        if (riskMode === 'safe') {
            currentMinAi = 75;
            currentMinConf = 72;
        } else if (riskMode === 'aggressive') {
            currentMinAi = 45;
            currentMinConf = 40;
        }

        const longCondition = confluenceScore >= currentMinConf && predictionUpProb >= 55 && smc.swingTrend !== 'BEARISH';
        const shortCondition = confluenceScore >= currentMinConf && predictionDownProb >= 55 && smc.swingTrend !== 'BULLISH';
        const systemDecision: SystemDecision = longCondition ? 'GO_LONG' : shortCondition ? 'GO_SHORT' : 'WAIT';

        // Final Coherence Check: If decision is WAIT, Ensure prediction text represents this
        if (systemDecision === 'WAIT') {
             // Only allow trend text if it's very high confidence but confluence is missing
             if (predictionUpProb < 75 && predictionDownProb < 75) {
                 prediction.text = 'YATAY';
                 prediction.direction = 'FLAT';
             }
        } else {
             // Ensure prediction text matches decision direction if decision is NOT wait
             if (systemDecision === 'GO_LONG') {
                 prediction.text = 'YUKARI 📈';
                 prediction.direction = 'UP';
             } else if (systemDecision === 'GO_SHORT') {
                 prediction.text = 'AŞAĞI 📉';
                 prediction.direction = 'DOWN';
             }
        }

        let signal: 'BUY' | 'SELL' | null = null;
        if (longCondition && aiScore >= currentMinAi) signal = 'BUY';
        else if (shortCondition && aiScore >= currentMinAi) signal = 'SELL';

        // ===============================
        // 11. REGIME PREDICTION
        // ===============================
        const trendStrength = Math.abs(ema50 - ema200) / currentPrice;
        let regimePredictionValue: RegimePrediction = 'TRANSITION';
        if (isStoppingVolume) regimePredictionValue = 'STOPPING_VOLUME';
        else if (Math.abs(zScore) > 2.0 && acceleration < 0) regimePredictionValue = 'EXHAUSTION';
        else if (volatilityRegime === 'SQUEEZE') regimePredictionValue = 'PRE_EXPLOSION';
        else if (earlyReversal === 'UP') regimePredictionValue = 'EARLY_REVERSAL_UP';
        else if (earlyReversal === 'DOWN') regimePredictionValue = 'EARLY_REVERSAL_DOWN';
        else if (slope > 0 && acceleration > 0 && whaleHighVol) regimePredictionValue = 'ACCELERATING_TREND';
        else if (slope > 0 && acceleration <= 0) regimePredictionValue = 'DECELERATING_TREND';
        else if (slope < 0 && acceleration < 0 && whaleHighVol) regimePredictionValue = 'ACCELERATING_DROP';
        else if (slope < 0 && acceleration >= 0) regimePredictionValue = 'BOTTOM_FINDING';
        else if (trendStrength < 0.005) regimePredictionValue = 'RANGE';

        // Market Phase
        let marketPhaseTextValue = 'KONSOLİDASYON';
        if (whaleStatus === 'BUY_ACTIVE' && volatilityRegime === 'SQUEEZE') marketPhaseTextValue = 'AKÜMÜLASYON 💎';
        else if (whaleStatus === 'SELL_ACTIVE' && volatilityRegime === 'SQUEEZE') marketPhaseTextValue = 'DAĞITIM ⚠️';
        else if (trendUp && whaleHighVol) marketPhaseTextValue = 'YUKARI TREND 🚀';
        else if (!trendUp && whaleHighVol) marketPhaseTextValue = 'AŞAĞI TREND 📉';

        // Capital Phase
        const volScoreAsset = currentVolume / Math.max(volSMA, 1);
        const atrScoreAsset = atrVal / Math.max(atrSMA, 0.0001);
        const assetScore = volScoreAsset * 0.4 + atrScoreAsset * 0.3 + trendStrength * 0.3;
        const capitalPhaseValue = assetScore > 2.0 ? 'PRIMARY_FLOW' : assetScore > 1.4 ? 'SECONDARY_FLOW' : assetScore > 1.1 ? 'ROTATION' : 'NO_CAPITAL';
        const capitalFlowTextValue = capitalPhaseValue === 'PRIMARY_FLOW' ? 'Ana Akış (Güçlü)' : capitalPhaseValue === 'SECONDARY_FLOW' ? 'İkincil Akış' : capitalPhaseValue === 'ROTATION' ? 'Rotasyon' : 'Para Yok ❌';

        // MTF Consensus (single-TF approximation)
        const bullIndicators = [slope > 0, macdBull, st.bull, rsi > 50, adx.diPlus > adx.diMinus].filter(Boolean).length;
        const mtfConsensusStr = `${bullIndicators}/5 ${bullIndicators >= 4 ? 'GÜÇLÜ BOĞA' : bullIndicators <= 1 ? 'GÜÇLÜ AYI' : bullIndicators >= 3 ? 'BOĞA' : 'KARIŞIK'}`;

        // Legacy V3 AI Components (backward compat)
        const components: AiScoreComponents = {
            whaleConfirmed: isWhale && !fakeBreakoutUp && !fakeBreakoutDown ? 15 : 0,
            regimeAlignment: marketRegime === 'RISK_ON' && whaleStatus === 'BUY_ACTIVE' ? 15 : 0,
            volumePower: isWhale ? 10 : 0,
            trendAlignment: trendUp ? 10 : 0,
            mtfConsensus: bullIndicators >= 3 ? 15 : 5,
            momentumAccel: (slope > 0 && acceleration > 0) || (slope < 0 && acceleration < 0) ? 10 : 0,
            volatilityRegime: volatilityRegime === 'SQUEEZE' ? 10 : 0,
            zScore: Math.abs(zScore) > 2.5 ? 10 : Math.abs(zScore) > 1.5 ? 5 : 0,
            bayesianWinRate: Math.round(this.bayesianMetrics.currentWinRate * 10),
            trapPenalty: fakeBreakoutUp || fakeBreakoutDown ? -15 : 0
        };

        // ===============================
        // 12. TARGET CALCULATIONS (ATR-Based)
        // ===============================
        const atrTarget = this.calculateATR(highs, lows, closes, adaptedAtrLen);
        const direction = systemDecision === 'GO_LONG' ? 1 : systemDecision === 'GO_SHORT' ? -1 : (predictionUpProb > predictionDownProb ? 1 : -1);
        
        const targets = {
            t1: currentPrice + (direction * atrTarget * 1.5),
            t2: currentPrice + (direction * atrTarget * 3.0),
            sl: currentPrice - (direction * atrTarget * 1.0)
        };

        return {
            symbol: 'BTCUSDT',
            trend, slope, acceleration,
            whaleDetected: isWhale, whaleStatus, signal,
            f4Value, f4FiboValue, aiScore,
            aiComponents: components,
            marketRegime, volatilityRegime, regimePrediction: regimePredictionValue, systemDecision,
            zScoreValue: zScore, mtfConsensus: mtfConsensusStr,
            earlyReversal, fastSlope, fastAcceleration,
            deathRisk, whaleTrust,
            // V5 New
            confluenceScore, confluenceBreakdown, prediction,
            adm, vpa, v5Indicators,
            momentumState, momentumColor,
            whaleSignalText, marketPhaseText: marketPhaseTextValue,
            capitalFlowText: capitalFlowTextValue, capitalPhase: capitalPhaseValue, tfAdaptFactor: tfAdapt,
            // SMC & Structure
            smc, liquidity, systemRestMode: systemRestModeValue,
            vixBottom: volatilityRegime === 'SQUEEZE' && zScore < -1.5,
            inPremium: zScore > 1.5,
            inDiscount: zScore < -1.5,
            swingTrend: smc.swingTrend,
            targets,
            // V5.3/V5.4 New Fields
            f4PowerLoss,
            f4EarlyBuy,
            f4EarlySell,
            f4ConfirmedBuy,
            f4ConfirmedSell,
            liquidityZone,
            liquidityBonus,
            mtfWeightedScore,
            dynamicWeights,
        };
    }
}
