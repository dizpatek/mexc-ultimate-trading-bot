const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/mexc_bot'
});

async function checkData() {
  console.log("--- DATABASE SIGNAL CHECK (DIAGNOSTIC) ---");
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, symbol, timeframe, signal_type, user_id, timestamp 
      FROM strategy_signals 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    
    if (rows.length === 0) {
      console.log("RESULT: No signals found in strategy_signals table.");
    } else {
      console.log("RESULT: Found " + rows.length + " recent signals.");
      console.table(rows.map(r => ({
        id: r.id,
        user: r.user_id,
        sym: r.symbol,
        tf: r.timeframe,
        type: r.signal_type,
        time: new Date(Number(r.timestamp)).toLocaleString()
      })));
      
      const distinctTfs = await client.query(`SELECT DISTINCT timeframe FROM strategy_signals`);
      console.log("Existing Timeframes in DB:", distinctTfs.rows.map(r => r.timeframe));
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkData();
