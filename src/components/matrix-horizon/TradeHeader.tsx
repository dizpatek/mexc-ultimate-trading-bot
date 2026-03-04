"use client";

import React from 'react';
import { Activity, ChevronUp, ChevronDown, Zap, ShieldAlert, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TradeHeaderProps {
    isSectionExpanded: boolean;
    setIsSectionExpanded: (val: boolean) => void;
    tradesCount: number;
    lastFetchTime: number;
    error: string | null;
    activeTab: 'AKTIF' | 'PASIF';
    setActiveTab: (tab: 'AKTIF' | 'PASIF') => void;
    onNewTrade: () => void;
    clearingAction: 'active' | 'passive' | null;
    pendingClear: 'active' | 'passive' | null;
    setPendingClear: (val: 'active' | 'passive' | null) => void;
    handleClearAll: (type: 'active' | 'passive') => void;
    hasTradeItems: boolean;
}

export const TradeHeader: React.FC<TradeHeaderProps> = ({
    isSectionExpanded,
    setIsSectionExpanded,
    tradesCount,
    lastFetchTime,
    error,
    activeTab,
    setActiveTab,
    onNewTrade,
    clearingAction,
    pendingClear,
    setPendingClear,
    handleClearAll,
    hasTradeItems
}) => {
    return (
        <div className="flex items-center justify-between px-2 cursor-pointer group" onClick={() => setIsSectionExpanded(!isSectionExpanded)}>
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="absolute -inset-1 bg-cyan-500/20 rounded-full blur-sm animate-pulse"></div>
                    <Activity className="w-5 h-5 text-cyan-400 relative z-10" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-[0.3em] flex items-center gap-2 group-hover:text-cyan-400 transition-colors">
                        AKILLI İŞLEMLER 
                        {isSectionExpanded ? <ChevronUp className="w-4 h-4 ml-1 text-slate-500" /> : <ChevronDown className="w-4 h-4 ml-1 text-slate-500" />}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Nöro-Motor Entegre {" // "} {tradesCount} Pozisyon {" // "} Son Sinyal: {new Date(lastFetchTime).toLocaleTimeString([], { hour12: false, second: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                {error && (
                    error.includes('API keys') ? (
                        <div 
                            onClick={() => window.location.href = '/settings'}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold animate-pulse cursor-pointer hover:bg-yellow-500/20 transition-colors"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            KONFİGÜRASYON GEREKLİ: ANAHTARLARI DÜZELTMEK İÇİN TIKLAYIN
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            API ERROR: {error.toUpperCase()}
                        </div>
                    )
                )}
                <div className="flex bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden p-0.5">
                    <button 
                        onClick={onNewTrade}
                        className="p-2 px-3 text-[10px] font-black transition-all rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 flex items-center gap-1.5 mr-1"
                        title="YENİ İŞLEM OLUŞTUR"
                    >
                        <Zap className="w-3 h-3" />
                        YENİ İŞLEM
                    </button>
                    <button 
                        onClick={() => setActiveTab('AKTIF')}
                        className={cn(
                            "p-2 px-4 text-xs font-black transition-all rounded-md",
                            activeTab === 'AKTIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        AKTİF
                    </button>
                    <button 
                        onClick={() => setActiveTab('PASIF')}
                        className={cn(
                            "p-2 px-4 text-xs font-black transition-all rounded-md",
                            activeTab === 'PASIF' ? "text-white bg-slate-800" : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        PASİF
                    </button>
                </div>
                {hasTradeItems && (
                    <div className="flex items-center gap-2 relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setPendingClear(activeTab === 'AKTIF' ? 'active' : 'passive'); }}
                            disabled={clearingAction !== null || pendingClear !== null}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest group",
                                (clearingAction !== null || pendingClear !== null) ? "opacity-50 cursor-not-allowed" : "",
                                activeTab === 'AKTIF' 
                                    ? "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400" 
                                    : "bg-slate-500/10 border border-slate-500/20 hover:bg-slate-500/20 text-slate-400"
                            )}
                            title={activeTab === 'AKTIF' ? "TÜM AKTİF POZİSYONLARI KAPAT VE SAT" : "İŞLEM GEÇMİŞİNİ TEMİZLE"}
                        >
                            {clearingAction !== null ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <ShieldAlert className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            )}
                            {clearingAction !== null ? 'İŞLENİYOR...' : (activeTab === 'AKTIF' ? 'TÜMÜNÜ SAT' : 'GEÇMİŞİ TEMİZLE')}
                        </button>
                        {pendingClear !== null && (
                            <div className="absolute right-0 top-full mt-2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 border border-rose-500/30 shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap">
                                <span className="text-[10px] font-black text-rose-300 uppercase tracking-wider mr-2">
                                    {pendingClear === 'active' ? 'TÜM POZİSYONLAR SATILACAK!' : 'GEÇMİŞ SİLİNECEK!'}
                                </span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleClearAll(pendingClear); }}
                                    className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors shadow-lg"
                                >
                                    ONAYLA ✓
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setPendingClear(null); }}
                                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-black uppercase tracking-wider transition-colors"
                                >
                                    İPTAL ✕
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
