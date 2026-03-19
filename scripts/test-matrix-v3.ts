
import { MatrixV5Engine } from '../src/lib/matrix-v5-engine.ts';

// Synthetic Data Generator
function generateData(length: number) {
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    let price = 100;
    let angle = 0;

    for (let i = 0; i < length; i++) {
        // Create a trend using sine wave + linear trend
        const trend = i * 0.1;
        const cycle = Math.sin(angle) * 5;
        price = 100 + trend + cycle + (Math.random() - 0.5) * 2;
        
        const volBase = 1000;
        let vol = volBase + Math.random() * 500;

        // Inject Whale Activity at specific points
        if (i === length - 5) {
            vol = volBase * 5; // Huge volume spike
        }

        closes.push(price);
        highs.push(price + Math.random());
        lows.push(price - Math.random());
        volumes.push(vol);

        angle += 0.2;
    }

    return { closes, highs, lows, volumes };
}

async function runTest() {
    console.log('--- Starting Matrix V3 Engine Test ---');
    
    const engine = new MatrixV5Engine({
        f4Length: 10,
        whaleVolumeMultiplier: 2.0,
        f4SlopeThreshold: 0.05
    });

    const data = generateData(100);
    
    console.log(`Generated ${data.closes.length} bars of data.`);
    
    // Run analysis on the full dataset
    // In a real scenario, we'd feed the window, but the engine takes full arrays and uses the last ones
    
    const result = engine.analyze(data.closes, data.highs, data.lows, data.volumes);
    
    console.log('\nAnalysis Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.whaleDetected) {
        console.log('\n[SUCCESS] Whale Detected!');
    } else {
        console.log('\n[INFO] No Whale Detected (Check threshold or data)');
    }
    
    if (result.signal) {
        console.log(`\n[SIGNAL] ${result.signal} generated based on F4 Trend & Momentum.`);
    } else {
        console.log('\n[INFO] No Signal generated.');
    }

    // Test specific scenarios
    console.log('\n--- Scenario Tests ---');
    
    // 1. Strong Bullish Trend
    const bullData = { ...data, closes: data.closes.map((p, i) => p + i * 2) }; // Steep updraft
    const bullResult = engine.analyze(bullData.closes, data.highs, data.lows, data.volumes);
    console.log(`Bullish Scenario Slope: ${bullResult.slope.toFixed(4)} (Threshold: 0.05) -> Signal: ${bullResult.signal}`);

    // 3. Quadratic Bullish Trend (Increasing Momentum)
    const quadData = { ...data, closes: data.closes.map((p, i) => p + i * i * 0.05) }; 
    const quadResult = engine.analyze(quadData.closes, data.highs, data.lows, data.volumes);
    console.log(`Quadratic Bullish Scenario Slope: ${quadResult.slope.toFixed(4)} (Threshold: 0.05) -> Signal: ${quadResult.signal}`);
}

runTest().catch(console.error);
