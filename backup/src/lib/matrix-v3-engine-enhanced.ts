/**
 * Matrix V3 Engine - Enhanced Version
 * Full port from "Matrix F4 Ultimate V3" Pine Script
 * 
 * Core Components:
 * 1. F4 Trend Engine (Multi-Timeframe Slope & Acceleration)
 * 2. Whale Engine (Volume Anomaly, Stopping Volume, Trap Detection)
 * 3. AI Score Engine (10-component weighted scoring)
 * 4. Regime Prediction (Momentum-based forecasting)
 * 5. System Decision (Final GO/NO-GO)
 * 6. SMC Structure (BOS, CHoCH, Order Blocks, FVG, Equal Highs/Lows)
 * 7. Williams Vix Fix (Dip Hunter)
 * 8. QFL (Quick Fingers Luc) Panic Bottom Detection
 * 9. ChartPrime Trend Channels
 * 10. LuxAlgo Trend Lines
 */

export interface MatrixV3Config {
    // F4 Settings
    f4Length: number;
    f4Alpha: number;
    f4SlopeThresholdFactor: number;
    f4FiboLength: number;
    f4FiboAlpha: number;
    
    // Trade Mode
    tradeMode: 'Scalp' | 'Swing';
    
    // Whale Engine
    whaleVolumeMultiplier: number;
    minAiScore: number;
    useWhaleEngine: boolean;
    
    // Vix Fix
    vixLookback: number;
    vixBbl: number;
    vixMult: number;
    vixLb: number;
    vixPh: number;
    vixPl: number;
    useQFL: boolean;
    useMomentum: boolean;
    qflLookback: number;
    qflDropPct: number;
    
    // Capital Engine
    signalFreshnessBars: number;
    maxConsecutiveLoss: number;
    
    // ChartPrime
    cpLength: number;
    
    // LuxAlgo
    luxLength: number;
    luxMult: number;
    luxCalcMethod: 'Atr' | 'Stdev' | 'Linreg';
}

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
    earlyReversalBonus: number;
    stoppingVolumePenalty: number;
    vixBottomBonus: number;
    deltaDivergence: number;
}

export type MarketRegime = 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
export type VolatilityRegime = 'SIKIŞTIRMA' | 'PATLAMA' | 'YÜKSEK_VOL' | 'NORMAL';
export type RegimePrediction = 
    | 'HIZLANAN_TREND' | 'YAVAŞLAYAN_TREND' 
    | 'HIZLANAN_DÜŞÜŞ' | 'DİP_ARAYIŞI' 
    | 'RANGE' | 'STOPPING_VOL' | 'PRE_EXPLOSION'
    | 'ERKEN_DÖNÜŞ_YUKARI' | 'ERKEN_DÖNÜŞ_AŞAĞI'
    | 'DİP_FIRSATI_VIX' | 'EXHAUSTION'
    | 'TRANSITION';
export type SystemDecision = 'GO_LONG' | 'GO_SHORT' | 'WAIT';

export interface OrderBlock {
    barHigh: number;
    barLow: number;
    barTime: number;
    bias: 'BULLISH' | 'BEARISH';
    mitigated: boolean;
}

export interface FairValueGap {
    top: number;
    bottom: number;
    bias: 'BULLISH' | 'BEARISH';
    mitigated: boolean;
}

export interface SwingPoint {
    price: number;
    barIndex: number;
    barTime: number;
    type: 'HIGH' | 'LOW';
    strength: 'HIGH' | 'LOW'; // Yüksek Zirve/Dip vs Düşük Zirve/Dip
}

export interface StructurePoint {
    level: number;
    barTime: number;
    barIndex: number;
    type: 'BOS' | 'CHoCH';
    direction: 'BULLISH' | 'BEARISH';
    internal: boolean;
}

export interface MatrixV3Result {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    slope: number;
    acceleration: number;
    whaleDetected: boolean;
    whaleStatus: 'RALLİ_HAZIRLIĞI' | 'DAĞITIM' | 'TUZAK' | 'ALIM_AKTİF' | 'SATIM_AKTİF' | 'NÖTR';
    signal: 'BUY' | 'SELL' | null;
    f4Value: number;
    f4FiboValue: number;
    
    // V3 Fields
    aiScore: number;
    aiComponents: AiScoreComponents;
    marketRegime: MarketRegime;
    volatilityRegime: VolatilityRegime;
    regimePrediction: RegimePrediction;
    systemDecision: SystemDecision;
    zScoreValue: number;
    mtfConsensus: string;
    mtfBullCount: number;
    
    // Early Reversal Signals
    earlyReversal: 'UP' | 'DOWN' | null;
    fastSlope: number;
    fastAcceleration: number;
    
    // SMC Structure
    internalTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    swingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    lastBOS: StructurePoint | null;
    lastCHoCH: StructurePoint | null;
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    equalHighs: SwingPoint | null;
    equalLows: SwingPoint | null;
    
    // Premium/Discount Zones
    trailingTop: number;
    trailingBottom: number;
    inPremium: boolean;
    inDiscount: boolean;
    
    // Vix Fix
    vixBottom: boolean;
    vixValue: number;
    
    // QFL
    qflPanicBottom: boolean;
    
    // WaveTrend
    wt1: number;
    wt2: number;
    wtDivergence: 'BULLISH' | 'BEARISH' | null;
    
    // Market Data
    btcDominance: number;
    btcDomChange: number;
    usdtDominance: number;
    usdtDomChange: number;
    othersDominance: number;
    othersDomChange: number;
    dxyValue: number;
    dxyChange: number;
    marketFlow: 'ALTCOIN_SEZONU' | 'NAKİTE_KAÇIŞ' | 'BİTCOIN_ÖNCÜ' | 'KARIŞIK';
    
    // Capital Engine
    capitalPhase: 'PRIMARY_FLOW' | 'SECONDARY_FLOW' | 'ROTATION' | 'NO_CAPITAL';
    signalFreshness: number;
    decayFactor: number;
    timeValid: boolean;
    
    // System Health
    whaleTrust: number;
    consecutiveLosses: number;
    deathRisk: boolean;
    systemRestMode: boolean;
    metaAllow: boolean;
    
    // Dashboard Recommendation
    confluenceText: string;
    confluenceColor: string;

    // Forecast
    forecastPrice: number;
    forecastBias: 'UP' | 'DOWN' | 'FLAT';
    forecastConfidence: number;
}

