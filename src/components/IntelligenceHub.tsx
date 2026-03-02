"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, Target, ExternalLink } from 'lucide-react';
import { useHoldings } from '../hooks/usePortfolio';
import { cn } from '@/lib/utils';

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
}

interface NewsApiResponse {
    id: string;
    title: string;
    translatedTitle?: string;
    excerpt?: string;
    source: string;
    time: string;
    url: string;
}

export const IntelligenceHub = () => {
    const { data: holdings } = useHoldings();
    const [intel, setIntel] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const analyzeSentiment = (title: string): { sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL', impact: 'HIGH' | 'MEDIUM' | 'LOW', asset: string } => {
        const t = title.toUpperCase();
        let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let asset = 'GLOBAL';

        // Asset Detection
        if (t.includes('BTC') || t.includes('BITCOIN')) asset = 'BTC';
        else if (t.includes('ETH') || t.includes('ETHEREUM')) asset = 'ETH';
        else if (t.includes('SOL') || t.includes('SOLANA')) asset = 'SOL';

        // Sentiment Keywords
        const bullWords = ['SURGE', 'BREAKS', 'UP', 'RALLY', 'RECORD', 'HIGH', 'BUYS', 'GREEN', 'ADOPTION', 'LAUNCH', 'YÜKSELİŞ', 'KIRDI', 'REKOR'];
        const bearWords = ['CRASH', 'DROP', 'DOWN', 'SELL', 'RED', 'HACK', 'BAN', 'REGULATION', 'DELAY', 'LOW', 'DÜŞÜŞ', 'KAYIP', 'ERTELEDİ', 'DÜŞTÜ'];

        if (bullWords.some(w => t.includes(w))) {
            sentiment = 'BULLISH';
            impact = t.includes('BTC') ? 'HIGH' : 'MEDIUM';
        } else if (bearWords.some(w => t.includes(w))) {
            sentiment = 'BEARISH';
            impact = t.includes('BTC') ? 'HIGH' : 'MEDIUM';
        }

        if (t.includes('FED') || t.includes('SEC') || t.includes('ETF')) impact = 'HIGH';

        return { sentiment, impact, asset };
    };

    const fetchNews = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/news');
            const data = await res.json();
            
            if (Array.isArray(data)) {
                const mappedNews = data.map((item: NewsApiResponse) => {
                    const analysis = analyzeSentiment(item.title);
                    return {
                        ...item,
                        title: item.translatedTitle || item.title,
                        originalTitle: item.title,
                        sentiment: analysis.sentiment,
                        impact: analysis.impact,
                        relatedAsset: analysis.asset
                    } as NewsItem;
                });
                setIntel(mappedNews);
                setError(null);
            }
        } catch (err) {
            console.error('Intel Error:', err);
            setError('Veri Alınamadı');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [fetchNews]);

    const relevantHolding = (asset: string) => {
        return holdings?.find(h => h.symbol === asset);
    };

    return (
        <div className="flex flex-col h-full bg-[#020617]/90 backdrop-blur-xl border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
             {/* Header */}
             <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-950/50 relative z-10 gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-blue-500 tracking-widest flex items-center gap-1.5">
                        <Activity className="w-4 h-4" /> IntelligenceHub
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {loading && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-tighter">CANLI</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                {error ? (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <Activity className="w-8 h-8 text-slate-700" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{error}</span>
                        <button onClick={fetchNews} className="text-xs font-black text-blue-400 border-b border-blue-400/30 pb-0.5">YENİDEN DENE</button>
                    </div>
                ) : intel.length === 0 && loading ? (
                    <div className="space-y-4 p-4">
                        {[1,2,3,4].map(i => (
                            <div key={i} className="space-y-2 animate-pulse">
                                <div className="h-3 w-1/4 bg-slate-800 rounded" />
                                <div className="h-10 w-full bg-slate-800 rounded" />
                                <div className="h-3 w-1/2 bg-slate-800 rounded" />
                            </div>
                        ))}
                    </div>
                ) : (
                    intel.map((item) => {
                        const isHeld = relevantHolding(item.relatedAsset);
                        return (
                            <div key={item.id} className="p-4 border-b border-white/5 hover:bg-slate-900/40 transition-colors group relative overflow-hidden">
                                 {/* Sentiment Accent Bar */}
                                <div className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[60%] rounded-r transition-all",
                                    item.sentiment === 'BULLISH' ? 'bg-emerald-500' : 
                                    item.sentiment === 'BEARISH' ? 'bg-rose-500' : 'bg-slate-600'
                                )} />
                                
                                <div className="flex justify-between items-start mb-2 pl-2">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-xs font-black px-2 py-1 rounded border uppercase tracking-tighter",
                                            item.sentiment === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                            item.sentiment === 'BEARISH' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                            'bg-slate-800 border-slate-700 text-slate-400'
                                        )}>
                                            {item.relatedAsset}
                                        </span>
                                        {isHeld && (
                                            <div className="flex items-center gap-1.5 group/held">
                                                <Target className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-xs font-black text-blue-400 uppercase tracking-tighter">PORTFÖYÜNDE</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs font-mono text-slate-600 font-bold">
                                        {item.time}
                                    </span>
                                </div>

                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="block pl-2 peer"
                                >
                                    <h4 className="text-sm font-bold text-slate-200 leading-tight group-hover:text-blue-400 transition-colors line-clamp-2" title={item.originalTitle}>
                                        {item.title}
                                    </h4>
                                </a>

                                <div className="flex items-center justify-between pl-2 mt-3 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                            {item.sentiment === 'BULLISH' ? 
                                                <TrendingUp className="w-4 h-4 text-emerald-500" /> : 
                                                item.sentiment === 'BEARISH' ? 
                                                <TrendingDown className="w-4 h-4 text-rose-500" /> :
                                                <Activity className="w-4 h-4 text-slate-500" />
                                            }
                                            <span className={cn(
                                                "text-xs font-black uppercase tracking-widest",
                                                item.sentiment === 'BULLISH' ? 'text-emerald-500' : 
                                                item.sentiment === 'BEARISH' ? 'text-rose-500' : 'text-slate-500'
                                            )}>
                                                {item.sentiment === 'BULLISH' ? 'POZİTİF' : item.sentiment === 'BEARISH' ? 'NEGATİF' : 'NÖTR'}
                                            </span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600">
                                            {item.source.toUpperCase()}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-slate-600 uppercase">
                                            ETKİ: <span className={cn(
                                                "font-black tracking-widest",
                                                item.impact === 'HIGH' ? 'text-blue-400' : 
                                                item.impact === 'MEDIUM' ? 'text-slate-400' : 'text-slate-600'
                                            )}>
                                                {item.impact === 'HIGH' ? 'YÜKSEK' : item.impact === 'MEDIUM' ? 'ORTA' : 'DÜŞÜK'}
                                            </span>
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* Whale Watch Mini-Feed */}
            <div className="p-3 bg-slate-950/80 border-t border-white/10 relative overflow-hidden group/whale">
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/whale:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-2 relative z-10">
                    <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> BALİNA RADARI</span>
                    <span className="text-xs animate-pulse text-blue-500">TARANIYOR...</span>
                </div>
                <div className="flex items-center gap-2 text-xs relative z-10">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    <span className="font-black text-cyan-400">BTC</span>
                    <span className="text-slate-400 line-clamp-1 font-medium italic">1.250 BTC MEXC Soğuk Cüzdanına Aktarıldı</span>
                    <div className="ml-auto px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black text-xs tracking-widest">
                        GÜVENLİ
                    </div>
                </div>
            </div>
        </div>
    );
};
