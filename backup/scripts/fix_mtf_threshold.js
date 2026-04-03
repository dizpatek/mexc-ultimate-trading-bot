const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function fixMtf() {
  const r = await pool.query(
    `UPDATE bot_configs SET pilot_mtf_long_threshold = 20, pilot_mtf_short_threshold = 20, updated_at = ${Date.now()} WHERE user_id = 1 RETURNING pilot_mtf_long_threshold, pilot_mtf_short_threshold`
  );
  console.log('MTF Threshold guncellendi:', JSON.stringify(r.rows[0]));
  await pool.end();
}
fixMtf();
