/**
 * F3 Indicator Implementation
 * Converted from Pine Script v4
 * Original author: Tim & eFSo (ig:imfatihsonturk)
 */

interface OHLCData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface F3Result {
    timestamp: number;
    f3: number;
    f3Fibo: number;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    color: 'green' | 'red' | 'yellow';
    fiboColor: 'blue' | 'purple' | 'yellow';
}

/**
 * Calculate EMA (Exponential Moving Average)
 */
function ema(data: number[], period: number): number[] {
    if (data.length === 0) return [];

    const k = 2 / (period + 1);
    const emaValues: number[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
        const emaValue = data[i] * k + emaValues[i - 1] * (1 - k);
        emaValues.push(emaValue);
    }

    return emaValues;
}

/**
 * Calculate typical price: (high + low + 2 * close) / 4
 */
function typicalPrice(ohlc: OHLCData[]): number[] {
    return ohlc.map(candle => (candle.high + candle.low + 2 * candle.close) / 4);
}

/**
 * Calculate F3 indicator value
 * @param ohlc - Array of OHLC data
 * @param length - F3 Length parameter (default: 7)
 * @param volumeFactor - Volume Factor parameter (default: 3.7)
 */
export function calculateF3(
    ohlc: OHLCData[],
    length: number = 7,
    volumeFactor: number = 3.7
): number[] {
    const tp = typicalPrice(ohlc);

    // Calculate 6 levels of EMA
    const e1 = ema(tp, length);
    const e2 = ema(e1, length);
    const e3 = ema(e2, length);
    const e4 = ema(e3, length);
    const e5 = ema(e4, length);
    const e6 = ema(e5, length);

    // Calculate coefficients
    const a = volumeFactor;
    const c1 = -a * a * a;
    const c2 = 3 * a * a + 3 * a * a * a;
    const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
    const c4 = 1 + 3 * a + a * a * a + 3 * a * a;

    // Calculate F3 values
    const f3Values: number[] = [];
    for (let i = 0; i < ohlc.length; i++) {
        const f3 = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
        f3Values.push(f3);
    }

    return f3Values;
}

/**
 * Calculate F3 Fibonacci variant
 * @param ohlc - Array of OHLC data
 * @param length - F3 Length fibo parameter (default: 5)
 * @param volumeFactor - Volume Factor fibo parameter (default: 0.618)
 */
export function calculateF3Fibo(
    ohlc: OHLCData[],
    length: number = 5,
    volumeFactor: number = 0.618
): number[] {
    const tp = typicalPrice(ohlc);

    // Calculate 6 levels of EMA
    const e1 = ema(tp, length);
    const e2 = ema(e1, length);
    const e3 = ema(e2, length);
    const e4 = ema(e3, length);
    const e5 = ema(e4, length);
    const e6 = ema(e5, length);

    // Calculate coefficients
    const a = volumeFactor;
    const c1 = -a * a * a;
    const c2 = 3 * a * a + 3 * a * a * a;
    const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
    const c4 = 1 + 3 * a + a * a * a + 3 * a * a;

    // Calculate F3 Fibo values
    const f3FiboValues: number[] = [];
    for (let i = 0; i < ohlc.length; i++) {
        const f3Fibo = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
        f3FiboValues.push(f3Fibo);
    }

    return f3FiboValues;
}

/**
 * Detect crossover (value crosses above previous value)
 */
function crossover(current: number, previous: number): boolean {
    return current > previous;
}

/**
 * Detect crossunder (value crosses below previous value)
 */
function crossunder(current: number, previous: number): boolean {
    return current < previous;
}

/**
 * Calculate full F3 indicator with signals
 */
export function calculateF3WithSignals(
    ohlc: OHLCData[],
    showF3Fibo: boolean = false
): F3Result[] {
    if (ohlc.length < 50) {
        throw new Error('Insufficient data: need at least 50 candles for accurate F3 calculation');
    }

    const f3Values = calculateF3(ohlc);
    const f3FiboValues = calculateF3Fibo(ohlc);

    const results: F3Result[] = [];

    for (let i = 1; i < ohlc.length; i++) {
        const f3 = f3Values[i];
        const f3Prev = f3Values[i - 1];
        const f3Fibo = f3FiboValues[i];
        const f3FiboPrev = f3FiboValues[i - 1];

        // Determine F3 color
        let color: 'green' | 'red' | 'yellow' = 'yellow';
        if (f3 > f3Prev) {
            color = 'green';
        } else if (f3 < f3Prev) {
            color = 'red';
        }

        // Determine F3 Fibo color
        let fiboColor: 'blue' | 'purple' | 'yellow' = 'yellow';
        if (f3Fibo > f3FiboPrev) {
            fiboColor = 'blue';
        } else if (f3Fibo < f3FiboPrev) {
            fiboColor = 'purple';
        }

        // Determine signal based on F3 Fibo crossover/crossunder
        let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
        if (showF3Fibo) {
            if (crossover(f3Fibo, f3FiboPrev)) {
                signal = 'BUY';  // Blue line active (Mavi çizgi aktif)
            } else if (crossunder(f3Fibo, f3FiboPrev)) {
                signal = 'SELL'; // Purple line active (Mor çizgi aktif)
            }
        }

        results.push({
            timestamp: ohlc[i].timestamp,
            f3,
            f3Fibo,
            signal,
            color,
            fiboColor
        });
    }

    return results;
}

/**
 * Get the latest F3 signal
 */
export function getLatestF3Signal(ohlc: OHLCData[]): {
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    f3: number;
    f3Fibo: number;
    timestamp: number;
} | null {
    if (ohlc.length < 50) return null;

    const results = calculateF3WithSignals(ohlc, true);
    const latest = results[results.length - 1];

    return {
        signal: latest.signal,
        f3: latest.f3,
        f3Fibo: latest.f3Fibo,
        timestamp: latest.timestamp
    };
}
/**
 * Helper function for Alarm Engine to get latest indicators easily
 */
export function F3(ohlc: OHLCData[]) {
    if (!ohlc || ohlc.length < 50) {
        return { f3: 0, f3Fibo: 0, buySignal: false, sellSignal: false };
    }

    const latest = getLatestF3Signal(ohlc);

    if (!latest) {
        return { f3: 0, f3Fibo: 0, buySignal: false, sellSignal: false };
    }

    return {
        f3: latest.f3,
        f3Fibo: latest.f3Fibo,
        buySignal: latest.signal === 'BUY',
        sellSignal: latest.signal === 'SELL'
    };
}
