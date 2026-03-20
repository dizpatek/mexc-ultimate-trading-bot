import { sql } from './src/lib/postgres';

async function run() {
  try {
    const signals = await sql`
      SELECT id, symbol, side, signal_type, timestamp, executed, veto_reason, payload 
      FROM strategy_signals 
      WHERE (symbol = 'BNBUSDT' OR symbol = 'DOTUSDT')
      ORDER BY id DESC LIMIT 20
    `;
    console.log(JSON.stringify(signals, null, 2));
  } catch (e: any) {
    console.error('Query failed:', e.message);
  }
}

run();
