import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { getPrice } from '@/lib/mexc-wrapper';
import { calculateF4 } from '@/lib/indicators/f4';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTCUSDT';
        const interval = searchParams.get('interval') || '1h';

        // Get klines data (using MEXC API via fetch to bypass wrapper kline limitation if exists)
        // Or use getKlines from wrapper if available and reliable
        // For indicators we need historical data
        const klines = await fetch(
            `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`
        ).then(res => res.json());

        if (!klines || !Array.isArray(klines)) {
            throw new Error('Failed to fetch klines data');
        }

        // Parse klines: [time, open, high, low, close, volume, ...]
        const high = klines.map((k: any) => parseFloat(k[2]));
        const low = klines.map((k: any) => parseFloat(k[3]));
        const close = klines.map((k: any) => parseFloat(k[4]));
        const volume = klines.map((k: any) => parseFloat(k[5]));

        // Calculate F4 with default parameters
        const f4Result = calculateF4({
            high,
            low,
            close,
            volume,
            length1: 7,
            a1: 3.7,
            length12: 5,
            a12: 0.618,
            wtLength: 10,
            wtAvgLength: 21,
        });

        // Get current price for reference
        const currentPrice = await getPrice(symbol);

        return NextResponse.json({
            symbol,
            interval,
            timestamp: Date.now(),
            currentPrice,
            ...f4Result,
        });

    } catch (error: any) {
        console.error('Error calculating F4:', error);
        return NextResponse.json(
            { error: 'Failed to calculate F4 indicator', details: error.message },
            { status: 500 }
        );
    }
}
