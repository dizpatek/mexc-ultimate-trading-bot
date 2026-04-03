const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
async function check() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bot_configs'");
    console.log('Columns:', res.rows.map(r => r.column_name).sort().join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
check();
