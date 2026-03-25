const pg = require('pg');
const bcrypt = require('bcryptjs');

const DB_URL = "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require";

(async () => {
  const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    const hash = await bcrypt.hash('123456', 10);
    const now = Date.now();
    
    // Create User
    const res = await pool.query(`
      INSERT INTO users (username, email, password_hash, created_at, updated_at, is_admin)
      VALUES ('test_user', 'test@mexc.com', $1, $2, $2, false)
      ON CONFLICT (email) DO UPDATE SET password_hash = $1
      RETURNING id
    `, [hash, now]);
    
    const userId = res.rows[0].id;
    
    // Init settings just in case
    await pool.query(`
      INSERT INTO bot_configs (user_id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, pilot_timeframe, updated_at) 
      VALUES ($1, 10, 1.8, 65, false, false, '4h', $2) 
      ON CONFLICT (user_id) DO NOTHING
    `, [userId, now]);

    console.log('Test hesabı hazır!');
  } catch (err) {
    console.error('Hata:', err);
  } finally {
    await pool.end();
  }
})();
