import { NextResponse } from 'next/server';
import { fetchAndProcessNews } from '@/services/newsService';

export const revalidate = 300; // Cache the response for 5 minutes (300 seconds)

export async function GET() {
    try {
        const news = await fetchAndProcessNews();
        return NextResponse.json(news);
    } catch (error) {
        console.error('API Route Error fetching news:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
