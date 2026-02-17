import { NextRequest, NextResponse } from 'next/server';
import { getKlines } from '@/lib/mexc';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol');
        const interval = searchParams.get('interval') || '1h';
        const limit = parseInt(searchParams.get('limit') || '500');
        const startTime = searchParams.get('startTime') ? parseInt(searchParams.get('startTime')!) : undefined;
        const endTime = searchParams.get('endTime') ? parseInt(searchParams.get('endTime')!) : undefined;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
        }

        console.log(`[API] Fetching klines for ${symbol} (${interval}) limits: ${limit} range: ${startTime}-${endTime}`);
        const klines = await getKlines(symbol, interval, limit, startTime, endTime);
        console.log(`[API] Received ${klines?.length || 0} klines for ${symbol}`);
        
        // Format klines for lightweight-charts
        // MEXC returns: [time, open, high, low, close, volume, closeTime, quoteAssetVolume]
        const formattedKlines = klines.map((k: (string | number)[]) => ({
            time: (k[0] as number) / 1000, // convert ms to seconds
            open: parseFloat(k[1] as string),
            high: parseFloat(k[2] as string),
            low: parseFloat(k[3] as string),
            close: parseFloat(k[4] as string),
            volume: parseFloat(k[5] as string),
        }));

        return NextResponse.json(formattedKlines);
    } catch (error: unknown) {
        console.error('Klines API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
