import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getDbUrl() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  for (const line of env.split('\n')) {
    if (line.startsWith('POSTGRES_URL=')) {
        let url = line.split('=')[1].trim();
        if (url.startsWith('"')) url = url.slice(1, -1);
        if (!url.includes('sslmode=')) url += '?sslmode=require';
        return url;
    }
  }
}

const pool = new Pool({ 
  connectionString: getDbUrl() || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`SELECT * FROM bot_configs WHERE id = 1`);
    console.log("=== BOT CONFIG ===");
    console.log(JSON.stringify(res.rows[0], null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
