import { MatrixV5Engine } from './matrix-v5-engine';

/**
 * LOGIC VERIFICATION SCRIPT
 * Checks if the engine maintains coherence between Prediction and Decision.
 */

async function testLogic() {
    const engine = new MatrixV5Engine();
    
    // Create dummy historical data
    const closes = Array(100).fill(50000).map((v, i) => v + (Math.sin(i / 10) * 1000));
    const highs = closes.map(c => c + 50);
    const lows = closes.map(c => c - 50);
    const volumes = Array(100).fill(100);

    console.log("=== MATRIX V5 LOGIC COHERENCE TEST ===\n");

    // Case 1: Standard Normal Market (Testing thresholds)
    const res = engine.analyze(closes, highs, lows, volumes, "1h", "normal");
    
    console.log(`Interval: 1h, Risk: Normal`);
    console.log(`Prediction: ${res.prediction.text} (${res.prediction.upProb.toFixed(1)}% UP)`);
    console.log(`Confluence: ${res.confluenceScore.toFixed(1)}`);
    console.log(`Decision: ${res.systemDecision}`);
    
    const isCoherent = (res.systemDecision === 'WAIT' && res.prediction.text === 'YATAY') || 
                       (res.systemDecision === 'GO_LONG' && res.prediction.text === 'YUKARI 📈') ||
                       (res.systemDecision === 'GO_SHORT' && res.prediction.text === 'AŞAĞI 📉') ||
                       (res.prediction.upProb > 75 || res.prediction.downProb > 75); // High confidence bypass

    if (isCoherent) {
        console.log("✅ LOGIC COHERENT");
    } else {
        console.log("❌ LOGIC CONFLICT DETECTED!");
    }

    // Case 2: Extreme Mode
    const resExt = engine.analyze(closes, highs, lows, volumes, "1h", "aggressive");
    console.log(`\nInterval: 1h, Risk: EXTREME`);
    console.log(`Prediction: ${resExt.prediction.text} (${resExt.prediction.upProb.toFixed(1)}% UP)`);
    console.log(`Decision: ${resExt.systemDecision}`);
}

testLogic().catch(console.error);
