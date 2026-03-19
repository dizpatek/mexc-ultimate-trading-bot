const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    console.log('--- Strategy Signals Full Details for XRPUSDT ---');
    const res = await pool.query(`
      SELECT *
      FROM strategy_signals
      WHERE symbol = 'XRPUSDT'
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    console.log(JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
