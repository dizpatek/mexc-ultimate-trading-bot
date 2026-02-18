"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    RefreshCw, TrendingUp, TrendingDown, Wallet, Fish, 
    AlertCircle, Activity, Zap, LineChart, CircleDollarSign, 
    X
} from 'lucide-react';
import { api } from '@/services/api';
import { TradingViewEmbedChart } from './TradingViewEmbedChart';
import { AssetDetailModal } from './AssetDetailModal';
import { useHoldings } from '../hooks/usePortfolio';
import { useMexcWebSocket } from '../hooks/useMexcWebSocket';
import { cn } from '@/lib/utils';
import { AssetIcon } from './AssetIcon';


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
    
    // 3. Interval Selection
    const [interval, setIntervalState] = useState('4h');
    const intervals = [
        { id: '1h', label: '1S' },
        { id: '4h', label: '4S' },
        { id: '1d', label: 'GÜN' },
        { id: '1w', label: 'HAF' },
        { id: '1M', label: 'AY' }
    ];

    // 4. AI Signal Data
    const [signalDataMap, setSignalDataMap] = useState<Record<string, F4Data>>({});
    const [isLoadingSignals, setIsLoadingSignals] = useState(true);
    const [errorSignals, setErrorSignals] = useState<string | null>(null);
    const [tradeAmounts, setTradeAmounts] = useState<Record<string, string>>({});
    const [isTrading, setIsTrading] = useState<Record<string, boolean>>({});
    const [tradeStatus, setTradeStatus] = useState<Record<string, { type: 'success' | 'error', msg: string } | null>>({});
    const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(null);
    const [viewDetailAsset, setViewDetailAsset] = useState<{ symbol: string; price: number; score: number; decision: string; prediction: string; trap: boolean } | null>(null);

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
                        const response = await fetch(`/api/indicators/f4?symbol=${symbol}&interval=${interval}`);
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
                            interval: interval,
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
    }, [activeSymbolsString, activeSymbols, interval]);

    const setTradeAmountToMax = useCallback((symbol: string, side: 'BUY' | 'SELL') => {
        if (!holdings) return;
        
        if (side === 'BUY') {
            const usdt = holdings.find(h => h.symbol === 'USDT' || h.symbol === 'USDC');
            if (usdt) {
                // Formatting to 2 decimals for USDT
                setTradeAmounts(prev => ({ ...prev, [symbol]: usdt.holding.toFixed(2) }));
            }
        } else {
            const assetBase = symbol.replace('USDT', '');
            const asset = holdings.find(h => h.symbol === assetBase);
            if (asset) {
                // Using 6 decimals for asset quantity
                setTradeAmounts(prev => ({ ...prev, [symbol]: asset.holding.toString() }));
            }
        }
    }, [holdings]);

    const handleQuickTrade = async (symbol: string, side: 'BUY' | 'SELL') => {
        const amount = tradeAmounts[symbol] || '10'; // Default to 10 if empty
        setIsTrading(prev => ({ ...prev, [symbol]: true }));
        setTradeStatus(prev => ({ ...prev, [symbol]: null }));

        try {
            const response = await api.post('/trade/execute', { 
                symbol, 
                side, 
                usdtAmount: amount 
            });
            
            if (response.status === 200 && response.data.success) {
                setTradeStatus(prev => ({ ...prev, [symbol]: { type: 'success', msg: 'Tamam!' } }));
                setTimeout(() => setTradeStatus(prev => ({ ...prev, [symbol]: null })), 3000);
            } else {
                const errorMsg = response.data.error || 'İşlem Başarısız';
                setTradeStatus(prev => ({ ...prev, [symbol]: { type: 'error', msg: errorMsg } }));
                setTimeout(() => setTradeStatus(prev => ({ ...prev, [symbol]: null })), 5000);
            }
        } catch (error: unknown) {
            console.error('Trade execution error', error);
            const errorMsg = error instanceof Error ? error.message : 'Hata Oluştu';
            setTradeStatus(prev => ({ ...prev, [symbol]: { type: 'error', msg: errorMsg } }));
            setTimeout(() => setTradeStatus(prev => ({ ...prev, [symbol]: null })), 5000);
        } finally {
            setIsTrading(prev => ({ ...prev, [symbol]: false }));
        }
    };

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

    const getPredictionColor = useCallback((pred: string) => {
        const positive = ['RALLY_PREP', 'BUY_ACTIVE', 'PRE_EXPLOSION', 'ACCELERATING_TREND', 'BOTTOM_FINDING'];
        const negative = ['DISTRIBUTION', 'TRAP', 'SELL_ACTIVE', 'ACCELERATING_DROP', 'DECELERATING_TREND'];
        
        if (positive.includes(pred)) return 'text-emerald-400';
        if (negative.includes(pred)) return 'text-rose-400';
        return 'text-cyan-300';
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
                        {isLoadingSignals && (
                            <div className="ml-2 flex items-center gap-1 border-l border-slate-700 pl-2 text-cyan-400">
                                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                <span className="animate-pulse text-[9px]">SYNC</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/50 shadow-inner">
                        {intervals.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setIntervalState(item.id)}
                                className={cn(
                                    "px-2.5 py-0.5 text-[9px] font-bold rounded transition-all duration-200",
                                    interval === item.id 
                                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.1)]" 
                                        : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
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
                            <th className="px-3 py-3 text-right border-r border-slate-800/40">FİYAT / DEĞİŞİM</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40 w-[140px]">AI SKOR & GÜÇ</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">PİYASA REJİMİ</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">BALİNA & VOLATİLİTE</th>
                            <th className="px-3 py-3 text-left border-r border-slate-800/40">TAHMİN</th>
                            <th className="px-3 py-3 text-center border-r border-slate-800/40 text-[10px]">KARAR</th>
                            <th className="px-3 py-3 text-center border-slate-800/40">HIZLI İŞLEM (USDT)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {activeSymbols.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
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
                                        className="hover:bg-cyan-950/20 transition-all duration-200 group relative cursor-pointer"
                                        onClick={() => setViewDetailAsset({
                                            symbol: assetName,
                                            price: currentPrice,
                                            score: signalData?.aiScore || 0,
                                            decision: signalData?.systemDecision || 'WAIT',
                                            prediction: signalData?.regimePrediction || 'NEUTRAL',
                                            trap: signalData?.whaleStatus === 'TRAP'
                                        })}
                                    >
                                        {/* 1. ASSET */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex items-center justify-between group/cell">
                                                <div className="flex items-center gap-2.5">
                                                    <AssetIcon symbol={assetName} />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-200 text-xs">{assetName}</span>
                                                        <span className="text-[9px] text-slate-500 font-mono">USDT</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(`https://www.mexc.com/exchange/${assetName}_USDT`, '_blank');
                                                    }}
                                                    className="p-1.5 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all opacity-100 shadow-sm hover:shadow-cyan-500/10"
                                                    title="MEXC'de Aç"
                                                >
                                                    <LineChart className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>

                                        {/* 2. HOLDINGS */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                                            <div className="flex flex-col">
                                                <span className="text-slate-300 font-mono text-xs">{holding.holding.toFixed(4)}</span>
                                                <span className="text-[9px] text-slate-500 font-mono">${holdingValue.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                            </div>
                                        </td>

                                        {/* 3. PRICE & DAILY PERFORMANCE (COMBINED) */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30 text-right">
                                            <div className="flex flex-col gap-1.5 items-end">
                                                <span className="font-mono text-xs text-slate-300">
                                                    ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { 
                                                        minimumFractionDigits: currentPrice < 1 ? 4 : 2,
                                                        maximumFractionDigits: currentPrice < 1 ? 6 : 2
                                                    }) : '---'}
                                                </span>
                                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950/50 border ${holding.change24h >= 0 ? 'text-emerald-400 border-emerald-500/20' : 'text-rose-400 border-rose-500/20'}`}>
                                                    {holding.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                    <span className="font-mono text-[10px] font-black">
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
                                                    <Fish className={`w-3 h-3 ${
                                                        signalData?.whaleDetected && (signalData.whaleStatus === 'BUY_ACTIVE' || signalData.whaleStatus === 'RALLY_PREP') ? 'text-emerald-400 animate-pulse' : 
                                                        signalData?.whaleDetected && (signalData.whaleStatus === 'SELL_ACTIVE' || signalData.whaleStatus === 'DISTRIBUTION' || signalData.whaleStatus === 'TRAP') ? 'text-rose-400 animate-pulse' : 
                                                        signalData?.whaleDetected ? 'text-amber-400 animate-pulse' : 'text-slate-700'
                                                    }`} />
                                                    <span className={`text-[9px] font-bold ${
                                                        signalData?.whaleStatus === 'BUY_ACTIVE' || signalData?.whaleStatus === 'RALLY_PREP' ? 'text-emerald-400' : 
                                                        signalData?.whaleStatus === 'SELL_ACTIVE' || signalData?.whaleStatus === 'DISTRIBUTION' || signalData?.whaleStatus === 'TRAP' ? 'text-rose-400' : 
                                                        signalData?.whaleDetected ? 'text-amber-400' : 'text-slate-600'
                                                    }`}>
                                                        {signalData?.whaleDetected ? (signalData.whaleStatus || 'WHALE') : 'NO WHALE'}
                                                    </span>
                                                </div>
                                                {/* Volatility */}
                                                <div className="flex items-center gap-1.5">
                                                    <Activity className={`w-3 h-3 ${
                                                        signalData?.volatilityRegime === 'EXPLOSION' ? 'text-purple-400 animate-bounce' : 
                                                        signalData?.volatilityRegime === 'HIGH_VOL' ? 'text-amber-500' :
                                                        signalData?.volatilityRegime === 'SQUEEZE' ? 'text-orange-400' : 'text-slate-600'
                                                    }`} />
                                                    <span className={`text-[9px] font-bold ${
                                                        signalData?.volatilityRegime === 'EXPLOSION' ? 'text-purple-400' : 
                                                        signalData?.volatilityRegime === 'HIGH_VOL' ? 'text-amber-500' :
                                                        signalData?.volatilityRegime === 'SQUEEZE' ? 'text-orange-400' : 'text-slate-500'
                                                    }`}>
                                                        {signalData?.volatilityRegime || 'NORMAL'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 7. PREDICTION */}
                                        <td className="px-3 py-2.5 border-r border-slate-800/30">
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-bold truncate max-w-[100px] ${getPredictionColor(signalData?.regimePrediction || '')}`}>
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
                                        <td className="px-3 py-2.5 text-center border-r border-slate-800/30">
                                            <div className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-md border ${getDecisionStyle(signalData?.systemDecision || 'WAIT')}`}>
                                                <span className="text-[10px] font-black tracking-wider">
                                                    {signalData?.systemDecision === 'GO_LONG' ? 'LONG AÇ' : signalData?.systemDecision === 'GO_SHORT' ? 'SHORT AÇ' : 'BEKLE'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 9. QUICK TRADE */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2 justify-center">
                                                <div className="relative group">
                                                    <CircleDollarSign className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 group-focus-within:text-cyan-400" />
                                                    <input 
                                                        type="number"
                                                        value={tradeAmounts[fullSymbol] ?? ''}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            setTradeAmounts(prev => ({ ...prev, [fullSymbol]: e.target.value }));
                                                        }}
                                                        className="w-20 bg-slate-950/80 border border-slate-800 rounded px-1.5 py-1 text-[10px] pl-5 font-bold focus:outline-none focus:border-cyan-500/50 transition-colors"
                                                        placeholder="50"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickTrade(fullSymbol, 'BUY');
                                                        }}
                                                        disabled={isTrading[fullSymbol]}
                                                        className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-black transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        {isTrading[fullSymbol] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5 fill-emerald-500/20" />}
                                                        AL
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTradeAmountToMax(fullSymbol, 'BUY');
                                                        }}
                                                        className="px-1 text-[7px] text-emerald-500/60 hover:text-emerald-400 font-bold uppercase transition-colors"
                                                    >
                                                        MAX USDT
                                                    </button>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleQuickTrade(fullSymbol, 'SELL');
                                                        }}
                                                        disabled={isTrading[fullSymbol]}
                                                        className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded text-[9px] font-black transition-all active:scale-95 disabled:opacity-50"
                                                    >
                                                        {isTrading[fullSymbol] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                                        SAT
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTradeAmountToMax(fullSymbol, 'SELL');
                                                        }}
                                                        className="px-1 text-[7px] text-rose-500/60 hover:text-rose-400 font-bold uppercase transition-colors"
                                                    >
                                                        MAX ASSET
                                                    </button>
                                                </div>
                                                {tradeStatus[fullSymbol] && (
                                                    <div className={`text-[8px] font-bold animate-in fade-in slide-in-from-right-2 duration-300 ${tradeStatus[fullSymbol]?.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {tradeStatus[fullSymbol]?.msg}
                                                    </div>
                                                )}
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

            {/* CHART MODAL */}
            {selectedChartSymbol && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#131722] w-full max-w-6xl h-[80vh] rounded-xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-[#1e222d]">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-lg text-slate-200">{selectedChartSymbol} / USDT</span>
                                <span className="text-xs px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 font-mono">MATRIX CHART</span>
                            </div>
                            <button 
                                onClick={() => setSelectedChartSymbol(null)}
                                className="p-1.5 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 relative">
                            <TradingViewEmbedChart 
                                symbol={selectedChartSymbol} 
                                theme="dark" 
                                height={window.innerHeight * 0.75} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ASSET DETAIL MODAL */}
            {viewDetailAsset && (
                <AssetDetailModal 
                    isOpen={!!viewDetailAsset}
                    onClose={() => setViewDetailAsset(null)}
                    symbol={viewDetailAsset.symbol}
                    currentPrice={viewDetailAsset.price}
                    f4Score={viewDetailAsset.score}
                    f4Decision={viewDetailAsset.decision}
                    f4Prediction={viewDetailAsset.prediction}
                    trapWarning={viewDetailAsset.trap}
                />
            )}
        </div>
    );
}
