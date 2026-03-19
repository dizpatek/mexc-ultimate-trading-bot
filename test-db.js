
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/mexc_bot'
});

async function check() {
  try {
    const signals = await pool.query('SELECT count(*) FROM strategy_signals');
    console.log('Total Signals:', signals.rows[0].count);
    
    const lastSignals = await pool.query('SELECT id, symbol, signal_type, timestamp FROM strategy_signals ORDER BY timestamp DESC LIMIT 5');
    console.log('Last 5 Signals:', JSON.stringify(lastSignals.rows, null, 2));

    const lastLogs = await pool.query('SELECT id, message, timestamp FROM system_logs ORDER BY timestamp DESC LIMIT 5');
    console.log('Last 5 Logs:', JSON.stringify(lastLogs.rows, null, 2));

  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

check();
