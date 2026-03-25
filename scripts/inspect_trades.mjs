/**
 * Admin işlemleri derinlemesine analiz scripti
 * Kullanım: node --env-file=.env scripts/inspect_trades.mjs
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

function safePct(entry, current, side = 'BUY') {
  const e = parseFloat(entry), c = parseFloat(current);
  if (!e || !c || isNaN(e) || isNaN(c)) return '?%';
  const pnl = side === 'SELL' ? ((e - c) / e) * 100 : ((c - e) / e) * 100;
  return (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + '%';
}

async function main() {
  try {
    // ── 1. Kullanıcıları listele ────────────────────────────────────────────
    const uRes = await pool.query(`
      SELECT u.id, u.email, u.username,
             (SELECT value FROM system_settings WHERE user_id = u.id AND key = 'is_admin' LIMIT 1) AS is_admin
      FROM users u ORDER BY u.id LIMIT 10
    `);
    console.log('\n👥 KULLANICILAR:');
    uRes.rows.forEach(u =>
      console.log(`  [${u.id}] ${u.email} ${u.is_admin === 'true' ? '👑 ADMIN' : ''}`)
    );

    // Admin ID'yi bul (id=1 veya is_admin=true)
    const admin = uRes.rows.find(u => u.is_admin === 'true') || uRes.rows[0];
    if (!admin) { console.log('Kullanıcı bulunamadı.'); return; }
    console.log(`\n🎯 Analiz edilecek kullanıcı: [${admin.id}] ${admin.email}\n`);

    // ── 2. AKTİF Smart Trades ──────────────────────────────────────────────
    const activeRes = await pool.query(`
      SELECT st.id, st.symbol, st.side, st.status,
             st.entry_price, st.current_price, st.tp_price, st.sl_price,
             st.created_at, st.meta
      FROM smart_trades st
      WHERE st.user_id = $1
        AND st.status IN ('PENDING','FILLED','OPEN','ACTIVE')
      ORDER BY st.created_at DESC
    `, [admin.id]);

    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`📊 AKTİF İŞLEMLER (${activeRes.rows.length} adet)`);
    console.log(`═══════════════════════════════════════════════════════`);

    if (!activeRes.rows.length) {
      console.log('  Aktif işlem yok.\n');
    } else {
      for (const t of activeRes.rows) {
        const meta = typeof t.meta === 'string' ? JSON.parse(t.meta || '{}') : (t.meta || {});
        const mode = meta?.mode || meta?.payload?.mode || '?';
        const aiScore = meta?.aiScore ?? meta?.payload?.aiScore ?? '?';
        const mtf = meta?.mtfConsensus ?? meta?.payload?.mtfConsensus ?? '—';
        const pnl = safePct(t.entry_price, t.current_price, t.side);

        console.log(`\n  📌 [${t.id}] ${t.symbol} | ${mode} | ${t.side} | ${t.status}`);
        console.log(`     Giriş: ${t.entry_price} │ Şu An: ${t.current_price || '—'} │ P&L: ${pnl}`);
        console.log(`     TP: ${t.tp_price || '—'} │ SL: ${t.sl_price || '—'}`);
        console.log(`     AI: ${aiScore} │ MTF: ${mtf}`);
        console.log(`     Açıldı: ${new Date(t.created_at).toLocaleString('tr-TR')}`);
      }
    }

    // ── 3. Son 40 KAPALI İşlem ─────────────────────────────────────────────
    const closedRes = await pool.query(`
      SELECT st.id, st.symbol, st.side, st.status,
             st.entry_price, st.close_price,
             st.created_at, st.closed_at, st.meta
      FROM smart_trades st
      WHERE st.user_id = $1
        AND st.status IN ('CLOSED','CANCELLED','STOPPED','DONE')
      ORDER BY COALESCE(st.closed_at, st.created_at) DESC
      LIMIT 40
    `, [admin.id]);

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`📁 SON ${closedRes.rows.length} KAPALI İŞLEM`);
    console.log(`═══════════════════════════════════════════════════════`);

    let wins = 0, losses = 0, neutral = 0;
    let totalPnl = 0;
    const mtfMismatches = [];

    for (const t of closedRes.rows) {
      const meta = typeof t.meta === 'string' ? JSON.parse(t.meta || '{}') : (t.meta || {});
      const mode = meta?.mode || meta?.payload?.mode || '?';
      const exitReason = meta?.exitReason || t.status;
      const mtf = meta?.mtfConsensus ?? meta?.payload?.mtfConsensus ?? '';
      const aiScore = meta?.aiScore ?? meta?.payload?.aiScore ?? '?';

      const entryP = parseFloat(t.entry_price);
      const closeP = parseFloat(t.close_price || t.entry_price);
      const pnlPct = t.side === 'SELL'
        ? ((entryP - closeP) / entryP) * 100
        : ((closeP - entryP) / entryP) * 100;
      totalPnl += pnlPct;

      const isTP = exitReason?.includes('TP') || exitReason?.includes('TAKE_PROFIT');
      const isSL = exitReason?.includes('SL') || exitReason?.includes('STOP_LOSS') || exitReason?.includes('PANIC');
      if (isTP) wins++; else if (isSL) losses++; else neutral++;

      // MTF uyuşmazlığı: COVER/SAT modu iken MTF boğaysa zararlı olabilir
      const isCover = mode === 'COVER' || t.side === 'SELL';
      const mtfBull = mtf && (mtf.includes('BOĞA') || mtf.includes('BULLISH') || mtf.includes('AL') || parseFloat(mtf) > 50);
      if (isCover && mtfBull && pnlPct < 0) {
        mtfMismatches.push({ id: t.id, symbol: t.symbol, mode, mtf, exitReason, pnlPct });
      }

      const icon = pnlPct >= 0 ? '✅' : '❌';
      const closedAt = t.closed_at ? new Date(t.closed_at).toLocaleString('tr-TR') : '—';
      console.log(`\n  ${icon} [${t.id}] ${t.symbol} │ ${mode} │ ${t.side} │ AI:${aiScore}`);
      console.log(`     Giriş: ${t.entry_price} → Çıkış: ${t.close_price || '—'} │ P&L: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%`);
      console.log(`     Çıkış: ${exitReason} │ MTF: ${mtf || '—'} │ Kapandı: ${closedAt}`);
    }

    // ── 4. ÖZET ───────────────────────────────────────────────────────────
    const total = closedRes.rows.length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`📈 PERFORMANS ÖZETİ (Son ${total} işlem)`);
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`  ✅ TP ile kapanan : ${wins}`);
    console.log(`  ❌ SL ile kapanan : ${losses}`);
    console.log(`  ➡️  Diğer kapanış  : ${neutral}`);
    console.log(`  🎯 Winrate         : %${winRate}`);
    console.log(`  💰 Toplam P&L      : ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%`);
    console.log(`  📊 Ort. P&L/işlem  : ${total > 0 ? (totalPnl / total).toFixed(3) : 0}%`);

    if (mtfMismatches.length > 0) {
      console.log(`\n  ⚠️  MTF/YÖN UYUŞMAZLIĞI (COVER + Boğa MTF → Zarar):`);
      mtfMismatches.forEach(m => {
        console.log(`    → [${m.id}] ${m.symbol} │ Mode:${m.mode} │ MTF:${m.mtf} │ P&L:${m.pnlPct.toFixed(2)}%`);
      });
    } else {
      console.log(`\n  ℹ️  MTF uyuşmazlığı tespit edilmedi.`);
    }

    // ── 5. En çok işlem gören semboller ──────────────────────────────────
    const symRes = await pool.query(`
      SELECT symbol,
             COUNT(*) as total,
             COUNT(CASE WHEN meta::text ILIKE '%TP_HIT%' OR meta::text ILIKE '%TAKE_PROFIT%' THEN 1 END) as wins,
             AVG(CASE
               WHEN side='BUY' AND close_price IS NOT NULL
                 THEN (close_price::float - entry_price::float) / NULLIF(entry_price::float,0) * 100
               WHEN side='SELL' AND close_price IS NOT NULL
                 THEN (entry_price::float - close_price::float) / NULLIF(entry_price::float,0) * 100
             END) as avg_pnl
      FROM smart_trades
      WHERE user_id = $1 AND status IN ('CLOSED','STOPPED','DONE')
      GROUP BY symbol
      ORDER BY total DESC
      LIMIT 10
    `, [admin.id]);

    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`🏆 EN ÇOK İŞLEM GÖREN SEMBOLLER`);
    console.log(`═══════════════════════════════════════════════════════`);
    symRes.rows.forEach(r => {
      const wr = r.total > 0 ? ((r.wins / r.total) * 100).toFixed(0) : 0;
      const avgP = r.avg_pnl ? parseFloat(r.avg_pnl).toFixed(3) : '?';
      console.log(`  ${r.symbol.padEnd(12)} │ ${r.total} işlem │ Win:%${wr} │ Ort.P&L: ${avgP}%`);
    });

  } catch (err) {
    console.error('\n❌ HATA:', err.message);
    console.error(err.stack?.split('\n').slice(0,3).join('\n'));
  } finally {
    await pool.end();
  }
}

main();
