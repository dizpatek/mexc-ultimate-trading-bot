/**
 * 🦅 MASTER SYSTEM AUDIT v3.0 — Konsolide Denetim Aracı
 * Tüm scripts klasöründeki araçları birleştiren tek kapsamlı audit.
 * 
 * Denetlenen Alanlar:
 *   1. Admin kullanıcı ve bot konfigürasyonu
 *   2. Kapanan işlemlerin detaylı analizi (neden zarar etti?)
 *   3. TP/SL hesaplama doğruluğu
 *   4. Sinyal → Pilot → Monitor → Exit pipeline izlenebilirliği
 *   5. Ayar etkisi analizi (MTF Veto, TSL, TTP, F4 vb.)
 *   6. Aktif işlem durumu
 *   7. Re-Entry bellek durumu
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

const ADMIN_ID = 1; // Admin user

function sep(title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🔍 ${title}`);
  console.log('═'.repeat(70));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pct(entry, exit, side) {
  if (!entry || !exit) return '?%';
  const p = side === 'SELL'
    ? ((entry - exit) / entry) * 100
    : ((exit - entry) / entry) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(3) + '%';
}

async function run() {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 1: ADMIN KULLANICI VE BOT KONFİGÜRASYONU
    // ═══════════════════════════════════════════════════════════════════
    sep('1. ADMIN KULLANICI BİLGİSİ');
    const usersRes = await pool.query(`
      SELECT id, username, email, is_admin,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id AND status IN ('FILLED','PENDING')) as active_count,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id AND status = 'CLOSED') as closed_count
      FROM users WHERE id = ${ADMIN_ID}
    `);
    const admin = usersRes.rows[0];
    if (admin) {
      console.log(`  ID: ${admin.id} | ${admin.username} | ${admin.email}`);
      console.log(`  Toplam Emir: ${admin.order_count} | Aktif: ${admin.active_count} | Kapalı: ${admin.closed_count}`);
    }

    sep('2. BOT KONFİGÜRASYONU');
    const cfgRes = await pool.query(`SELECT * FROM bot_configs WHERE user_id = ${ADMIN_ID}`);
    if (cfgRes.rows.length > 0) {
      const cfg = cfgRes.rows[0];
      const tfs = cfg.timeframe_settings || {};
      console.log(`  Auto Trade      : ${cfg.auto_trade ? '✅ AÇIK' : '❌ KAPALI'}`);
      console.log(`  Defense Mode    : ${cfg.defense_mode ? '🛡️ AÇIK' : '❌ KAPALI'}`);
      console.log(`  Pilot Timeframe : ${cfg.pilot_timeframe || '?'}`);
      console.log(`  MTF Veto Aktif  : ${cfg.pilot_mtf_veto ? '✅' : '❌'}`);
      console.log(`  Sadece Portföy  : ${cfg.pilot_only_holdings ? '✅' : '❌'}`);
      console.log(`  Pilot Mode      : ${cfg.pilot_mode || tfs.pilot_mode || '?'}`);
      console.log(`  Trade Alloc %   : ${tfs.pilot_trade_allocation || '?'}`);
      console.log(`  TP%: ${tfs.pilot_tp_percent || '?'} | SL%: ${tfs.pilot_sl_percent || '?'}`);
      console.log(`  TP Trailing     : ${tfs.pilot_tp_trailing ?? cfg.pilot_tp_trailing} | Dev: ${tfs.pilot_tp_deviation ?? cfg.pilot_tp_deviation}`);
      console.log(`  SL Trailing     : ${tfs.pilot_sl_trailing ?? cfg.pilot_sl_trailing} | Dev: ${tfs.pilot_sl_deviation ?? cfg.pilot_sl_deviation}`);
      console.log(`  Cover TP%: ${tfs.cover_tp_percent || '?'} | Cover SL%: ${tfs.cover_sl_percent || '?'}`);
      console.log(`  AI Threshold    : ${cfg.ai_threshold}`);
      console.log(`  F4 Length       : ${cfg.f4_length}`);
      console.log(`  Whale Mult      : ${cfg.whale_multiplier}`);
      console.log(`  MTF Long Thresh : ${cfg.pilot_mtf_long_threshold || '?'}`);
      console.log(`  MTF Short Thresh: ${cfg.pilot_mtf_short_threshold || '?'}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 2: KAPANAN İŞLEMLERİN DETAYLI ANALİZİ
    // ═══════════════════════════════════════════════════════════════════
    sep('3. KAPANAN İŞLEMLER — DETAYLI ANALİZ');
    const closedRes = await pool.query(`
      SELECT 
        o.id, o.symbol, o.side, o.price as entry_price, o.qty,
        o.meta::jsonb->>'exitPrice' as exit_price,
        o.meta::jsonb->>'exitReason' as exit_reason,
        o.meta::jsonb->>'highestPrice' as highest_price,
        o.meta::jsonb->>'lowestPrice' as lowest_price,
        o.meta::jsonb->>'closedAt' as closed_at,
        o.meta::jsonb->>'filledAt' as filled_at,
        o.meta::jsonb->>'tradeState' as trade_state,
        o.meta::jsonb->>'profitLoss' as profit_loss,
        o.meta::jsonb->>'profitLossPercentage' as profit_loss_pct,
        o.meta::jsonb->>'tpTriggered' as tp_triggered,
        o.meta::jsonb->>'tslActivated' as tsl_activated,
        o.meta::jsonb->>'activeStopLoss' as active_sl,
        o.meta::jsonb->>'activeTakeProfit' as active_tp,
        o.meta::jsonb->>'aiScore' as ai_score,
        o.meta::jsonb->>'lastAiScore' as last_ai_score,
        o.meta::jsonb->>'mtfVerdict' as mtf_verdict,
        o.meta::jsonb->>'pilotVetoReason' as pilot_veto,
        o.meta::jsonb->>'source' as source,
        o.meta::jsonb->'payload'->>'mode' as trade_mode,
        o.meta::jsonb->'payload'->'stopLoss'->>'price' as initial_sl,
        o.meta::jsonb->'payload'->'takeProfit'->>'price' as initial_tp,
        o.meta::jsonb->'payload'->'stopLoss'->>'trailing' as sl_trailing,
        o.meta::jsonb->'payload'->'stopLoss'->>'deviation' as sl_dev,
        o.meta::jsonb->'payload'->'takeProfit'->>'trailing' as tp_trailing,
        o.meta::jsonb->'payload'->'takeProfit'->>'deviation' as tp_dev,
        o.meta::jsonb->'payload'->>'timeframe' as trade_tf,
        o.meta::jsonb->'payload'->>'source' as payload_source,
        o.meta::jsonb->'payload'->>'trailingBuy' as trailing_buy,
        o.created_at,
        o.trading_mode
      FROM orders o
      WHERE o.user_id = ${ADMIN_ID} AND o.status = 'CLOSED'
        AND o.meta::jsonb->>'smartTrade' = 'true'
      ORDER BY COALESCE((o.meta::jsonb->>'closedAt')::bigint, o.created_at) DESC
      LIMIT 50
    `);

    let totalPnl = 0, wins = 0, losses = 0;
    const exitReasons = {};
    const issueLog = [];

    console.log(`  Toplam kapalı SmartTrade: ${closedRes.rows.length}\n`);

    for (const row of closedRes.rows) {
      const entry = parseFloat(row.entry_price || 0);
      const exit = parseFloat(row.exit_price || 0);
      const high = parseFloat(row.highest_price || entry);
      const low = parseFloat(row.lowest_price || entry);
      const isLong = row.side === 'BUY';
      const mode = row.trade_mode || (isLong ? 'TRADE' : 'COVER');

      let plPct = 0;
      if (exit > 0 && entry > 0) {
        plPct = isLong ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
      }
      totalPnl += plPct;
      if (plPct >= 0) wins++; else losses++;

      const exitR = row.exit_reason || 'UNKNOWN';
      exitReasons[exitR] = (exitReasons[exitR] || 0) + 1;

      // Duration
      const filledAt = parseInt(row.filled_at || row.created_at || 0);
      const closedAt = parseInt(row.closed_at || 0);
      const durationMin = closedAt > 0 ? ((closedAt - filledAt) / 60000).toFixed(1) : '?';

      // Max potential profit
      const maxPotential = isLong
        ? ((high - entry) / entry) * 100
        : ((entry - low) / entry) * 100;

      // TP/SL Analysis
      const initTp = parseFloat(row.initial_tp || 0);
      const initSl = parseFloat(row.initial_sl || 0);
      const activeSl = parseFloat(row.active_sl || 0);
      const activeTp = parseFloat(row.active_tp || 0);

      const icon = plPct >= 0 ? '✅' : '❌';
      const src = row.payload_source || row.source || 'manual';

      console.log(`  ${icon} [${row.id}] ${row.symbol} | ${mode} | ${row.side} | ${src}`);
      console.log(`     Giriş: $${entry} → Çıkış: $${exit || '?'} | P&L: ${plPct >= 0 ? '+' : ''}${plPct.toFixed(3)}%`);
      console.log(`     Zirve: $${high} | Dip: $${low} | Max Potansiyel: ${maxPotential >= 0 ? '+' : ''}${maxPotential.toFixed(3)}%`);
      console.log(`     TP: $${initTp} (Aktif: $${activeTp || '—'}) | SL: $${initSl} (Aktif: $${activeSl || '—'})`);
      console.log(`     TSL: ${row.tsl_activated === 'true' ? '✅' : '❌'} | TTP: ${row.tp_triggered === 'true' ? '✅' : '❌'} | Trailing SL: ${row.sl_trailing} | Trailing TP: ${row.tp_trailing}`);
      console.log(`     AI: ${row.ai_score || row.last_ai_score || '?'} | MTF: ${row.mtf_verdict || '?'} | TF: ${row.trade_tf || '?'}`);
      console.log(`     Çıkış Nedeni: ${exitR} | Süre: ${durationMin}dk`);

      // ── SORUN TESPİTİ ──────────────────────────────────────
      // 1. Cover + TP yukarıda = HATA
      if (mode === 'COVER' && initTp > 0 && initTp > entry) {
        issueLog.push(`🔴 [${row.id}] ${row.symbol} COVER TP HATASI: TP ($${initTp}) > Giriş ($${entry}) — TP aşağıda olmalıydı!`);
      }
      // 2. Long + SL yukarıda = HATA
      if (mode === 'TRADE' && initSl > 0 && initSl > entry) {
        issueLog.push(`🔴 [${row.id}] ${row.symbol} TRADE SL HATASI: SL ($${initSl}) > Giriş ($${entry}) — SL aşağıda olmalıydı!`);
      }
      // 3. Cover + SL aşağıda = HATA
      if (mode === 'COVER' && initSl > 0 && initSl < entry) {
        issueLog.push(`🔴 [${row.id}] ${row.symbol} COVER SL HATASI: SL ($${initSl}) < Giriş ($${entry}) — SL yukarıda olmalıydı!`);
      }
      // 4. TSL aktif olmadan kapanma (trailing true ama tsl_activated false)
      if (row.sl_trailing === 'true' && row.tsl_activated !== 'true' && exitR.includes('SL')) {
        issueLog.push(`🟠 [${row.id}] ${row.symbol}: Trailing SL=true ama TSL hiç aktifleşmedi! SL sabit kaldı.`);
      }
      // 5. Zarar eden ama max potansiyel kârlı olan işlemler
      if (plPct < 0 && maxPotential > 0.5) {
        issueLog.push(`🟡 [${row.id}] ${row.symbol}: ${plPct.toFixed(2)}% zarar AMA max potansiyel +${maxPotential.toFixed(2)}% idi — TSL/TTP çalışsaydı kârla kapanabilirdi.`);
      }
      // 6. 30 saniyeden kısa sürede kapanan işlemler (SL buffer sorunu)
      if (closedAt > 0 && filledAt > 0 && (closedAt - filledAt) < 30000 && plPct < 0) {
        issueLog.push(`🔴 [${row.id}] ${row.symbol}: İşlem ${((closedAt - filledAt) / 1000).toFixed(0)}sn içinde zarar ile kapandı! Buffer sorunu?`);
      }
      // 7. exitReason eksik
      if (!row.exit_reason || row.exit_reason === 'undefined') {
        issueLog.push(`🟡 [${row.id}] ${row.symbol}: exitReason eksik — log izlenebilirliği kırık!`);
      }
      // 8. profitLoss DB'de kayıtlı mı?
      if (!row.profit_loss && exit > 0) {
        issueLog.push(`🟡 [${row.id}] ${row.symbol}: profitLoss meta'da kayıtlı değil — performans takibi eksik.`);
      }
      console.log('');
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 3: PERFORMANS ÖZETİ
    // ═══════════════════════════════════════════════════════════════════
    sep('4. PERFORMANS ÖZETİ');
    const total = closedRes.rows.length;
    console.log(`  ✅ Kârlı    : ${wins} (${total > 0 ? ((wins/total)*100).toFixed(1) : 0}%)`);
    console.log(`  ❌ Zararlı  : ${losses} (${total > 0 ? ((losses/total)*100).toFixed(1) : 0}%)`);
    console.log(`  💰 Toplam P&L: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(3)}%`);
    console.log(`  📊 Ort/işlem : ${total > 0 ? (totalPnl/total).toFixed(3) : 0}%`);

    sep('5. ÇIKIŞ NEDENLERİ DAĞILIMI');
    Object.entries(exitReasons).sort((a, b) => b[1] - a[1]).forEach(([r, count]) => {
      console.log(`  ${r.padEnd(50)}: ${count}`);
    });

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 4: AKTİF İŞLEMLER
    // ═══════════════════════════════════════════════════════════════════
    sep('6. AKTİF İŞLEMLER');
    const activeRes = await pool.query(`
      SELECT id, symbol, side, status, price, qty,
        meta::jsonb->'payload'->>'mode' as mode,
        meta::jsonb->>'activeStopLoss' as active_sl,
        meta::jsonb->>'activeTakeProfit' as active_tp,
        meta::jsonb->>'tpTriggered' as tp_triggered,
        meta::jsonb->>'tslActivated' as tsl_activated,
        meta::jsonb->>'aiScore' as ai_score,
        meta::jsonb->>'pilotVetoReason' as pilot_veto,
        meta::jsonb->'payload'->>'source' as source,
        created_at
      FROM orders
      WHERE user_id = ${ADMIN_ID} AND status IN ('FILLED','PENDING')
        AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY created_at DESC
    `);
    console.log(`  Aktif işlem sayısı: ${activeRes.rows.length}`);
    for (const t of activeRes.rows) {
      console.log(`  📌 [${t.id}] ${t.symbol} | ${t.mode || '?'} | ${t.side} | ${t.status} | ${t.source || 'manual'}`);
      console.log(`     Giriş: $${t.price} | Qty: ${t.qty}`);
      console.log(`     TP: $${t.active_tp || '—'} | SL: $${t.active_sl || '—'}`);
      console.log(`     TTP: ${t.tp_triggered === 'true' ? '✅' : '❌'} | TSL: ${t.tsl_activated === 'true' ? '✅' : '❌'}`);
      if (t.pilot_veto) console.log(`     ⚠️ Pilot Veto: ${t.pilot_veto}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 5: SON SİNYALLER VE VETO ANALİZİ
    // ═══════════════════════════════════════════════════════════════════
    sep('7. SON SİNYALLER — VETO/ONAY ANALİZİ');
    const sigRes = await pool.query(`
      SELECT symbol, signal_type, executed, veto_reason, timeframe, trading_mode, timestamp,
        execution_result::jsonb->>'confidence' as confidence,
        execution_result::jsonb->>'insight' as insight
      FROM strategy_signals 
      WHERE user_id = ${ADMIN_ID}
      ORDER BY timestamp DESC LIMIT 30
    `);
    
    let executedCount = 0, vetoedCount = 0;
    const vetoReasons = {};
    
    for (const s of sigRes.rows) {
      if (s.executed) executedCount++; else vetoedCount++;
      if (s.veto_reason) {
        const vr = s.veto_reason.substring(0, 60);
        vetoReasons[vr] = (vetoReasons[vr] || 0) + 1;
      }
      const ts = new Date(parseInt(s.timestamp)).toLocaleString('tr-TR');
      console.log(`  ${s.executed ? '✅' : '🛑'} ${s.symbol} | ${s.signal_type} | ${s.timeframe || '?'} | ${ts}`);
      if (s.veto_reason) console.log(`     Veto: ${s.veto_reason.substring(0, 80)}`);
    }
    
    console.log(`\n  Toplam: ${sigRes.rows.length} | Çalıştırılan: ${executedCount} | Veto: ${vetoedCount}`);
    
    if (Object.keys(vetoReasons).length > 0) {
      console.log(`\n  VETO NEDENLERİ DAĞILIMI:`);
      Object.entries(vetoReasons).sort((a, b) => b[1] - a[1]).forEach(([r, c]) => {
        console.log(`    ${r}: ${c}`);
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 6: RE-ENTRY BELLEK DURUMU
    // ═══════════════════════════════════════════════════════════════════
    sep('8. RE-ENTRY BELLEK DURUMU (Geri Alım Havuzu)');
    const reEntryRes = await pool.query(`
      SELECT symbol, 
        (meta::jsonb->>'exitPrice')::numeric as exit_price,
        (meta::jsonb->>'executedQty')::numeric as qty,
        (meta::jsonb->>'closedAt') as closed_at
      FROM orders
      WHERE user_id = ${ADMIN_ID}
        AND status = 'CLOSED'
        AND side = 'BUY'
        AND meta::jsonb->>'source' = 'pilot_auto'
        AND meta::jsonb->>'tradeState' = 'TRADE_COMPLETED'
        AND meta::jsonb->>'reEntryConsumed' IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM orders o2
          WHERE o2.user_id = ${ADMIN_ID}
            AND o2.symbol = orders.symbol
            AND o2.status IN ('FILLED','PENDING')
            AND o2.meta::jsonb->>'smartTrade' = 'true'
        )
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    console.log(`  Re-entry havuzunda: ${reEntryRes.rows.length} sembol`);
    for (const r of reEntryRes.rows) {
      const usdt = (parseFloat(r.exit_price || 0) * parseFloat(r.qty || 0)).toFixed(2);
      console.log(`  ♻️ ${r.symbol} | USDT: $${usdt} | Satış: ${r.closed_at ? new Date(parseInt(r.closed_at)).toLocaleString('tr-TR') : '?'}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 7: TESPİT EDİLEN SORUNLAR
    // ═══════════════════════════════════════════════════════════════════
    sep('9. 🚨 TESPİT EDİLEN SORUNLAR');
    if (issueLog.length === 0) {
      console.log('  ✅ Kritik sorun tespit edilmedi.');
    } else {
      console.log(`  Toplam ${issueLog.length} sorun tespit edildi:\n`);
      issueLog.forEach(i => console.log(`  ${i}`));
    }

    // ═══════════════════════════════════════════════════════════════════
    // BÖLÜM 8: PİPELİNE İZLENEBİLİRLİK TESTİ
    // ═══════════════════════════════════════════════════════════════════
    sep('10. PİPELİNE İZLENEBİLİRLİK TESTİ');
    // Son kapanan işlemin tüm meta alanlarını kontrol et
    if (closedRes.rows.length > 0) {
      const lastTrade = closedRes.rows[0];
      const metaRes = await pool.query(`SELECT meta FROM orders WHERE id = ${lastTrade.id}`);
      const meta = typeof metaRes.rows[0].meta === 'string' ? JSON.parse(metaRes.rows[0].meta) : metaRes.rows[0].meta;
      
      const requiredFields = [
        'tradeState', 'exitReason', 'exitPrice', 'closedAt', 'filledAt',
        'highestPrice', 'lowestPrice', 'profitLoss', 'profitLossPercentage',
        'activeStopLoss', 'activeTakeProfit', 'source', 'aiScore', 'lastAiScore'
      ];
      
      console.log(`  Son kapanan işlem [${lastTrade.id}] ${lastTrade.symbol} meta alanları:`);
      for (const f of requiredFields) {
        const val = meta[f];
        const hasVal = val !== undefined && val !== null;
        console.log(`    ${hasVal ? '✅' : '❌'} ${f}: ${hasVal ? String(val).substring(0, 50) : 'EKSİK'}`);
      }
      
      // Payload alt alanları
      const payload = meta.payload || {};
      const payloadFields = ['mode', 'source', 'timeframe', 'takeProfit', 'stopLoss'];
      console.log(`\n  Payload alt alanları:`);
      for (const f of payloadFields) {
        const val = payload[f];
        const hasVal = val !== undefined && val !== null;
        console.log(`    ${hasVal ? '✅' : '❌'} payload.${f}: ${hasVal ? (typeof val === 'object' ? JSON.stringify(val).substring(0, 60) : val) : 'EKSİK'}`);
      }
    }

    sep('✅ MASTER AUDIT TAMAMLANDI');

  } catch (err) {
    console.error('\n❌ AUDIT HATASI:', err.message || err);
  } finally {
    await pool.end();
  }
}

run();
