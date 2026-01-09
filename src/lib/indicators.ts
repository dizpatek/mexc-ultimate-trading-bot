// Technical Indicators Implementation

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for SMA
 * @returns {number[]} Array of SMA values
 */
export function calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
    }
    return sma;
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for EMA
 * @returns {number[]} Array of EMA values
 */
export function calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // First EMA is SMA
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);

    // Calculate subsequent EMAs
    for (let i = period; i < prices.length; i++) {
        const currentEMA = (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
        ema.push(currentEMA);
    }

    return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for RSI (typically 14)
 * @returns {number[]} Array of RSI values
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsi: number[] = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
        if (i > period) {
            // Smoothed averages
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }

        const rs = avgGain / avgLoss;
        const rsiValue = 100 - (100 / (1 + rs));
        rsi.push(rsiValue);
    }

    return rsi;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices - Array of prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line EMA period (default 9)
 * @returns {object} Object with macdLine, signalLine, and histogram
 */
export function calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    if (fastEMA.length < slowEMA.length) return { macdLine: [], signalLine: [], histogram: [] };

    // MACD Line = Fast EMA - Slow EMA
    const macdLine: number[] = [];
    for (let i = 0; i < slowEMA.length; i++) {
        macdLine.push(fastEMA[i + (fastEMA.length - slowEMA.length)] - slowEMA[i]);
    }

    // Signal Line = EMA of MACD Line
    const signalLine = calculateEMA(macdLine, signalPeriod);

    // Histogram = MACD Line - Signal Line
    const histogram: number[] = [];
    for (let i = 0; i < signalLine.length; i++) {
        histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i]);
    }

    return {
        macdLine: macdLine.slice(-histogram.length),
        signalLine,
        histogram
    };
}

/**
 * Get latest indicator values
 * @param {number[]} prices - Array of prices
 * @returns {object} Latest values of all indicators
 */
export function getLatestIndicators(prices: number[]) {
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const rsi = calculateRSI(prices, 14);
    const macd = calculateMACD(prices);

    return {
        sma20: sma20.length > 0 ? sma20[sma20.length - 1] : null,
        sma50: sma50.length > 0 ? sma50[sma50.length - 1] : null,
        ema12: ema12.length > 0 ? ema12[ema12.length - 1] : null,
        ema26: ema26.length > 0 ? ema26[ema26.length - 1] : null,
        rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
        macd: {
            macdLine: macd.macdLine.length > 0 ? macd.macdLine[macd.macdLine.length - 1] : null,
            signalLine: macd.signalLine.length > 0 ? macd.signalLine[macd.signalLine.length - 1] : null,
            histogram: macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : null
        }
    };
}
