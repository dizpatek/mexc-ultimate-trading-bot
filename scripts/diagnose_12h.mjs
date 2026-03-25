/**
 * 12 Saatlik Kapsamlı Sinyal Tanı Scripti
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const NOW = Date.now();
const H12 = NOW - 12 * 60 * 60 * 1000;
const H1  = NOW - 60 * 60 * 1000;

function ts(ms) {
  return new Date(parseInt(ms)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("📊 TAM TANI RAPORU — Son 12 Saat");
  console.log(`Aralık: ${new Date(H12).toLocaleString("tr-TR")} → ${new Date(NOW).toLocaleString("tr-TR")}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1) Pilot Config
  const cfg = await pool.query(`
    SELECT pilot_timeframe, pilot_mode, pilot_mtf_veto,
           pilot_mtf_long_threshold, pilot_mtf_short_threshold,
           auto_trade, pilot_only_holdings, ai_threshold,
           f4_multiplier, pilot_mtf_threshold
    FROM bot_configs WHERE user_id = 1
  `);
  if (cfg.rows.length > 0) {
    const c = cfg.rows[0];
    console.log("--- [1] Pilot Konfigürasyon ---");
    console.log(`  TF: ${c.pilot_timeframe} | Mod: ${c.pilot_mode} | AutoTrade: ${c.auto_trade} | SadecePF: ${c.pilot_only_holdings}`);
    console.log(`  MTF Veto: ${c.pilot_mtf_veto} | LONG Eşik: +${c.pilot_mtf_long_threshold} | SHORT Eşik: -${c.pilot_mtf_short_threshold}`);
    console.log(`  AI Eşik: ${c.ai_threshold} | F4 Çarpan: ${c.f4_multiplier} | MTF Küresel Eşik: ${c.pilot_mtf_threshold}`);
  }

  // 2) 12 saat toplam
  const total = await pool.query(`
    SELECT COUNT(*) as all_cnt,
           SUM(CASE WHEN executed THEN 1 ELSE 0 END) as executed_cnt,
           SUM(CASE WHEN NOT executed THEN 1 ELSE 0 END) as blocked_cnt,
           COUNT(DISTINCT symbol) as symbols
    FROM strategy_signals WHERE timestamp > $1
  `, [H12]);
  const t = total.rows[0];
  console.log(`\n--- [2] 12 Saat Özeti ---`);
  console.log(`  Toplam Sinyal : ${t.all_cnt}`);
  console.log(`  Açılan        : ${t.executed_cnt}`);
  console.log(`  Engellenen    : ${t.blocked_cnt}`);
  console.log(`  Sembol Sayısı : ${t.symbols}`);
  
  const expectedRounds = Math.round(12 * 60 / 15);
  const expectedSignals = expectedRounds * parseInt(t.symbols || 11);
  console.log(`  BEKLENEN      : ~${expectedRounds} tur × ${t.symbols || 11} sembol ≈ ${expectedSignals} sinyal`);

  // 3) Saatlik dağılım
  const hourly = await pool.query(`
    SELECT 
      date_trunc('hour', to_timestamp(timestamp::float / 1000)) AS saat,
      COUNT(*) as cnt,
      SUM(CASE WHEN executed THEN 1 ELSE 0 END) as acilan
    FROM strategy_signals WHERE timestamp > $1
    GROUP BY saat ORDER BY saat
  `, [H12]);
  console.log(`\n--- [3] Saatlik Dağılım ---`);
  if (hourly.rows.length === 0) {
    console.log("  ❌ Hiç sinyal yok! Cron çalışmıyor ya da strategy_signals tablosu başka.");
  } else {
    hourly.rows.forEach(r => {
      const saat = new Date(r.saat).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
      const bar = "▓".repeat(Math.min(parseInt(r.cnt), 30));
      console.log(`  ${saat} ${bar.padEnd(30)} ${r.cnt} sinyal, ${r.acilan} açıldı`);
    });
  }

  // 4) Veto nedenleri
  const vetos = await pool.query(`
    SELECT veto_reason, COUNT(*) as cnt
    FROM strategy_signals
    WHERE timestamp > $1 AND executed = false AND veto_reason IS NOT NULL AND veto_reason != ''
    GROUP BY veto_reason ORDER BY cnt DESC LIMIT 10
  `, [H12]);
  console.log(`\n--- [4] Veto Nedenleri (12h) ---`);
  if (vetos.rows.length === 0) {
    console.log("  Kayıtlı veto yok.");
  } else {
    vetos.rows.forEach(r => {
      console.log(`  [${String(r.cnt).padStart(4)}x] ${String(r.veto_reason).substring(0, 100)}`);
    });
  }

  // 5) Sembol başına tam özet
  const bySym = await pool.query(`
    SELECT symbol,
           COUNT(*) as cnt,
           SUM(CASE WHEN executed THEN 1 ELSE 0 END) as acilan,
           MAX(timestamp) as son,
           STRING_AGG(DISTINCT signal_type, ',') as tipler,
           STRING_AGG(DISTINCT veto_reason, ' | ') FILTER (WHERE veto_reason IS NOT NULL AND veto_reason != '') as vetolar
    FROM strategy_signals WHERE timestamp > $1
    GROUP BY symbol ORDER BY cnt DESC LIMIT 20
  `, [H12]);
  console.log(`\n--- [5] Sembol Başına (12h) ---`);
  bySym.rows.forEach(r => {
    const son = ts(r.son);
    console.log(`  ${String(r.symbol).padEnd(14)} → ${r.cnt} sinyal | ${r.acilan} açıldı | Son:${son} | ${r.tipler}`);
    if (r.vetolar) console.log(`    ❌ ${String(r.vetolar).substring(0, 120)}`);
  });

  // 6) Son 1 saatte sinyal var mı?
  const recnt = await pool.query(`SELECT COUNT(*) as c FROM strategy_signals WHERE timestamp > $1`, [H1]);
  const rCount = parseInt(recnt.rows[0].c);
  console.log(`\n--- [6] Son 1 Saat ---`);
  if (rCount === 0) {
    console.log("  ⚠️  Son 1 saatte HİÇ sinyal yok! Scanner/cron durmuş olabilir.");
  } else {
    console.log(`  ✅ ${rCount} sinyal var.`);
  }

  // 7) Aktif smart trades
  const trades = await pool.query(`
    SELECT symbol, side, status, entry_price, created_at, meta::text as meta
    FROM smart_trades WHERE user_id = 1 AND status IN ('PENDING','FILLED','OPEN','ACTIVE')
    ORDER BY created_at DESC LIMIT 20
  `);
  console.log(`\n--- [7] Aktif İşlemler (${trades.rows.length} adet) ---`);
  if (trades.rows.length === 0) {
    console.log("  Aktif işlem yok.");
  } else {
    trades.rows.forEach(t => {
      const meta = JSON.parse(t.meta || '{}');
      const ai = meta?.aiScore ?? meta?.payload?.aiScore ?? '?';
      const mode = meta?.mode || '?';
      const dt = new Date(t.created_at).toLocaleString("tr-TR");
      console.log(`  ${t.symbol.padEnd(14)} [${mode}/${t.side}] | Entry: ${t.entry_price} | AI:${ai} | ${dt}`);
    });
  }

  // 8) Kapanmış işlemler ve P&L
  const closed = await pool.query(`
    SELECT symbol, side, entry_price::float, close_price::float, meta::text as meta, closed_at
    FROM smart_trades WHERE user_id = 1 AND status IN ('CLOSED','STOPPED','DONE')
    ORDER BY COALESCE(closed_at, created_at) DESC LIMIT 10
  `);
  console.log(`\n--- [8] Son Kapanan İşlemler ---`);
  if (closed.rows.length === 0) {
    console.log("  Kapanan işlem yok.");
  } else {
    let totPnl = 0;
    closed.rows.forEach(t => {
      const meta = JSON.parse(t.meta || '{}');
      const exitReason = meta?.exitReason || '?';
      const ep = parseFloat(t.entry_price) || 0;
      const cp = parseFloat(t.close_price) || ep;
      const pnl = t.side === 'SELL' ? ((ep - cp) / ep * 100) : ((cp - ep) / ep * 100);
      totPnl += pnl;
      const icon = pnl >= 0 ? '✅' : '❌';
      console.log(`  ${icon} ${t.symbol.padEnd(14)} | ${t.side} | P&L: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% | Neden: ${String(exitReason).substring(0, 50)}`);
    });
    console.log(`  TOPLAM P&L: ${totPnl >= 0 ? '+' : ''}${totPnl.toFixed(2)}%`);
  }

  // 9) system_events son 20
  const sysev = await pool.query(`
    SELECT type, title, description, created_at FROM system_events
    WHERE user_id = 1 AND created_at > NOW() - INTERVAL '12 hours'
    ORDER BY created_at DESC LIMIT 20
  `);
  console.log(`\n--- [9] Son Sistem Olayları (12h, ${sysev.rows.length} adet) ---`);
  sysev.rows.forEach(e => {
    const t = new Date(e.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    console.log(`  ${t} [${e.type}] ${String(e.title).substring(0, 50)} | ${String(e.description || '').substring(0, 80)}`);
  });

  console.log("\n═══════════════════════════════════════════════════════════════\n");
  await pool.end();
}

main().catch(e => { console.error("❌ HATA:", e.message); process.exit(1); });
