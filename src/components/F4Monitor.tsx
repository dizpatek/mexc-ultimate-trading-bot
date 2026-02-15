import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, RefreshCw, AlertCircle, Fish, Gauge, Binary, Brain, Shield, Rocket, List, ChevronDown, ChevronUp } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';

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
    timestamp: number;
    currentPrice: number;
    
    // Matrix V3 Fields
    f4Slope: number;
    f4Acceleration: number;
    whaleDetected: boolean;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    signal: 'BUY' | 'SELL' | null;
    
    // V3 Advanced
    aiScore: number;
    aiComponents: AiScoreComponents;
    marketRegime: 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
    regimePrediction: string;
    systemDecision: 'GO_LONG' | 'GO_SHORT' | 'WAIT';
    
    actionRecommendation: 'LONG' | 'SHORT' | 'WAIT';
    error?: string;
}

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

export function F4Monitor() {
    const { data: holdings, isLoading: isHoldingsLoading } = useHoldings();
    const [signals, setSignals] = useState<Record<string, F4Data>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [selectedInterval, setSelectedInterval] = useState('15m');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Combine holdings with watchlist, ensuring unique symbols and filtering out invalids (like USDT)
    const activeSymbols = useMemo(() => {
        const holdingSymbols = holdings
            ?.filter(h => h.symbol !== 'USDT' && h.symbol !== 'USDC') // Filter out stablecoins
            ?.map(h => `${h.symbol}USDT`) || [];
        
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
        } catch (err: any) {
            console.error(`Error fetching F4 for ${symbol}:`, err);
            setSignals(prev => ({
                ...prev,
                [symbol]: {
                    symbol,
                    error: err.message,
                    interval,
                    timestamp: Date.now(),
                    currentPrice: 0,
                    f4Slope: 0, f4Acceleration: 0, whaleDetected: false,
                    trend: 'NEUTRAL', signal: 'NEUTRAL',
                    aiScore: 0,
                    aiComponents: {} as any,
                    marketRegime: 'NEUTRAL',
                    regimePrediction: 'RANGE',
                    systemDecision: 'WAIT',
                    actionRecommendation: 'WAIT'
                } as any
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

    const getScoreColor = (score: number) => {
        if (score >= 65) return 'text-green-500';
        if (score >= 40) return 'text-amber-500';
        return 'text-red-500';
    };

    const getDecisionStyle = (decision: string) => {
        if (decision === 'GO_LONG') return 'text-green-400 bg-green-900/30 border-green-500/50';
        if (decision === 'GO_SHORT') return 'text-red-400 bg-red-900/30 border-red-500/50';
        return 'text-gray-500 bg-gray-900/30 border-gray-700/50';
    };

    return (
        <div className="w-full bg-[#0a0a0a] border border-[#222] rounded-md overflow-hidden font-mono text-sm relative">
            {/* Header / Status Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-b border-[#222]">
                <div className="flex items-center gap-4">
                    <h2 className="text-green-500 font-bold tracking-wider flex items-center gap-2">
                        <Binary className="w-4 h-4" /> MATRIX_V3_TERMINAL
                    </h2>
                    <span className="text-xs text-gray-500">|</span>
                    <span className="text-xs text-gray-400">SCANNING: {selectedInterval.toUpperCase()}</span>
                    <span className="text-xs text-gray-500">|</span>
                    <div className="flex gap-1">
                        {['5m','15m','1h','4h'].map(int => (
                            <button 
                                key={int}
                                onClick={() => setSelectedInterval(int)}
                                className={`px-2 py-0.5 text-[10px] rounded ${selectedInterval === int ? 'bg-green-900/40 text-green-400 border border-green-500/30' : 'text-gray-600 hover:text-gray-300'}`}
                            >
                                {int}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        LIVE FEED
                    </div>
                    <button onClick={handleRefresh} className="p-1 hover:text-white text-gray-500 transition-colors">
                        <RefreshCw className={`w-3 h-3 ${Object.values(loading).some(v => v) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Data Grid */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead className="bg-[#151515] text-[10px] text-gray-500 uppercase tracking-widest text-left">
                        <tr>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Asset</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Price</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">AI Score</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Trend State</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Momentum</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Whale</th>
                            <th className="px-4 py-2 font-normal border-r border-[#222]">Signal</th>
                            <th className="px-4 py-2 font-normal">Action</th>
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
                                <>
                                    <tr 
                                        key={symbol} 
                                        onClick={() => toggleRow(symbol)}
                                        className={`hover:bg-[#1a1a1a] cursor-pointer transition-colors ${isExpanded ? 'bg-[#1a1a1a]' : ''}`}
                                    >
                                        {/* 1. ASSET */}
                                        <td className="px-4 py-3 border-r border-[#222] font-bold text-gray-300">
                                            {symbol.replace('USDT', '')}
                                            <span className="text-[10px] text-gray-600 block">PERP</span>
                                        </td>

                                        {/* 2. PRICE */}
                                        <td className="px-4 py-3 border-r border-[#222] text-gray-400">
                                            ${data?.currentPrice?.toLocaleString()}
                                        </td>

                                        {/* 3. AI SCORE */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${getScoreColor(data?.aiScore || 0).replace('text-','bg-')}`} 
                                                        style={{ width: `${data?.aiScore}%` }}
                                                    />
                                                </div>
                                                <span className={`font-bold ${getScoreColor(data?.aiScore || 0)}`}>
                                                    {data?.aiScore}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 4. TREND STATE */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            <div className={`flex items-center gap-1 ${data?.trend === 'BULLISH' ? 'text-green-500' : data?.trend === 'BEARISH' ? 'text-red-500' : 'text-gray-500'}`}>
                                                {data?.trend === 'BULLISH' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                <span className="text-[11px] font-bold">{data?.trend?.substring(0,4)}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-600">{data?.regimePrediction}</div>
                                        </td>

                                        {/* 5. MOMENTUM */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            <div className="flex flex-col">
                                                <span className={`text-[11px] font-bold ${(data?.f4Acceleration||0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {(data?.f4Acceleration||0) > 0 ? 'ACCEL' : 'DECEL'}
                                                </span>
                                                <span className="text-[10px] text-gray-600">Vel: {data?.f4Slope?.toFixed(4)}</span>
                                            </div>
                                        </td>

                                        {/* 6. WHALE */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            {data?.whaleDetected ? (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-600/50 text-amber-500 text-[10px] font-bold animate-pulse">
                                                    <Fish className="w-3 h-3" /> DETECTED
                                                </span>
                                            ) : (
                                                <span className="text-gray-700 text-[10px]">-</span>
                                            )}
                                        </td>

                                        {/* 7. SIGNAL */}
                                        <td className="px-4 py-3 border-r border-[#222]">
                                            {data?.signal ? (
                                                <span className={`font-bold ${data.signal === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                                                    {data.signal}
                                                </span>
                                            ) : <span className="text-gray-700">-</span>}
                                        </td>

                                        {/* 8. ACTION */}
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-[10px] font-bold border rounded ${getDecisionStyle(data?.systemDecision || 'WAIT')}`}>
                                                {data?.systemDecision?.replace('GO_', '') || 'WAIT'}
                                            </span>
                                            {isExpanded ? <ChevronUp className="w-3 h-3 inline ml-2 text-gray-500" /> : <ChevronDown className="w-3 h-3 inline ml-2 text-gray-500" />}
                                        </td>
                                    </tr>

                                    {/* EXPANDED DETAILS */}
                                    {isExpanded && (
                                        <tr className="bg-[#111] border-b border-[#222]">
                                            <td colSpan={8} className="p-4">
                                                <div className="grid grid-cols-4 gap-4 text-xs">
                                                    <div className="space-y-1">
                                                        <div className="text-gray-500 text-[10px] uppercase">Market Regime</div>
                                                        <div className={`font-bold ${data?.marketRegime === 'RISK_ON' ? 'text-green-500' : 'text-red-500'}`}>
                                                            {data?.marketRegime}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="text-gray-500 text-[10px] uppercase">Prediction</div>
                                                        <div className="text-blue-400 font-bold">{data?.regimePrediction?.replace(/_/g, ' ')}</div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="text-gray-500 text-[10px] uppercase">AI Contribution</div>
                                                        <div className="text-gray-400">
                                                            Trend: <span className="text-white">+{data?.aiComponents?.trendAlignment}</span> | 
                                                            Vol: <span className="text-white">+{data?.aiComponents?.volumePower}</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="text-gray-500 text-[10px] uppercase">Risk Analysis</div>
                                                        <div className="text-gray-400">
                                                            Trap: <span className="text-red-400">-{data?.aiComponents?.trapPenalty}</span> |
                                                            Whale: <span className="text-amber-400">+{data?.aiComponents?.whaleConfirmed}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-4 py-2 border-t border-[#222] bg-[#111] flex justify-between items-center text-[10px] text-gray-600">
                <span>MATRIX ENGINE V3.1.0 // CONNECTED</span>
                <span>© 2026 MEXC ULTIMATE TRADING BOT</span>
            </div>
        </div>
    );
}
