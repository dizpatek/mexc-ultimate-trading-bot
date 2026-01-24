import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { predictPrice } from '@/lib/price-predictor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const symbol = searchParams.get('symbol') || 'BTCUSDT';
        const interval = '60m'; // MEXC API uses '60m' for hourly, not '1h' in some endpoints, or '1h' works too. Let's use '60m' to be safe.

        // Fetch Klines from MEXC
        // API format: /api/v3/klines?symbol=BTCUSDT&interval=60m&limit=50
        const mxUrl = `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=60m&limit=100`;

        const response = await fetch(mxUrl, {
            next: { revalidate: 300 } // Cache for 5 mins
        });

        if (!response.ok) {
            console.error(`MEXC API Error: ${response.statusText}`);
            // Return fallback/mock data if API fails to prevent UI crash
            return NextResponse.json({
                symbol,
                currentPrice: 0,
                predictedPrice: 0,
                trend: 'FLAT',
                confidence: 0,
                forecastTime: Date.now(),
                error: 'Market data unavailable'
            });
        }

        const data = await response.json();

        // Parse Close Prices (index 4)
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid data format from MEXC');
        }

        const prices = data.map((k: any) => parseFloat(k[4]));
        const prediction = predictPrice(symbol, prices);

        return NextResponse.json(prediction);

    } catch (error: any) {
        console.error('Prediction API Error:', error);
        return NextResponse.json({
            symbol: 'UNKNOWN',
            currentPrice: 0,
            predictedPrice: 0,
            trend: 'FLAT',
            confidence: 0,
            error: error.message
        }, { status: 500 });
    }
}
