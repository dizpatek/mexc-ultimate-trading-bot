import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { predictPrice } from '@/lib/price-predictor';

export const dynamic = 'force-dynamic';

type KlineData = [string, string, string, string, string, string, string, string, string, string, string, string];

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTCUSDT';

        // Use Binance for better public kline data reliability
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`;

        const response = await fetch(binanceUrl, {
            next: { revalidate: 300 } // Cache for 5 mins
        });

        if (!response.ok) {
            // Fallback to MEXC if Binance is down
            const mexcUrl = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=60m&limit=100`;
            const mxRes = await fetch(mexcUrl);
            if (!mxRes.ok) throw new Error('Global market data sources unavailable');

            const mxData: KlineData[] = await mxRes.json();
            const prices = mxData.map((k) => parseFloat(k[4]));
            return NextResponse.json(predictPrice(symbol, prices));
        }

        const data: KlineData[] = await response.json();
        const prices = data.map((k) => parseFloat(k[4]));
        const prediction = predictPrice(symbol, prices);

        return NextResponse.json(prediction);

    } catch (error: unknown) {
        console.error('Prediction API Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            symbol: 'UNKNOWN',
            currentPrice: 0,
            predictedPrice: 0,
            trend: 'FLAT',
            confidence: 0,
            error: errorMessage
        }, { status: 500 });
    }
}
