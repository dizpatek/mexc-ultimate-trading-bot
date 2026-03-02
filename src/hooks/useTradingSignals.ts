import { useState, useCallback } from 'react';
import { F4Data } from '@/lib/trading-logic';

export const MTF_INTERVALS = ['15m', '1h', '4h', '1d', '1w'];

export function useTradingSignals() {
    const [signalDataMap, setSignalDataMap] = useState<Record<string, F4Data>>({});
    const [mtfData, setMtfData] = useState<Record<number, Record<string, F4Data>>>({});
    const [loadingMtf, setLoadingMtf] = useState<Record<number, boolean>>({});
    const [failedMtf, setFailedMtf] = useState<Record<number, boolean>>({});
    const [liveSignals, setLiveSignals] = useState<Record<string, F4Data>>({});
    const [isLoadingSignals, setIsLoadingSignals] = useState(false);

    /**
     * Map API response to F4Data structure consistently
     */
    const mapApiResponse = useCallback((data: any, symbol: string, interval: string): F4Data => {
        return {
            symbol: symbol.replace('USDT', ''),
            interval: interval,
            currentPrice: data.currentPrice,
            f4Slope: data.f4Slope,
            f4Acceleration: data.f4Acceleration,
            whaleDetected: data.whaleDetected ?? false,
            whaleStatus: data.whaleStatus || data.whaleSignalText || '',
            trend: data.trend || 'NEUTRAL',
            signal: data.signal || null,
            aiScore: data.confluenceScore ?? data.aiScore ?? 0,
            confluenceScore: data.confluenceScore,
            prediction: data.prediction,
            v5Indicators: Array.isArray(data.v5Indicators) ? data.v5Indicators : [],
            adm: data.adm,
            vpa: data.vpa,
            marketRegime: data.marketRegime || 'NEUTRAL',
            volatilityRegime: data.volatilityRegime || '',
            regimePrediction: data.prediction?.text || data.regimePrediction || '',
            systemDecision: data.systemDecision || '',
            mtfConsensus: data.mtfConsensus || '',
            zScoreValue: data.zScoreValue || 0,
            deathRisk: data.deathRisk ?? false,
            smc: data.smc,
            liquidity: data.liquidity,
            whaleTrust: data.whaleTrust,
            tfAdaptFactor: data.tfAdaptFactor,
            f4PowerLoss: data.f4PowerLoss,
            liquidityZone: data.liquidityZone,
            f4EarlyBuy: data.f4EarlyBuy ?? false,
            f4EarlySell: data.f4EarlySell ?? false,
            f4ConfirmedBuy: data.f4ConfirmedBuy ?? false,
            f4ConfirmedSell: data.f4ConfirmedSell ?? false
        };
    }, []);

    /**
     * Single signal fetcher
     */
    const fetchSignal = useCallback(async (symbol: string, interval: string): Promise<F4Data | null> => {
        try {
            const sym = symbol.replace('/', '');
            const res = await fetch(`/api/indicators/f4?symbol=${sym}&interval=${interval}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (data.error) return null;
            return mapApiResponse(data, sym, interval);
        } catch (error) {
            console.error(`Failed to fetch F4 data for ${symbol}/${interval}`, error);
            return null;
        }
    }, [mapApiResponse]);

    /**
     * Fetch Multi-Timeframe Analysis for a trade row
     */
    const fetchMtfAnalysis = useCallback(async (tradeId: number, symbol: string) => {
        setLoadingMtf(prev => ({ ...prev, [tradeId]: true }));
        try {
            const rawResults = await Promise.all(
                MTF_INTERVALS.map(async (tf) => {
                    const d = await fetchSignal(symbol, tf);
                    return { tf, d };
                })
            );
            const map: Record<string, F4Data> = {};
            let hasData = false;
            rawResults.forEach(({ tf, d }) => { 
                if (d) {
                    map[tf] = d; 
                    hasData = true;
                }
            });
            if (hasData) {
                setMtfData(prev => ({ ...prev, [tradeId]: map }));
                setFailedMtf(prev => ({ ...prev, [tradeId]: false }));
            } else {
                setFailedMtf(prev => ({ ...prev, [tradeId]: true }));
            }
        } finally {
            setLoadingMtf(prev => ({ ...prev, [tradeId]: false }));
        }
    }, [fetchSignal]);

    /**
     * Fetch MTF Analysis for multiple trades sequentially to prevent fan-out
     */
    const fetchMultipleMtfAnalysis = useCallback(async (trades: {id: number, symbol: string}[]) => {
        if (!trades.length) return;
        
        // Mark all as loading
        setLoadingMtf(prev => {
            const next = { ...prev };
            trades.forEach(t => next[t.id] = true);
            return next;
        });

        const updates: Record<number, Record<string, F4Data>> = {};
        const newFailures: Record<number, boolean> = {};

        try {
            // Process sequentially to avoid rate limits
            for (const trade of trades) {
                const rawResults = await Promise.all(
                    MTF_INTERVALS.map(async (tf) => {
                        const d = await fetchSignal(trade.symbol, tf);
                        return { tf, d };
                    })
                );
                
                const map: Record<string, F4Data> = {};
                let hasData = false;
                rawResults.forEach(({ tf, d }) => { 
                    if (d) {
                        map[tf] = d;
                        hasData = true;
                    } 
                });
                if (hasData) {
                    updates[trade.id] = map;
                    newFailures[trade.id] = false;
                } else {
                    newFailures[trade.id] = true;
                }
            }

            setMtfData(prev => ({ ...prev, ...updates }));
            setFailedMtf(prev => ({ ...prev, ...newFailures }));
        } finally {
            // Mark all as explicitly loaded
            setLoadingMtf(prev => {
                const next = { ...prev };
                trades.forEach(t => next[t.id] = false);
                return next;
            });
        }
    }, [fetchSignal]);

    /**
     * Weekly/Daily/Hourly live signals for active trades
     */
    const fetchLiveSignals = useCallback(async (symbols: string[], interval: string = '4h') => {
        if (!symbols.length) return;
        
        const results = await Promise.all(symbols.map(async (sym) => {
            const d = await fetchSignal(sym, interval);
            return { sym, d };
        }));
        
        setLiveSignals(prev => {
            const next = { ...prev };
            results.forEach(({ sym, d }) => {
                if (d) next[sym] = d;
            });
            return next;
        });
    }, [fetchSignal]);

    /**
     * Fetch signals for all symbols at a specific interval (Portfolio View)
     */
    const fetchIntervalForSymbols = useCallback(async (symbols: string[], interval: string) => {
        if (!symbols.length) return;
        setIsLoadingSignals(true);
        try {
            const results = await Promise.all(symbols.map(async (symbol) => {
                const d = await fetchSignal(symbol, interval);
                return { symbol, d };
            }));
            const newSignals: Record<string, F4Data> = {};
            results.forEach((res) => {
                if (res.d) newSignals[res.symbol] = res.d;
            });
            setSignalDataMap(prev => ({ ...prev, ...newSignals }));
        } finally {
            setIsLoadingSignals(false);
        }
    }, [fetchSignal]);

    return {
        signalDataMap,
        mtfData,
        loadingMtf,
        failedMtf,
        liveSignals,
        isLoadingSignals,
        fetchMtfAnalysis,
        fetchMultipleMtfAnalysis,
        fetchLiveSignals,
        fetchIntervalForSymbols
    };
}

