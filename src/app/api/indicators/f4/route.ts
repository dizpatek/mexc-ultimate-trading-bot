import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { getPrice } from '@/lib/mexc-wrapper';
import { calculateF4 } from '@/lib/indicators/f4';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTCUSDT';
        let interval = searchParams.get('interval') || '1h';

        // Sanitize for Binance API
        if (interval === '60m') interval = '1h';

        // Source 1: Binance (Public & Reliable)
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;

        let data;
        try {
            const res = await fetch(binanceUrl, { next: { revalidate: 60 } });
            if (!res.ok) throw new Error(`Binance returned ${res.status}`);
            data = await res.json();
        } catch (e: any) {
            console.warn(`[F4 API] Binance failed for ${symbol}: ${e.message}. Trying MEXC fallback.`);

            // Source 2: MEXC Fallback
            let mexcInterval = interval;
            if (mexcInterval === '1h') mexcInterval = '60m';

            const mexcUrl = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${mexcInterval}&limit=200`;
            const mxRes = await fetch(mexcUrl);
            if (!mxRes.ok) throw new Error('Global market data sources currently unavailable');
            data = await mxRes.json();
        }

        if (!Array.isArray(data) || data.length < 50) {
            throw new Error('Insufficient kline history for indicator calculation');
        }

        // Parse: [time, open, high, low, close, volume, ...]
        const high = data.map((k: any) => parseFloat(k[2]));
        const low = data.map((k: any) => parseFloat(k[3]));
        const close = data.map((k: any) => parseFloat(k[4]));
        const volume = data.map((k: any) => parseFloat(k[5]));

        const f4Result = calculateF4({
            high, low, close, volume,
            length1: 7, a1: 3.7, length12: 5, a12: 0.618,
            wtLength: 10, wtAvgLength: 21,
        });

        // Price can still come from MEXC wrapper to keep wallet-relative context
        const currentPrice = await getPrice(symbol);

        return NextResponse.json({
            symbol,
            interval,
            timestamp: Date.now(),
            currentPrice,
            ...f4Result,
        });

    } catch (error: any) {
        console.error('F4 CALCULATION ERROR:', error.message);
        return NextResponse.json({
            error: 'INDICATOR_ERROR',
            message: error.message
        }, { status: 500 });
    }
}
