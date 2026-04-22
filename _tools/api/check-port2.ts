import { sql } from '../../src/lib/postgres';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function check() {
  const users = await sql`SELECT id, username FROM users`;
  console.log("Users:", users.rows);
  const ports = await sql`SELECT user_id, asset, free FROM portfolio`;
  console.log("Portfolio:", ports.rows);
  const tradeHist = await sql`SELECT COUNT(*) FROM trade_history`;
  console.log("TradeHistory Count:", tradeHist.rows[0]);
  process.exit(0);
}
check().catch(console.error);
