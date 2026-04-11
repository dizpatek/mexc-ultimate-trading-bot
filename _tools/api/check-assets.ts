import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

async function run() {
  const { sql } = await import('../src/lib/postgres');
  
  console.log('📊 TEST CÜZDAN VARLIK ANALİZİ\n');
  
  // 1. Simülatör portföyü (test mode)
  const portfolio = await sql`SELECT symbol, balance FROM portfolio WHERE type = 'SIMULATOR' AND balance > 0 ORDER BY balance DESC`;
  console.log('=== Simülatör Portföy (portfolio tablosu) ===');
  for (const row of portfolio.rows) {
    console.log(`  ${row.symbol}: ${Number(row.balance).toFixed(4)}`);
  }
  
  // 2. Aktif Smart Trade'lerdeki semboller
  const trades = await sql`SELECT DISTINCT symbol FROM orders WHERE status IN ('FILLED', 'ACTIVE', 'OPEN') AND trading_mode = 'test'`;
  console.log('\n=== Aktif Test İşlemleri (orders tablosu) ===');
  for (const row of trades.rows) {
    console.log(`  ${row.symbol}`);
  }

  // 3. Bot config'te kaydedilmiş ar_symbols
  const config = await sql`SELECT timeframe_settings FROM bot_configs WHERE id = 1`;
  if (config.rows.length > 0) {
    const ts = config.rows[0].timeframe_settings;
    console.log('\n=== Bot Config - AutoResearch Symbols ===');
    console.log(`  ar_symbols: ${JSON.stringify(ts?.ar_symbols)}`);
    console.log(`  ar_timeframe: ${ts?.ar_timeframe}`);
    console.log(`  ar_is_running: ${ts?.ar_is_running}`);
  }
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
