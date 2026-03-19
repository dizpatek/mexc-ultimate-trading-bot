const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    console.log('--- LAST 20 NON-VETOED SIGNALS ---');
    const res = await pool.query(`
      SELECT symbol, signal_type, timeframe, timestamp, execution_result, price
      FROM strategy_signals
      WHERE veto_reason IS NULL OR veto_reason = ''
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    
    res.rows.forEach(row => {
      console.log(`[${row.timestamp}] ${row.symbol} | ${row.signal_type} @ ${row.price} (${row.timeframe})`);
      console.log(`Execution: ${JSON.stringify(row.execution_result)}`);
      console.log('---');
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
