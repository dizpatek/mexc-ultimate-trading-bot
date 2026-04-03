import { sql } from './src/lib/postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function triggerTestSignal() {
  const userId = 14;
  const symbol = 'BTCUSDT';
  const timestamp = Date.now();

  console.log(`🚀 Simülasyon Başlatılıyor: ${symbol} için BUY sinyali gönderiliyor...`);

  try {
    // 1. Mevcut aktif sinyalleri temizle (test için)
    await sql`DELETE FROM strategy_signals WHERE symbol = ${symbol} AND user_id = ${userId}`;

    // 2. Yeni süyal ekle
    await sql`
      INSERT INTO strategy_signals (
        user_id, symbol, timeframe, signal_type, side, price, timestamp, executed
      ) VALUES (
        ${userId}, ${symbol}, '15m', 'BUY', 'BUY', 65000, ${timestamp}, false
      )
    `;

    console.log(`✅ Sinyal veritabanına eklendi. Botun sinyali işlemesi için ~30sn bekleyin.`);
    console.log(`💡 İpucu: Bu işlemden sonra 'node scripts/toolbox.mjs asset' ile hafızayı kontrol edebilirsiniz.`);

  } catch (err) {
    console.error(`❌ Sinyal tetikleme hatası:`, err);
  }
  process.exit();
}

triggerTestSignal();
