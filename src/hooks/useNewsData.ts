import { useState, useCallback, useEffect } from 'react';
import { analyzeSentiment } from '@/lib/sentiment';

export interface NewsItem {
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

export interface NewsApiResponse {
    id: string;
    title: string;
    translatedTitle?: string;
    excerpt?: string;
    source: string;
    time: string;
    url: string;
    publishedOn: number;
}

export function useNewsData() {
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
                            publishedOn: item.publishedOn,
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
