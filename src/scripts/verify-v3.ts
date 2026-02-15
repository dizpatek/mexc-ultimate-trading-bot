
import { MatrixV3Engine } from '../lib/matrix-v3-engine';

// Mock Data Generator (Sine wave + Noise + Volume spikes)
function generateMockData(length: number) {
    const closes = [];
    const highs = [];
    const lows = [];
    const volumes = [];
    
    for (let i = 0; i < length; i++) {
        // Price: Sine wave with upward trend
        const trend = i * 0.1;
        const noise = Math.random() * 2;
        const price = 100 + Math.sin(i * 0.1) * 10 + trend + noise;
        
        closes.push(price);
        highs.push(price + Math.random() * 2);
        lows.push(price - Math.random() * 2);
        
        // Volume: Random with occasional spikes
        let vol = Math.random() * 100 + 50;
        if (i % 50 === 0) vol *= 5; // Whale spike
        volumes.push(vol);
    }
    
    return { closes, highs, lows, volumes };
}

async function runVerification() {
    console.log("🚀 Starting Matrix V3 Engine Verification...");
    
    const engine = new MatrixV3Engine({
        minAiScore: 60,
        whaleVolumeMultiplier: 2.0
    });
    
    // Test 1: Sufficient Data (500 candles)
    console.log("\n🧪 Test 1: Full Data Analysis (500 candles)");
    const data = generateMockData(500);
    const result = engine.analyze(data.closes, data.highs, data.lows, data.volumes);
    
    console.log("✅ Analysis Completed");
    console.log({
        trend: result.trend,
        slope: result.slope.toFixed(4),
        accel: result.acceleration.toFixed(4),
        aiScore: result.aiScore,
        whale: result.whaleDetected,
        regime: result.marketRegime,
        prediction: result.regimePrediction
    });

    if (result.aiScore < 0 || result.aiScore > 100) console.error("❌ AI Score out of bounds!");
    else console.log("✅ AI Score within bounds (0-100)");

    if (!result.aiComponents) console.error("❌ AI Components missing!");
    else console.log("✅ AI Components present");

    // Test 2: Insufficient Data
    console.log("\n🧪 Test 2: Insufficient Data Warning (<200 candles)");
    const shortData = generateMockData(100);
    engine.analyze(shortData.closes, shortData.highs, shortData.lows, shortData.volumes);
    
    console.log("\n✨ Verification Complete.");
}

runVerification().catch(console.error);
