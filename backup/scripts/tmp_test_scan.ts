import { SignalScanner } from './src/services/SignalScanner.ts';

async function testScan() {
  try {
    const symbols = ["BTCUSDT"];
    console.log(`--- BTC Detaylı Analiz (1m) ---`);
    const results = await SignalScanner.runScan(symbols, "1m", "test");
    
    results.forEach(r => {
      console.log(`[${r.symbol}] Result: ${r.signalType} | Detail: ${r.detail}`);
    });
    
    // Manual analysis to see exact values
    const { MatrixV5Strategy } = await import('./src/lib/strategies');
    const strategy = new MatrixV5Strategy("BTCUSDT", { timeframe: "1m" });
    const analysis = await strategy.analyze();
    console.log("--- BTC Indicators ---");
    console.log(JSON.stringify(analysis?.indicators, null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Tarama Hatası:", err);
    process.exit(1);
  }
}

testScan();
