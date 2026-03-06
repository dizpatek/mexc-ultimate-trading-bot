import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE orders 
      SET meta = jsonb_set(meta::jsonb, '{smartTrade}', 'true') 
      WHERE status IN ('FILLED', 'PENDING', 'CLOSED') 
      AND (meta::jsonb->>'smartTrade') IS NULL
    `);
    console.log('Updated rows:', res.rowCount);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

run();
