import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

async function translateToTurkish(text: string): Promise<string> {
    try {
        // Use a public translation endpoint (Lingva is a good free proxy for Google Translate)
        const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(text)}`);
        if (res.data && res.data[0] && res.data[0][0]) {
            return res.data[0][0][0];
        }
        return text;
    } catch (e) {
        console.warn('Translation error:', e);
        return text;
    }
}

export async function GET() {
    try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');

        const rawNews = response.data.Data.slice(0, 10);
        
        // Translate titles in parallel
        const news = await Promise.all(rawNews.map(async (article: any) => {
            const translatedTitle = await translateToTurkish(article.title);
            return {
                id: article.id,
                title: article.title,
                translatedTitle: translatedTitle,
                excerpt: article.body.length > 150 ? article.body.substring(0, 150) + '...' : article.body,
                source: article.source_info.name,
                time: new Date(article.published_on * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                url: article.url,
                imageUrl: article.imageurl
            };
        }));

        return NextResponse.json(news);
    } catch (error) {
        console.error('Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
