import { getKlines } from './mexc';
import { calculateRSI, calculateMACD, calculateSMA } from './indicators';

// Simple logger replacement to avoid dependency on winston for now
const logger = {
    error: (msg: string, meta?: any) => console.error(msg, meta),
    info: (msg: string, meta?: any) => console.log(msg, meta),
};

export interface StrategySignal {
    symbol: string;
    strategy: string;
    signal: 'BUY' | 'SELL' | null;
    reason: string;
    indicators: any;
    timestamp: number;
}

export interface StrategyParameters {
    rsiPeriod?: number;
    overboughtLevel?: number;
    oversoldLevel?: number;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    [key: string]: any;
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
            const klines = await getKlines(this.symbol, '1h', limit);
            // Klines format: [openTime, open, high, low, close, volume, closeTime, ...]
            return klines.map(k => parseFloat(k[4])); // Close prices
        } catch (error: any) {
            logger.error(`Failed to get historical data for ${this.symbol}`, { error: error.message });
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
            ...parameters
        });
    }

    async analyze(): Promise<StrategySignal | null> {
        const prices = await this.getHistoricalData(200); // Need enough data for RSI
        const rsiValues = calculateRSI(prices, this.parameters.rsiPeriod || 14);

        if (rsiValues.length === 0) return null;

        const currentRSI = rsiValues[rsiValues.length - 1];
        const previousRSI = rsiValues[rsiValues.length - 2];

        let signal: 'BUY' | 'SELL' | null = null;
        let reason = '';
        const oversold = this.parameters.oversoldLevel!;
        const overbought = this.parameters.overboughtLevel!;

        // Oversold condition: RSI crosses above oversold level
        if (previousRSI <= oversold && currentRSI > oversold) {
            signal = 'BUY';
            reason = `RSI crossed above ${oversold} (${currentRSI.toFixed(2)})`;
        }
        // Overbought condition: RSI crosses below overbought level
        else if (previousRSI >= overbought && currentRSI < overbought) {
            signal = 'SELL';
            reason = `RSI crossed below ${overbought} (${currentRSI.toFixed(2)})`;
        }

        return {
            symbol: this.symbol,
            strategy: 'rsi',
            signal,
            reason,
            indicators: {
                rsi: currentRSI
            },
            timestamp: Date.now()
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
            ...parameters
        });
    }

    async analyze(): Promise<StrategySignal | null> {
        const prices = await this.getHistoricalData(200);
        const macd = calculateMACD(
            prices,
            this.parameters.fastPeriod,
            this.parameters.slowPeriod,
            this.parameters.signalPeriod
        );

        if (macd.histogram.length < 2) return null;

        const currentHistogram = macd.histogram[macd.histogram.length - 1];
        const previousHistogram = macd.histogram[macd.histogram.length - 2];

        let signal: 'BUY' | 'SELL' | null = null;
        let reason = '';

        // Bullish crossover: histogram crosses above zero
        if (previousHistogram <= 0 && currentHistogram > 0) {
            signal = 'BUY';
            reason = `MACD histogram crossed above zero (${currentHistogram.toFixed(6)})`;
        }
        // Bearish crossover: histogram crosses below zero
        else if (previousHistogram >= 0 && currentHistogram < 0) {
            signal = 'SELL';
            reason = `MACD histogram crossed below zero (${currentHistogram.toFixed(6)})`;
        }

        return {
            symbol: this.symbol,
            strategy: 'macd',
            signal,
            reason,
            indicators: {
                macd: {
                    macdLine: macd.macdLine[macd.macdLine.length - 1],
                    signalLine: macd.signalLine[macd.signalLine.length - 1],
                    histogram: currentHistogram
                }
            },
            timestamp: Date.now()
        };
    }
}

// Moving Average Crossover Strategy
class MACrossoverStrategy extends BaseStrategy {
    constructor(symbol: string, parameters: StrategyParameters = {}) {
        super(symbol, {
            fastPeriod: 20,
            slowPeriod: 50,
            ...parameters
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

        let signal: 'BUY' | 'SELL' | null = null;
        let reason = '';

        // Golden cross: fast MA crosses above slow MA
        if (previousFast <= previousSlow && currentFast > currentSlow) {
            signal = 'BUY';
            reason = `Fast MA (${this.parameters.fastPeriod}) crossed above Slow MA (${this.parameters.slowPeriod})`;
        }
        // Death cross: fast MA crosses below slow MA
        else if (previousFast >= previousSlow && currentFast < currentSlow) {
            signal = 'SELL';
            reason = `Fast MA (${this.parameters.fastPeriod}) crossed below Slow MA (${this.parameters.slowPeriod})`;
        }

        return {
            symbol: this.symbol,
            strategy: 'ma_crossover',
            signal,
            reason,
            indicators: {
                fastMA: currentFast,
                slowMA: currentSlow
            },
            timestamp: Date.now()
        };
    }
}

// Strategy Factory
export function createStrategy(type: string, symbol: string, parameters: StrategyParameters = {}): BaseStrategy {
    switch (type) {
        case 'rsi':
            return new RSIStrategy(symbol, parameters);
        case 'macd':
            return new MACDStrategy(symbol, parameters);
        case 'ma_crossover':
            return new MACrossoverStrategy(symbol, parameters);
        default:
            throw new Error(`Unknown strategy type: ${type}`);
    }
}

// Available strategies
export const AVAILABLE_STRATEGIES: Record<string, any> = {
    rsi: {
        name: 'RSI Strategy',
        description: 'Generates signals based on RSI overbought/oversold levels',
        parameters: {
            rsiPeriod: { type: 'number', default: 14, min: 2, max: 50 },
            overboughtLevel: { type: 'number', default: 70, min: 50, max: 90 },
            oversoldLevel: { type: 'number', default: 30, min: 10, max: 50 }
        }
    },
    macd: {
        name: 'MACD Strategy',
        description: 'Generates signals based on MACD histogram crossovers',
        parameters: {
            fastPeriod: { type: 'number', default: 12, min: 5, max: 50 },
            slowPeriod: { type: 'number', default: 26, min: 10, max: 100 },
            signalPeriod: { type: 'number', default: 9, min: 5, max: 50 }
        }
    },
    ma_crossover: {
        name: 'MA Crossover Strategy',
        description: 'Generates signals based on moving average crossovers',
        parameters: {
            fastPeriod: { type: 'number', default: 20, min: 5, max: 100 },
            slowPeriod: { type: 'number', default: 50, min: 10, max: 200 }
        }
    }
};