export class MatrixV3Engine {
    private config: MatrixV3Config;

    private bayesianMetrics = {
        totalBuySignals: 0,
        winBuySignals: 0,
        totalSellSignals: 0,
        winSellSignals: 0,
        currentWinRate: 0.5,
        consecutiveLosses: 0,
        consecutiveWins: 0,
        whaleTrust: 1.0
    };

    private signalBar: number = -999;
    
    // SMC State
    private swingHigh: SwingPoint | null = null;
    private swingLow: SwingPoint | null = null;
    private internalHigh: SwingPoint | null = null;
    private internalLow: SwingPoint | null = null;
    private swingTrendState: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    private internalTrendState: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    private orderBlocks: OrderBlock[] = [];
    private fairValueGaps: FairValueGap[] = [];
    private trailingTop: number = 0;
    private trailingBottom: number = Infinity;

    constructor(config: Partial<MatrixV3Config> = {}) {
        this.config = {
            f4Length: config.f4Length || 10,
            f4Alpha: config.f4Alpha || 3.7,
            f4SlopeThresholdFactor: config.f4SlopeThresholdFactor || 0.01,
            f4FiboLength: config.f4FiboLength || 5,
            f4FiboAlpha: config.f4FiboAlpha || 0.618,
            tradeMode: config.tradeMode || 'Scalp',
            whaleVolumeMultiplier: config.whaleVolumeMultiplier || 1.0,
            minAiScore: config.minAiScore || 65,
            useWhaleEngine: config.useWhaleEngine ?? true,
            vixLookback: config.vixLookback || 22,
            vixBbl: config.vixBbl || 20,
            vixMult: config.vixMult || 2.0,
            vixLb: config.vixLb || 50,
            vixPh: config.vixPh || 0.85,
            vixPl: config.vixPl || 1.01,
            useQFL: config.useQFL ?? false,
            useMomentum: config.useMomentum ?? false,
            qflLookback: config.qflLookback || 30,
            qflDropPct: config.qflDropPct || 3.0,
            signalFreshnessBars: config.signalFreshnessBars || 5,
            maxConsecutiveLoss: config.maxConsecutiveLoss || 6,
            cpLength: config.cpLength || 45,
            luxLength: config.luxLength || 20,
            luxMult: config.luxMult || 4.0,
            luxCalcMethod: config.luxCalcMethod || 'Atr'
        };
    }

    public updateWinRate(isWin: boolean, isBuy: boolean) {
        if (isBuy) {
            this.bayesianMetrics.totalBuySignals++;
            if (isWin) this.bayesianMetrics.winBuySignals++;
        } else {
            this.bayesianMetrics.totalSellSignals++;
            if (isWin) this.bayesianMetrics.winSellSignals++;
        }
        
        const total = this.bayesianMetrics.totalBuySignals + this.bayesianMetrics.totalSellSignals;
        const wins = this.bayesianMetrics.winBuySignals + this.bayesianMetrics.winSellSignals;
        this.bayesianMetrics.currentWinRate = total > 0 ? wins / total : 0.5;
        
        // Update trust and consecutive counters
        if (isWin) {
            this.bayesianMetrics.consecutiveWins++;
            this.bayesianMetrics.consecutiveLosses = 0;
            this.bayesianMetrics.whaleTrust = Math.min(1.5, this.bayesianMetrics.whaleTrust + 0.05);
        } else {
            this.bayesianMetrics.consecutiveLosses++;
            this.bayesianMetrics.consecutiveWins = 0;
            this.bayesianMetrics.whaleTrust = Math.max(0.0, this.bayesianMetrics.whaleTrust - 0.1);
        }
    }

    // ===============================
    // MATH HELPERS
    // ===============================
    
