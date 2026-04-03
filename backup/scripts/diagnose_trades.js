const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require'
});

async function run() {
  try {
    const rs = await pool.query('SELECT timeframe_settings, pilot_timeframe FROM bot_configs WHERE id = 1');
    console.log(JSON.stringify(rs.rows[0], null, 2));
  } catch(e) { }
  await pool.end();
}
run();
