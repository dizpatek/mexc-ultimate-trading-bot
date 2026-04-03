const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

// Read directly to bypass double quotes or other shell weirdness
const env = dotenv.parse(fs.readFileSync('.env.local'));
const connectionString = env.DATABASE_URL.replace(/\"/g, '');

console.log('Testing connection to:', connectionString.split('@')[1]);

const pool = new Pool({ 
  connectionString,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ SUCCESS! Database connected at:', res.rows[0].now);
    
    // Check if tables are being created by the main app
    const tables = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(`Current table count in public schema: ${tables.rows[0].count}`);
    
  } catch (err) {
    console.error('❌ CONNECTION FAILED:', err.message);
  } finally {
    await pool.end();
  }
}

test();
