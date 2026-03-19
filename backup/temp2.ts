import { Pool } from 'pg';
import * as fs from 'fs';

function getDbUrl() {
  const env = fs.readFileSync('.env', 'utf-8');
  for (const line of env.split('\n')) {
    if (line.startsWith('POSTGRES_URL=')) return line.split('=')[1].trim();
  }
}

const pool = new Pool({ connectionString: getDbUrl() });

async function run() {
  try {
    const res = await pool.query(`SELECT id, symbol, status, side, created_at, trading_mode, meta::jsonb->>'smartTrade' as smart_trade, meta::jsonb->>'tradeState' as state FROM orders WHERE symbol LIKE '%VISTA%' ORDER BY created_at DESC LIMIT 10`);
    console.log("VISTA ORDERS:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
