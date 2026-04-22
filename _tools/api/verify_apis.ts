import * as dotenv from 'dotenv';
import { sql } from '../../src/lib/postgres';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  try {
    const users = await sql`SELECT id, username FROM users WHERE username = 'admin'`;
    if (users.rows.length === 0) {
      console.log("No admin user found.");
      return;
    }
    const user = users.rows[0];
    console.log(`Verifying for user: ${user.username} (ID: ${user.id})`);

    // Verify Analysis Query
    console.log("Testing Analysis Query...");
    const historyRes = await sql`
      SELECT id, order_id, symbol, side, price, profit_loss as pnl, profit_loss_percentage as pnl_perc, created_at as closed_at
      FROM trade_history
      WHERE user_id = ${user.id} AND trading_mode = 'test'
      ORDER BY created_at DESC
      LIMIT 10
    `;
    console.log(`Found ${historyRes.rows.length} previous test trades.`);

    // Verify Active Orders Query
    console.log("Testing Active Orders Query...");
    const activeRes = await sql`
      SELECT id, symbol, side, type, price, status, created_at
      FROM orders
      WHERE user_id = ${user.id} AND trading_mode = 'test' AND status IN ('FILLED', 'ACTIVE', 'OPEN', 'PENDING')
    `;
    console.log(`Found ${activeRes.rows.length} active test orders.`);

    // Verify Portfolio Query
    console.log("Testing Portfolio Query...");
    const portfolioRes = await sql`SELECT asset, free FROM portfolio WHERE user_id = ${user.id}`;
    console.log(`Found ${portfolioRes.rows.length} portfolio items.`);

    console.log("All DB queries for APIs are VALID with current schema.");
  } catch (err: any) {
    console.error("Verification failed:", err.message);
  } finally {
    process.exit(0);
  }
}

verify();
