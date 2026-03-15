require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Checking last 5 pilot order logs from DB...");
  const orders = await pool.query(`
    SELECT id, symbol, side, status, price, qty, meta::jsonb->>'source' as source, created_at 
    FROM orders 
    WHERE meta::jsonb->>'source' = 'pilot_auto' 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.table(orders.rows);

  console.log("\nChecking simulated balances from settings...");
  const settings = await pool.query("SELECT * FROM settings WHERE key = 'SIMULATED_BALANCES' AND user_id = 1");
  if (settings.rows[0]) {
    const balances = JSON.parse(settings.rows[0].value);
    console.table(balances.map(b => ({ asset: b.asset, free: b.free, locked: b.locked })));
  } else {
    console.log("No SIMULATED_BALANCES found in settings.");
  }

  console.log("\nChecking recent system logs (last 20)...");
  const logs = await pool.query("SELECT type, msg, created_at FROM system_logs ORDER BY created_at DESC LIMIT 20");
  console.table(logs.rows.map(l => ({ 
    type: l.type, 
    msg: l.msg ? l.msg.substring(0, 100) : "",
    created_at: new Date(Number(l.created_at)).toISOString()
  })));

  await pool.end();
}

run().catch(console.error);
