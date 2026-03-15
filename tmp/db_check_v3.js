require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Checking simulated balances from system_settings...");
  const settings = await pool.query("SELECT * FROM system_settings WHERE key = 'SIMULATED_BALANCES' AND user_id = 1");
  if (settings.rows[0]) {
    const balances = JSON.parse(settings.rows[0].value);
    console.table(balances.map(b => ({ asset: b.asset, free: b.free, locked: b.locked })));
  } else {
    console.log("No SIMULATED_BALANCES found in system_settings.");
  }

  console.log("\nChecking last 5 pilot order logs from DB...");
  const orders = await pool.query(`
    SELECT id, symbol, side, status, price, qty, meta::jsonb->>'source' as source, created_at 
    FROM orders 
    WHERE meta::jsonb->>'source' = 'pilot_auto' 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.table(orders.rows);

  await pool.end();
}

run().catch(console.error);
