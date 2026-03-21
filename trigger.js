const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function trigger() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const userId = 14;
    const symbol = 'BTCUSDT';
    const timestamp = Date.now();

    console.log(`🚀 Simülasyon: ${symbol} BUY (Anti-Gravity Test)...`);

    await client.query('DELETE FROM strategy_signals WHERE symbol = $1 AND user_id = $2', [symbol, userId]);
    
    await client.query(`
      INSERT INTO strategy_signals (
        user_id, symbol, timeframe, signal_type, side, price, timestamp, executed
      ) VALUES ($1, $2, '15m', 'BUY', 'BUY', 65000, $3, false)
    `, [userId, symbol, timestamp]);

    console.log('✅ Sinyal gönderildi. Botun tarama döngüsünü (30sn) bekleyin.');
  } catch (err) {
    console.error('❌ Hata:', err);
  } finally {
    await client.end();
  }
}

trigger();
