"use client";

import { useState, useEffect } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';

interface NewsArticle {
    id: string;
    title: string;
    description: string;
    url: string;
    source: string;
    publishedAt: string;
    imageUrl?: string;
}

export const NewsSection = () => {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNews = async () => {
        setLoading(true);
        setError(null);

        try {
            // Using CryptoCompare News API (free tier)
            const response = await fetch(
                'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=BTC,ETH,Trading'
            );

            if (!response.ok) {
                throw new Error('Failed to fetch crypto news');
            }

            const data = await response.json();

            if (data.Data && Array.isArray(data.Data)) {
                const articles: NewsArticle[] = data.Data.slice(0, 5).map((item: any) => ({
                    id: item.id || item.guid,
                    title: item.title,
                    description: item.body || item.description || '',
                    url: item.url || item.guid,
                    source: item.source || item.source_info?.name || 'CryptoCompare',
                    publishedAt: new Date(item.published_on * 1000).toISOString(),
                    imageUrl: item.imageurl || undefined,
                }));

                setNews(articles);
            } else {
                throw new Error('Invalid news data format');
            }
        } catch (err: any) {
            console.error('Error fetching crypto news:', err);
            setError(err.message || 'Failed to load news');
            setNews([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();

        // Refresh news every 15 minutes
        const interval = setInterval(fetchNews, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading && news.length === 0) {
        return (
            <div className="portfolio-container p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Newspaper className="h-5 w-5" />
                    Crypto News
                </h2>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-4 bg-secondary rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-secondary rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && news.length === 0) {
        return (
            <div className="portfolio-container p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Newspaper className="h-5 w-5" />
                    Crypto News
                </h2>
                <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">{error}</p>
                    <button
                        onClick={fetchNews}
                        className="mt-4 text-xs text-primary hover:underline"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="portfolio-container p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Crypto News
            </h2>

            <div className="space-y-4">
                {news.map((article) => (
                    <a
                        key={article.id}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-all hover:bg-secondary/30 group"
                    >
                        <div className="flex items-start gap-3">
                            {article.imageUrl && (
                                <img
                                    src={article.imageUrl}
                                    alt={article.title}
                                    className="w-16 h-16 rounded object-cover flex-shrink-0"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                                    {article.title}
                                </h3>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                    {article.description}
                                </p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{article.source}</span>
                                    <span suppressHydrationWarning>
                                        {new Date(article.publishedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                    </a>
                ))}
            </div>

            {loading && news.length > 0 && (
                <div className="mt-4 text-center text-xs text-muted-foreground">
                    Refreshing news...
                </div>
            )}
        </div>
    );
};
