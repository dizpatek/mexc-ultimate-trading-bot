import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function updateConfig() {
  try {
    // 1. AI Threshold'u 68'e düşür (1m için daha iyi)
    // 2. auto_trade'i true yap
    const res = await pool.query(`
      UPDATE bot_configs 
      SET ai_threshold = 68, 
          auto_trade = true,
          updated_at = extract(epoch from now()) * 1000
      WHERE id = 1
      RETURNING *
    `);
    
    console.log('--- GÜNCEL KONFİGÜRASYON ---');
    console.log(JSON.stringify(res.rows[0], null, 2));

    await pool.query(`
      INSERT INTO system_logs (user_id, level, message, details, timestamp)
      VALUES (1, 'SUCCESS', '🚀 ANTIGRAVITY OPTİMİZASYONU', 'AI Threshold 68 olarak güncellendi ve Auto-Trade zorunlu aktif edildi.', extract(epoch from now()) * 1000)
    `);

  } catch (err) {
    console.error('Güncelleme hatası:', err);
  } finally {
    await pool.end();
  }
}

updateConfig();
