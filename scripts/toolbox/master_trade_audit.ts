import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🔍 MASTER TRADE AUDIT (Admin İşlem Analizi)
 * Admin kullanıcısının aktif ve kapalı SmartTrade işlemlerini analiz eder.
 * Sinyal, MTF ve AI metadata'sını çözerek winrate ve uyuşmazlıkları raporlar.
 */

function pct(entry: number, close: number, side: string): string {
  if (!entry || !close) return '?%';
  const p = side === 'SELL'
    ? ((entry - close) / entry) * 100
    : ((close - entry) / entry) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(2) + '%';
}

async function tradeAudit(userId: number = 1) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🔍 MASTER TRADE AUDIT (User: ${userId})`);
  console.log(`${'═'.repeat(62)}`);

  const { active, closed, bySymbol } = await DiagnosticsService.getTradeAudit(userId);

  // ── AKTİF İŞLEMLER ────────────────────────────────────────────────
  console.log(`\n📊 AKTİF SMARTTRADE İŞLEMLER (${active.length} adet)`);
  console.log('─'.repeat(62));

  if (!active.length) {
    console.log('  Aktif işlem yok.');
  }

  for (const t of active) {
    const m = (t as any).meta || {};
    const mode     = m.mode || m.payload?.mode || '?';
    const ai       = m.aiScore ?? m.payload?.aiScore ?? '?';
    const mtf      = m.mtfConsensus ?? m.payload?.mtfConsensus ?? '—';
    const tp       = m.activeTakeProfit ?? m.payload?.takeProfit?.price ?? '—';
    const sl       = m.activeStopLoss  ?? m.payload?.stopLoss?.price  ?? '—';
    const hp       = m.highestPrice ?? '—';
    const entryP   = parseFloat((t as any).entry_price || '0');
    const ts       = new Date(parseInt((t as any).created_at || '0')).toLocaleString('tr-TR');

    console.log(`\n  📌 [${(t as any).id}] ${(t as any).symbol} │ ${mode} │ ${(t as any).side} │ ${(t as any).status}`);
    console.log(`     Giriş: ${entryP} │ Qty: ${(t as any).qty || '—'}`);
    console.log(`     TP: ${tp} │ SL: ${sl} │ En Yüksek: ${hp}`);
    console.log(`     AI: ${ai} │ MTF: ${mtf}`);
    console.log(`     Açıldı: ${ts}`);
  }

  // ── KAPALI İŞLEMLER ───────────────────────────────────────────────
  console.log(`\n${'─'.repeat(62)}`);
  console.log(`📁 SON ${closed.length} KAPALI İŞLEM`);
  console.log('─'.repeat(62));

  let wins = 0, losses = 0, totalPnl = 0;
  const mismatches: any[] = [];

  for (const t of closed) {
    const m = (t as any).meta || {};
    const mode       = m.mode || m.payload?.mode || '?';
    const exitReason = m.exitReason || (t as any).status || '—';
    const ai         = m.aiScore ?? m.payload?.aiScore ?? '?';
    const mtf        = m.mtfConsensus ?? m.payload?.mtfConsensus ?? '';

    const entryP = parseFloat((t as any).entry_price || '0');
    const closeP = parseFloat((t as any).close_price  || (t as any).entry_price || '0');
    const side   = (t as any).side || 'BUY';
    const pnlVal = side === 'SELL'
      ? ((entryP - closeP) / entryP) * 100
      : ((closeP - entryP) / entryP) * 100;

    if (isNaN(pnlVal)) continue;
    totalPnl += pnlVal;

    const isTP = exitReason.includes('TP') || exitReason.includes('TAKE_PROFIT') || exitReason.includes('KÂR');
    const isSL = exitReason.includes('SL') || exitReason.includes('STOP_LOSS') || exitReason.includes('PANIC');
    if (isTP) wins++; else if (isSL) losses++;

    // MTF uyuşmazlığı tespiti: COVER + boğa MTF + zarar
    const isCover = mode === 'COVER' || side === 'SELL';
    const mtfBull = mtf && (mtf.includes('BOĞA') || mtf.includes('AL') || mtf.includes('BULL'));
    if (isCover && mtfBull && pnlVal < 0) {
      mismatches.push({ id: (t as any).id, symbol: (t as any).symbol, mode, mtf, exitReason, pnlPct: pnlVal });
    }

    const icon    = pnlVal >= 0 ? '✅' : '❌';
    const closedAt = (t as any).closed_ts
      ? new Date(parseInt((t as any).closed_ts)).toLocaleString('tr-TR')
      : '—';
    const pnlStr   = `${pnlVal >= 0 ? '+' : ''}${pnlVal.toFixed(2)}%`;

    console.log(`\n  ${icon} [${(t as any).id}] ${(t as any).symbol} │ ${mode} │ ${side} │ AI:${ai}`);
    console.log(`     ${entryP} → ${closeP || '—'} │ P&L: ${pnlStr}`);
    console.log(`     Çıkış: ${exitReason} │ MTF: ${mtf || '—'} │ ${closedAt}`);
  }

  // ── PERFORMANS ÖZETİ ──────────────────────────────────────────────
  const total   = closed.length;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';

  console.log(`\n${'═'.repeat(62)}`);
  console.log(`📈 PERFORMANS ÖZETİ (Son ${total} işlem)`);
  console.log('═'.repeat(62));
  console.log(`  ✅ TP Kapanış  : ${wins}`);
  console.log(`  ❌ SL Kapanış  : ${losses}`);
  console.log(`  🎯 Winrate     : %${winRate}`);
  console.log(`  💰 Toplam P&L  : ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%`);
  console.log(`  📊 Ort/işlem   : ${total > 0 ? (totalPnl / total).toFixed(3) : 0}%`);

  if (mismatches.length) {
    console.log(`\n  ⚠️  MTF/YÖN UYUŞMAZLIĞI (COVER + Boğa MTF → Zarar):`);
    mismatches.forEach(m =>
      console.log(`    → [${m.id}] ${m.symbol} │ MTF: ${m.mtf} │ P&L: ${m.pnlPct.toFixed(2)}%`)
    );
  } else {
    console.log(`\n  ℹ️  MTF uyuşmazlığı kaydı bulunamadı.`);
  }

  // ── SEMBOL BAZLI ──────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🏆 SEMBOL BAZLI İŞLEM ÖZETİ`);
  console.log('═'.repeat(62));
  bySymbol.forEach((r: any) => {
    const wr = r.total_trades > 0
      ? ((r.tp_count / r.total_trades) * 100).toFixed(0) : '0';
    console.log(
      `  ${r.symbol.padEnd(12)} │ ${r.total_trades} işlem │ TP:${r.tp_count} SL:${r.sl_count} │ Win:%${wr}`
    );
  });

  console.log(`\n✅ Denetim tamamlandı.`);
}

tradeAudit();
