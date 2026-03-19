const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    console.log('--- GLOBAL 20 LAST SIGNALS ---');
    const res = await pool.query(`
      SELECT symbol, signal_type, timeframe, timestamp, veto_reason, execution_result, price
      FROM strategy_signals
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    
    res.rows.forEach(row => {
      console.log(`[${row.timestamp}] ${row.symbol} | ${row.signal_type} @ ${row.price} (${row.timeframe})`);
      console.log(`Veto: ${row.veto_reason || 'NONE'}`);
      console.log(`Execution: ${JSON.stringify(row.execution_result)}`);
      console.log('---');
    });

    console.log('\n--- GLOBAL 20 LAST SYSTEM LOGS ---');
    const logs = await pool.query(`
      SELECT level, message, details, timestamp
      FROM system_logs
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    logs.rows.forEach(log => {
      console.log(`[${log.timestamp}] ${log.level}: ${log.message}`);
      console.log(`Details: ${log.details}`);
      console.log('---');
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
