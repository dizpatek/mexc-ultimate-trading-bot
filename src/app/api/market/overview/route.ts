import { NextResponse } from 'next/server';
import { getTopCoins } from '@/lib/coingecko-service';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
    try {
        const coins = await getTopCoins(15);

        if (!coins || coins.length === 0) {
            // Return safe fallback or error structure
            return NextResponse.json([]);
        }

        const marketData = coins.map(coin => ({
            symbol: `${coin.symbol.toUpperCase()}/USDT`,
            name: coin.name,
            price: coin.current_price,
            change24h: coin.price_change_percentage_24h,
            volume: coin.total_volume,
            rank: coin.market_cap_rank,
            marketCap: coin.market_cap,
            image: coin.image // Pass image directly from CoinGecko
        }));

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
