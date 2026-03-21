import { sql } from '../../src/lib/postgres';

/**
 * 📈 MASTER PERFORMANCE ANALYZER (Ticaret Analitiği)
 * PnL, başarı oranı, çıkış nedenleri ve mod bazlı kuralları (Rule 3 & 4) denetler.
 */

async function performanceAnalyzer(userId: number = 14) {
  console.log(`\n--- 📈 MASTER PERFORMANCE ANALYZER: TİCARET VE MOD DENETİMİ ---`);
  const startTime = Date.now();

  try {
    // 1. Genel Performans Özeti (Kârlı/Zararlı)
    console.log(`\n📊 1. GENEL PERFORMANS (Son 30 İşlem):`);
    const { rows: closedTrades } = await sql`
      SELECT 
             (meta::jsonb->>'entryPrice')::numeric as entry_price,
             (meta::jsonb->>'exitPrice')::numeric as exit_price,
             (meta::jsonb->>'executedQty')::numeric as qty,
             meta::jsonb->>'exitReason' as exit_reason
      FROM orders 
      WHERE user_id = ${userId} AND status = 'CLOSED' 
      ORDER BY updated_at DESC LIMIT 30
    `;

    if (closedTrades.length > 0) {
      let profit = 0, loss = 0;
      closedTrades.forEach((t: any) => {
        const pnl = (Number(t.exit_price || 0) - Number(t.entry_price || 0)) * Number(t.qty || 0);
        if (pnl > 0) profit++; else loss++;
      });
      console.log(`   - Toplam: ${closedTrades.length} | Kârlı: ${profit} | Zararlı: ${loss}`);
      console.log(`   - Başarı Oranı: %${((profit / closedTrades.length) * 100).toFixed(1)}`);
    } else {
      console.log(`   ℹ️ Bilgi: Tamamlanmış son işlem bulunamadı.`);
    }

    // 2. Mod Kuralları Doğrulaması (Rule 3 & 4)
    console.log(`\n⚖️ 2. MOD KURAL DOĞRULAMASI:`);
    const { rows: config } = await sql`SELECT pilot_mode FROM bot_configs WHERE user_id = ${userId}` as unknown as { rows: Array<{ pilot_mode: string }> };
    const mode = (config[0]?.pilot_mode as string) || 'matrix';
    console.log(`   - Aktif Mod: ${mode.toUpperCase()}`);

    const { rows: active } = await sql`
      SELECT symbol, meta::jsonb->>'mode' as trade_mode 
      FROM orders WHERE user_id = ${userId} AND status = 'FILLED'
    `;

    if (mode === 'matrix') {
      const distinctModes = new Set(active.map((a: any) => a.trade_mode));
      if (distinctModes.size > 1) {
        console.log(`   ❌ HATA: Matrix modunda birden fazla yön (Long/Short) açık!`);
      } else {
        console.log(`   ✅ OK: Matrix kuralı korunuyor.`);
      }
    } else {
      // Hedge Mode: Her yönden max 1
      const tradeCount = active.filter((a: any) => a.trade_mode === 'TRADE').length;
      const coverCount = active.filter((a: any) => a.trade_mode === 'COVER').length;
      if (tradeCount > 1 || coverCount > 1) {
        console.log(`   ❌ HATA: Hedge modunda aynı yönden birden fazla işlem var! (T:${tradeCount}, C:${coverCount})`);
      } else {
        console.log(`   ✅ OK: Hedge kuralı korunuyor.`);
      }
    }

    // 3. Çıkış Nedenleri Analizi
    console.log(`\n🚪 3. ÇIKIŞ NEDENLERİ:`);
    const reasons: Record<string, number> = {};
    closedTrades.forEach((t: any) => {
      const r = t.exit_reason || 'Bilinmiyor';
      reasons[r] = (reasons[r] || 0) + 1;
    });

    Object.entries(reasons).forEach(([r, count]) => {
      console.log(`   - ${r.padEnd(20)}: ${count} adet`);
    });

    console.log(`\n✨ Performans denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ PERFORMANCE ANALYZER HATASI:`, err);
  }
}

performanceAnalyzer();
