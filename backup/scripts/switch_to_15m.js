const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function switchTo15m() {
  // Veritabanı sütunlarına uygun sorgu:
  const r1 = await pool.query(`
    UPDATE bot_configs SET 
      pilot_timeframe = '15m',
      timeframe_settings = '{}'::jsonb,
      updated_at = ${Date.now()}
    WHERE user_id = 1
    RETURNING pilot_timeframe
  `);
  console.log('DB timeframe guncellendi:', JSON.stringify(r1.rows[0]));
  await pool.end();
}
switchTo15m();
