import { sql } from './src/lib/postgres.ts';

async function checkTrades() {
  try {
    const trades = await sql`
      SELECT symbol FROM orders 
      WHERE status NOT IN ('CLOSED', 'CANCELED', 'REJECTED') 
      AND meta::jsonb->>'smartTrade' = 'true'
    `;
    console.log(JSON.stringify(trades.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTrades();
