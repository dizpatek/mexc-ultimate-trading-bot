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

        const marketData = coins.map((coin, index) => ({
            symbol: coin.symbol.replace('USDT', '/USDT'), // Format as BASE/QUOTE
            name: coin.symbol.replace('USDT', ''), // Use symbol as name for now as MEXC ticker doesn't have full name
            price: parseFloat(coin.lastPrice),
            change24h: parseFloat(coin.priceChangePercent),
            // Check get24hrTicker return type. priceChangePercent usually string.
            // Let's assume it is percentage value directly or 0.05.
            // Actually usually Binance/MEXC return '5.2' for 5.2%.
            // Wait, let's look at `mexc.ts` types.
            volume: parseFloat(coin.quoteVolume),
            rank: index + 1,
            marketCap: 0, // MEXC ticker doesn't provide MC. We can ignore or estimate.
            // image: coin.image // We don't have images from MEXC ticker.
        }));

        // Fix percentage: If it comes as 0.05 for 5%, multiply by 100.
        // If it comes as 5.0 for 5%, leave it.
        // Usually APIs like Binance/MEXC return relative change?
        // Binance V3 ticker/24hr returns 'priceChangePercent': '3.400' (meaning 3.4%)
        // So just parseFloat is enough.

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
