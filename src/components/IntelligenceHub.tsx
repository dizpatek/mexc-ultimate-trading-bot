"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, Target, ExternalLink, AlertTriangle } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';
import { useTrade } from '@/context/TradeContext';
import { analyzeSentiment } from '@/lib/sentiment';
import { cn } from '@/lib/utils';

// --- Types ---

interface NewsItem {
    id: string;
    title: string;
    originalTitle?: string;
    translatedTitle?: string;
    excerpt: string;
    source: string;
    time: string;
    url: string;
    sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    relatedAsset: string;
    sentimentScore: number;
    sentimentConfidence: number;
    publishedOn: number;
    isNew?: boolean;
}

interface NewsApiResponse {
    id: string;
    title: string;
    translatedTitle?: string;
    excerpt?: string;
    source: string;
    time: string;
    url: string;
    publishedOn: number;
}

// --- Specialized Hooks ---

/**
 * Hook for raw news data acquisition and 24h filtering
 */
function useNewsData() {
    const [rawNews, setRawNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNews = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/news');
            if (!res.ok) throw new Error('API request failed');
            const data = await res.json();

            if (Array.isArray(data)) {
                const now = Math.floor(Date.now() / 1000);
                const cutoff = now - 86400; // 24 hours ago

                const mapped = data
                    .map((item: NewsApiResponse) => {
                        const analysis = analyzeSentiment(item.title);
                        return {
                            ...item,
                            title: item.translatedTitle || item.title,
                            originalTitle: item.title,
                            sentiment: analysis.sentiment,
                            impact: analysis.impact,
                            relatedAsset: analysis.asset,
                            sentimentScore: analysis.score,
                            sentimentConfidence: analysis.confidence,
                        } as NewsItem;
                    })
                    .filter(item => item.publishedOn > cutoff);

                setRawNews(mapped);
                setError(null);
            }
        } catch (err) {
            console.error('News Data Error:', err);
            setError('Veri Alınamadı');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 60000);
        return () => clearInterval(interval);
    }, [fetchNews]);

    return { rawNews, loading, error, fetchNews };
}

/**
 * Hook for UI-state management (new item detection) and analytics
 */
function useNewsAnalytics(rawNews: NewsItem[]) {
    const seenIdsRef = useRef<Set<string>>(new Set());
    
    // Enrich news with local UI state (isNew flag)
    const intel = useMemo(() => {
        const processed = rawNews.map(item => ({
            ...item,
            isNew: seenIdsRef.current.size > 0 && !seenIdsRef.current.has(item.id)
        }));

        // Update seen IDs for next render
        const currentIds = rawNews.map(i => i.id);
        if (currentIds.length > 0) {
            seenIdsRef.current = new Set([...Array.from(seenIdsRef.current), ...currentIds]);
        }
        
        return processed;
    }, [rawNews]);

    const aggregateSentiment = useMemo(() => {
        if (intel.length === 0) return 0;
        return Math.round(intel.reduce((sum, i) => sum + i.sentimentScore, 0) / intel.length);
    }, [intel]);

    const stats = useMemo(() => ({
        bullCount: intel.filter(i => i.sentiment === 'BULLISH').length,
        bearCount: intel.filter(i => i.sentiment === 'BEARISH').length,
    }), [intel]);

    return { intel, aggregateSentiment, stats };
}

// --- UI Components ---

