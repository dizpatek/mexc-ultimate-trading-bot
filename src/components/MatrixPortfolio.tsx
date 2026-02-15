"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Fish, AlertCircle, Activity } from 'lucide-react';
import Image from 'next/image';
import { useHoldings } from '../hooks/usePortfolio';
import { useMexcWebSocket } from '../hooks/useMexcWebSocket';
// import { cn } from '@/lib/utils';

const AssetIcon = ({ symbol }: { symbol: string }) => {
    const [error, setError] = React.useState(false);
    
    if (error) {
        return (
            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                {symbol[0]}
            </div>
        );
    }

    return (
        <Image 
            src={`https://api.iconify.design/cryptocurrency-color:${symbol.toLowerCase()}.svg`}
            width={24}
            height={24}
            alt={symbol}
            className="rounded-full bg-slate-800 p-0.5"
            onError={() => setError(true)}
        />
    );
};

interface AiScoreComponents {
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

interface F4Data {
    symbol: string;
    interval: string;
    currentPrice?: number;
    
    // Matrix V3 Data
    f4Slope: number;
    f4Acceleration: number;
    whaleDetected: boolean;
    whaleStatus: 'RALLY_PREP' | 'DISTRIBUTION' | 'TRAP' | 'BUY_ACTIVE' | 'SELL_ACTIVE' | 'NEUTRAL';
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    signal: 'BUY' | 'SELL' | null;
    
    // Advanced V3
    aiScore: number;
    aiComponents: AiScoreComponents;
    marketRegime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    volatilityRegime: 'SQUEEZE' | 'EXPLOSION' | 'HIGH_VOL' | 'NORMAL';
    regimePrediction: string;
    systemDecision: 'GO_LONG' | 'GO_SHORT' | 'WAIT';
    mtfConsensus: 'STRONG_BULL' | 'STRONG_BEAR' | 'MIXED';
    zScoreValue: number;
    