    private calculateLinReg(source: number[], length: number, offset: number = 0): number {
        if (source.length < length + offset) return 0;
        
        const end = source.length - 1 - offset;
        const start = end - length + 1;
        
        let sumX = 0; let sumY = 0; let sumXY = 0; let sumXX = 0;
        
        for (let i = 0; i < length; i++) {
            const x = i;
            const y = source[start + i];
            sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
        }
        
        const slope = (length * sumXY - sumX * sumY) / (length * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / length;
        return intercept + slope * (length - 1);
    }

    private calculateSMA(source: number[], length: number): number {
        if (source.length === 0) return 0;
        const slice = source.slice(-length);
        const effectiveLength = Math.max(slice.length, 1);
        return slice.reduce((a, b) => a + b, 0) / effectiveLength;
    }

    private calculateEMASeries(source: number[], length: number): number[] {
        if (source.length === 0) return [];
        const k = 2 / (length + 1);
        const emaSeries: number[] = [];
        let ema = source[0];
        emaSeries.push(ema);

        for (let i = 1; i < source.length; i++) {
            ema = source[i] * k + ema * (1 - k);
            emaSeries.push(ema);
        }
        return emaSeries;
    }

    private calculateEMA(source: number[], length: number): number {
        const series = this.calculateEMASeries(source, length);
        return series.length > 0 ? series[series.length - 1] : 0;
    }

    private calculateStdDev(source: number[], length: number): number {
        if (source.length === 0) return 0;
        const slice = source.slice(-length);
        const effectiveLength = Math.max(slice.length, 1);
        const mean = slice.reduce((a, b) => a + b, 0) / effectiveLength;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / effectiveLength;
        return Math.sqrt(variance);
    }

    private calculateATR(highs: number[], lows: number[], closes: number[], length: number): number {
        if (highs.length < 2) return 0;
        const effectiveLength = Math.min(length, highs.length - 1);
        let trSum = 0;
        let count = 0;
        const startIndex = Math.max(1, highs.length - effectiveLength);
        for (let i = startIndex; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i - 1]);
            const lc = Math.abs(lows[i] - closes[i - 1]);
            trSum += Math.max(hl, hc, lc);
            count++;
        }
        return count > 0 ? trSum / count : 0;
    }

    private highest(source: number[], length: number): number {
        if (source.length === 0) return 0;
        const slice = source.slice(-length);
        return Math.max(...slice);
    }

    private lowest(source: number[], length: number): number {
        if (source.length === 0) return 0;
        const slice = source.slice(-length);
        return Math.min(...slice);
    }

    // ===============================
    // F4 CALCULATIONS (TILLSON T3)
    // ===============================
    
    private calculateF4(highs: number[], lows: number[], closes: number[], length: number, alpha: number): number {
        if (closes.length === 0) return 0;
        // Tillson T3 with H+L+2C/4 source
        const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + 2 * c) / 4);

        const e1 = this.calculateEMASeries(hlc3, length);
        const e2 = this.calculateEMASeries(e1, length);
        const e3 = this.calculateEMASeries(e2, length);
        const e4 = this.calculateEMASeries(e3, length);
        const e5 = this.calculateEMASeries(e4, length);
        const e6 = this.calculateEMASeries(e5, length);

        const lastE3 = e3[e3.length - 1] ?? 0;
        const lastE4 = e4[e4.length - 1] ?? 0;
        const lastE5 = e5[e5.length - 1] ?? 0;
        const lastE6 = e6[e6.length - 1] ?? 0;

        const c1 = -alpha * alpha * alpha;
        const c2 = 3 * alpha * alpha + 3 * alpha * alpha * alpha;
        const c3 = -6 * alpha * alpha - 3 * alpha - 3 * alpha * alpha * alpha;
        const c4 = 1 + 3 * alpha + alpha * alpha * alpha + 3 * alpha * alpha;

        return c1 * lastE6 + c2 * lastE5 + c3 * lastE4 + c4 * lastE3;
    }

    // ===============================
    // WILIAMS VIX FIX
    // ===============================
    
    private calculateVixFix(closes: number[], lows: number[], lookback: number): number {
        // wvf = ((highest(close, pd) - low) / highest(close, pd)) * 100
        const highestClose = this.highest(closes, lookback);
        const currentLow = lows[lows.length - 1];
        if (highestClose <= 0) return 0;
        return ((highestClose - currentLow) / highestClose) * 100;
    }

    private detectVixBottom(closes: number[], lows: number[]): boolean {
        const lookback = this.config.vixLookback;
        const bbl = this.config.vixBbl;
        const lb = this.config.vixLb;
        
        // We need historical WVF values to calculate SMA and StdDev
        const wvfHistory: number[] = [];
        const historyNeeded = Math.max(bbl, lb);
        
        for (let i = 0; i < historyNeeded; i++) {
            const endIdx = closes.length - (historyNeeded - 1 - i);
            if (endIdx < lookback) continue;
            
            const sliceCloses = closes.slice(0, endIdx);
            const sliceLows = lows.slice(0, endIdx);
            wvfHistory.push(this.calculateVixFix(sliceCloses, sliceLows, lookback));
        }
        
        if (wvfHistory.length < bbl) return false;
        
        const currentWvf = wvfHistory[wvfHistory.length - 1];
        const wvfSma = this.calculateSMA(wvfHistory, bbl);
        const wvfStdev = this.calculateStdDev(wvfHistory, bbl);
        const upperBand = wvfSma + (this.config.vixMult * wvfStdev);
        const rangeHigh = Math.max(...wvfHistory.slice(-lb)) * this.config.vixPh;
        
        return currentWvf >= upperBand || currentWvf >= rangeHigh;
    }

    // ===============================
    // QFL (QUICK FINGERS LUC)
    // ===============================
    
    private detectQFLPanic(closes: number[], lows: number[]): boolean {
        if (closes.length < 2) return false;
        // QFL Base = lowest low of lookback period (shifted by 1)
        const base = this.lowest(lows.slice(0, -1), this.config.qflLookback);
        const currentClose = closes[closes.length - 1];

        return base > 0 && currentClose < base * (1 - this.config.qflDropPct / 100);
    }

    // ===============================
    // WAVETREND
    // ===============================
    
    private calculateWaveTrend(closes: number[], highs: number[], lows: number[]): { wt1: number, wt2: number, divergence: 'BULLISH' | 'BEARISH' | null } {
        const length = 10;
        const avgLength = 21;
        
        // HLC3
        const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
        
        // ESA = EMA(HLC3, 10)
        const esaSeries = this.calculateEMASeries(hlc3, length);

        // D = EMA(abs(HLC3 - ESA), 10)
        const diff = hlc3.map((h, i) => Math.abs(h - esaSeries[i]));
        const dSeries = this.calculateEMASeries(diff, length);

        // CI = (HLC3 - ESA) / (0.015 * D)
        const ci = hlc3.map((h, i) => dSeries[i] > 0 ? (h - esaSeries[i]) / (0.015 * dSeries[i]) : 0);

        // WT1 = EMA(CI, 21)
        const wt1Series = this.calculateEMASeries(ci, avgLength);
        const wt1 = wt1Series.length > 0 ? wt1Series[wt1Series.length - 1] : 0;

        // WT2 = SMA(WT1, 4)
        const wt2 = this.calculateSMA(wt1Series, 4);
        
        // Divergence detection (simplified)
        let divergence: 'BULLISH' | 'BEARISH' | null = null;
        const currentWt1 = wt1;
        
        if (closes.length >= 5 && currentWt1 < -60 && closes[closes.length - 1] < closes[closes.length - 5]) {
            divergence = 'BULLISH';
        } else if (closes.length >= 5 && currentWt1 > 60 && closes[closes.length - 1] > closes[closes.length - 5]) {
            divergence = 'BEARISH';
        }
        
        return { wt1, wt2, divergence };
    }

    // ===============================
    // SMC STRUCTURE
    // ===============================
    
    private detectSwingPoints(highs: number[], lows: number[], length: number): { swingHigh: SwingPoint | null, swingLow: SwingPoint | null } {
        const len = highs.length;
        if (len < length * 2 + 1) return { swingHigh: null, swingLow: null };
        
        const pivotIndex = len - length - 1;
        const pivotHigh = highs[pivotIndex];
        const pivotLow = lows[pivotIndex];
        
        let isSwingHigh = true;
        let isSwingLow = true;
        
        for (let i = pivotIndex - length; i <= pivotIndex + length; i++) {
            if (i !== pivotIndex) {
                if (highs[i] >= pivotHigh) isSwingHigh = false;
                if (lows[i] <= pivotLow) isSwingLow = false;
            }
        }
        
        let swingHigh: SwingPoint | null = null;
        let swingLow: SwingPoint | null = null;
        
        if (isSwingHigh) {
            const prevHigh = this.swingHigh;
            const strength = prevHigh && pivotHigh > prevHigh.price ? 'HIGH' : 'LOW';
            swingHigh = {
                price: pivotHigh,
                barIndex: pivotIndex,
                barTime: Date.now(),
                type: 'HIGH',
                strength
            };
        }
        
        if (isSwingLow) {
            const prevLow = this.swingLow;
            const strength = prevLow && pivotLow > prevLow.price ? 'HIGH' : 'LOW';
            swingLow = {
                price: pivotLow,
                barIndex: pivotIndex,
                barTime: Date.now(),
                type: 'LOW',
                strength
            };
        }
        
        return { swingHigh, swingLow };
    }

    private updateStructure(swingHigh: SwingPoint | null, swingLow: SwingPoint | null, closes: number[]): {
        bos: StructurePoint | null,
        choch: StructurePoint | null,
        internalTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
        swingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
    } {
        let bos: StructurePoint | null = null;
        let choch: StructurePoint | null = null;
        const currentClose = closes[closes.length - 1];
        
        // Update swing trend
        if (swingHigh) {
            if (this.swingTrendState === 'BEARISH' && currentClose > swingHigh.price) {
                // CHoCH - Trend reversal
                choch = {
                    level: swingHigh.price,
                    barTime: Date.now(),
                    barIndex: swingHigh.barIndex,
                    type: 'CHoCH',
                    direction: 'BULLISH',
                    internal: false
                };
                this.swingTrendState = 'BULLISH';
            } else if (this.swingTrendState === 'BULLISH' && currentClose > swingHigh.price) {
                // BOS - Trend continuation
                bos = {
                    level: swingHigh.price,
                    barTime: Date.now(),
                    barIndex: swingHigh.barIndex,
                    type: 'BOS',
                    direction: 'BULLISH',
                    internal: false
                };
            }
            this.swingHigh = swingHigh;
        }
        
        if (swingLow) {
            if (this.swingTrendState === 'BULLISH' && currentClose < swingLow.price) {
                choch = {
                    level: swingLow.price,
                    barTime: Date.now(),
                    barIndex: swingLow.barIndex,
                    type: 'CHoCH',
                    direction: 'BEARISH',
                    internal: false
                };
                this.swingTrendState = 'BEARISH';
            } else if (this.swingTrendState === 'BEARISH' && currentClose < swingLow.price) {
                bos = {
                    level: swingLow.price,
                    barTime: Date.now(),
                    barIndex: swingLow.barIndex,
                    type: 'BOS',
                    direction: 'BEARISH',
                    internal: false
                };
            }
            this.swingLow = swingLow;
        }
        
        return {
            bos,
            choch,
            internalTrend: this.internalTrendState,
            swingTrend: this.swingTrendState
        };
    }

    private detectOrderBlocks(closes: number[], highs: number[], lows: number[], volumes: number[]): OrderBlock[] {
        const len = closes.length;
        if (len < 3) return [];

        const volSma = this.calculateSMA(volumes, 20);
        const atrLength = Math.min(200, highs.length - 1);
        const atr = atrLength >= 2 ? this.calculateATR(highs, lows, closes, atrLength) : 0;
        if (atr === 0 || volSma === 0) return this.orderBlocks.filter(ob => !ob.mitigated);
        
        // Look for high volatility bars with volume
        const newBlocks: OrderBlock[] = [];
        
        for (let i = len - 3; i < len; i++) {
            const range = highs[i] - lows[i];
            const isHighVol = range >= 2 * atr;
            const hasVolume = volumes[i] > volSma;
            
            if (isHighVol && hasVolume) {
                const isBullish = closes[i] > closes[i - 1];
                newBlocks.push({
                    barHigh: highs[i],
                    barLow: lows[i],
                    barTime: Date.now(),
                    bias: isBullish ? 'BULLISH' : 'BEARISH',
                    mitigated: false
                });
            }
        }
        
        // Check mitigation
        this.orderBlocks = this.orderBlocks.map(ob => {
            if (!ob.mitigated) {
                const currentClose = closes[len - 1];
                if (ob.bias === 'BEARISH' && currentClose > ob.barHigh) {
                    ob.mitigated = true;
                } else if (ob.bias === 'BULLISH' && currentClose < ob.barLow) {
                    ob.mitigated = true;
                }
            }
            return ob;
        });
        
        // Add new blocks
        this.orderBlocks.push(...newBlocks);
        
        // Keep only last 20 blocks
        if (this.orderBlocks.length > 20) {
            this.orderBlocks = this.orderBlocks.slice(-20);
        }
        
        return this.orderBlocks.filter(ob => !ob.mitigated);
    }

    private detectFVG(highs: number[], lows: number[], closes: number[]): FairValueGap[] {
        const len = closes.length;
        if (len < 3) return [];
        
        const currentLow = lows[len - 1];
        const prev2High = highs[len - 3];
        const currentHigh = highs[len - 1];
        const prev2Low = lows[len - 3];
        
        // Bullish FVG: Current Low > Prev2 High
        if (currentLow > prev2High) {
            this.fairValueGaps.push({
                top: currentLow,
                bottom: prev2High,
                bias: 'BULLISH',
                mitigated: false
            });
        }
        
        // Bearish FVG: Current High < Prev2 Low
        if (currentHigh < prev2Low) {
            this.fairValueGaps.push({
                top: currentHigh,
                bottom: prev2Low,
                bias: 'BEARISH',
                mitigated: false
            });
        }
        
        // Check mitigation
        const currentClose = closes[len - 1];
        this.fairValueGaps = this.fairValueGaps.map(fvg => {
            if (!fvg.mitigated) {
                if (fvg.bias === 'BULLISH' && currentClose < fvg.bottom) {
                    fvg.mitigated = true;
                } else if (fvg.bias === 'BEARISH' && currentClose > fvg.top) {
                    fvg.mitigated = true;
                }
            }
            return fvg;
        });
        
        // Keep only last 10
        if (this.fairValueGaps.length > 10) {
            this.fairValueGaps = this.fairValueGaps.slice(-10);
        }
        
        return this.fairValueGaps.filter(fvg => !fvg.mitigated);
    }

    // ===============================
    // MAIN ANALYSIS
    // ===============================
    
    public analyze(
        closes: number[], 
        highs: number[], 
        lows: number[], 
        volumes: number[],
        marketData?: {
            btcDominance?: number;
            btcDomChange?: number;
            usdtDominance?: number;
            usdtDomChange?: number;
            othersDominance?: number;
            othersDomChange?: number;
            dxyValue?: number;
            dxyChange?: number;
        }
    ): MatrixV3Result {
        const len = closes.length;
        if (len < 200) {
            console.warn("Matrix V3: Insufficient data (<200 candles). Results may be inaccurate.");
        }

        const currentPrice = closes[len - 1];
        const currentVolume = volumes[len - 1];

        // Dynamic settings based on trade mode
        const useLen = this.config.tradeMode === 'Scalp' ? 10 : 21;
        const dynamicSwingLen = this.config.tradeMode === 'Scalp' ? 20 : 50;

        const atr = this.calculateATR(highs, lows, closes, 14);
        const atrPct = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
        
        // ===============================
        // 1. F4 TREND ENGINE
        // ===============================
        const currentLinReg = this.calculateLinReg(closes, useLen, 0);
        const prevLinReg = this.calculateLinReg(closes, useLen, 1);
        const prevLinReg2 = this.calculateLinReg(closes, useLen, 2);
        
        const rawSlope = currentLinReg - prevLinReg;
        const prevRawSlope = prevLinReg - prevLinReg2;
        
        // Fast Momentum (Early Warning)
        const fastLength = 5;
        const currentFastLinReg = this.calculateLinReg(closes, fastLength, 0);
        const prevFastLinReg = this.calculateLinReg(closes, fastLength, 1);
        const prevFastLinReg2 = this.calculateLinReg(closes, fastLength, 2);
        
        const fastRawSlope = currentFastLinReg - prevFastLinReg;
        const prevFastRawSlope = prevFastLinReg - prevFastLinReg2;

        const fastSlope = (fastRawSlope / currentPrice) * 100;
        const fastAcceleration = ((fastRawSlope - prevFastRawSlope) / currentPrice) * 100;

        // Percent slope
        const slope = (rawSlope / currentPrice) * 100;
        const acceleration = ((rawSlope - prevRawSlope) / currentPrice) * 100;

        const slopeThreshold = Math.max(this.config.f4SlopeThresholdFactor, atrPct * 0.2);
        const accelThreshold = Math.max(0.01, atrPct * 0.05);

        // Early Reversal Detection
        let earlyReversal: 'UP' | 'DOWN' | null = null;
        if (fastAcceleration > accelThreshold && slope < -slopeThreshold) earlyReversal = 'UP';
        else if (fastAcceleration < -accelThreshold && slope > slopeThreshold) earlyReversal = 'DOWN';

        this.internalTrendState = fastSlope > slopeThreshold ? 'BULLISH' : fastSlope < -slopeThreshold ? 'BEARISH' : 'NEUTRAL';

        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (slope > slopeThreshold) trend = 'BULLISH';
        else if (slope < -slopeThreshold) trend = 'BEARISH';

        // F4 Value (Tillson T3 approximation)
        const f4Value = this.calculateF4(highs, lows, closes, useLen, this.config.f4Alpha);
        const f4FiboValue = this.calculateF4(highs, lows, closes, this.config.f4FiboLength, this.config.f4FiboAlpha);

        // ===============================
        // 2. WHALE ENGINE
        // ===============================
        const volSMA = this.calculateSMA(volumes, 20);
        const isWhale = this.config.useWhaleEngine && currentVolume > (volSMA * this.config.whaleVolumeMultiplier);
        const isStoppingVolume = currentVolume > (volSMA * 3.5);
        
        // Trap Detection
        const highest20 = this.highest(highs, 20);
        const lowest20 = this.lowest(lows, 20);
        const highest20Prev = highs.length > 1 ? this.highest(highs.slice(0, -1), 20) : highest20;
        const lowest20Prev = lows.length > 1 ? this.lowest(lows.slice(0, -1), 20) : lowest20;
        const openPrice = len > 1 ? closes[len - 2] : closes[len - 1];
        const isGreen = currentPrice > openPrice;

        const fakeBreakoutUp = isWhale && highs[len-1] >= highest20Prev && currentPrice < highest20Prev;
        const fakeBreakoutDown = isWhale && lows[len-1] <= lowest20Prev && currentPrice > lowest20Prev;
        
        // Cumulative Volume Delta
        const volDelta = currentVolume * (isGreen ? 1 : -1);
        
        // Rally / Distribution Classification
        // Removed 50-period extremes as they lag too much
        
        const whaleBuyConfirmed = isWhale && isGreen && !fakeBreakoutUp &&
            (currentPrice <= lowest20Prev * 1.02 || currentPrice > highest20Prev * 0.98); // Accumulation near lows OR breakout
        const whaleSellConfirmed = isWhale && !isGreen && !fakeBreakoutDown &&
            (currentPrice >= highest20Prev * 0.98 || currentPrice < lowest20Prev); // Distribution near highs OR breakdown
        
        // Simplified Phase Logic - Don't rely on 50-period extremes as they lag too much
        const rallyPhase = whaleBuyConfirmed || (isWhale && isGreen && slope > 0);
        const distributionPhase = whaleSellConfirmed || (isWhale && !isGreen && slope < 0);
        
        let whaleStatus: MatrixV3Result['whaleStatus'] = 'NÖTR';
        if (rallyPhase) whaleStatus = 'RALLİ_HAZIRLIĞI';
        else if (distributionPhase) whaleStatus = 'DAĞITIM';
        else if (fakeBreakoutUp || fakeBreakoutDown) whaleStatus = 'TUZAK';
        else if (isWhale && isGreen) whaleStatus = 'ALIM_AKTİF';
        else if (isWhale && !isGreen) whaleStatus = 'SATIM_AKTİF';

        // ===============================
        // 3. VIX FIX & QFL
        // ===============================
        const vixBottom = this.detectVixBottom(closes, lows);
        const vixValue = this.calculateVixFix(closes, lows, this.config.vixLookback);
        const qflPanicBottom = this.config.useQFL && this.detectQFLPanic(closes, lows);
        
        // Combined bottom signal
        const isVixBottomSignal = vixBottom &&
            (!this.config.useQFL || qflPanicBottom) &&
            (!this.config.useMomentum || fastAcceleration > 0);

        // ===============================
        // 4. VOLATILITY REGIME
        // ===============================
        const stdev20 = this.calculateStdDev(closes, 20);
        const sma20 = this.calculateSMA(closes, 20);
        const bbw = sma20 > 0 ? (4 * stdev20) / sma20 : 0;
        
        // Real BBW Z-Score from historical BBW values
        const bbwHistory: number[] = [];
        const bbwLookback = Math.min(50, len - 20);
        for (let i = 0; i < bbwLookback; i++) {
            const idx = len - bbwLookback + i;
            if (idx < 20) continue;
            const s = this.calculateStdDev(closes.slice(0, idx + 1), 20);
            const m = this.calculateSMA(closes.slice(0, idx + 1), 20);
            bbwHistory.push(m > 0 ? (4 * s) / m : 0);
        }
        const bbwMean = bbwHistory.length > 0 ? this.calculateSMA(bbwHistory, bbwHistory.length) : bbw;
        const bbwStd = bbwHistory.length > 1 ? this.calculateStdDev(bbwHistory, bbwHistory.length) : 0.0001;
        const bbwZScore = bbwStd > 0.0001 ? (bbw - bbwMean) / bbwStd : 0;
        
        // Real ATR Z-Score from historical ATR values
        const atrHistory: number[] = [];
        const atrLookback = Math.min(50, len - 15);
        for (let i = 0; i < atrLookback; i++) {
            const idx = len - atrLookback + i;
            if (idx < 15) continue;
            atrHistory.push(this.calculateATR(highs.slice(0, idx + 1), lows.slice(0, idx + 1), closes.slice(0, idx + 1), 14));
        }
        const atrMean = atrHistory.length > 0 ? this.calculateSMA(atrHistory, atrHistory.length) : atr;
        const atrStd = atrHistory.length > 1 ? this.calculateStdDev(atrHistory, atrHistory.length) : 0.0001;
        const atrZScore = atrStd > 0.0001 ? (atr - atrMean) / atrStd : 0;
        
        let volatilityRegime: VolatilityRegime = 'NORMAL';
        if (bbwZScore < -1.0) volatilityRegime = 'SIKIŞTIRMA';
        else if (bbwZScore > 1.5) volatilityRegime = 'PATLAMA';
        else if (atrZScore > 1.0) volatilityRegime = 'YÜKSEK_VOL'; // Lowered threshold from 1.5

        // ===============================
        // 5. MARKET REGIME
        // ===============================
        const ema50 = this.calculateEMA(closes, 50);
        const ema200 = this.calculateEMA(closes, 200);
        const trendUp = ema50 > ema200;
        
        let marketRegime: MarketRegime = 'NEUTRAL';
        // Pure trend based regime, decoupled from volatility
        if (trendUp) marketRegime = 'RISK_ON';
        else marketRegime = 'RISK_OFF';
        
        // Neutral if EMAs are very close (choppy / consolidating)
        const spread = Math.abs(ema50 - ema200) / currentPrice;
        if (spread < 0.005) marketRegime = 'NEUTRAL';

        // ===============================
        // 5.5 MTF CONSENSUS
        // ===============================
        const slopeForLength = (length: number): number => {
            if (closes.length < length + 1) return 0;
            const lr0 = this.calculateLinReg(closes, length, 0);
            const lr1 = this.calculateLinReg(closes, length, 1);
            return currentPrice > 0 ? ((lr0 - lr1) / currentPrice) * 100 : 0;
        };
        const mtfLengths = this.config.tradeMode === 'Scalp' ? [5, 13, 34] : [8, 21, 55];
        const mtfSlopes = mtfLengths.map(slopeForLength);
        const mtfBullCount = mtfSlopes.filter(value => value > slopeThreshold).length;
        const mtfBearCount = mtfSlopes.filter(value => value < -slopeThreshold).length;
        const mtfConsensus = mtfBullCount > mtfBearCount ? 'GÜÇLÜ YÜKSELİŞ' : mtfBearCount > mtfBullCount ? 'GÜÇLÜ DÜŞÜŞ' : 'KARIŞIK';

        // ===============================
        // 6. Z-SCORE
        // ===============================
        const sma50 = this.calculateSMA(closes, 50);
        const stdev50 = this.calculateStdDev(closes, 50);
        const zScore = stdev50 > 0 ? (currentPrice - sma50) / stdev50 : 0;
        
        let zScorePoints = 0;
        if (zScore > 2.5) zScorePoints = -10;       // Overbought = bearish penalty
        else if (zScore > 1.5) zScorePoints = -5;
        else if (zScore < -2.5) zScorePoints = 10;  // Oversold = bullish opportunity
        else if (zScore < -1.5) zScorePoints = 5;
        else if (Math.abs(zScore) < 0.5) zScorePoints = 3; // Mean reversion zone

        // ===============================
        // 7. WAVETREND
        // ===============================
        const { wt1, wt2, divergence: wtDivergence } = this.calculateWaveTrend(closes, highs, lows);

        // ===============================
        // 8. SMC STRUCTURE
        // ===============================
        const { swingHigh, swingLow } = this.detectSwingPoints(highs, lows, dynamicSwingLen);
        const { bos, choch, internalTrend, swingTrend } = this.updateStructure(swingHigh, swingLow, closes);
        
        const activeOrderBlocks = this.detectOrderBlocks(closes, highs, lows, volumes);
        const activeFVGs = this.detectFVG(highs, lows, closes);

        // Update trailing extremes
        if (this.trailingTop === 0) this.trailingTop = highs[len-1];
        if (!Number.isFinite(this.trailingBottom)) this.trailingBottom = lows[len-1];
        if (highs[len-1] > this.trailingTop) this.trailingTop = highs[len-1];
        if (lows[len-1] < this.trailingBottom) this.trailingBottom = lows[len-1];
        
        // Premium/Discount
        const inPremium = currentPrice >= (this.trailingTop * 0.75 + this.trailingBottom * 0.25);
        const inDiscount = currentPrice <= (this.trailingTop * 0.25 + this.trailingBottom * 0.75);

        // ===============================
        // 9. AI SCORE (10 COMPONENTS)
        // ===============================
        // Delta Divergence
        const lowestLow = this.lowest(lows, 10);
        const highestHigh = this.highest(highs, 10);
        const deltaBullishDiv = lows[len-1] <= lowestLow && volDelta > 0;
        const deltaBearishDiv = highs[len-1] >= highestHigh && volDelta < 0;

        const mtfScore = mtfBullCount >= 3 ? 15 :
            mtfBullCount === 2 ? 10 :
            mtfBullCount === 1 ? 5 :
            mtfBearCount >= 3 ? -15 :
            mtfBearCount === 2 ? -10 :
            mtfBearCount === 1 ? -5 : 0;
        const momentumScore = (slope > slopeThreshold && acceleration > accelThreshold) ? 12 :
            (slope < -slopeThreshold && acceleration < -accelThreshold) ? -12 : 0;
        const bayesianScore = Math.round((this.bayesianMetrics.currentWinRate - 0.5) * 20);
        
        const components: AiScoreComponents = {
            whaleConfirmed: (isWhale && !fakeBreakoutUp && !fakeBreakoutDown) ? 15 : 0,
            regimeAlignment: 
                (marketRegime === 'RISK_ON' && trend === 'BULLISH') ? 15 :
                (marketRegime === 'RISK_OFF' && trend === 'BEARISH') ? 15 :
                (marketRegime === 'NEUTRAL') ? 5 : 0,
            volumePower: currentVolume > volSMA * 1.5 ? 10 :
                         currentVolume > volSMA ? 5 : 0,
            trendAlignment: 
                (trendUp && trend === 'BULLISH') ? 10 :
                (!trendUp && trend === 'BEARISH') ? 10 :
                (trend !== 'NEUTRAL') ? 5 : 0,
            mtfConsensus: mtfScore,
            momentumAccel: momentumScore,
            volatilityRegime: volatilityRegime === 'SIKIŞTIRMA' ? 10 : 
                (volatilityRegime === 'PATLAMA' ? 5 : (volatilityRegime === 'YÜKSEK_VOL' ? -5 : 3)),
            zScore: zScorePoints,
            bayesianWinRate: bayesianScore,
            trapPenalty: (fakeBreakoutUp || fakeBreakoutDown) ? -15 : 0,
            earlyReversalBonus: earlyReversal === 'UP' ? 8 :
                                earlyReversal === 'DOWN' ? -5 : 0,
            stoppingVolumePenalty: isStoppingVolume ? -10 : 0,
            vixBottomBonus: isVixBottomSignal ? 10 : 0,
            deltaDivergence: deltaBullishDiv ? 15 : (deltaBearishDiv ? -15 : 0)
        };

        const rawAiScore = Object.values(components).reduce((a, b) => a + b, 0);
        const aiScore = Math.max(0, Math.min(100, 50 + rawAiScore / 2));

        // ===============================
        // 10. REGIME PREDICTION
        // ===============================
        let regimePrediction: RegimePrediction = 'TRANSITION';
        
        if (isStoppingVolume) regimePrediction = 'STOPPING_VOL';
        else if (isVixBottomSignal) regimePrediction = 'DİP_FIRSATI_VIX';
        else if (Math.abs(zScore) > 2.0 && acceleration < 0) regimePrediction = 'EXHAUSTION';
        else if (volatilityRegime === 'SIKIŞTIRMA' && slope > 0 && acceleration > 0) regimePrediction = 'PRE_EXPLOSION';
        else if (earlyReversal === 'UP') regimePrediction = 'ERKEN_DÖNÜŞ_YUKARI';
        else if (earlyReversal === 'DOWN') regimePrediction = 'ERKEN_DÖNÜŞ_AŞAĞI';
        else if (volatilityRegime === 'SIKIŞTIRMA') regimePrediction = 'PRE_EXPLOSION';
        else if (slope > 0 && acceleration > 0) regimePrediction = 'HIZLANAN_TREND';
        else if (slope > 0 && acceleration <= 0) regimePrediction = 'YAVAŞLAYAN_TREND';
        else if (slope < 0 && acceleration < 0) regimePrediction = 'HIZLANAN_DÜŞÜŞ';
        else if (slope < 0 && acceleration >= 0) regimePrediction = 'DİP_ARAYIŞI';
        else if (Math.abs(ema50 - ema200) / currentPrice < 0.005) regimePrediction = 'RANGE';

        // ===============================
        // 11. CAPITAL ENGINE
        // ===============================
        const atrRatio = atrMean > 0.0001 ? (atr / atrMean) : 1.0;
        const assetScore = (currentVolume / Math.max(volSMA, 1)) * 0.4 + 
            atrRatio * 0.3 +
            (Math.abs(ema50 - ema200) / currentPrice) * 0.3;
        
        let capitalPhase: MatrixV3Result['capitalPhase'] = 'NO_CAPITAL';
        if (assetScore > 2.0) capitalPhase = 'PRIMARY_FLOW';
        else if (assetScore > 1.4) capitalPhase = 'SECONDARY_FLOW';
        else if (assetScore > 1.1) capitalPhase = 'ROTATION';

        // Signal freshness
        const barsLate = this.signalBar === -999 ? 999 : len - this.signalBar;
        const decayFactor = barsLate <= 1 ? 1.0 : 
            barsLate <= 3 ? 0.7 : 
            barsLate <= this.config.signalFreshnessBars ? 0.4 : 0.0;
        const timeValid = decayFactor > 0;

        // ===============================
        // 12. SYSTEM DECISION
        // ===============================
        const tradeAllowedByScore = aiScore >= this.config.minAiScore;
        const regimeTradable = regimePrediction !== 'RANGE' && regimePrediction !== 'STOPPING_VOL';
        
        // Simplified capital check - any volume activity is sufficient
        const capitalActive = currentVolume > volSMA * 0.5;
        
        // Death risk from consecutive losses (stateless per-request, so always false for now)
        const deathRisk = this.bayesianMetrics.consecutiveLosses >= this.config.maxConsecutiveLoss;
        
        // System rest mode (overtrading protection)
        const systemRestMode = false; // Stateless per-request
        
        const metaAllow = regimeTradable && !deathRisk && !systemRestMode;
        
        let systemDecision: SystemDecision = 'WAIT';
        let signal: 'BUY' | 'SELL' | null = null;
        
        // --- LONG CONDITIONS ---
        const isScalp = this.config.tradeMode === 'Scalp';
        const highConfidence = aiScore >= 70;
        
        // 1. Strong Trend Follow
        const strongLong = trend === 'BULLISH' && tradeAllowedByScore && 
            marketRegime === 'RISK_ON' && metaAllow && capitalActive;
            
        // 2. Reversal / Scalp Opportunity (trend may still be bearish during early reversal)
        const scalpLong = tradeAllowedByScore && metaAllow &&
            (isScalp || highConfidence) && 
            (earlyReversal === 'UP' || isVixBottomSignal || whaleBuyConfirmed) &&
            (marketRegime !== 'RISK_OFF' || highConfidence);

        // --- SHORT CONDITIONS ---
        // 1. Strong Trend Follow
        const strongShort = trend === 'BEARISH' && tradeAllowedByScore && 
            marketRegime === 'RISK_OFF' && metaAllow && capitalActive;
            
        // 2. Reversal / Scalp Opportunity (trend may still be bullish during early reversal)
        const scalpShort = tradeAllowedByScore && metaAllow &&
            (isScalp || highConfidence) && 
            (earlyReversal === 'DOWN' || whaleSellConfirmed) && !isVixBottomSignal &&
            (marketRegime !== 'RISK_ON' || highConfidence);
        
        if (strongLong || scalpLong) {
            systemDecision = 'GO_LONG';
            signal = 'BUY';
            this.signalBar = len;
        } else if (strongShort || scalpShort) {
            systemDecision = 'GO_SHORT';
            signal = 'SELL';
            this.signalBar = len;
        }

        // ===============================
        // 13. MARKET DATA
        // ===============================
        const btcDominance = marketData?.btcDominance || 0;
        const btcDomChange = marketData?.btcDomChange || 0;
        const usdtDominance = marketData?.usdtDominance || 0;
        const usdtDomChange = marketData?.usdtDomChange || 0;
        const othersDominance = marketData?.othersDominance || 0;
        const othersDomChange = marketData?.othersDomChange || 0;
        const dxyValue = marketData?.dxyValue || 0;
        const dxyChange = marketData?.dxyChange || 0;
        
        let marketFlow: MatrixV3Result['marketFlow'] = 'KARIŞIK';
        if (btcDomChange < -0.1 && usdtDomChange < -0.1) marketFlow = 'ALTCOIN_SEZONU';
        else if (usdtDomChange > 0.1) marketFlow = 'NAKİTE_KAÇIŞ';
        else if (btcDomChange > 0.1 && usdtDomChange < 0.1) marketFlow = 'BİTCOIN_ÖNCÜ';

        // ===============================
        // 14. CONFLUENCE TEXT (Dashboard)
        // ===============================
        let confluenceText = 'NÖTR / BEKLE';
        let confluenceColor = 'gray';
        
        const isRally = wt1 > 80;
        const isOverbought = wt1 > 60;
        const isOversold = wt1 < -60;
        const prevF4Value = len > 1
            ? this.calculateF4(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1), useLen, this.config.f4Alpha)
            : f4Value;
        const prevF4FiboValue = len > 1
            ? this.calculateF4(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1), this.config.f4FiboLength, this.config.f4FiboAlpha)
            : f4FiboValue;
        const f4TrendUp = f4Value > prevF4Value;
        const fiboTrendUp = f4FiboValue > prevF4FiboValue;
        
        if (isRally && f4TrendUp) {
            confluenceText = 'RALLİ MODU (TUT)';
            confluenceColor = '#00ff00';
        } else if ((inDiscount || isOversold || wtDivergence === 'BULLISH') && (fiboTrendUp || wt1 > wt2)) {
            confluenceText = 'DİP DÖNÜŞÜ - AL';
            confluenceColor = '#089981';
        } else if (!inPremium && !isOverbought && fiboTrendUp && f4TrendUp) {
            confluenceText = 'TREND YÖNÜNDE AL';
            confluenceColor = '#089981';
        } else if ((inPremium || isOverbought || wtDivergence === 'BEARISH') && (!fiboTrendUp || wt1 < wt2)) {
            confluenceText = 'TEPE DÖNÜŞÜ - SAT';
            confluenceColor = '#F23645';
        } else if (!inDiscount && !isOversold && !fiboTrendUp && !f4TrendUp) {
            confluenceText = 'DÜŞÜŞ TRENDİ (SAT)';
            confluenceColor = '#F23645';
        } else if ((isOverbought || inPremium) && fiboTrendUp) {
            confluenceText = 'AŞIRI ALIM (RİSKLİ)';
            confluenceColor = '#F23645';
        } else if ((isOversold || inDiscount) && !fiboTrendUp) {
            confluenceText = 'AŞIRI SATIŞ (TEPKİ)';
            confluenceColor = '#089981';
        }

        // ===============================
        // 15. FORECAST (SHORT-HORIZON)
        // ===============================
        const forecastMovePct = slope + acceleration * 0.6;
        const forecastVolAdj = volatilityRegime === 'SIKIŞTIRMA' ? 0.8 : volatilityRegime === 'PATLAMA' ? 1.2 : 1.0;
        const forecastMoveAdj = forecastMovePct * forecastVolAdj;
        const forecastPrice = currentPrice * (1 + forecastMoveAdj / 100);
        const forecastBias: MatrixV3Result['forecastBias'] =
            forecastMoveAdj > slopeThreshold ? 'UP' :
            forecastMoveAdj < -slopeThreshold ? 'DOWN' : 'FLAT';
        const forecastConfidence = Math.max(0, Math.min(1, Math.abs(forecastMoveAdj) / Math.max(atrPct, 0.1)));

        return {
            trend,
            slope,
            acceleration,
            whaleDetected: isWhale,
            whaleStatus,
            signal,
            f4Value,
            f4FiboValue,
            
            aiScore,
            aiComponents: components,
            marketRegime,
            volatilityRegime,
            regimePrediction,
            systemDecision,
            zScoreValue: zScore,
            mtfConsensus,
            mtfBullCount,
            
            earlyReversal,
            fastSlope,
            fastAcceleration,
            
            internalTrend,
            swingTrend,
            lastBOS: bos,
            lastCHoCH: choch,
            orderBlocks: activeOrderBlocks,
            fairValueGaps: activeFVGs,
            equalHighs: null,
            equalLows: null,
            
            trailingTop: this.trailingTop,
            trailingBottom: this.trailingBottom,
            inPremium,
            inDiscount,
            
            vixBottom: isVixBottomSignal,
            vixValue,
            qflPanicBottom,
            
            wt1,
            wt2,
            wtDivergence,
            
            btcDominance,
            btcDomChange,
            usdtDominance,
            usdtDomChange,
            othersDominance,
            othersDomChange,
            dxyValue,
            dxyChange,
            marketFlow,
            
            capitalPhase,
            signalFreshness: barsLate,
            decayFactor,
            timeValid,
            
            whaleTrust: this.bayesianMetrics.whaleTrust,
            consecutiveLosses: this.bayesianMetrics.consecutiveLosses,
            deathRisk,
            systemRestMode,
            metaAllow,

            confluenceText,
            confluenceColor,
            forecastPrice,
            forecastBias,
            forecastConfidence
        };
    }
}
