import { MatrixV5Strategy } from './src/lib/strategies';
import { getKlines } from './src/lib/market-data';

async function test() {
  const symbol = 'XRPUSDT';
  const strategy = new MatrixV5Strategy(symbol, {
    timeframe: '1m',
    minAiScore: 65,
    mtfThreshold: 50
  });

  console.log(`--- Testing Strategy Analysis for ${symbol} ---`);
  try {
    const result = await strategy.analyze();
    if (!result) {
      console.log('No signal generated (result is null).');
    } else {
      console.log('Signal:', result.signal);
      console.log('Reason:', result.reason);
      console.log('Indicators:', JSON.stringify(result.indicators, null, 2));
    }
  } catch (err) {
    console.error('Analysis failed:', err);
  }
}

test();
