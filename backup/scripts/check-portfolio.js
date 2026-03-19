
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function check() {
  try {
    const res = await pool.query('SELECT * FROM portfolio ORDER BY id LIMIT 20');
    console.log('Portfolio entries:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('DB Error:', err);
  } finally {
    await pool.end();
  }
}

check();