    error?: string;
}

export function MatrixPortfolio() {
    // 1. Portfolio Data
    const { data: holdings, isLoading: isHoldingsLoading } = useHoldings();
    
    // 2. Real-time Price Data (WebSocket)
    const activeSymbols = useMemo(() => {
        return holdings
            ?.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC')
            ?.map(h => `${h.symbol}USDT`) || [];
    }, [holdings]);
    
    const activeSymbolsString = useMemo(() => [...activeSymbols].sort().join(','), [activeSymbols]);

    const { tickerData, isConnected } = useMexcWebSocket(activeSymbols);

    // 3. AI Signal Data
    const [signalDataMap, setSignalDataMap] = useState<Record<string, F4Data>>({});
    const [isLoadingSignals, setIsLoadingSignals] = useState(true);
    const [errorSignals, setErrorSignals] = useState<string | null>(null);

    // Fetch AI signals
    useEffect(() => {
        let isMounted = true;
        
        async function loadSignals() {
             if (!activeSymbols || activeSymbols.length === 0) {
                if (isMounted) {
                    setSignalDataMap({});
                    setIsLoadingSignals(false);
                }
                return;
            }

            if (isMounted) {
                setIsLoadingSignals(true);
                setErrorSignals(null);
            }

            try {
                // Fetch each symbol in parallel
                const results = await Promise.all(activeSymbols.map(async (symbol) => {
                    try {
                        const response = await fetch(`/api/indicators/f4?symbol=${symbol}&interval=4h`);
                        if (!response.ok) return null;
                        const data = await response.json();
                        if (data.error) return null;
                        return { symbol, data };
                    } catch (error) {
                        console.error(`Failed to fetch F4 data for ${symbol}`, error);
                        return null;
                    }
                }));

                const newSignals: Record<string, F4Data> = {};
                
                results.forEach((res) => {
                    if (res && res.data) {
                        // Map API response to F4Data
                        const d = res.data;
                         newSignals[res.symbol] = {
                            symbol: res.symbol.replace('USDT', ''),
                            interval: '4h',
                            currentPrice: d.currentPrice,
                            f4Slope: d.f4Slope,
                            f4Acceleration: d.f4Acceleration,
                            whaleDetected: d.whaleDetected,
                            whaleStatus: d.whaleStatus,
                            trend: d.trend,
                            signal: d.f4Signal, // or d.signal
                            aiScore: d.aiScore,
                            aiComponents: d.aiComponents,
                            marketRegime: d.marketRegime,
                            volatilityRegime: d.volatilityRegime,
                            regimePrediction: d.regimePrediction,
                            systemDecision: d.systemDecision,
                            mtfConsensus: d.mtfConsensus,
                            zScoreValue: d.zScoreValue
                        };
                    }
                });

                if (isMounted) {
                    setSignalDataMap(prev => ({ ...prev, ...newSignals }));
                    setIsLoadingSignals(false);
                }
            } catch (err: unknown) {
                if (isMounted) {
                     const message = err instanceof Error ? err.message : String(err);
                     console.error('Master F4 fetch error', err);
                     setErrorSignals(message || "Failed to sync Matrix data");
                     setIsLoadingSignals(false);
                }
            }
        }

        loadSignals();

        return () => { isMounted = false; };
    }, [activeSymbolsString, activeSymbols]);

    const getScoreColor = useCallback((score: number) => {
        if (score >= 70) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-rose-500';
    }, []);

    const getDecisionStyle = useCallback((decision: 'GO_LONG' | 'GO_SHORT' | 'WAIT') => {
        switch (decision) {
            case 'GO_LONG': return 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
            case 'GO_SHORT': return 'bg-rose-900/40 text-rose-400 border-rose-700/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
            case 'WAIT': return 'bg-slate-800/40 text-slate-400 border-slate-700/50';
            default: return 'bg-slate-800/40 text-slate-400 border-slate-700/50';
        }
    }, []);

    const getPredictionLabel = useCallback((pred: string) => {
        const map: Record<string, string> = {
            'RALLY_PREP': 'RALLİ HAZIRLIĞI 🚀',
            'DISTRIBUTION': 'DAĞITIM ⚠️',
            'TRAP': 'TUZAK ! 💀',
            'BUY_ACTIVE': 'ALICI BASKIN 🟢',
            'SELL_ACTIVE': 'SATICI BASKIN 🔴',
            'NEUTRAL': 'NÖTR ⚪',
            // Future Predictions
            'STOPPING_VOLUME': 'DURDURMA HACMİ 🛑',
            'PRE_EXPLOSION': 'PATLAMA ÖNCESİ 💣',
            'ACCELERATING_TREND': 'HIZLANAN TREND 🚀',
            'DECELERATING_TREND': 'GÜÇ KAYBI ⚠️',
            'ACCELERATING_DROP': 'HIZLI DÜŞÜŞ 🩸',
            'BOTTOM_FINDING': 'DİP ARAYIŞI 🎣',
            'RANGE': 'YATAY ↔️'
        };
        return map[pred] || pred?.replace(/_/g, ' ') || '-';
    }, []);

    if (isHoldingsLoading) {
         return (
             <div className="bg-transparent text-slate-200 rounded-lg h-48 flex items-center justify-center">
                 <RefreshCw className="w-6 h-6 animate-spin text-cyan-500 mr-2" />
                  <span className="text-slate-400 font-mono text-xs">MATRIX V3 ENGINE BAŞLATILIYOR...</span>
              </div>
          );
    }

    return (
        <div className="bg-transparent text-slate-200 rounded-lg h-full flex flex-col font-sans">
            <div className="flex justify-between items-center p-3 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md">
                <div className="flex items-center text-[10px] gap-3">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/50 border border-slate-700 ${isConnected ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="font-bold tracking-wide">{isConnected ? 'SOCKET: ONLINE' : 'SOCKET: OFFLINE'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isLoadingSignals && (
                        <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>SYNCING...</span>
                        </div>
                    )}
                    <div className="text-[10px] font-bold text-slate-500 tracking-widest px-2 py-1 bg-slate-950 rounded border border-slate-800">
                        MATRIX F4 ULTIMATE V3.0
                    </div>
                </div>
            </div>
            
            {errorSignals && (
                <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 text-[10px] text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    <span>VERİ HATASI: {errorSignals}</span>
                </div>
            )}

            <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="min-w-full divide-y divide-slate-800/40">
                    <thead className="bg-slate-900/60 backdrop-blur-md sticky top-0 z-10 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">VARLIK</th>
                            <th className="px-3 py-3 text-right border-r border-slate-800/40">PORTFÖY</th>
                            <th className="px-3 py-3 text-right border-r border-slate-800/40">GÜNLÜK %</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40 w-[140px]">AI SKOR & GÜÇ</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">PİYASA REJİMİ</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">BALİNA & VOLATİLİTE</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">TAHMİN</th>
                            <th className="px-3 py-3 text-center">KARAR</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {activeSymbols.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <Wallet className="w-10 h-10 opacity-10" />
                                        <span className="text-xs">Takip edilecek varlık bulunamadı.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            holdings?.map((holding) => {
                                const assetName = holding.symbol;
                                const fullSymbol = `${assetName}USDT`;
                                const signalData = signalDataMap[fullSymbol];
                                const ticker = tickerData[fullSymbol];
                                const currentPrice = ticker ? parseFloat(ticker.p) : (signalData?.currentPrice || 0);
                                const holdingValue = holding.holding * currentPrice;

                                return (
                                    <tr 
                                        key={fullSymbol}
                                        className="hover:bg-cyan-950/20 transition-all duration-200 group relative"
                                    >
                                        {/* 1. ASSET */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex items-center gap-2.5">
                                                <AssetIcon symbol={assetName} />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-200 text-xs">{assetName}</span>
                                                    <span className="text-[9px] text-slate-500 font-mono">
                                                        ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { 
                                                            minimumFractionDigits: currentPrice < 1 ? 4 : 2,
                                                            maximumFractionDigits: currentPrice < 1 ? 4 : 2
                                                        }) : '---'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. HOLDINGS */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 font-mono text-xs">{holding.holding.toFixed(4)}</span>
                                                <span className="text-[9px] text-slate-500 font-mono">${holdingValue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                            </div>
                                        </td>

                                        {/* 3. DAILY PERFORMANCE */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                                            <div className="flex justify-end">
                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/50 border ${holding.change24h >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                                                    {holding.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                                    <span className="font-mono text-xs font-black">
                                                        {holding.change24h >= 0 ? '+' : ''}{holding.change24h.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 4. AI SCORE */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                             <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold text-slate-500">AI CONFIDENCE</span>
                                                    <span className={`font-mono text-[10px] font-bold ${getScoreColor(signalData?.aiScore || 0)}`}>
                                                        {signalData?.aiScore || 0}/100
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-500 ${getScoreColor(signalData?.aiScore || 0).replace('text-','bg-')}`} 
                                                        style={{ width: `${signalData?.aiScore || 0}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-1">
                                                    {signalData?.mtfConsensus === 'STRONG_BULL' && <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 rounded border border-emerald-500/20">MTF++</span>}
                                                    {signalData?.mtfConsensus === 'STRONG_BEAR' && <span className="text-[8px] bg-rose-500/10 text-rose-400 px-1 rounded border border-rose-500/20">MTF--</span>}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 5. MARKET REGIME & TREND */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex flex-col gap-1">
                                                <div className={`flex items-center gap-1.5 ${signalData?.marketRegime === 'RISK_ON' ? 'text-emerald-400' : signalData?.marketRegime === 'RISK_OFF' ? 'text-rose-400' : 'text-slate-400'}`}>
                                                    {signalData?.marketRegime === 'RISK_ON' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    <span className="text-[10px] font-bold">{signalData?.marketRegime?.replace('_', ' ') || 'NEUTRAL'}</span>
                                                </div>
                                                <span className={`text-[9px] ${signalData?.trend === 'BULLISH' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    Trend: {signalData?.trend || '---'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 6. WHALE & VOLATILITY */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex flex-col gap-1">
                                                {/* Whale Status */}
                                                <div className="flex items-center gap-1.5">
                                                    <Fish className={`w-3 h-3 ${signalData?.whaleDetected ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                                                    <span className={`text-[9px] font-bold ${signalData?.whaleDetected ? 'text-amber-400' : 'text-slate-500'}`}>
                                                        {signalData?.whaleDetected ? (signalData.whaleStatus || 'WHALE') : 'NO WHALE'}
                                                    </span>
                                                </div>
                                                {/* Volatility */}
                                                <div className="flex items-center gap-1.5">
                                                    <Activity className={`w-3 h-3 ${signalData?.volatilityRegime === 'EXPLOSION' ? 'text-purple-400' : signalData?.volatilityRegime === 'SQUEEZE' ? 'text-orange-400' : 'text-slate-600'}`} />
                                                    <span className="text-[9px] text-slate-400">
                                                        {signalData?.volatilityRegime || 'NORMAL'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7. PREDICTION */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-cyan-300 font-medium truncate max-w-[100px]">
                                                    {getPredictionLabel(signalData?.regimePrediction || '')}
                                                </span>
                                                {(signalData?.aiComponents?.trapPenalty || 0) < 0 && (
                                                    <span className="text-[9px] text-rose-400 flex items-center gap-1 mt-0.5">
                                                        <AlertCircle className="w-2.5 h-2.5" /> TUZAK TESPİTİ
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* 8. DECISION */}
                                        <td className="px-3 py-2.5 text-center">
                                            <div className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md border ${getDecisionStyle(signalData?.systemDecision || 'WAIT')}`}>
                                                <span className="text-[10px] font-black tracking-wider">
                                                    {signalData?.systemDecision === 'GO_LONG' ? 'LONG AÇ' : signalData?.systemDecision === 'GO_SHORT' ? 'SHORT AÇ' : 'BEKLE'}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }))}
                    </tbody>
                </table>
            </div>
            
            <div className="px-4 py-2 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center text-[9px] text-slate-600 font-mono uppercase">
                <span>MATRIX ENGINE V3.1.0 // ONLINE</span>
                <span>SYNC: {new Date().toLocaleTimeString()}</span>
            </div>
        </div>
    );
}
