import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const H12 = Date.now() - 12 * 60 * 60 * 1000;

// 1. Kolonları listele
const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='strategy_signals' ORDER BY ordinal_position`);
console.log("KOLONLAR:", cols.rows.map(r=>r.column_name).join(', '));

// 2. Son açılan sinyal örneği (tüm alanlar)
const sample = await pool.query(`SELECT * FROM strategy_signals WHERE executed=true ORDER BY timestamp DESC LIMIT 1`);
if (sample.rows[0]) {
  const r = sample.rows[0];
  console.log("\nSON AÇILAN SİNYAL:");
  Object.keys(r).forEach(k => {
    const v = r[k];
    if (v !== null && String(v).length < 200) console.log(`  ${k}: ${v}`);
  });
}

// 3. Bot config
const cfg = await pool.query(`SELECT user_id, pilot_mtf_long_threshold, pilot_mtf_short_threshold FROM bot_configs WHERE user_id=1`);
console.log("\nBOT CONFIG (user_id=1):", JSON.stringify(cfg.rows[0]));

// 4. Son 12 saatte açılan ve engellenenlerin özeti
const summ = await pool.query(`
  SELECT executed, signal_type, COUNT(*) as cnt
  FROM strategy_signals WHERE timestamp > $1 AND user_id=1
  GROUP BY executed, signal_type ORDER BY executed DESC, cnt DESC
`, [H12]);
console.log("\nSON 12S ÖZET:");
summ.rows.forEach(r => console.log(`  [${r.executed?'AÇILDI':'ENGEL'}] ${r.signal_type}: ${r.cnt}`));

// 5. Veto nedenleri (ilk 100 karakter)
const vetos = await pool.query(`
  SELECT veto_reason, COUNT(*) as cnt FROM strategy_signals
  WHERE timestamp > $1 AND executed=false AND veto_reason IS NOT NULL AND veto_reason!=''
  GROUP BY veto_reason ORDER BY cnt DESC LIMIT 8
`, [H12]);
console.log("\nVETO NEDENLERİ:");
vetos.rows.forEach(r => console.log(`  [${r.cnt}x] ${String(r.veto_reason).substring(0,110)}`));

await pool.end();
