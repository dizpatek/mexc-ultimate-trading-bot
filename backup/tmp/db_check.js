require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found in .env");
  process.exit(1);
}

const pool = new Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Checking last 10 orders from pilot_auto...");
  const orders = await pool.query(`
    SELECT id, symbol, side, status, price, qty, meta->>'source' as source, created_at 
    FROM orders 
    WHERE meta::jsonb->>'source' = 'pilot_auto' 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  console.table(orders.rows);

  console.log("\nChecking last 5 orders from ANY source...");
  const anyOrders = await pool.query(`
    SELECT id, symbol, side, status, price, qty, meta->>'source' as source, created_at 
    FROM orders 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  console.table(anyOrders.rows);

  console.log("\nChecking system logs for today's errors...");
  const logs = await pool.query(`
    SELECT type, msg, created_at 
    FROM system_logs 
    ORDER BY created_at DESC 
    LIMIT 30
  `);
  console.table(logs.rows.map(l => ({ 
    type: l.type, 
    msg: l.msg ? l.msg.substring(0, 100) : "",
    created_at: new Date(Number(l.created_at)).toISOString()
  })));

  await pool.end();
}

run().catch(console.error);
