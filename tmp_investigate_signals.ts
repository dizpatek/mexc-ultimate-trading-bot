import { sql } from './src/lib/postgres.ts';

async function checkRecentSignals() {
  try {
    const now = Date.now();
    console.log(`--- En Son 10 Sinyal ---`);
    const signals = await sql`
      SELECT id, symbol, signal_type, timeframe, timestamp 
      FROM strategy_signals 
      ORDER BY id DESC
      LIMIT 10
    `;
    console.log(JSON.stringify(signals.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRecentSignals();
