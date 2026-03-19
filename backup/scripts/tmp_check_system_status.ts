import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function checkSystem() {
  try {
    const configRes = await pool.query(`SELECT auto_trade, pilot_only_holdings, ai_threshold, pilot_timeframe FROM bot_configs WHERE id = 1`);
    console.log('BOT_CONFIG_JSON_START');
    console.log(JSON.stringify(configRes.rows, null, 2));
    console.log('BOT_CONFIG_JSON_END');

    const logsRes = await pool.query(`
      SELECT level, message, details, to_timestamp(timestamp / 1000) as created_at 
      FROM system_logs 
      ORDER BY timestamp DESC 
      LIMIT 10
    `);
    console.log('SYSTEM_LOGS_JSON_START');
    console.log(JSON.stringify(logsRes.rows, null, 2));
    console.log('SYSTEM_LOGS_JSON_END');
  } catch (err) {
    console.error('Sistem kontrol hatası:', err);
  } finally {
    await pool.end();
  }
}

checkSystem();
