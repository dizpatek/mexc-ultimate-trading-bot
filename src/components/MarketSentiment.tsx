"use client";

import { useEffect, useState } from 'react';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment-analyzer';
import { Brain } from 'lucide-react';
import axios from 'axios';

interface CryptoCompareNewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    published_on: number;
    imageurl: string;
}

interface CryptoCompareNewsResponse {
    Data: CryptoCompareNewsItem[];
}

export const MarketSentiment = () => {
    const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNewsAndAnalyze = async () => {
            try {
                // Fetch latest crypto news
                const res = await axios.get<CryptoCompareNewsResponse>(
                    'https://min-api.cryptocompare.com/data/v2/news/?lang=EN'
                );
                const news = res.data.Data || [];

                // Extract headlines
                const headlines = news.map((item) => item.title);

                // Analyze
                const result = analyzeSentiment(headlines);
                setSentiment(result);
            } catch (error) {
                console.error('Failed to analyze sentiment', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNewsAndAnalyze();
    }, []);

    if (loading) {
        return (
            <div className="stat-card animate-pulse h-48 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Brain className="w-8 h-8 animate-bounce" />
                    <span>Küresel Haberler Analiz Ediliyor...</span>
                </div>
            </div>
        );
    }

    if (!sentiment) return null;

    // Color logic
    let colorClass = 'text-yellow-500';
    if (sentiment.score >= 20) { colorClass = 'text-green-500'; }
    if (sentiment.score <= -20) { colorClass = 'text-red-500'; }

    // Gauge rotation (-90deg to 90deg)
    // Score -100 to 100 maps to -90 to 90
    const rotation = (sentiment.score / 100) * 90;

    return (
        <div className="w-full h-full flex flex-col justify-center px-2">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-amber-400" />
                    YZ DUYARLILIĞI
                </h3>
                <span className="text-[9px] text-slate-600 bg-slate-900 px-1 py-0.5 rounded border border-white/5">{sentiment.analyzedCount} AKIŞ</span>
            </div>

            <div className="flex items-center gap-4">
                {/* Gauge Visualization (Simplified) */}
                <div className="relative w-16 h-8 overflow-hidden shrink-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-slate-800 rounded-t-full"></div>
                    <div
                        className={`absolute top-0 left-0 w-full h-full rounded-t-full origin-bottom transition-all duration-1000 ease-out ${sentiment.score > 0 ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'
                            }`}
                        style={{ transform: `rotate(${rotation}deg)`, opacity: 0.8 }}
                    ></div>
                    <div className="absolute bottom-0 left-1/2 w-[2px] h-8 bg-white origin-bottom -translate-x-1/2 rotate-0" style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}></div>
                </div>

                <div className="flex flex-col">
                    <div className={`text-lg font-black font-mono leading-none ${colorClass} flex items-center gap-2`}>
                        {sentiment.label}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        SKOR: <span className="text-white">{sentiment.score > 0 ? '+' : ''}{sentiment.score}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
