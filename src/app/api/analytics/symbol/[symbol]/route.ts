import { NextResponse } from 'next/server';
import { getTradeHistoryBySymbol } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
    try {
        const { symbol } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');

        const trades = await getTradeHistoryBySymbol(symbol, limit);
        return NextResponse.json(trades);
    } catch (error: any) {
        console.error('Error fetching symbol trades:', error);
        return NextResponse.json({ error: 'Failed to fetch symbol trades' }, { status: 500 });
    }
}
