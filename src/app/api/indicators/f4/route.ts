import { NextResponse } from 'next/server';
import { MatrixV3Engine } from '@/lib/matrix-v3-engine-enhanced';
import { monitorSmartTrades } from '@/lib/smart-trade-monitor';

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

// Fetch market data (BTC.D, USDT.D, OTHERS.D, DXY)
async function fetchMarketData() {
    try {
        // Using CoinGecko for dominance data (free API)
        const response = await fetch('https://api.coingecko.com/api/v3/global', {
            next: { revalidate: 60 }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        const btcDominance = data.data?.market_cap_percentage?.btc || 0;
        const usdtDominance = data.data?.market_cap_percentage?.usdt || 0;
        
        // Calculate OTHERS.D (100 - BTC - USDT - ETH - BNB roughly)
        const othersDominance = 100 - btcDominance - usdtDominance - (data.data?.market_cap_percentage?.eth || 0);
        
        return {
            btcDominance,
            btcDomChange: 0, // Would need historical data
            usdtDominance,
            usdtDomChange: 0,
            othersDominance,
            othersDomChange: 0,
            dxyValue: 104, // Placeholder - would need forex API
            dxyChange: 0
        };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase();
        const interval = searchParams.get('interval') || '1h';
        const tradeMode = searchParams.get('mode') || 'Scalp';

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

        // Fetch market data (dominance, DXY)
        const marketData = await fetchMarketData();

        // Initialize Engine with mode-specific settings
        const engine = new MatrixV3Engine({
            f4Length: tradeMode === 'Scalp' ? 10 : 10,
            f4Alpha: tradeMode === 'Scalp' ? 3.7 : 1.2,
            f4SlopeThresholdFactor: 0.01,
            f4FiboLength: tradeMode === 'Scalp' ? 5 : 8,
            f4FiboAlpha: 0.618,
            tradeMode: tradeMode as 'Scalp' | 'Swing',
            whaleVolumeMultiplier: 1.8,
            minAiScore: 65,
            useWhaleEngine: true,
            useQFL: false,
            useMomentum: false,
            qflLookback: 30,
            qflDropPct: 3.0,
            signalFreshnessBars: 5,
            maxConsecutiveLoss: 6
        });

        // Run Analysis with market data
        const result = engine.analyze(closes, highs, lows, volumes, marketData || undefined);

        // Map to Response
        const payload = {
            symbol,
            interval: interval,
            timestamp: Date.now(),
            currentPrice: closes[closes.length - 1],
            
            // Matrix V3 Core Data
            f4Slope: result.slope,
            f4Acceleration: result.acceleration,
            f4Value: result.f4Value,
            f4FiboValue: result.f4FiboValue,
            whaleDetected: result.whaleDetected,
            whaleStatus: result.whaleStatus,
            trend: result.trend,
            signal: result.signal,
            earlyReversal: result.earlyReversal,
            fastSlope: result.fastSlope,
            fastAcceleration: result.fastAcceleration,
            
            // AI Score
            aiScore: result.aiScore,
            aiComponents: result.aiComponents,
            
            // Market Regime
            marketRegime: result.marketRegime,
            volatilityRegime: result.volatilityRegime,
            regimePrediction: result.regimePrediction,
            systemDecision: result.systemDecision,
            zScoreValue: result.zScoreValue,
            mtfConsensus: result.mtfConsensus,
            mtfBullCount: result.mtfBullCount,
            
            // SMC Structure
            internalTrend: result.internalTrend,
            swingTrend: result.swingTrend,
            lastBOS: result.lastBOS,
            lastCHoCH: result.lastCHoCH,
            orderBlocks: result.orderBlocks.slice(-5), // Last 5 active OBs
            fairValueGaps: result.fairValueGaps.slice(-3), // Last 3 active FVGs
            
            // Premium/Discount
            trailingTop: result.trailingTop,
            trailingBottom: result.trailingBottom,
            inPremium: result.inPremium,
            inDiscount: result.inDiscount,
            
            // Vix Fix & QFL
            vixBottom: result.vixBottom,
            vixValue: result.vixValue,
            qflPanicBottom: result.qflPanicBottom,
            
            // WaveTrend
            wt1: result.wt1,
            wt2: result.wt2,
            wtDivergence: result.wtDivergence,
            
            // Market Data
            btcDominance: result.btcDominance,
            btcDomChange: result.btcDomChange,
            usdtDominance: result.usdtDominance,
            usdtDomChange: result.usdtDomChange,
            othersDominance: result.othersDominance,
            othersDomChange: result.othersDomChange,
            dxyValue: result.dxyValue,
            dxyChange: result.dxyChange,
            marketFlow: result.marketFlow,
            
            // Capital Engine
            capitalPhase: result.capitalPhase,
            signalFreshness: result.signalFreshness,
            decayFactor: result.decayFactor,
            timeValid: result.timeValid,
            
            // System Health
            whaleTrust: result.whaleTrust,
            consecutiveLosses: result.consecutiveLosses,
            deathRisk: result.deathRisk,
            systemRestMode: result.systemRestMode,
            metaAllow: result.metaAllow,
            
            // Dashboard
            confluenceText: result.confluenceText,
            confluenceColor: result.confluenceColor,
            
            // Legacy / Helper fields
            f4Signal: result.signal || 'NEUTRAL',
            actionRecommendation: result.systemDecision
        };

        // Trigger system-managed SL/TP monitoring (Virtual)
        // Fire and forget - don't block the UI response
        monitorSmartTrades().catch(err => console.error('[IndicatorAPI] Monitor Error:', err));

        return NextResponse.json(payload);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown Server Error';
        console.error('F4 Exception:', error);
        return NextResponse.json({ error: 'SERVER_EXCEPTION', message }, { status: 500 });
    }
}
