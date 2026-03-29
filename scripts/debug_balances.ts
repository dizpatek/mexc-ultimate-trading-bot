
import { sql } from './src/lib/postgres';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const res = await sql`SELECT * FROM balances WHERE user_id = 1`;
    console.log("BALANCES FOR USER 1:");
    console.log(JSON.stringify(res.rows, null, 2));
    
    const ordersRes = await sql`
      SELECT id, symbol, side, status, meta->>'source' as source, updated_at 
      FROM orders 
      WHERE user_id = 1 AND symbol LIKE '%XRP%' 
      ORDER BY updated_at DESC LIMIT 10
    `;
    console.log("\nXRP ORDERS FOR USER 1:");
    console.log(JSON.stringify(ordersRes.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
