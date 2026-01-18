import { NextResponse } from 'next/server';
import axios from 'axios';

const CRYPTORANK_API_KEY = 'a6ea95811d51a85fda8206308aa0b6c435e24c1327191b261776b8bf101a';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
    try {
        const response = await axios.get('https://api.cryptorank.io/v2/coins', {
            params: {
                limit: 100,
                convert: 'USD'
            },
            headers: {
                'Authorization': CRYPTORANK_API_KEY
            },
            timeout: 10000
        });

        if (!response.data || !response.data.data || response.data.data.length === 0) {
            return NextResponse.json([]);
        }

        const marketData = response.data.data.map((coin: any) => ({
            symbol: coin.symbol,
            name: coin.name,
            price: coin.price?.USD || 0,
            change24h: coin.delta?.day || 0,
            volume: coin.volume24h || 0,
            rank: coin.rank,
            marketCap: coin.marketCap || 0
        }));

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
