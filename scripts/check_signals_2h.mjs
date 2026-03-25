/**
 * Son 2 saatlik sinyal denetimi
 * Kullanım: node scripts/check_signals_2h.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TWO_HOURS_AGO = Date.now() - 2 * 60 * 60 * 1000;
const THIRTY_MIN_AGO = Date.now() - 30 * 60 * 1000;

async function main() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("📊 SİNYAL DENETİMİ (Son 2 Saat)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Başlangıç: ${new Date(TWO_HOURS_AGO).toLocaleTimeString("tr-TR")} | Bitiş: ${new Date().toLocaleTimeString("tr-TR")}\n`);

  // 1) Toplam
  const totals = await pool.query(`
    SELECT signal_type, executed, COUNT(*) as cnt, COUNT(DISTINCT symbol) as unique_symbols
    FROM strategy_signals
    WHERE timestamp > $1
    GROUP BY signal_type, executed
    ORDER BY cnt DESC
  `, [TWO_HOURS_AGO]);

  console.log("--- [1] Sinyal Tipi Dağılımı ---");
  if (totals.rows.length === 0) {
    console.log("  ❌ Son 2 saatte HİÇ sinyal kaydedilmemiş!");
  } else {
    totals.rows.forEach(r => {
      const ex = r.executed ? '✅ AÇILDI' : '🚫 VETO';
      console.log(`  ${String(r.signal_type).padEnd(8)} | ${ex.padEnd(12)} | ${r.cnt} sinyal | ${r.unique_symbols} sembol`);
    });
  }

  // 2) Veto nedenleri
  const vetos = await pool.query(`
    SELECT veto_reason, COUNT(*) as cnt, COUNT(DISTINCT symbol) as sym_cnt
    FROM strategy_signals
    WHERE timestamp > $1 AND executed = false AND veto_reason IS NOT NULL AND veto_reason != ''
    GROUP BY veto_reason
    ORDER BY cnt DESC
    LIMIT 10
  `, [TWO_HOURS_AGO]);

  console.log("\n--- [2] Veto Nedenleri ---");
  if (vetos.rows.length === 0) {
    console.log("  Kayıtlı veto yok.");
  } else {
    vetos.rows.forEach(r => {
      console.log(`  [${String(r.cnt).padStart(3)}x] (${r.sym_cnt} sembol) ${String(r.veto_reason).substring(0, 90)}`);
    });
  }

  // 3) Sembol başına sinyal
  const bySymbol = await pool.query(`
    SELECT symbol, COUNT(*) as cnt,
           SUM(CASE WHEN executed THEN 1 ELSE 0 END) as acilan,
           MAX(timestamp) as son_sinyal,
           STRING_AGG(DISTINCT signal_type, ',') as tipler
    FROM strategy_signals
    WHERE timestamp > $1
    GROUP BY symbol
    ORDER BY cnt DESC
    LIMIT 20
  `, [TWO_HOURS_AGO]);

  console.log("\n--- [3] Sembol Başına Sinyal ---");
  if (bySymbol.rows.length === 0) {
    console.log("  Veri yok.");
  } else {
    bySymbol.rows.forEach(r => {
      const sonT = new Date(parseInt(r.son_sinyal)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      console.log(`  ${String(r.symbol).padEnd(14)} → ${r.cnt} sinyal | ${r.acilan} açıldı | Son:${sonT} | ${r.tipler}`);
    });
  }

  // 4) Tüm sinyaller ham liste (son 2 saat)
  const all = await pool.query(`
    SELECT symbol, signal_type, side, executed, veto_reason, timestamp
    FROM strategy_signals
    WHERE timestamp > $1
    ORDER BY timestamp DESC
    LIMIT 50
  `, [TWO_HOURS_AGO]);

  console.log(`\n--- [4] Son ${all.rows.length} Sinyal (Ham Liste) ---`);
  all.rows.forEach(r => {
    const t = new Date(parseInt(r.timestamp)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const ex = r.executed ? '✅' : '🚫';
    const veto = r.veto_reason ? ` → ${String(r.veto_reason).substring(0, 60)}` : '';
    console.log(`  ${t} ${ex} ${String(r.symbol).padEnd(12)} [${r.signal_type}/${r.side || '?'}]${veto}`);
  });

  // 5) Pilot config
  const config = await pool.query(`
    SELECT pilot_timeframe, pilot_mtf_veto, pilot_mtf_long_threshold, 
           pilot_mtf_short_threshold, auto_trade, pilot_mode, pilot_only_holdings
    FROM bot_configs WHERE user_id = 1
  `);
  console.log("\n--- [5] Pilot Ayarları ---");
  if (config.rows.length > 0) {
    const c = config.rows[0];
    console.log(`  TF:${c.pilot_timeframe} | Mod:${c.pilot_mode} | AutoTrade:${c.auto_trade} | SadecePF:${c.pilot_only_holdings}`);
    console.log(`  MTF Veto:${c.pilot_mtf_veto} | Long:>%${c.pilot_mtf_long_threshold} | Short:<%${c.pilot_mtf_short_threshold}`);
  }

  // 6) Son 30 dakika
  const recent = await pool.query(`SELECT COUNT(*) as cnt FROM strategy_signals WHERE timestamp > $1`, [THIRTY_MIN_AGO]);
  const recentCnt = parseInt(recent.rows[0].cnt);
  console.log(`\n--- [6] Son 30 Dakika: ${recentCnt === 0 ? "⚠️  HİÇ sinyal yok! Cron durmuş olabilir." : recentCnt + " sinyal ✅"} ---`);

  console.log("\n═══════════════════════════════════════════════════════\n");
  await pool.end();
}

main().catch(e => {
  console.error("❌ SCRIPT HATASI:", e.message);
  process.exit(1);
});
