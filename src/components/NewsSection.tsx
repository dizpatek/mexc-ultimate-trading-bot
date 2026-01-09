"use client";

import React, { useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

// Mock data for news - in a real app, this would come from an API
const newsData = [
    {
        id: 1,
        title: "Bitcoin Reaches New All-Time High Amid Institutional Adoption",
        excerpt: "Major financial institutions continue to increase their Bitcoin holdings as the price surges past previous records.",
        source: "CryptoDaily",
        time: "2 hours ago",
        url: "#"
    },
    {
        id: 2,
        title: "Ethereum 2.0 Upgrade Shows Promising Results in Latest Testnet",
        excerpt: "The latest testnet results indicate that Ethereum's transition to proof-of-stake is progressing smoothly.",
        source: "Blockchain Times",
        time: "5 hours ago",
        url: "#"
    },
    {
        id: 3,
        title: "Regulatory Clarity Boosts Crypto Market Confidence",
        excerpt: "New guidelines from financial regulators provide clearer framework for cryptocurrency exchanges and investors.",
        source: "Finance Watch",
        time: "1 day ago",
        url: "#"
    },
    {
        id: 4,
        title: "DeFi Protocol Announces Major Security Audit Completion",
        excerpt: "Leading decentralized finance platform completes comprehensive security audit with no critical vulnerabilities found.",
        source: "DeFi Report",
        time: "1 day ago",
        url: "#"
    }
];

export const NewsSection = () => {
    const [category, setCategory] = useState('all');

    const categories = [
        { id: 'all', name: 'All News' },
        { id: 'bitcoin', name: 'Bitcoin' },
        { id: 'ethereum', name: 'Ethereum' },
        { id: 'defi', name: 'DeFi' },
        { id: 'regulation', name: 'Regulation' }
    ];

    return (
        <div className="portfolio-container p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold flex items-center">
                    <Newspaper className="h-5 w-5 mr-2" />
                    Latest Crypto News
                </h2>
                <div className="flex space-x-2 overflow-x-auto pb-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${category === cat.id
                                    ? 'btn-primary'
                                    : 'btn-outline'
                                }`}
                            onClick={() => setCategory(cat.id)}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {newsData.map((article) => (
                    <div key={article.id} className="border border-border rounded-lg p-5 hover:bg-muted/50 transition-all duration-300 hover:shadow-md">
                        <h3 className="font-medium mb-3 hover:text-primary cursor-pointer">
                            <a href={article.url} className="flex items-start group">
                                {article.title}
                                <ExternalLink className="h-4 w-4 ml-2 mt-1 opacity-70 group-hover:opacity-100 transition-opacity" />
                            </a>
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">{article.excerpt}</p>
                        <div className="flex justify-between items-center">
                            <span className="text-xs bg-muted px-3 py-1.5 rounded-full font-medium">{article.source}</span>
                            <span className="text-xs text-muted-foreground">{article.time}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 text-center">
                <button className="text-sm text-primary hover:underline transition-colors font-medium">
                    View All News
                </button>
            </div>
        </div>
    );
};
