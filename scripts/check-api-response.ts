import { MatrixV3Engine } from '../src/lib/matrix-v3-engine';

async function checkApiResponse() {
    console.log('--- Checking Matrix V3 API Response Structure ---');
    try {
        // Mock data fetching if real API fails in script context, or try real if possible
        // For accurate test, we'd need real data, but let's see if we can use the engine directly
        
        // Synthetic data for structure check
        const closes = Array(100).fill(50000).map((p, i) => p + i * 10);
        const highs = closes.map(c => c + 50);
        const lows = closes.map(c => c - 50);
        const volumes = Array(100).fill(100).map((v, i) => i === 90 ? 500 : 100); // Whale spike

        const engine = new MatrixV3Engine();
        const result = engine.analyze(closes, highs, lows, volumes);

        const apiResponse = {
            symbol: 'BTCUSDT',
            interval: '1h',
            timestamp: Date.now(),
            currentPrice: closes[closes.length - 1],
            f4Slope: result.slope,
            f4Acceleration: result.acceleration,
            whaleDetected: result.whaleDetected,
            trend: result.trend,
            signal: result.signal,
            f4Signal: result.signal,
            smcStructure: 'NEUTRAL',
            confluenceScore: 85,
            actionRecommendation: result.signal === 'BUY' ? 'LONG' : 'SHORT'
        };

        console.log(JSON.stringify(apiResponse, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

checkApiResponse();
