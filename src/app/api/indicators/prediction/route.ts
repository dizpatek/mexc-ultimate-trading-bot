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
        const interval = '1h'; // Default to hourly

        // Fetch Klines from MEXC
        const response = await fetch(`https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=50`);
        if (!response.ok) throw new Error('Failed to fetch market data');

        const data = await response.json();
        // Parse Close Prices (index 4)
        const prices = data.map((k: any) => parseFloat(k[4]));

        const prediction = predictPrice(symbol, prices);

        return NextResponse.json(prediction);

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
