
// Use absolute paths to avoid issues
const path = require('path');
const mexcWrapperPath = path.resolve(__dirname, 'src/lib/mexc-wrapper.ts');
// We need to use ts-node or just require the JS if it-s compiled, 
// but since I'm in a Next.js project, I'll use a simpler script to query the DB directly
// as mexc-wrapper might have many dependencies.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function check() {
  try {
    const res = await pool.query('SELECT symbol, balance FROM portfolio WHERE user_id = 1 AND type = \'SIMULATOR\'');
    console.log('Portfolio (Simulator):', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
