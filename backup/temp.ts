import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT id, symbol, status, side, created_at, meta::jsonb->>'source' as source 
      FROM orders 
      WHERE symbol LIKE '%VISTA%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log("LAST 10 VISTA ORDERS:");
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
