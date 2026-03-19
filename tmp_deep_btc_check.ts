import { MatrixV5Engine } from './src/lib/matrix-v5-engine.ts';
import { fetchKlines } from './src/lib/mexc.ts';

async function deepCheck() {
  try {
    const symbol = "BTCUSDT";
    const timeframe = "1m";
    const klines = await fetchKlines(symbol, timeframe, 500);
    
    if (!klines || klines.length < 100) {
      console.log("Klines çekilemedi veya yetersiz.");
      return;
    }

    const engine = new MatrixV5Engine();
    
    const opens = klines.map(k => parseFloat(String(k[1])));
    const highs = klines.map(k => parseFloat(String(k[2])));
    const lows = klines.map(k => parseFloat(String(k[3])));
    const closes = klines.map(k => parseFloat(String(k[4])));
    const volumes = klines.map(k => parseFloat(String(k[5])));

    const result = engine.analyze(
      closes,
      highs,
      lows,
      volumes,
      timeframe,
      "normal",
      0,
      { tradeMode: "Scalp", mtfThreshold: 80 },
      opens
    );

    console.log("--- BTC Deep Indicators (1m) ---");
    console.log("AI Score:", result.aiScore);
    console.log("F4 Power:", result.f4Power);
    console.log("F4 Power Loss:", result.f4PowerLoss);
    console.log("Early Buy/Sell:", result.f4EarlyBuy, "/", result.f4EarlySell);
    console.log("Confirmed Buy/Sell:", result.f4ConfirmedBuy, "/", result.f4ConfirmedSell);
    console.log("Signal Type:", result.signal);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

deepCheck();
