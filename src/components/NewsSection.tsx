"use client";

import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, RefreshCw, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';

interface NewsArticle {
    id: string;
    title: string;
    excerpt: string;
    source: string;
    time: string;
    url: string;
    imageUrl?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
}

const mockNews: NewsArticle[] = [
    {
        id: '1',
        title: 'Bitcoin Surges Past $90,000 as Institutional Adoption Grows',
        excerpt: 'Major financial institutions announce new Bitcoin investment products, driving the cryptocurrency to record highs. Analysts predict continued momentum...',
        source: 'CryptoNews',
        time: '2 hours ago',
        url: 'https://example.com/news/1',
        sentiment: 'positive'
    },
    {
        id: '2',
        title: 'Ethereum 2.0 Upgrade Successfully Completed',
        excerpt: 'The long-awaited upgrade brings significant improvements to network scalability and energy efficiency. Gas fees expected to drop...',
        source: 'BlockChainDaily',
        time: '4 hours ago',
        url: 'https://example.com/news/2',
        sentiment: 'positive'
    },
    {
        id: '3',
        title: 'Regulatory Concerns Rise Over Stablecoin Issuance',
        excerpt: 'Global regulators discuss new frameworks for stablecoin oversight, potentially impacting major stablecoin providers in the market...',
        source: 'FinanceWatch',
        time: '6 hours ago',
        url: 'https://example.com/news/3',
        sentiment: 'negative'
    },
    {
        id: '4',
        title: 'Solana Network Activity Hits New All-Time High',
        excerpt: 'DeFi protocols on Solana see unprecedented growth as users seek lower transaction costs and faster settlement times...',
        source: 'CryptoSlate',
        time: '8 hours ago',
        url: 'https://example.com/news/4',
        sentiment: 'positive'
    },
];

export const NewsSection = () => {
    const [news, setNews] = useState<NewsArticle[]>(mockNews);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const response = await api.get('/news');
            setNews(response.data || mockNews);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch news', err);
            setNews(mockNews);
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
                <div className="flex items-center gap-2">
                    <div className={`p-2 ${loading ? 'bg-primary/10' : 'bg-blue-500/10'} rounded-lg transition-colors`}>
                        <Newspaper className={`h-5 w-5 ${loading ? 'text-primary' : 'text-blue-500'}`} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Crypto News</h2>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">Latest market updates</p>
                            {loading && (
                                <div className="h-1.5 w-1.5 bg-primary rounded-full animate-pulse"></div>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={fetchNews}
                    className="p-2 hover:bg-muted rounded-full transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1" style={{ maxHeight: '600px' }}>
                {news.map((article) => (
                    <div key={article.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-all duration-300 hover:shadow-md group">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="font-medium text-sm leading-snug hover:text-primary cursor-pointer line-clamp-2 flex-1">
                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-start">
                                    {article.title}
                                    <ExternalLink className="h-3.5 w-3.5 ml-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </a>
                            </h3>
                            {article.sentiment === 'positive' && (
                                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{article.excerpt}</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs bg-muted/60 px-2 py-1 rounded font-medium">{article.source}</span>
                            <span className="text-xs text-muted-foreground">{article.time}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-border text-center">
                <a href="https://cryptorank.io/news" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    View all news on CryptoRank
                </a>
            </div>
        </div>
    );
};
