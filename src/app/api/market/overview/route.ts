import { NextResponse } from 'next/server';
import { getTopCurrencies } from '@/lib/cryptorank-service';
import { get24hrTicker } from '@/lib/mexc';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 1 minute

export async function GET() {
    try {
        // Get top 15 currencies from CryptoRank
        const currencies = await getTopCurrencies(15);

        if (!currencies || currencies.length === 0) {
            return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
        }

        // Enrich with MEXC ticker data for more accurate real-time info
        const marketData = await Promise.all(
            currencies.map(async (currency) => {
                const symbol = `${currency.symbol}USDT`;
                let volume24h = currency.volume24h;
                let change24h = currency.delta.day;

                // Try to get MEXC data for better accuracy
                try {
                    const ticker = await get24hrTicker(symbol);
                    if (ticker && ticker.volume) {
                        volume24h = parseFloat(ticker.quoteVolume) || volume24h;
                    }
                    if (ticker && ticker.priceChangePercent) {
                        change24h = parseFloat(ticker.priceChangePercent);
                    }
                } catch (e) {
                    // Use CryptoRank data as fallback
                }

                return {
                    symbol: `${currency.symbol}/USDT`,
                    name: currency.name,
                    price: currency.price.USD,
                    change24h: change24h,
                    volume: volume24h,
                    rank: currency.rank,
                    marketCap: currency.marketCap
                };
            })
        );

        return NextResponse.json(marketData);
    } catch (error: any) {
        console.error('Error in market overview API:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
