// cspell:ignore XRPUSDT BNBUSDT SOLUSDT ETHUSDT BTCUSDT stablecoins watchlist WATCHLIST
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    RefreshCw, Fish, Binary, ChevronDown, ChevronUp
} from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';
import { normalizeSymbol } from '@/lib/symbol-utils';
import { api, sendTradeSignal } from '@/services/api';

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

interface V5IndicatorState {
    name: string;
    value: string;
    state: string;
    color: 'green' | 'red' | 'gray' | 'orange';
    numericValue?: number;
}

interface ConfluenceBreakdown {
    techScore: number;
    momentumScore: number;
    volumeScore: number;
    trendScore: number;
    marketScore: number;
    timingScore: number;
    totalScore: number;
    status: string;
}

interface PredictionResult {
    upProb: number;
    downProb: number;
    text: string;
    direction: 'UP' | 'DOWN' | 'FLAT';
}

interface ADMResult {
    classification: number;
    evidence: string;
    bias: string;
    direction: number;
}

interface VPAResult {
    buyVolume: number;
    sellVolume: number;
    delta: number;
    netPressure: number;
    state: string;
}

interface OrderBlock {
    barHigh: number;
    barLow: number;
    bias: 'BULLISH' | 'BEARISH';
    mitigated: boolean;
}

interface FairValueGap {
    top: number;
    bottom: number;
    bias: 'BULLISH' | 'BEARISH';
    mitigated: boolean;
}

interface F4Data {
    symbol: string;
    interval: string;
    timestamp: number;
    currentPrice: number;
    
    // Matrix V3 Core
    f4Slope: number;
    f4Acceleration: number;
    f4Value: number;
    f4FiboValue: number;
    whaleDetected: boolean;
    whaleStatus: string;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    signal: 'BUY' | 'SELL' | null;
    
    // AI Score
    aiScore: number;
    aiComponents: AiScoreComponents;
    
    // Market Regime
    marketRegime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    volatilityRegime: string;
    regimePrediction: string;
    systemDecision: 'GO_LONG' | 'GO_SHORT' | 'WAIT';
    zScoreValue: number;
    mtfBullCount: number;
    
    // Early Reversal
    earlyReversal: 'UP' | 'DOWN' | null;
    fastSlope: number;
    fastAcceleration: number;
    
    // SMC Structure
    internalTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    swingTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    
    // Premium/Discount
    trailingTop: number;
    trailingBottom: number;
    inPremium: boolean;
    inDiscount: boolean;
    
    // Vix Fix & QFL
    vixBottom: boolean;
    vixValue: number;
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
    marketFlow: string;
    
    // Capital Engine
    capitalPhase: string;
    signalFreshness: number;
    decayFactor: number;
    timeValid: boolean;
    
    // System Health
    whaleTrust: number;
    consecutiveLosses: number;
    deathRisk: boolean;
    systemRestMode: boolean;
    metaAllow: boolean;
    
    confluenceText: string;
    confluenceColor: string;
    actionRecommendation?: string;

    // V5 New
    confluenceScore: number;
    confluenceBreakdown: ConfluenceBreakdown;
    prediction: PredictionResult;
    v5Indicators: V5IndicatorState[];
    adm: ADMResult;
    vpa: VPAResult;
    momentumState: string;
    momentumColor: string;
    whaleSignalText: string;
    marketPhaseText: string;
    capitalFlowText: string;
    mtfConsensus: string;
    
    // V5.3/V5.4
    f4PowerLoss: number;
    f4EarlyBuy: boolean;
    f4EarlySell: boolean;
    f4ConfirmedBuy: boolean;
    f4ConfirmedSell: boolean;
    liquidityZone: string;
    liquidityBonus: number;
    mtfWeightedScore: number;
    dynamicWeights: { tech: number; momentum: number; market: number; trend: number; };

    error?: string;
}

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

