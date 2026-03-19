import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function applyOptimizations() {
    console.log("--- SINYAL AKIŞI OPTİMİZASYONU BAŞLATILDI ---");
    
    try {
        // 1. AI Threshold'u 65'e indir (1m için daha akışkan)
        // 2. pilot_only_holdings'i false yap (Tüm piyasayı tara)
        const query = `
            UPDATE bot_configs 
            SET ai_threshold = 65, 
                pilot_only_holdings = false,
                updated_at = ${Date.now()}
            WHERE id = 1
        `;
        
        const res = await pool.query(query);
        console.log("✅ Veritabanı başarıyla güncellendi. Etkilenen satır:", res.rowCount);
        
        const final = await pool.query('SELECT ai_threshold, pilot_only_holdings FROM bot_configs WHERE id = 1');
        console.log("Yeni Ayarlar:", final.rows[0]);

    } catch (err) {
        console.error("Hata:", err.message);
    } finally {
        await pool.end();
    }
}

applyOptimizations();
