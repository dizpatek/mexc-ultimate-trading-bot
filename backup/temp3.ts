import { sql } from './src/lib/postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  try {
    const { rows } = await sql`
      SELECT id, symbol, status, side, created_at, trading_mode, 
             meta::jsonb->>'smartTrade' as smart_trade, 
             meta::jsonb->>'tradeState' as state,
             meta::jsonb->>'source' as source
      FROM orders 
      WHERE symbol LIKE '%VISTA%' 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
