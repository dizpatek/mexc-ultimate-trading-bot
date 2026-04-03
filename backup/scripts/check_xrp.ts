import * as dotenv from "dotenv";
import { sql } from "../src/lib/postgres";

dotenv.config();

async function check() {
  try {
    const { rows } = await sql`
      SELECT id, symbol, side, status, meta->>'source' as source, meta->>'tradeState' as state, updated_at 
      FROM orders 
      WHERE user_id = 1 AND symbol LIKE '%XRP%' 
      ORDER BY updated_at DESC LIMIT 10
    `;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
