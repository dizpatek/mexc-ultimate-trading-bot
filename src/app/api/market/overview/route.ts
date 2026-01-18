import { NextResponse } from 'next/server';
import { getTopAssets } from '@/lib/mexc';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
    try {
        const coins = await getTopAssets(20);

        if (!coins || coins.length === 0) {
            return NextResponse.json([]);
        }

        const marketData = coins.map((coin: any, index: number) => ({
            symbol: coin.symbol.replace('USDT', '/USDT'),
            name: coin.symbol.replace('USDT', ''),
            price: parseFloat(coin.lastPrice) || 0,
            change24h: parseFloat(coin.priceChangePercent) || 0,
            volume: parseFloat(coin.quoteVolume) || 0,
            rank: index + 1,
            marketCap: 0
        }));

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
