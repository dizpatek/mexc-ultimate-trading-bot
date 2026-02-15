import { NextResponse } from 'next/server';
import { MatrixV3Engine } from '@/lib/matrix-v3-engine';

export const dynamic = 'force-dynamic';

async function fetchWithTimeout(url: string, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
        const interval = searchParams.get('interval') || '1h';

        const bncInterval = interval === '60m' ? '1h' : interval;
        const mxcInterval = interval === '1h' ? '60m' : interval;

        // Increased limit to 500 for EMA200 and V3 Engine
        const limit = 500;

        const endpoints = [
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${bncInterval}&limit=${limit}`,
            `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=${bncInterval}&limit=${limit}`,
            `https://api.mexc.com/api/v3/klines?symbol=${symbol}&interval=${mxcInterval}&limit=${limit}`
        ];

        let data = null;
        let lastError = '';

        for (const url of endpoints) {
            try {
                const res = await fetchWithTimeout(url, { next: { revalidate: 30 } }, 5000);
                if (res.ok) {
                    data = await res.json();
                    if (Array.isArray(data) && data.length > 200) break; // Ensure we have enough data
                }
            } catch (e) {
                lastError = e instanceof Error ? e.message : String(e);
                continue;
            }
        }

        if (!data || !Array.isArray(data)) {
            return NextResponse.json({
                symbol,
                error: 'MARKET_DATA_UNAVAILABLE',
                message: lastError || 'All API providers failed',
                timestamp: Date.now()
            });
        }

        // Parse Data
        const highs = data.map((k: string[]) => parseFloat(k[2]));
        const lows = data.map((k: string[]) => parseFloat(k[3]));
        const closes = data.map((k: string[]) => parseFloat(k[4]));
        const volumes = data.map((k: string[]) => parseFloat(k[5]));

        // Initialize Engine
        const engine = new MatrixV3Engine({
            f4Length: 10,
            whaleVolumeMultiplier: 1.8,
            minAiScore: 65,
            useWhaleEngine: true
        });

        // Run Analysis
        const result = engine.analyze(closes, highs, lows, volumes);

        // Map to Response
        return NextResponse.json({
            symbol,
            interval: interval,
            timestamp: Date.now(),
            currentPrice: closes[closes.length - 1],
            
            // Matrix V3 Data
            f4Slope: result.slope,
            f4Acceleration: result.acceleration,
            whaleDetected: result.whaleDetected,
            whaleStatus: result.whaleStatus, // Added V3 field
            trend: result.trend,
            signal: result.signal,
            
            // New V3 Advanced Data
            aiScore: result.aiScore,
            aiComponents: result.aiComponents,
            marketRegime: result.marketRegime,
            volatilityRegime: result.volatilityRegime, // Added V3 field
            regimePrediction: result.regimePrediction,
            systemDecision: result.systemDecision,
            zScoreValue: result.zScoreValue,
            mtfConsensus: result.mtfConsensus, // Added V3 field
            
            // Legacy / Helper fields
            f4Signal: result.signal || 'NEUTRAL',
            actionRecommendation: result.systemDecision
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Server Error';
        console.error('F4 Exception:', error);
        return NextResponse.json({ error: 'SERVER_EXCEPTION', message }, { status: 500 });
    }
}
