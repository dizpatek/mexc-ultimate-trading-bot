import { sql } from './src/lib/postgres';

async function run() {
  try {
    const signals = await sql`SELECT * FROM strategy_signals WHERE id = 1385 OR symbol = 'BNBUSDT' ORDER BY id DESC LIMIT 5`;
    console.log(JSON.stringify(signals, null, 2));
  } catch (e: any) {
    console.error('Query failed:', e.message);
  }
}

run();
