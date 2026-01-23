"use client";

import { useEffect, useState } from 'react';
import { analyzeSentiment, SentimentResult } from '@/lib/sentiment-analyzer';
import { Brain, Smile, Frown, Meh, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export const MarketSentiment = () => {
    const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNewsAndAnalyze = async () => {
            try {
                // Fetch latest crypto news
                const res = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
                const news = res.data.Data || [];

                // Extract headlines
                const headlines = news.map((item: any) => item.title);

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
                    <span>Analyzing Global News...</span>
                </div>
            </div>
        );
    }

    if (!sentiment) return null;

    // Color logic
    let colorClass = 'text-yellow-500';
    let Icon = Meh;
    if (sentiment.score >= 20) { colorClass = 'text-green-500'; Icon = Smile; }
    if (sentiment.score <= -20) { colorClass = 'text-red-500'; Icon = Frown; }
    if (sentiment.score <= -60 || sentiment.score >= 60) Icon = AlertTriangle;

    // Gauge rotation (-90deg to 90deg)
    // Score -100 to 100 maps to -90 to 90
    const rotation = (sentiment.score / 100) * 90;

    return (
        <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    AI Sentiment
                </h3>
                <span className="text-xs text-muted-foreground">Based on {sentiment.analyzedCount} articles</span>
            </div>

            <div className="flex flex-col items-center">
                {/* Gauge Visualization */}
                <div className="relative w-48 h-24 overflow-hidden mb-2">
                    <div className="absolute top-0 left-0 w-full h-full bg-muted rounded-t-full"></div>
                    <div
                        className={`absolute top-0 left-0 w-full h-full rounded-t-full origin-bottom transition-all duration-1000 ease-out ${sentiment.score > 0 ? 'bg-gradient-to-r from-yellow-500 to-green-500' : 'bg-gradient-to-r from-red-500 to-yellow-500'
                            }`}
                        style={{ transform: `rotate(${rotation}deg)`, opacity: 0.3 }}
                    ></div>
                    {/* Needle */}
                    <div
                        className="absolute bottom-0 left-1/2 w-1 h-24 bg-foreground origin-bottom transition-transform duration-1000 ease-out"
                        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                    ></div>
                    <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-foreground rounded-full -translate-x-1/2 translate-y-1/2"></div>
                </div>

                <div className={`text-2xl font-bold ${colorClass} flex items-center gap-2 mb-1`}>
                    <Icon className="w-6 h-6" />
                    {sentiment.label}
                </div>
                <div className="text-sm text-muted-foreground font-mono">
                    Score: {sentiment.score > 0 ? '+' : ''}{sentiment.score}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 w-full text-center">
                    <div className="bg-green-500/10 p-2 rounded-lg">
                        <div className="text-xs text-muted-foreground uppercase">Bullish</div>
                        <div className="font-bold text-green-500">{sentiment.bullishCount}</div>
                    </div>
                    <div className="bg-red-500/10 p-2 rounded-lg">
                        <div className="text-xs text-muted-foreground uppercase">Bearish</div>
                        <div className="font-bold text-red-500">{sentiment.bearishCount}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
