
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function check() {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const configExists = tables.rows.some(r => r.table_name === 'bot_config');
    if (configExists) {
      const config = await pool.query('SELECT * FROM bot_config LIMIT 1');
      console.log('Bot Config:', JSON.stringify(config.rows[0], null, 2));
    } else {
      console.log('bot_config table not found');
    }

  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

check();