const SentimentBar = ({ score, confidence }: { score: number; confidence: number }) => {
    const normalizedWidth = Math.abs(score);
    const isPositive = score >= 0;

    return (
        <div className="flex items-center gap-1.5 w-full">
            <span className="text-[8px] font-black text-slate-600 w-5 text-right shrink-0">
                {score > 0 ? '+' : ''}{score}
            </span>
            <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden relative">
                <div className="absolute inset-0 flex">
                    <div className="w-1/2 flex justify-end">
                        {!isPositive && (
                            <div
                                className="h-full bg-gradient-to-l from-rose-500 to-rose-600 rounded-l-full shadow-[0_0_6px_rgba(244,63,94,0.6)] transition-all duration-500"
                                style={{ width: `${normalizedWidth}%` }}
                            />
                        )}
                    </div>
                    <div className="w-[1px] bg-slate-600 shrink-0" />
                    <div className="w-1/2">
                        {isPositive && (
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-r-full shadow-[0_0_6px_rgba(16,185,129,0.6)] transition-all duration-500"
                                style={{ width: `${normalizedWidth}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>
            <span className="text-[7px] font-mono text-slate-600 w-7 shrink-0">%{confidence}</span>
        </div>
    );
};

const NewsTicker = ({ items }: { items: NewsItem[] }) => {
    const highImpact = useMemo(() => 
        items.filter(i => i.isNew || i.impact === 'HIGH' || Math.abs(i.sentimentScore) > 20), 
    [items]);

    if (highImpact.length === 0) return null;

    return (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-amber-950/40 border-b border-amber-500/20 px-0 py-1.5">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.05),transparent)] animate-pulse" />
            <div className="flex items-center gap-2 text-xs">
                <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border-r border-amber-500/30 font-black text-amber-500 uppercase z-10">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.2em]">FLAŞ</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="animate-[ticker_30s_linear_infinite] flex items-center gap-8 whitespace-nowrap">
                        {[...highImpact, ...highImpact].map((item, idx) => (
                            <span key={`${item.id}-${idx}`} className="inline-flex items-center gap-2 text-[11px]">
                                <span className={cn(
                                    "font-black text-xs",
                                    item.sentiment === 'BULLISH' ? 'text-emerald-400' : item.sentiment === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'
                                )}>
                                    {item.sentiment === 'BULLISH' ? '▲' : item.sentiment === 'BEARISH' ? '▼' : '●'}
                                </span>
                                <span className="font-black text-amber-200 uppercase tracking-wider">{item.relatedAsset}</span>
                                <span className="text-slate-300 font-bold drop-shadow-sm">{item.title}</span>
                                <span className="text-slate-700 mx-3">│</span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const NewsItemRow = ({ 
    item, 
    isHeld, 
    handleNewsTrade 
}: { 
    item: NewsItem; 
    isHeld: boolean; 
    handleNewsTrade: (item: NewsItem, direction: 'BUY' | 'SELL') => void 
}) => {
    const isCritical = item.impact === 'HIGH' && Math.abs(item.sentimentScore) > 25;

    return (
        <div className={cn(
            "p-2 border-b border-blue-900/30 hover:bg-blue-950/25 transition-all duration-300 group relative overflow-hidden",
            isCritical && "bg-amber-950/10 border-amber-500/20",
            item.isNew && "animate-news-flash"
        )}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/8 to-cyan-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            {isCritical && <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent animate-pulse pointer-events-none" />}
            
            <div className={cn(
                "absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-[70%] rounded-r transition-all duration-300",
                item.sentiment === 'BULLISH' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' :
                item.sentiment === 'BEARISH' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-slate-600 shadow-[0_0_5px_rgba(148,163,184,0.5)]'
            )} />

            <div className="flex items-center gap-2 pl-2">
                <span className={cn(
                    "text-[9px] font-black px-1.2 py-0.5 rounded border uppercase tracking-tighter shrink-0",
                    item.sentiment === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                    item.sentiment === 'BEARISH' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                    'bg-slate-800 border-slate-700 text-slate-400'
                )}>
                    {item.relatedAsset}
                </span>
                
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-slate-200 leading-tight group-hover:text-blue-400 transition-colors truncate" title={item.originalTitle}>
                        {item.title}
                    </h4>
                </a>

                <span className="text-[11px] font-mono text-slate-600 font-bold shrink-0">{item.time}</span>
            </div>

            {/* Bottom Row: Meta + Wide Centered Slider + Controls */}
            <div className="flex items-center justify-between pl-2 mt-1 px-1 gap-3">
                {/* Meta Labels */}
                <div className="flex items-center gap-1.5 shrink-0 min-w-[60px]">
                    {isCritical && <span className="text-[8px] font-black px-1 py-0.25 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse uppercase tracking-tight">KRT</span>}
                    {isHeld && <Target className="w-3 h-3 text-blue-400" />}
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[50px]">{item.source}</span>
                </div>

                {/* Centered & Wide Slider */}
                <div className="flex-1 flex justify-center max-w-[200px]">
                    <SentimentBar score={item.sentimentScore} confidence={item.sentimentConfidence} />
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 shrink-0 min-w-[75px] justify-end">
                    {item.relatedAsset !== 'GLOBAL' && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button onClick={(e) => { e.stopPropagation(); handleNewsTrade(item, 'BUY'); }} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black hover:bg-emerald-500/20 transition-colors">
                                AL
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleNewsTrade(item, 'SELL'); }} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[8px] font-black hover:bg-rose-500/20 transition-colors">
                                SAT
                            </button>
                        </div>
                    )}
                    <ExternalLink className="w-2.5 h-2.5 text-slate-700 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export const IntelligenceHub = () => {
    const { data: holdings } = useHoldings();
    const trade = useTrade();
    
    // De-coupled hooks
    const { rawNews, loading, error, fetchNews } = useNewsData();
    const { intel, aggregateSentiment, stats } = useNewsAnalytics(rawNews);

    const handleNewsTrade = useCallback((item: NewsItem, direction: 'BUY' | 'SELL') => {
        const assetSymbol = item.relatedAsset === 'GLOBAL' ? 'BTC/USDT' : `${item.relatedAsset}/USDT`;
        trade.setSymbol(assetSymbol);
        trade.setMode(direction === 'BUY' ? 'TRADE' : 'COVER');
        trade.setTpEnabled(true);
        trade.setSlEnabled(true);
        trade.setIsPanelOpen(true);
    }, [trade]);

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-[#020617] to-[#0f172a]/90 backdrop-blur-xl border border-blue-500/30 rounded-xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)] relative group/hub">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-50 shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-pulse" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-none opacity-30" />

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/30 bg-gradient-to-r from-slate-950/90 to-slate-900/80 relative z-10 gap-3">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
                    <span className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 uppercase tracking-[0.25em]">INTELLIGENCE HUB</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                    <div className={cn(
                        "flex items-center gap-1 px-1.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider",
                        aggregateSentiment > 5 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                        aggregateSentiment < -5 ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-slate-800 border-slate-700 text-slate-400"
                    )}>
                        {aggregateSentiment > 5 ? <TrendingUp className="w-2.5 h-2.5" /> : aggregateSentiment < -5 ? <TrendingDown className="w-2.5 h-2.5" /> : <Activity className="w-2.5 h-2.5" />}
                        {aggregateSentiment > 0 ? '+' : ''}{aggregateSentiment}
                    </div>
                </div>
            </div>

            <NewsTicker items={intel} />

            {/* Sentiment Overview Bar */}
            {intel.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border-b border-blue-900/20 relative z-10">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest shrink-0">PİYASA</span>
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden flex">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700" style={{ width: `${(stats.bullCount / intel.length * 100)}%` }} />
                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-700" style={{ width: `${(stats.bearCount / intel.length * 100)}%` }} />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-black text-[8px]">
                        <span className="text-emerald-500">{stats.bullCount}▲</span>
                        <span className="text-slate-700">/</span>
                        <span className="text-rose-500">{stats.bearCount}▼</span>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                {error ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center space-y-2">
                        <Activity className="w-6 h-6 text-slate-700" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{error}</span>
                        <button onClick={fetchNews} className="text-xs font-black text-blue-400 border-b border-blue-400/30 pb-0.5 hover:text-blue-300 transition-colors">YENİDEN DENE</button>
                    </div>
                ) : intel.length === 0 && loading ? (
                    <div className="space-y-2 p-3">
                        {[1,2,3].map(i => (
                            <div key={i} className="space-y-1.5 animate-pulse">
                                <div className="h-2.5 w-1/4 bg-slate-800 rounded" />
                                <div className="h-8 w-full bg-slate-800 rounded" />
                            </div>
                        ))}
                    </div>
                ) : (
                    intel.map((item) => (
                        <NewsItemRow 
                            key={item.id} 
                            item={item} 
                            isHeld={!!holdings?.find(h => h.symbol === item.relatedAsset)} 
                            handleNewsTrade={handleNewsTrade} 
                        />
                    ))
                )}
            </div>

            {/* Whale Watch Mini-Feed */}
            <div className="p-2.5 bg-gradient-to-r from-slate-950 to-slate-900 border-t border-blue-500/30 relative overflow-hidden group/whale z-10">
                <div className="absolute top-0 bottom-0 left-[-100%] w-1/2 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent group-hover/whale:animate-[sweep_2s_ease-in-out_infinite]" />
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 relative z-10">
                    <span className="flex items-center gap-1.5 text-blue-400 drop-shadow-[0_0_3px_rgba(96,165,250,0.6)]"><Activity className="w-3.5 h-3.5" /> BALİNA RADARI</span>
                    <span className="animate-pulse text-cyan-500 tracking-widest">TARANIYOR...</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] relative z-10 bg-[#020617]/70 rounded-lg p-1.5 border border-blue-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-[pulse_1.5s_ease-in-out_infinite]" />
                    <span className="font-black text-white/90">BTC</span>
                    <span className="text-slate-400 line-clamp-1 font-mono text-[9px]">1.250 BTC MEXC Soğuk Cüzdanına Aktarıldı</span>
                    <div className="ml-auto px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-[8px] tracking-widest">GÜVENLİ</div>
                </div>
            </div>
        </div>
    );
};
