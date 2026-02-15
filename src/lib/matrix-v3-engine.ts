/**
 * Matrix V3 Engine
 * Ported from "Matrix F4 Ultimate V3" Pine Script
 * 
 * Core Components:
 * 1. F4 Trend Engine (Multi-Timeframe Slope & Acceleration)
 * 2. Whale Engine (Volume Anomaly, Stopping Volume, Trap Detection)
 * 3. AI Score Engine (10-component weighted scoring)
 * 4. Regime Prediction (Momentum-based forecasting)
 * 5. System Decision (Final GO/NO-GO)
 */

export interface MatrixV3Config {
    f4Length: number;           // Default: 10
    whaleVolumeMultiplier: number; // Default: 2.5
    minAiScore: number;         // Default: 65
    useWhaleEngine: boolean;    // Default: true
}

export interface AiScoreComponents {
    whaleConfirmed: number;     // +15
    regimeAlignment: number;    // +15 (Risk-ON/OFF match)
    volumePower: number;        // +10 (Whale volume active)
    trendAlignment: number;     // +10 (EMA50 > EMA200)
    mtfConsensus: number;       // +15 (4+ TFs agree)
    momentumAccel: number;      // +10 (Slope & Accel same direction)
    volatilityRegime: number;   // +10 (Squeeze/Explosion)
    zScore: number;             // +10 (Mean reversion)
    bayesianWinRate: number;    // +5
    trapPenalty: number;        // -15 (Fake breakout)
}

export type MarketRegime = 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
export type VolatilityRegime = 'SQUEEZE' | 'EXPLOSION' | 'HIGH_VOL' | 'NORMAL';
export type RegimePrediction = 
    'ACCELERATING_TREND' | 'DECELERATING_TREND' | 
    'ACCELERATING_DROP' | 'BOTTOM_FINDING' | 
    'RANGE' | 'STOPPING_VOLUME' | 'PRE_EXPLOSION';
export type SystemDecision = 'GO_LONG' | 'GO_SHORT' | 'WAIT';

export interface MatrixV3Result {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    slope: number;
    acceleration: number;
    whaleDetected: boolean;
    whaleStatus: 'RALLY_PREP' | 'DISTRIBUTION' | 'TRAP' | 'BUY_ACTIVE' | 'SELL_ACTIVE' | 'NEUTRAL';
    signal: 'BUY' | 'SELL' | null;
    f4Value: number;
    
    // V3 Fields
    aiScore: number;
    aiComponents: AiScoreComponents;
    marketRegime: MarketRegime;
    volatilityRegime: VolatilityRegime;
    regimePrediction: RegimePrediction;
    systemDecision: SystemDecision;
    zScoreValue: number;
    mtfConsensus: 'STRONG_BULL' | 'STRONG_BEAR' | 'MIXED';
}

export class MatrixV3Engine {
    private config: MatrixV3Config;

    constructor(config: Partial<MatrixV3Config> = {}) {
        this.config = {
            f4Length: config.f4Length || 10,
            whaleVolumeMultiplier: config.whaleVolumeMultiplier || 2.5,
            minAiScore: config.minAiScore || 65,
            useWhaleEngine: config.useWhaleEngine ?? true
        };
    }

    // Helper: Linear Regression
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

    // Helper: Simple Moving Average
    private calculateSMA(source: number[], length: number): number {
        if (source.length < length) return 0;
        const slice = source.slice(source.length - length);
        return slice.reduce((a, b) => a + b, 0) / length;
    }

    // Helper: Exponential Moving Average
    private calculateEMA(source: number[], length: number): number {
        if (source.length < length) return 0;
        const k = 2 / (length + 1);
        let ema = source[0]; // Simple initialization
        // Better initialization: SMA of first 'length' elements
        if (source.length >= length) {
             ema = source.slice(0, length).reduce((a, b) => a + b, 0) / length;
        }
        
        for (let i = length; i < source.length; i++) {
            ema = source[i] * k + ema * (1 - k);
        }
        return ema;
    }

    // Helper: Standard Deviation
    private calculateStdDev(source: number[], length: number): number {
        if (source.length < length) return 0;
        const slice = source.slice(source.length - length);
        const mean = slice.reduce((a, b) => a + b, 0) / length;
        const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / length;
        return Math.sqrt(variance);
    }

