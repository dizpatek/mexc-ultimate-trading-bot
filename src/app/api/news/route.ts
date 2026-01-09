import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');

        const news = response.data.Data.slice(0, 10).map((article: any) => ({
            id: article.id,
            title: article.title,
            excerpt: article.body.length > 150 ? article.body.substring(0, 150) + '...' : article.body,
            source: article.source_info.name,
            time: new Date(article.published_on * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            url: article.url,
            imageUrl: article.imageurl
        }));

        return NextResponse.json(news);
    } catch (error) {
        console.error('Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
