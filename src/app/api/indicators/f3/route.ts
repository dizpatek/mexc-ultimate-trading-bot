import { NextResponse } from 'next/server';
import { calculateF3WithSignals, getLatestF3Signal } from '@/lib/indicators/f3-indicator';
import axios from 'axios';

export const dynamic = 'force-dynamic';

interface KlineData {
    timestamp: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
}

async function fetchKlineData(symbol: string, interval: string = '60m', limit: number = 100): Promise<any[]> {
    try {
        const response = await axios.get(`https://api.mexc.com/api/v3/klines`, {
            params: {
                symbol,
                interval,
                limit
            }
        });

        return response.data.map((k: any[]) => ({
            timestamp: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
    } catch (error) {
        console.error(`Failed to fetch kline data for ${symbol}:`, error);
        throw error;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawSymbol = searchParams.get('symbol') || 'BTCUSDT';
        const symbol = rawSymbol.toUpperCase(); // Force uppercase for MEXC API
        const interval = searchParams.get('interval') || '60m';
        const fullData = searchParams.get('full') === 'true';

        console.log(`[F3-API] Fetching data for ${symbol} (${interval})`);

        // Fetch OHLC data from MEXC
        const klineData = await fetchKlineData(symbol, interval, fullData ? 200 : 100);

        if (klineData.length < 50) {
            return NextResponse.json({
                error: 'Insufficient data',
                message: 'Need at least 50 candles for F3 calculation'
            }, { status: 400 });
        }

        if (fullData) {
            // Return full F3 calculation with all values
            const f3Results = calculateF3WithSignals(klineData, true);
            return NextResponse.json({
                symbol,
                interval,
                data: f3Results
            });
        } else {
            // Return only the latest signal
            const latestSignal = getLatestF3Signal(klineData);

            if (!latestSignal) {
                return NextResponse.json({
                    error: 'Failed to calculate F3',
                    message: 'Insufficient data or calculation error'
                }, { status: 500 });
            }

            return NextResponse.json({
                symbol,
                interval,
                ...latestSignal,
                timestamp: new Date(latestSignal.timestamp).toISOString()
            });
        }

    } catch (error: any) {
        const errorMsg = error.response?.data?.msg || error.message;
        console.error(`[F3-API] Error for ${request.url}:`, errorMsg);
        return NextResponse.json({
            error: 'F3 calculation failed',
            message: errorMsg,
            details: error.response?.data
        }, { status: error.response?.status || 500 });
    }
}
