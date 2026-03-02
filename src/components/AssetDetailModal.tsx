"use client";

import { X, Zap, BarChart3, Info, ExternalLink } from 'lucide-react';
import { TradingViewEmbedChart } from './TradingViewEmbedChart';
import { cn } from '@/lib/utils';
import { AssetIcon } from './AssetIcon';

interface AssetDetailModalProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
    currentPrice?: number;
    f4Score?: number;
    f4Decision?: string;
    f4Prediction?: string;
    trapWarning?: boolean;
    
    // Matrix V5 Professional Data
    smc?: {
        swingTrend: string;
        internalTrend: string;
        bos: boolean;
        choch: boolean;
        orderBlocks: Array<{ high: number; low: number; type: string }>;
        fvgs: Array<{ top: number; bottom: number; type: string }>;
    };
    vpa?: { netPressure?: number; state: string; };
    adm?: { bias: string; classification?: number; evidence?: string; };
    liquidity?: { eqHighs: boolean; eqLows: boolean };
    whaleTrust?: number;
    v5Indicators?: Array<{ name: string; value: string; state: string; color: 'green' | 'red' | 'gray' | 'orange'; }>;
}

export const AssetDetailModal = ({ 
    symbol, 
    isOpen, 
    onClose,
    currentPrice,
    f4Score = 0,
    f4Decision = "WAIT",
    f4Prediction = "NEUTRAL",
    trapWarning = false,
    smc,
    vpa,
    adm,
    v5Indicators = []
}: AssetDetailModalProps) => {
    if (!isOpen) return null;

    // The symbol passed might be BTCUSDT or BTC.
    const assetName = symbol.endsWith('USDT') ? symbol.replace('USDT', '') : symbol;

    const getScoreColor = (score: number) => {
        if (score >= 65) return 'text-emerald-400';
        if (score >= 50) return 'text-amber-400';
        return 'text-rose-400';
    };

    const getDecisionStyle = (decision: string) => {
        switch (decision) {
            case 'BUY': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'STRONG BUY': return 'bg-emerald-600/30 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]';
            case 'SELL': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
            case 'STRONG SELL': return 'bg-rose-600/30 text-rose-400 border-rose-500/50 shadow-[0_0_15px_-3px_rgba(244,63,94,0.3)]';
            default: return 'bg-slate-800/50 text-slate-400 border-slate-700';
        }
    };

    // Ensure we have the full USDT pair for TradingView
    const chartSymbol = assetName.endsWith('USDT') ? assetName : `${assetName}USDT`;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <AssetIcon symbol={assetName} />
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-slate-100 uppercase">{assetName} / USDT</h2>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20 font-mono uppercase tracking-wider">Matrix F4 Pro</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-400 font-mono">${currentPrice?.toLocaleString() || '---'}</span>
                                    <span className="text-xs text-muted-foreground">MEXC Spot</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <a 
                            href={`https://www.mexc.com/exchange/${assetName}_USDT`} 
                            target="_blank" 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors border border-slate-700"
                        >
                            <span>MEXC Terminal</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#020617]">

                    {/* Left: TradingView Chart */}
                    <div className="flex-1 relative border-r border-slate-800 h-full overflow-hidden">
                        <TradingViewEmbedChart 
                            symbol={chartSymbol} 
                            theme="dark" 
                            height={window.innerHeight * 0.75} 
                        />
                    </div>

                    {/* Right: Analysis & Stats */}
                    <div className="w-full lg:w-[380px] flex flex-col bg-slate-900/20 overflow-y-auto border-l border-slate-800/50">
                        
                        {/* F4 INTELLIGENCE PANEL */}
                        <div className="p-6 space-y-6">
                            
                            <div>
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Zap className="w-3 h-3 text-cyan-400" /> Matrix Intelligence
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                        <p className="text-[9px] text-slate-500 uppercase mb-1">AI SCORE</p>
                                        <p className={cn("text-2xl font-black font-mono", getScoreColor(f4Score))}>
                                            {f4Score}
                                        </p>
                                    </div>
                                    <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
                                        <p className="text-[9px] text-slate-500 uppercase mb-1">PREDICTION</p>
                                        <p className="text-sm font-bold text-slate-200">
                                            {f4Prediction}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className={cn("p-4 rounded-xl border text-center transition-all", getDecisionStyle(f4Decision))}>
                                <p className="text-[9px] uppercase font-bold opacity-60 mb-1">System Decision</p>
                                <p className="text-lg font-black tracking-widest">{f4Decision}</p>
                            </div>

                            {trapWarning && (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl animate-pulse">
                                    <div className="flex items-center gap-2 text-rose-500 mb-1">
                                        <Info className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase">TRAP DETECTED</span>
                                    </div>
                                    <p className="text-[10px] text-rose-500/80 leading-tight">
                                        Market makers are spoofing liquidity. Potential exhaustion move. Avoid chasing.
                                    </p>
                                </div>
                            )}

                            {/* SMC & STRUCTURE (V5 PRO) */}
                            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center transition-all">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">SMC Yapı</span>
                                    <span className={cn("text-[10px] font-black uppercase", smc?.swingTrend === "BULLISH" ? "text-emerald-400" : smc?.swingTrend === "BEARISH" ? "text-rose-400" : "text-slate-400")}>
                                        {smc?.swingTrend || 'NEUTRAL'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={cn("text-[8px] p-1.5 rounded border text-center font-black", smc?.bos ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800/20 border-slate-800/50 text-slate-600")}>BOS</div>
                                    <div className={cn("text-[8px] p-1.5 rounded border text-center font-black", smc?.choch ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-slate-800/20 border-slate-800/50 text-slate-600")}>CHoCH</div>
                                </div>
                                <div className="pt-2 border-t border-white/5 space-y-2">
                                     <div className="flex justify-between text-[9px]">
                                        <span className="text-slate-500">Volüm Baskısı</span>
                                        <span className="text-slate-300 font-mono italic">{vpa?.state || '---'}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-slate-500">Drift Bias</span>
                                        <span className="text-slate-300 font-bold">{adm?.bias || '---'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* INDICATORS GRID */}
                            <div className="space-y-3 pt-2">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <BarChart3 className="w-3 h-3 text-indigo-400" /> V5 Technical Vitals
                                </h3>
                                
                                <div className="grid grid-cols-1 gap-2">
                                    {v5Indicators.length > 0 ? v5Indicators.map((ind, i) => (
                                        <div key={i} className="flex justify-between items-center p-2.5 bg-slate-900/40 rounded-lg border border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{ind.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-slate-500">{ind.value}</span>
                                                <span className={cn(
                                                    "text-[9px] font-black px-2 py-0.5 rounded leading-none",
                                                    ind.color === 'green' ? 'bg-emerald-500/20 text-emerald-400' : 
                                                    ind.color === 'red' ? 'bg-rose-500/20 text-rose-400' : 
                                                    ind.color === 'orange' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/20 text-slate-400'
                                                )}>
                                                    {ind.state}
                                                </span>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-4 text-slate-600 text-[10px] italic">
                                            V5 verisi senkronize ediliyor...
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* QUICK ACTION FOOTER */}
                        <div className="mt-auto p-6 border-t border-slate-800 bg-slate-900/50">
                             <a
                                href={`https://www.mexc.com/exchange/${assetName}_USDT`}
                                target="_blank"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98]"
                            >
                                <Zap className="w-4 h-4 fill-white" />
                                <span>FAST TRADE ON MEXC</span>
                            </a>
                            <p className="text-[9px] text-slate-500 text-center mt-3 font-mono opacity-50">
                                SYNC_ID: {symbol.toUpperCase()}_PRO_MATRIX_V5 // SESSION_ENCRYPTED
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
