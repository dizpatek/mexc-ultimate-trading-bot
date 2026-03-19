import { MatrixV5Strategy } from './src/lib/strategies/MatrixV5Strategy';
import { getBotConfig } from './src/lib/db';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function analyzeNow() {
  const config = await getBotConfig();
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  
  console.log('--- 1M ANALİZ BAŞLATILDI ---');
  console.log('AI Threshold:', config.ai_threshold);
  
  for (const symbol of symbols) {
    try {
      const strategy = new MatrixV5Strategy(symbol, {
        timeframe: '1m',
        minAiScore: config.ai_threshold || 72,
        f4Length: config.f4_length,
        mtfVeto: config.pilot_mtf_veto
      });
      
      const signal = await strategy.analyze();
      console.log(`\n[${symbol}]`);
      if (signal) {
        console.log('Sinyal:', signal.signal || 'INFO');
        console.log('AI Skor:', signal.indicators.aiScore);
        console.log('F4 Slope:', signal.indicators.f4Slope);
        console.log('Veto Reason:', signal.reason);
      } else {
        console.log('Veri yetersiz veya sinyal yok.');
      }
    } catch (err) {
      console.error(`${symbol} hata:`, err.message);
    }
  }
}

analyzeNow();
