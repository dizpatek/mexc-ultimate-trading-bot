/**
 * F4 Indicator Algorithm
 * Based on Smart Money Concepts + F4 Strategy
 * Ported from Pine Script to TypeScript
 */

export interface F4CalculationParams {
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
    length1: number;      // F4 Length (default: 7)
    a1: number;           // Volume Factor (default: 3.7)
    length12: number;     // F4 Fibonacci Length (default: 5)
    a12: number;          // Fibonacci Volume Factor (default: 0.618)
    wtLength: number;     // WaveTrend Channel Length (default: 10)
    wtAvgLength: number;  // WaveTrend Average Length (default: 21)
}

export interface F4Result {
    f4: number;
    f4Fibo: number;
    f4Signal: 'BUY' | 'SELL' | 'NEUTRAL';
    smcStructure: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    wt1: number;
    wt2: number;
    wtStatus: string;
    confluenceScore: number;
    actionRecommendation: 'LONG' | 'SHORT' | 'WAIT';
}

function ema(data: number[], period: number): number[] {
    const results: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i];
    }
    results[period - 1] = sum / period;

    // Calculate EMA for rest
    for (let i = period; i < data.length; i++) {
        results[i] = (data[i] - results[i - 1]) * multiplier + results[i - 1];
    }

    return results;
}

function sma(data: number[], period: number): number[] {
    const results: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j];
        }
        results[i] = sum / period;
    }
    return results;
}

export function calculateF4(params: F4CalculationParams): F4Result {
    const { high, low, close, length1, a1, length12, a12, wtLength, wtAvgLength } = params;

    // Calculate HLCC/4
    const hlcc4 = close.map((c, i) => (high[i] + low[i] + 2 * c) / 4);

    // === F4 Main Line Calculation ===
    const e1 = ema(hlcc4, length1);
    const e2 = ema(e1, length1);
    const e3 = ema(e2, length1);
    const e4 = ema(e3, length1);
    const e5 = ema(e4, length1);
    const e6 = ema(e5, length1);

    const c1 = -a1 * a1 * a1;
    const c2 = 3 * a1 * a1 + 3 * a1 * a1 * a1;
    const c3 = -6 * a1 * a1 - 3 * a1 - 3 * a1 * a1 * a1;
    const c4 = 1 + 3 * a1 + a1 * a1 * a1 + 3 * a1 * a1;

    const f4Values = e6.map((_, i) =>
        c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i]
    );

    // === F4 Fibonacci Line Calculation ===
    const e12 = ema(hlcc4, length12);
    const e22 = ema(e12, length12);
    const e32 = ema(e22, length12);
    const e42 = ema(e32, length12);
    const e52 = ema(e42, length12);
    const e62 = ema(e52, length12);

    const c12 = -a12 * a12 * a12;
    const c22 = 3 * a12 * a12 + 3 * a12 * a12 * a12;
    const c32 = -6 * a12 * a12 - 3 * a12 - 3 * a12 * a12 * a12;
    const c42 = 1 + 3 * a12 + a12 * a12 * a12 + 3 * a12 * a12;

    const f4FiboValues = e62.map((_, i) =>
        c12 * e62[i] + c22 * e52[i] + c32 * e42[i] + c42 * e32[i]
    );

    // === WaveTrend Calculation ===
    const ap = close.map((c, i) => (high[i] + low[i] + c) / 3);
    const esa = ema(ap, wtLength);

    // Calculate d (EMA of absolute deviation)
    const deviation = ap.map((val, i) => Math.abs(val - esa[i]));
    const d = ema(deviation, wtLength);

    // Calculate ci (Commodity Index)
    const ci = ap.map((val, i) => (val - esa[i]) / (0.015 * d[i]));

    const wt1Values = ema(ci, wtAvgLength);
    const wt2Values = sma(wt1Values, 4);

    // Get latest values
    const latestIdx = f4Values.length - 1;
    const f4 = f4Values[latestIdx] || 0;
    const f4Fibo = f4FiboValues[latestIdx] || 0;
    const f4Prev = f4Values[latestIdx - 1] || 0;
    const f4FiboPrev = f4FiboValues[latestIdx - 1] || 0;
    const wt1 = wt1Values[latestIdx] || 0;
    const wt2 = wt2Values[latestIdx] || 0;

    // === Signal Generation ===
    let f4Signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    if (f4Fibo > f4FiboPrev) {
        f4Signal = 'BUY';
    } else if (f4Fibo < f4FiboPrev) {
        f4Signal = 'SELL';
    }

    // === SMC Structure (simplified) ===
    let smcStructure: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (f4 > f4Prev) {
        smcStructure = 'BULLISH';
    } else if (f4 < f4Prev) {
        smcStructure = 'BEARISH';
    }

    // === WaveTrend Status ===
    const obLevel = 60;
    const osLevel = -60;
    let wtStatus = 'NEUTRAL';
    if (wt1 > obLevel) {
        wtStatus = 'OVERBOUGHT';
    } else if (wt1 < osLevel) {
        wtStatus = 'OVERSOLD';
    } else if (wt1 > wt2) {
        wtStatus = 'BULLISH_ZONE';
    } else {
        wtStatus = 'BEARISH_ZONE';
    }

    // === Confluence Score (0-100) ===
    let confluenceScore = 0;
    if (smcStructure === 'BULLISH' && f4Signal === 'BUY') confluenceScore += 40;
    if (smcStructure === 'BEARISH' && f4Signal === 'SELL') confluenceScore += 40;
    if (wt1 > wt2 && smcStructure === 'BULLISH') confluenceScore += 30;
    if (wt1 < wt2 && smcStructure === 'BEARISH') confluenceScore += 30;
    if (wt1 < osLevel && f4Signal === 'BUY') confluenceScore += 30;
    if (wt1 > obLevel && f4Signal === 'SELL') confluenceScore += 30;

    // === Action Recommendation ===
    let actionRecommendation: 'LONG' | 'SHORT' | 'WAIT' = 'WAIT';
    if (smcStructure === 'BULLISH' && f4Signal === 'BUY' && wt1 > wt2) {
        actionRecommendation = 'LONG';
    } else if (smcStructure === 'BEARISH' && f4Signal === 'SELL' && wt1 < wt2) {
        actionRecommendation = 'SHORT';
    }

    return {
        f4,
        f4Fibo,
        f4Signal,
        smcStructure,
        wt1,
        wt2,
        wtStatus,
        confluenceScore: Math.min(100, confluenceScore),
        actionRecommendation,
    };
}
