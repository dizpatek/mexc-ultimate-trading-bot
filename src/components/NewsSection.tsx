"use client";

import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '@/services/api';

interface NewsArticle {
    id: string;
    title: string;
    excerpt: string;
    source: string;
    time: string;
    url: string;
    imageUrl?: string;
}

export const NewsSection = () => {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const response = await api.get('/news');
            setNews(response.data);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch news', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    return (
        <div className="portfolio-container p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold flex items-center">
                    <Newspaper className="h-5 w-5 mr-2" />
                    Kripto Haberleri
                </h2>
                <button
                    onClick={fetchNews}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                    title="Yenile"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar" style={{ maxHeight: '600px' }}>
                {loading && news.length === 0 ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="border border-border rounded-lg p-5 animate-pulse">
                            <div className="h-4 bg-muted rounded w-3/4 mb-3"></div>
                            <div className="h-16 bg-muted rounded mb-3"></div>
                            <div className="h-3 bg-muted rounded w-1/4"></div>
                        </div>
                    ))
                ) : error ? (
                    <div className="text-center text-destructive py-10">
                        Haberler yüklenirken bir hata oluştu.
                    </div>
                ) : (
                    news.map((article) => (
                        <div key={article.id} className="border border-border rounded-lg p-5 hover:bg-muted/50 transition-all duration-300 hover:shadow-md group">
                            <h3 className="font-medium mb-2 leading-snug hover:text-primary cursor-pointer line-clamp-2">
                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-start">
                                    {article.title}
                                    <ExternalLink className="h-3.5 w-3.5 ml-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </a>
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{article.excerpt}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs bg-muted/60 px-2 py-1 rounded font-medium">{article.source}</span>
                                <span className="text-xs text-muted-foreground">{article.time}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-4 text-center border-t pt-2">
                <a href="https://cryptorank.io/news" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Tüm haberleri CryptoRank'te gör
                </a>
            </div>
        </div>
    );
};
