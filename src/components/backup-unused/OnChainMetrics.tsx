"use client";

import React, { useState, useEffect } from 'react';
import { Database, Flame, TrendingUp, ShieldAlert, CheckCircle2, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { api } from '@/services/api';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment-analyzer';
import { useModuleTimeframe } from '@/context/TimeframeContext';

interface Prediction {
    symbol: string;
    currentPrice: number;
    predictedPrice: number;
    trend: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
}

export const OnChainMetrics = () => {
    const [loading, setLoading] = useState(true);
    const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
    const [prediction, setPrediction] = useState<Prediction | null>(null);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [timeframe, setTimeframe] = useModuleTimeframe('1h');

    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
                const news = res.data.Data || [];
                setSentiment(analyzeSentiment(news.map((item: { title: string }) => item.title)));
            } catch { /* silent */ }
        };
        fetchSentiment();
    }, []);

    useEffect(() => {
        const fetchCurrentPrice = async () => {
            try {
                const res = await axios.get(`/api/market/ticker?symbol=BTCUSDT`);
                if (res.data && res.data.price) setCurrentPrice(parseFloat(res.data.price));
            } catch { /* silent */ }
        };
        fetchCurrentPrice();
        const priceId = setInterval(fetchCurrentPrice, 2000);
        return () => clearInterval(priceId);
    }, []);

    useEffect(() => {
        const fetchPrediction = async () => {
            try {
                const res = await api.get(`/indicators/f4?symbol=BTCUSDT&interval=${timeframe}`);
                if (res.data && !res.data.error) {
                    const d = res.data;
                    setPrediction({
                        symbol: d.symbol, 
                        currentPrice: d.currentPrice,
                        predictedPrice: d.predictedPrice || (d.currentPrice * (1 + (d.f4Slope || 0)/100)),
                        trend: d.prediction?.direction || (d.f4Slope > 0 ? 'UP' : d.f4Slope < 0 ? 'DOWN' : 'FLAT'),
                        confidence: d.confluenceScore || d.aiScore || 75
                    });
                }
            } catch { /* silent */ }
        };
        fetchPrediction();
    }, [timeframe]);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    const rotation = sentiment ? (sentiment.score / 100) * 90 : 0;

    if (loading) {
        return (
            <div className="px-5 py-2 space-y-3 animate-pulse">
                <div className="h-4 w-24 bg-slate-800 rounded" />
                <div className="h-32 bg-slate-800 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 border-t border-white/5 bg-slate-950/20">
            {/* 1. KÜRESEL NABIZ & PREDICTION */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between bg-slate-950/40 px-3 py-2 rounded-lg border border-white/5 relative group overflow-hidden">
                    <div className="flex items-center gap-3 relative z-10 w-full">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Newspaper className="w-3 h-3 text-amber-500" />
                            <span className="text-[8px] font-black text-slate-500 uppercase">KÜRESEL NABIZ:</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className={cn(
                                "text-[11px] font-black uppercase tracking-tight", 
                                (sentiment?.score || 0) >= 20 ? "text-emerald-400" 
                                : (sentiment?.score || 0) <= -20 ? "text-rose-400" 
                                : "text-amber-400"
                            )}>
                                {sentiment?.label || 'Nötr'}
                            </span>
                            <div className="relative w-6 h-3 overflow-hidden shrink-0 mt-0.5">
                                <div className="absolute top-0 left-0 w-full h-full bg-slate-800/30 rounded-t-full border border-white/5" />
                                <div className={cn(
                                    "absolute top-0 left-0 w-full h-full rounded-t-full origin-bottom transition-all duration-1000", 
                                    (sentiment?.score || 0) > 0 ? "bg-emerald-500/40" : "bg-rose-500/40"
                                )} style={{ transform: `rotate(${rotation}deg)` }} />
                                <div className="absolute bottom-0 left-1/2 w-[1px] h-3 bg-white origin-bottom -translate-x-1/2" 
                                    style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* AI Prediction Block */}
                <div className="space-y-2 relative group/ai px-0.5">
                    <div className="flex bg-slate-900/40 p-0.5 rounded border border-white/5 w-full relative z-10">
                        {['15m', '1h', '4h'].map(tf => (
                            <button key={tf} onClick={() => setTimeframe(tf)}
                                className={cn(
                                    "flex-1 py-1 text-[8px] font-black rounded-sm uppercase transition-all", 
                                    timeframe === tf ? "bg-white text-black text-[9px]" : "text-slate-500"
                                )}>
                                {tf}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 relative z-10">
                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-950/40 border border-white/5">
                            <span className="text-[8px] font-black text-slate-600 uppercase mb-0.5">Canlı</span>
                            <span className="text-[11px] font-mono font-bold text-slate-200">${currentPrice?.toLocaleString() || '---'}</span>
                        </div>
                        <div className="flex flex-col p-2.5 rounded-xl bg-slate-950/40 border border-white/5 items-end text-right">
                            <span className="text-[8px] font-black text-slate-600 uppercase mb-0.5">Projeksiyon</span>
                            <span className={cn(
                                "text-[11px] font-mono font-black", 
                                prediction?.trend === 'UP' ? "text-emerald-400" : "text-rose-400"
                            )}>
                                ${prediction?.predictedPrice?.toLocaleString('en-US', {maximumFractionDigits: 1}) || '---'}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2 relative z-10 px-0.5">
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest">
                            <span className="text-slate-500">Güven</span>
                            <span className="text-cyan-400 font-mono">{(prediction?.confidence || 0).toFixed(1)}%</span>
                        </div>
                        <div className="relative h-1.5 bg-slate-950 rounded-full border border-white/5 overflow-hidden">
                            <div className={cn(
                                "h-full rounded-full transition-all duration-1000", 
                                (prediction?.confidence || 0) > 75 ? "bg-emerald-500" : "bg-cyan-500"
                            )} style={{ width: `${prediction?.confidence || 0}%` }} />
                        </div>
                    </div>
                </div>
            </div>
            {/* Header */}
            <div className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sadeleştirilmiş On-Chain Tablosu</span>
            </div>

            {/* Simplified Table */}
            <div className="bg-black/40 rounded-lg border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/[0.03] border-b border-white/5">
                            <th className="py-1.5 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest w-1/3">Metrik</th>
                            <th className="py-1.5 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest w-1/3">Anlam</th>
                            <th className="py-1.5 px-2 text-[8px] font-black text-slate-500 uppercase tracking-widest w-1/3 text-right">Yorum</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 disabled:divide-transparent">
                        {[
                            { m: "SOPR 1.02", a: "Kâr satışı var", y: "Panik yok" },
                            { m: "MVRV 2.15", a: "Orta değer", y: "Balon değil" },
                            { m: "Net Flow -1250", a: "Borsa çıkışı", y: "Bullish", hc: true },
                            { m: "Rejim", a: "Akümülasyon", y: "Toplama süreci" },
                            { m: "Rezerv 2.1M", a: "Trend gerekli", y: "Sade anlamsız" },
                            { m: "Fonlama 0.012", a: "Hafif long", y: "Nötr" },
                        ].map((row, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                <td className={cn("py-1.5 px-2 text-[9px] font-black uppercase whitespace-nowrap", row.hc ? "text-emerald-400" : "text-white")}>{row.m}</td>
                                <td className="py-1.5 px-2 text-[8px] font-medium text-slate-400 leading-tight">{row.a}</td>
                                <td className="py-1.5 px-2 text-[8px] font-medium text-slate-500 text-right leading-tight">{row.y}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Genel Piyasa Okuması (Net Özet) */}
            <div className="flex flex-col gap-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Genel Piyasa Okuması (Net Özet)</span>
                <div className="grid grid-cols-2 gap-1.5">
                    {[
                        "Panik yok",
                        "Aşırı hype yok",
                        "Akıllı para çekiyor",
                        "Sistem sakin"
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-slate-900/50 px-2 py-1.5 rounded border border-white/5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500/70 shrink-0" />
                            <span className="text-[8px] font-black text-slate-300 uppercase leading-none mt-0.5">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Market Durumu */}
            <div className="flex flex-col gap-2 bg-slate-900/60 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-1.5">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">Market Durumu:</span>
                    </div>
                    <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Kontrollü Toplama</span>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-amber-500" />
                        <span className="text-[9px] font-black text-slate-400 uppercase">Risk Seviyesi</span>
                    </div>
                    <span className="text-[9px] font-black text-amber-500 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">Orta</span>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] font-black text-slate-400 uppercase">Trend Olasılığı</span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-500 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">Yükseliş Eğilimli</span>
                </div>
            </div>

            {/* Smart Money Score */}
            <div className="bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col relative z-10">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">Smart Money Score</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-emerald-400 font-mono leading-none">7.2</span>
                        <span className="text-[10px] text-emerald-400/50 font-black">/ 10</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 relative z-10 bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/30">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter shadow-sm">
                        Bullish Bias
                    </span>
                </div>
            </div>

        </div>
    );
};
