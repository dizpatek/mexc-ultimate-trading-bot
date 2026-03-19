import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://antigravity:antigravity@localhost:5432/antigravity"
});

async function main() {
  try {
    const { rows } = await pool.query(`
      SELECT id, symbol, status, created_at, meta 
      FROM orders 
      WHERE symbol = 'AVAXUSDT' 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    rows.forEach(row => {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      const createdAt = Number(row.created_at);
      const dateStr = isNaN(createdAt) ? 'Invalid Date' : new Date(createdAt).toISOString();
      console.log(`ID: ${row.id} | Status: ${row.status} | Time: ${dateStr}`);
      console.log(`SL: ${meta.payload?.stopLoss?.price} | TP: ${meta.payload?.takeProfit?.price}`);
      console.log(`ActiveSL: ${meta.activeStopLoss} | ActiveTP: ${meta.activeTakeProfit}`);
      console.log('---');
    });
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
