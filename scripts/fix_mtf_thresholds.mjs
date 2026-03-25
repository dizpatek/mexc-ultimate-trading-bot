import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Mevcut değerleri göster
const before = await pool.query(`SELECT user_id, pilot_mtf_long_threshold, pilot_mtf_short_threshold FROM bot_configs`);
console.log("ÖNCE:");
before.rows.forEach(r => console.log(`  user_id=${r.user_id} | long=${r.pilot_mtf_long_threshold} | short=${r.pilot_mtf_short_threshold}`));

// Yeni ölçeğe göre: eski 0-100 skala değerlerini tespit et (>=25 olması eski format demek değil)
// user_id=1 long=50: bu yeni slider'dan gelmiş (+50 boğa eşiği) — makul ama katı. Değiştirme.
// Güvenli kural: pilot_mtf_long_threshold > 30 ise eski formattan geliyor → 20 yap
// pilot_mtf_short_threshold > 30 ise eski formattan geliyor → 20 yap
const upd = await pool.query(`
  UPDATE bot_configs SET
    pilot_mtf_long_threshold = CASE WHEN pilot_mtf_long_threshold > 30 THEN 20 ELSE pilot_mtf_long_threshold END,
    pilot_mtf_short_threshold = CASE WHEN pilot_mtf_short_threshold > 30 THEN 20 ELSE pilot_mtf_short_threshold END
  RETURNING user_id, pilot_mtf_long_threshold, pilot_mtf_short_threshold
`);
console.log("\nSONRA:");
upd.rows.forEach(r => console.log(`  user_id=${r.user_id} | long=+${r.pilot_mtf_long_threshold} | short=-${r.pilot_mtf_short_threshold}`));

await pool.end();
console.log("\n✅ DB eşikleri yeni ölçeğe güncellendi.");
