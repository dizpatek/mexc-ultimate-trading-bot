/**
 * Simple Price Prediction Engine
 * Uses Linear Regression to predict trend direction and next price target.
 */

export interface PredictionResult {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number; // 0-100 (based on R-squared)
    forecastTime: number; // Timestamp for prediction
}

// Simple Linear Regression algorithm
function linearRegression(y: number[]) {
    const n = y.length;
    const x = Array.from({ length: n }, (_, i) => i); // [0, 1, 2, ... n-1]

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumXX += x[i] * x[i];
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-Squared (Confidence)
    const yMean = sumY / n;
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
        const yPred = slope * x[i] + intercept;
        ssTot += Math.pow(y[i] - yMean, 2);
        ssRes += Math.pow(y[i] - yPred, 2);
    }

    const rSquared = 1 - (ssRes / ssTot);

    return { slope, intercept, rSquared };
}

export function predictPrice(symbol: string, prices: number[]): PredictionResult {
    const n = prices.length;
    if (n < 10) {
        throw new Error('Insufficient data points for prediction');
    }

    const { slope, intercept, rSquared } = linearRegression(prices);

    // Predict next point (x = n)
    const nextPrice = slope * n + intercept;
    const currentPrice = prices[n - 1];

    // Determine Trend
    let trend: PredictionResult['trend'] = 'FLAT';
    if (slope > 0) trend = 'UP';
    else if (slope < 0) trend = 'DOWN';

    // Confidence Score (R-squared is 0-1, map to 0-100)
    // We adjust it based on data length as well
    const confidence = Math.min(100, Math.max(0, rSquared * 100));

    return {
        symbol,
        currentPrice,
        predictedPrice: nextPrice,
        trend,
        confidence,
        forecastTime: Date.now() + (60 * 60 * 1000) // 1 Hour forecast (assuming hourly candles)
    };
}
