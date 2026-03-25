/**
 * MTF-Sinyal Eşleme Denetim Scripti
 * Geçen 12 saatteki tüm sinyalleri MTF skoru ile karşılaştırır
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const NOW = Date.now();
const H12 = NOW - 12 * 60 * 60 * 1000;

function ts(ms) {
  return new Date(parseInt(ms)).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

async function main() {
  console.log("\n══════════════════════════════════════════════════════");
  console.log("🔍 MTF-SİNYAL EŞLEŞMESİ DENETİMİ — Son 12 Saat");
  console.log("══════════════════════════════════════════════════════\n");

  // 0. Mevcut pilot config
  const cfg = await pool.query(`
    SELECT pilot_mtf_long_threshold, pilot_mtf_short_threshold, pilot_mtf_veto,
           pilot_timeframe, auto_trade
    FROM bot_configs WHERE user_id = 1
  `);
  const c = cfg.rows[0] || {};
  console.log("--- [CONFIG] Aktif Pilot Ayarları ---");
  console.log(`  LONG Eşiği: +${c.pilot_mtf_long_threshold} | SHORT Eşiği: -${c.pilot_mtf_short_threshold} | MTF Veto: ${c.pilot_mtf_veto}`);
  console.log(`  TF: ${c.pilot_timeframe} | AutoTrade: ${c.auto_trade}\n`);

  // 1. Açılan sinyaller detayı (MTF skoru ile)
  const executed = await pool.query(`
    SELECT symbol, signal_type, timestamp, veto_reason,
           metadata->>'mtfScore' as mtf_score,
           metadata->>'mtfVerdict' as mtf_verdict,
           metadata->>'aiScore' as ai_score,
           metadata->>'mtfWeightedScore' as mtf_weighted
    FROM strategy_signals
    WHERE timestamp > $1 AND executed = true
    ORDER BY timestamp DESC
  `, [H12]);

  console.log(`--- [1] AÇILAN SİNYALLER (${executed.rows.length} adet) ---`);
  if (executed.rows.length === 0) {
    console.log("  Hiç açılmamış sinyal yok.");
  } else {
    for (const r of executed.rows) {
      const mtf = parseFloat(r.mtf_weighted || r.mtf_score || '0');
      const direction = r.signal_type === 'BUY' ? '📈 LONG' : '📉 COVER';
      const threshold = r.signal_type === 'BUY' ? c.pilot_mtf_long_threshold : -c.pilot_mtf_short_threshold;
      const passed = r.signal_type === 'BUY' ? (mtf >= threshold) : (mtf <= threshold);
      const icon = passed ? '✅' : '⚠️ MTF EŞLEŞME YOK';
      console.log(`  ${ts(r.timestamp)} ${r.symbol.padEnd(14)} [${direction}]`);
      console.log(`    MTF Skor: ${mtf > 0 ? '+' : ''}${mtf.toFixed(0)} | AI: ${r.ai_score} | Verdict: ${r.mtf_verdict || '-'}`);
      console.log(`    Eşik Kontrolü: ${icon} (Eşik: ${r.signal_type === 'BUY' ? '+' : '-'}${Math.abs(threshold)})`);
    }
  }

  // 2. metadata kolonunun yapısı - neyi saklıyor?
  const sampleMeta = await pool.query(`
    SELECT symbol, signal_type, timestamp, metadata
    FROM strategy_signals
    WHERE timestamp > $1 AND executed = true
    ORDER BY timestamp DESC LIMIT 3
  `, [H12]);

  console.log(`\n--- [2] METADATA ÖRNEK (İlk 3 Açılan) ---`);
  sampleMeta.rows.forEach(r => {
    console.log(`  ${r.symbol} [${r.signal_type}]:`);
    try {
      const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      if (meta) {
        const keys = ['mtfScore', 'mtfWeightedScore', 'mtfVerdict', 'aiScore', 'f4PowerLoss'];
        keys.forEach(k => {
          if (meta[k] !== undefined) console.log(`    ${k}: ${meta[k]}`);
        });
        // Tüm MTF ile ilgili key'leri göster
        const mtfKeys = Object.keys(meta).filter(k => k.toLowerCase().includes('mtf'));
        mtfKeys.forEach(k => {
          if (!keys.includes(k)) console.log(`    ${k}: ${meta[k]}`);
        });
      } else {
        console.log(`    metadata: null/empty`);
      }
    } catch(e) {
      console.log(`    Parse hatası: ${e.message}`);
    }
  });

  // 3. VETO'DAN GEÇEN ama MTF skoru olan sinyaller — MTF-signal uyumsuzluğu var mı?
  const vetoedWithMtf = await pool.query(`
    SELECT symbol, signal_type, timestamp, veto_reason,
           metadata->>'mtfWeightedScore' as mtf_weighted,
           metadata->>'mtfVerdict' as mtf_verdict,
           metadata->>'aiScore' as ai_score
    FROM strategy_signals
    WHERE timestamp > $1 
      AND executed = false 
      AND timeframe = $2
      AND (veto_reason ILIKE '%MTF%' OR veto_reason ILIKE '%Veto%')
    ORDER BY timestamp DESC LIMIT 20
  `, [H12, c.pilot_timeframe || '15m']);

  console.log(`\n--- [3] MTF VETO'LU 15m SİNYALLER (Son 20) ---`);
  if (vetoedWithMtf.rows.length === 0) {
    console.log("  Yok ya da timeframe eşleşmedi.");
    // Alternatif: timeframe filtresi olmadan dene
    const vetoedAny = await pool.query(`
      SELECT symbol, signal_type, timestamp, veto_reason, timeframe,
             metadata->>'mtfWeightedScore' as mtf_weighted
      FROM strategy_signals
      WHERE timestamp > $1 AND executed = false AND veto_reason ILIKE '%MTF%'
      ORDER BY timestamp DESC LIMIT 10
    `, [H12]);
    if (vetoedAny.rows.length) {
      console.log("  Tüm TF'lerden MTF veto'ları:");
      vetoedAny.rows.forEach(r => {
        const mtf = parseFloat(r.mtf_weighted || '0');
        console.log(`  ${ts(r.timestamp)} [${r.timeframe}] ${r.symbol} [${r.signal_type}] MTF:${mtf > 0 ? '+' : ''}${mtf.toFixed(0)} | ${String(r.veto_reason).substring(0, 90)}`);
      });
    }
  } else {
    vetoedWithMtf.rows.forEach(r => {
      const mtf = parseFloat(r.mtf_weighted || '0');
      const longEsh = c.pilot_mtf_long_threshold;
      const shortEsh = -c.pilot_mtf_short_threshold;
      const shouldPass = r.signal_type === 'BUY' ? (mtf >= longEsh) : (mtf <= shortEsh);
      const icon = shouldPass ? '🤔 YANLIŞ VETO?' : '✅ Doğru Veto';
      console.log(`  ${icon} ${ts(r.timestamp)} ${r.symbol} [${r.signal_type}] MTF:${mtf > 0 ? '+' : ''}${mtf.toFixed(0)}`);
      console.log(`    ${String(r.veto_reason).substring(0, 100)}`);
    });
  }

  // 4. Son 1 saatteki durum özeti
  const recent = await pool.query(`
    SELECT 
      timeframe,
      signal_type,
      executed,
      COUNT(*) as cnt,
      AVG((metadata->>'mtfWeightedScore')::float) as avg_mtf
    FROM strategy_signals
    WHERE timestamp > $1 AND user_id = 1
    GROUP BY timeframe, signal_type, executed
    ORDER BY timeframe, executed DESC
  `, [NOW - 60 * 60 * 1000]);

  console.log(`\n--- [4] Son 1 Saat — TF × Sinyal × Durum ---`);
  if (recent.rows.length === 0) {
    console.log("  Son 1 saatte sinyal yok.");
  } else {
    recent.rows.forEach(r => {
      const status = r.executed ? '✅AÇILDI' : '❌vetod ';
      const mtf = r.avg_mtf ? (r.avg_mtf > 0 ? '+' : '') + r.avg_mtf.toFixed(0) : 'N/A';
      console.log(`  [${r.timeframe}] [${r.signal_type}] ${status} × ${r.cnt} | Ort MTF: ${mtf}`);
    });
  }

  // 5. strategy_signals kolonlarını kontrol et (timeframe kolonu var mı)
  const cols = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='strategy_signals' ORDER BY ordinal_position
  `);
  console.log(`\n--- [5] strategy_signals Kolonları ---`);
  console.log("  " + cols.rows.map(r => r.column_name).join(', '));

  console.log("\n══════════════════════════════════════════════════════\n");
  await pool.end();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