export function F4Monitor() {
    const { data: holdings } = useHoldings();
    const [signals, setSignals] = useState<Record<string, F4Data>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [selectedInterval, setSelectedInterval] = useState('15m');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Combine holdings with watchlist, ensuring unique symbols and filtering out invalids (like USDT)
    const activeSymbols = useMemo(() => {
        const holdingSymbols = holdings
            ?.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC') // Filter out stablecoins
            ?.map(h => normalizeSymbol(h.symbol)) || [];
        
        // If user has no holdings (other than stables), use default watchlist. If they have holdings, merge them.
        if (holdingSymbols.length === 0) return DEFAULT_WATCHLIST;
        return Array.from(new Set([...holdingSymbols, ...DEFAULT_WATCHLIST]));
    }, [holdings]);

    const fetchSymbolSignal = useCallback(async (symbol: string, interval: string) => {
        setLoading(prev => ({ ...prev, [symbol]: true }));
        try {
            const response = await fetch(`/api/indicators/f4?symbol=${symbol}&interval=${interval}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || data.error || 'Fetch failed');
            if (data.error) throw new Error(data.message || data.error);

            setSignals(prev => ({ ...prev, [symbol]: data }));
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`Error fetching F4 for ${symbol}:`, err);
            setSignals(prev => ({
                ...prev,
                [symbol]: {
                    symbol,
                    error: errorMessage,
                    interval,
                    timestamp: Date.now(),
                    currentPrice: 0,
                    f4Slope: 0, f4Acceleration: 0, f4Value: 0, f4FiboValue: 0,
                    whaleDetected: false,
                    whaleStatus: 'NEUTRAL',
                    trend: 'NEUTRAL',
                    signal: null,
                    aiScore: 0,
                    aiComponents: {
                        whaleConfirmed: 0, regimeAlignment: 0, volumePower: 0, trendAlignment: 0,
                        mtfConsensus: 0, momentumAccel: 0, volatilityRegime: 0, zScore: 0,
                        bayesianWinRate: 0, trapPenalty: 0
                    },
                    marketRegime: 'NEUTRAL',
                    volatilityRegime: 'NORMAL',
                    regimePrediction: 'RANGE',
                    systemDecision: 'WAIT',
                    zScoreValue: 0,
                    mtfBullCount: 0,
                    earlyReversal: null,
                    fastSlope: 0,
                    fastAcceleration: 0,
                    internalTrend: 'NEUTRAL',
                    swingTrend: 'NEUTRAL',
                    orderBlocks: [],
                    fairValueGaps: [],
                    trailingTop: 0,
                    trailingBottom: 0,
                    inPremium: false,
                    inDiscount: false,
                    vixBottom: false,
                    vixValue: 0,
                    qflPanicBottom: false,
                    wt1: 0,
                    wt2: 0,
                    wtDivergence: null,
                    btcDominance: 0,
                    btcDomChange: 0,
                    usdtDominance: 0,
                    usdtDomChange: 0,
                    othersDominance: 0,
                    othersDomChange: 0,
                    marketFlow: 'NEUTRAL',
                    capitalPhase: 'NEUTRAL',
                    signalFreshness: 0,
                    decayFactor: 1,
                    timeValid: false,
                    whaleTrust: 0,
                    consecutiveLosses: 0,
                    deathRisk: false,
                    systemRestMode: false,
                    metaAllow: false,
                    confluenceText: 'Error',
                    confluenceColor: '#666666',
                    actionRecommendation: 'WAIT',
                    confluenceScore: 0,
                    confluenceBreakdown: {
                        techScore: 0, momentumScore: 0, volumeScore: 0, trendScore: 0,
                        marketScore: 0, timingScore: 0, totalScore: 0, status: 'YETERSİZ'
                    },
                    prediction: { upProb: 50, downProb: 50, text: 'YATAY', direction: 'FLAT' },
                    v5Indicators: [],
                    adm: { classification: 0, evidence: 'YOK', bias: 'Sapma Yok', direction: 0 },
                    vpa: { buyVolume: 0, sellVolume: 0, delta: 0, netPressure: 0, state: 'NÖTR' },
                    momentumState: 'NÖTR',
                    momentumColor: 'gray',
                    whaleSignalText: '-',
                    marketPhaseText: '-',
                    capitalFlowText: '-',
                    mtfConsensus: '-',
                    f4PowerLoss: 0,
                    f4EarlyBuy: false,
                    f4EarlySell: false,
                    f4ConfirmedBuy: false,
                    f4ConfirmedSell: false,
                    liquidityZone: 'YOK',
                    liquidityBonus: 0,
                    mtfWeightedScore: 0,
                    dynamicWeights: { tech: 0, momentum: 0, market: 0, trend: 0 }
                }
            }));
        } finally {
            setLoading(prev => ({ ...prev, [symbol]: false }));
        }
    }, []);

    useEffect(() => {
        if (activeSymbols.length > 0) {
            activeSymbols.forEach(s => fetchSymbolSignal(s, selectedInterval));
        }
        
        const intervalId = setInterval(() => {
             if (activeSymbols.length > 0) {
                 activeSymbols.forEach(s => fetchSymbolSignal(s, selectedInterval));
             }
        }, 30000); 
        return () => clearInterval(intervalId);
    }, [selectedInterval, fetchSymbolSignal, activeSymbols]);

    const handleRefresh = () => {
        activeSymbols.forEach(s => fetchSymbolSignal(s, selectedInterval));
    };

    const toggleRow = (symbol: string) => {
        setExpandedRow(expandedRow === symbol ? null : symbol);
    };

    const getDecisionStyle = (decision: string) => {
        if (decision === 'GO_LONG') return 'text-green-400 bg-green-900/30 border-green-500/50';
        if (decision === 'GO_SHORT') return 'text-red-400 bg-red-900/30 border-red-500/50';
        return 'text-gray-500 bg-gray-900/30 border-gray-700/50';
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0a0a] border border-[#222] rounded-md overflow-hidden font-mono text-sm relative">
            {/* Header / Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#222]">
                <div className="flex items-center gap-4">
                    <h2 className="text-green-500 font-bold tracking-wider flex items-center gap-2">
                        <Binary className="w-4 h-4" /> MATRIX_V3_TERMINAL
                    </h2>
                    <span className="text-xs text-gray-500">|</span>
                    <span className="text-xs text-gray-400">SCANNING: {selectedInterval.toUpperCase()}</span>
                    <span className="text-xs text-gray-500">|</span>
                    <div className="flex gap-1.5">
                        {['15m','1h','4h'].map(int => (
                            <button 
                                key={int}
                                onClick={() => setSelectedInterval(int)}
                                className={`px-2.5 py-1 text-xs rounded transition-colors ${selectedInterval === int ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                            >
                                {int}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                        LIVE FEED
                    </div>
                    <button onClick={handleRefresh} className="p-1.5 hover:text-white text-gray-500 transition-colors">
                        <RefreshCw className={`w-4 h-4 ${Object.values(loading).some(v => v) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead className="bg-[#151515] text-sm text-gray-500 uppercase tracking-widest text-left">
                        <tr>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Asset</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Price</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">AI Score</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Trend State</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Momentum</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Whale</th>
                            <th className="px-5 py-3 font-black border-r border-[#222]">Signal</th>
                            <th className="px-5 py-3 font-black">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                        {activeSymbols.map(symbol => {
                            const data = signals[symbol];
                            const isLoading = loading[symbol];
                            const isExpanded = expandedRow === symbol;

                            if (!data && isLoading) return (
                                <tr key={symbol} className="animate-pulse">
                                    <td className="px-4 py-3 text-gray-600 font-bold">{symbol.replace('USDT','')}</td>
                                    <td colSpan={7} className="px-4 py-3 text-gray-700">INITIALIZING FEED...</td>
                                </tr>
                            );

                            if (data?.error) return (
                                <tr key={symbol}>
                                    <td className="px-4 py-3 text-red-500 font-bold">{symbol}</td>
                                    <td colSpan={7} className="px-4 py-3 text-red-900">CONNECTION_ERROR: {data.error}</td>
                                </tr>
                            );

                            return (
                                <React.Fragment key={symbol}>
                                    <tr 
                                        onClick={() => toggleRow(symbol)}
                                        className={`hover:bg-[#1a1a1a] cursor-pointer transition-colors ${isExpanded ? 'bg-[#1a1a1a]' : ''}`}
                                    >
                                        {/* 1. ASSET */}
                                        <td className="px-5 py-4 border-r border-[#222] font-black text-gray-200 text-lg">
                                            {symbol.replace('USDT', '')}
                                            <span className="text-xs text-gray-500 block mt-1 font-bold">V5_INTEL</span>
                                        </td>

                                        {/* 2. PRICE */}
                                        <td className="px-5 py-4 border-r border-[#222] text-gray-300 font-mono text-base font-bold">
                                            ${data?.currentPrice?.toLocaleString()}
                                        </td>

                                        {/* 3. CONFLUENCE (AI SCORE V5) */}
                                        <td className="px-5 py-4 border-r border-[#222]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${data?.confluenceScore >= 65 ? 'bg-emerald-500' : data?.confluenceScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                                        style={{ width: `${data?.confluenceScore}%` }}
                                                    />
                                                </div>
                                                <span className={`font-black text-lg ${data?.confluenceScore >= 65 ? 'text-emerald-400' : data?.confluenceScore >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                                    {Math.round(data?.confluenceScore || 0)}%
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-1.5 uppercase font-black tracking-wider">
                                                {data?.confluenceBreakdown?.status || 'YETERSİZ'}
                                            </div>
                                        </td>

                                        {/* 4. PREDICTION */}
                                        <td className="px-5 py-4 border-r border-[#222]">
                                            <div className={`flex items-center gap-2 font-black text-lg ${data?.prediction?.direction === 'UP' ? 'text-emerald-400' : data?.prediction?.direction === 'DOWN' ? 'text-rose-400' : 'text-gray-500'}`}>
                                                {data?.prediction?.text || 'YATAY'}
                                            </div>
                                            <div className="flex gap-2 mt-1.5">
                                                <div className="text-xs text-emerald-500/80 font-bold">%{Math.round(data?.prediction?.upProb)}</div>
                                                <div className="text-xs text-rose-500/80 font-bold">%{Math.round(data?.prediction?.downProb)}</div>
                                            </div>
                                        </td>

                                        {/* 5. V5 INDICATORS SPARK */}
                                        <td className="px-5 py-4 border-r border-[#222]">
                                            <div className="grid grid-cols-4 gap-1">
                                                {data?.v5Indicators?.map((ind, i) => (
                                                    <div key={i} title={`${ind.name}: ${ind.state}`} className={`w-3 h-5 rounded-sm ${ind.color === 'green' ? 'bg-emerald-500' : ind.color === 'red' ? 'bg-rose-500' : ind.color === 'orange' ? 'bg-amber-500' : 'bg-gray-700'}`} />
                                                ))}
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-2 font-black uppercase">{data?.mtfConsensus}</div>
                                        </td>

                                        {/* 6. WHALE STATUS */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            {data?.whaleDetected ? (
                                                <div className="flex flex-col">
                                                    <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-black animate-pulse">
                                                        <Fish className="w-4 h-4" /> WHALE
                                                    </span>
                                                    <span className="text-[10px] text-amber-600/70 truncate w-20 mt-0.5">{data?.whaleSignalText}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-700 text-xs">-</span>
                                            )}
                                        </td>

                                        {/* 7. SIGNAL */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            {data?.signal ? (
                                                <span className={`px-2.5 py-1 rounded text-xs font-black ${data.signal === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                                    {data.signal}
                                                </span>
                                            ) : <span className="text-gray-700">-</span>}
                                        </td>

                                        {/* 8. ACTION */}
                                        <td className="px-5 py-4">
                                            <div className={`px-3 py-2 text-sm font-black border-2 rounded-lg flex items-center justify-between ${getDecisionStyle(data?.systemDecision || 'WAIT')}`}>
                                                <span>{data?.systemDecision?.replace('GO_', '') || 'WAIT'}</span>
                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                            </div>
                                        </td>
                                    </tr>

                                    {/* EXPANDED DETAILS */}
                                    {isExpanded && (
                                        <tr className="bg-[#111] border-b border-[#222]">
                                            <td colSpan={8} className="p-4">
                                                <div className="grid grid-cols-5 gap-4 text-sm">
                                                    <div className="space-y-1.5">
                                                        <div className="text-gray-500 text-xs uppercase tracking-wider">Market Regime</div>
                                                        <div className={`font-bold ${data?.marketRegime === 'RISK_ON' ? 'text-green-500' : 'text-red-500'}`}>
                                                            {data?.marketRegime}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="text-gray-500 text-xs uppercase tracking-wider">Prediction</div>
                                                        <div className="text-blue-400 font-bold">{data?.regimePrediction?.replace(/_/g, ' ')}</div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="text-gray-500 text-xs uppercase tracking-wider">AI Contribution</div>
                                                        <div className="text-gray-400">
                                                            Trend: <span className="text-white">+{data?.aiComponents?.trendAlignment}</span> | 
                                                            Vol: <span className="text-white">+{data?.aiComponents?.volumePower}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="text-gray-500 text-xs uppercase tracking-wider">Risk Analysis</div>
                                                        <div className="text-gray-400">
                                                            Trap: <span className="text-red-400">-{data?.aiComponents?.trapPenalty}</span> |
                                                            Whale: <span className="text-amber-400">+{data?.aiComponents?.whaleConfirmed}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1.5 border-l border-[#222] pl-4">
                                                        <div className="text-gray-500 text-xs uppercase tracking-wider">V5.4 Engine Insights</div>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">F4 Power Loss:</span>
                                                                <span className={(data?.f4PowerLoss ?? 0) > 40 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                                                                    %{(data?.f4PowerLoss ?? 0).toFixed(1)}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">Liquidity:</span>
                                                                <span className={data?.liquidityZone?.includes("BOĞA") ? "text-emerald-400 font-bold" : data?.liquidityZone?.includes("AYI") ? "text-rose-400 font-bold" : "text-gray-500 font-bold"}>
                                                                    {data?.liquidityZone || 'YOK'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-400">Early Warning:</span>
                                                                <span className={(data?.f4EarlyBuy || data?.f4ConfirmedBuy) ? "text-emerald-400 font-bold animate-pulse" : (data?.f4EarlySell || data?.f4ConfirmedSell) ? "text-rose-400 font-bold animate-pulse" : "text-gray-500 font-bold"}>
                                                                    {data?.f4ConfirmedBuy ? "CONFIRMED BUY" : data?.f4EarlyBuy ? "EARLY BUY" : data?.f4ConfirmedSell ? "CONFIRMED SELL" : data?.f4EarlySell ? "EARLY SELL" : "NONE"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-2.5 border-t border-[#222] bg-[#111] flex justify-between items-center text-xs text-gray-600">
                <span>MATRIX ENGINE V5.4.0 // CONNECTED</span>
                <span>© 2026 MEXC ULTIMATE TRADING BOT</span>
            </div>
        </div>
    );
}
