import { NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 100,
                page: 1,
                sparkline: false
            },
            timeout: 10000
        });

        if (!response.data || response.data.length === 0) {
            return NextResponse.json([]);
        }

        const marketData = response.data.map((coin: any) => ({
            symbol: coin.symbol,
            name: coin.name,
            price: coin.current_price || 0,
            change24h: coin.price_change_percentage_24h || 0,
            volume: coin.total_volume || 0,
            rank: coin.market_cap_rank || 0,
            marketCap: coin.market_cap || 0
        }));

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
