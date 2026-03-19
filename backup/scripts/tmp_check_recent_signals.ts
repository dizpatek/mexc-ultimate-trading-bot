import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function checkSignals() {
  try {
    const res = await pool.query(`
      SELECT symbol, timeframe, signal_type, ai_score, executed, veto_reason, created_at 
      FROM strategy_signals 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    console.log('--- SON 20 SİNYAL ---');
    console.table(res.rows);
  } catch (err) {
    console.error('Sinyal kontrol hatası:', err);
  } finally {
    await pool.end();
  }
}

checkSignals();
