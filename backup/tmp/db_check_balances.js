require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Checking balances for user 1 (mode: test)...");
  const balances = await pool.query("SELECT * FROM balances WHERE user_id = 1 AND trading_mode = 'test'");
  console.table(balances.rows.map(b => ({ asset: b.asset, free: b.free, locked: b.locked })));

  console.log("\nChecking recent system logs (last 50)...");
  const logs = await pool.query("SELECT type, msg, created_at FROM system_logs ORDER BY created_at DESC LIMIT 50");
  console.table(logs.rows.map(l => ({ 
    type: l.type, 
    msg: l.msg ? l.msg.substring(0, 80) : "",
    created_at: new Date(Number(l.created_at)).toISOString()
  })));

  await pool.end();
}

run().catch(console.error);