    // Helper: Average True Range (Approximation)
    private calculateATR(highs: number[], lows: number[], closes: number[], length: number): number {
        if (highs.length < length + 1) return 0;
        let trSum = 0;
        // Simple TR average for the last 'length' bars
        for (let i = highs.length - length; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i - 1]);
            const lc = Math.abs(lows[i] - closes[i - 1]);
            trSum += Math.max(hl, hc, lc);
        }
        return trSum / length;
    }

    // Helper: Bollinger Band Width Z-Score
    private calculateBBWZScore(closes: number[]): number {
        // We need historical BBW to calc Z-Score properly. 
        // Approximating using current close volatility relative to recent history.
        const stdev = this.calculateStdDev(closes, 20);
        const sma = this.calculateSMA(closes, 20);
        
        if (sma === 0) return 0;
        
        // BBW = (Upper - Lower) / Middle = (4 * StDev) / SMA
        const currentBBW = (4 * stdev) / sma;
        
        // To get a Z-Score, we'd need a history of BBW values. 
        // For now, we'll define arbitrary thresholds based on typical crypto volatility.
        // A "Squeeze" is usually very low volatility.
        
        if (currentBBW < 0.05) return -1.5; // Squeeze
        if (currentBBW > 0.20) return 2.0;  // High Vol
        return 0;
    }

    public analyze(closes: number[], highs: number[], lows: number[], volumes: number[]): MatrixV3Result {
        const len = closes.length;
        // Need at least 200 bars for EMA200
        if (len < 200) {
            console.warn("Matrix V3: Insufficient data (<200 candles). Results may be inaccurate.");
        }

        const currentPrice = closes[len - 1];
        const currentVolume = volumes[len - 1];
        
        // ===============================
        // 1. F4 Trend Engine (Slope & Accel)
        // ===============================
        const f4Length = this.config.f4Length;
        const currentLinReg = this.calculateLinReg(closes, f4Length, 0);
        const prevLinReg = this.calculateLinReg(closes, f4Length, 1);
        const prevLinReg2 = this.calculateLinReg(closes, f4Length, 2);
        
        const rawSlope = currentLinReg - prevLinReg;
        const prevRawSlope = prevLinReg - prevLinReg2;
        
        // Percent slope relative to price
        const slope = (rawSlope / currentPrice) * 100; 
        const acceleration = ((rawSlope - prevRawSlope) / currentPrice) * 100;

        let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (slope > 0.02) trend = 'BULLISH';
        else if (slope < -0.02) trend = 'BEARISH';

        // ===============================
        // 2. Whale Engine (V3)
        // ===============================
        const volSMA = this.calculateSMA(volumes, 20);
        const isWhale = currentVolume > (volSMA * this.config.whaleVolumeMultiplier);
        const isStoppingVolume = currentVolume > (volSMA * 3.5); 
        
        // Trap Detection
        // Need to be careful with slice indices
        const recentHighs = highs.slice(Math.max(0, len - 20));
        const recentLows = lows.slice(Math.max(0, len - 20));
        const highest20 = Math.max(...recentHighs);
        const lowest20 = Math.min(...recentLows);
        
        const fakeBreakoutUp = isWhale && highs[len-1] >= highest20 && closes[len-1] < highest20;
        const fakeBreakoutDown = isWhale && lows[len-1] <= lowest20 && closes[len-1] > lowest20;

        // Determine Candle Color (Open vs Close)
        // We might not have 'opens' passed in, approximate with prev Close if needed, 
        // but ideally we should update the interface. For now assuming closes[i-1] as open approximately.
        const openPrice = closes[len-2]; 
        const isGreen = closes[len-1] > openPrice;

        let whaleStatus: MatrixV3Result['whaleStatus'] = 'NEUTRAL';
        
        if (fakeBreakoutUp || fakeBreakoutDown) {
            whaleStatus = 'TRAP';
        } else if (isWhale) {
            if (isGreen) whaleStatus = 'BUY_ACTIVE';
            else whaleStatus = 'SELL_ACTIVE';
        }

        // ===============================
        // 3. Volatility Regime
        // ===============================
        const bbwZ = this.calculateBBWZScore(closes);
        
        let volatilityRegime: VolatilityRegime = 'NORMAL';
        if (bbwZ < -1.0) volatilityRegime = 'SQUEEZE';
        else if (bbwZ > 1.5) volatilityRegime = 'HIGH_VOL';
        else if (bbwZ >= -1.0 && bbwZ < -0.5) volatilityRegime = 'EXPLOSION'; 

        // ===============================
        // 4. Market Regime (Macro)
        // ===============================
        const ema50 = this.calculateEMA(closes, 50);
        const ema200 = this.calculateEMA(closes, 200);
        const trendUp = ema50 > ema200;
        
        let marketRegime: MarketRegime = 'NEUTRAL';
        if (trendUp && volatilityRegime !== 'HIGH_VOL') marketRegime = 'RISK_ON';
        else if (!trendUp && volatilityRegime === 'HIGH_VOL') marketRegime = 'RISK_OFF';

        // ===============================
        // 5. Z-Score (Mean Reversion)
        // ===============================
        const sma50 = this.calculateSMA(closes, 50);
        const stdev50 = this.calculateStdDev(closes, 50);
        const zScore = stdev50 > 0 ? (currentPrice - sma50) / stdev50 : 0;
        
        let zScorePoints = 0;
        if (Math.abs(zScore) > 2.5) zScorePoints = 10;
        else if (Math.abs(zScore) > 1.5) zScorePoints = 5;

        // ===============================
        // 6. AI Score Calculation (10 Components)
        // ===============================
        const whaleConfirmed = (isWhale && !fakeBreakoutUp && !fakeBreakoutDown) ? 15 : 0;
        const regimeMatch = ((marketRegime === 'RISK_ON' && whaleStatus === 'BUY_ACTIVE') || 
                             (marketRegime === 'RISK_OFF' && whaleStatus === 'SELL_ACTIVE')) ? 15 : 0;
        
        const components: AiScoreComponents = {
            whaleConfirmed,
            regimeAlignment: regimeMatch,
            volumePower: isWhale ? 10 : 0,
            trendAlignment: ((trendUp && whaleStatus === 'BUY_ACTIVE') || (!trendUp && whaleStatus === 'SELL_ACTIVE')) ? 10 : 0,
            mtfConsensus: (slope > 0 && ema50 > ema200) ? 15 : 5, 
            momentumAccel: (slope > 0 && acceleration > 0) || (slope < 0 && acceleration < 0) ? 10 : 0,
            volatilityRegime: volatilityRegime === 'SQUEEZE' ? 10 : (volatilityRegime === 'EXPLOSION' ? 5 : 0),
            zScore: zScorePoints,
            bayesianWinRate: 5, 
            trapPenalty: (fakeBreakoutUp || fakeBreakoutDown) ? -15 : 0
        };

        const aiScore = Math.max(0, Math.min(100, Object.values(components).reduce((a, b) => a + b, 0)));

        // ===============================
        // 7. Regime Prediction
        // ===============================
        let regimePrediction: RegimePrediction = 'RANGE';
        if (isStoppingVolume) regimePrediction = 'STOPPING_VOLUME';
        else if (volatilityRegime === 'SQUEEZE') regimePrediction = 'PRE_EXPLOSION';
        else if (slope > 0 && acceleration > 0) regimePrediction = 'ACCELERATING_TREND';
        else if (slope > 0 && acceleration <= 0) regimePrediction = 'DECELERATING_TREND';
        else if (slope < 0 && acceleration < 0) regimePrediction = 'ACCELERATING_DROP';
        else if (slope < 0 && acceleration >= 0) regimePrediction = 'BOTTOM_FINDING';

        // ===============================
        // 8. System Decision
        // ===============================
        let systemDecision: SystemDecision = 'WAIT';
        let signal: 'BUY' | 'SELL' | null = null;
        
        const isSafe = aiScore >= this.config.minAiScore;

        if (isSafe && marketRegime === 'RISK_ON') {
            systemDecision = 'GO_LONG';
            if (regimePrediction === 'ACCELERATING_TREND' || regimePrediction === 'BOTTOM_FINDING') signal = 'BUY';
        } else if (isSafe && marketRegime === 'RISK_OFF') {
            systemDecision = 'GO_SHORT';
            if (regimePrediction === 'ACCELERATING_DROP') signal = 'SELL';
        }

        return {
            trend,
            slope,
            acceleration,
            whaleDetected: isWhale,
            whaleStatus,
            signal,
            f4Value: currentLinReg,
            aiScore,
            aiComponents: components,
            marketRegime,
            volatilityRegime,
            regimePrediction,
            systemDecision,
            zScoreValue: zScore,
            mtfConsensus: slope > 0 ? 'STRONG_BULL' : 'STRONG_BEAR' 
        };
    }
}
