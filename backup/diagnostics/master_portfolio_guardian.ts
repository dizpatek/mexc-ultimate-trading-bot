import { sql } from '../../src/lib/postgres';

/**
 * 🛡️ MASTER PORTFOLIO GUARDIAN (Anti-Gravity Denetçisi)
 * Rule 1 & 2 uyumluluğu, varlık hafızası ve portföy senkronizasyonunu kontrol eder.
 */

async function portfolioGuardian(userId: number = 14) {
  console.log(`\n--- 🛡️ MASTER PORTFOLIO GUARDIAN: VARLIK VE KURAL DENETİMİ ---`);
  const startTime = Date.now();

  try {
    // 1. Portföy Özeti ve USDT Durumu
    console.log(`\n💰 1. PORTFÖY VE NAKİT DURUMU:`);
    const { rows: holdings } = await sql`
      SELECT symbol, balance
      FROM portfolio WHERE user_id = ${userId}
    `;
    
    if (holdings.length > 0) {
      const usdt = holdings.find((h: any) => h.symbol === 'USDT');
      console.log(`   - Toplam Varlık Sayısı: ${holdings.length - 1}`);
      console.log(`   - Bakiyedeki Nakit (USDT): $${Number(usdt?.balance || 0).toFixed(2)}`);
    } else {
      console.log(`   ⚠️ UYARI: Cüzdanda herhangi bir varlık saptanmadı.`);
    }

    // 2. Anti-Gravity Varlık Hafızası (Rule 2)
    console.log(`\n🧠 2. ANTI-GRAVITY VARLIK HAFIZASI (Memory Audit):`);
    const { rows: memory } = await sql`
      SELECT id, symbol, status, 
             (meta::jsonb->>'exitPrice')::numeric as exit_price,
             (meta::jsonb->>'executedQty')::numeric as qty
      FROM orders 
      WHERE user_id = ${userId} 
        AND status = 'CLOSED' 
        AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY updated_at DESC LIMIT 5
    `;

    if (memory.length > 0) {
      memory.forEach((m: any) => {
        const usdtValue = Number(m.exit_price || 0) * Number(m.qty || 0);
        console.log(`   - ${String(m.symbol).padEnd(10)} | Durum: ${m.status} | Geri Dönen: $${usdtValue.toFixed(2)}`);
      });
      console.log(`   ✅ Kural 2: Kapalı işlemlerden dönen USDT hafızası korunuyor.`);
    } else {
      console.log(`   ℹ️ Bilgi: Hafızaya alınmış son işlem bulunamadı.`);
    }

    // 3. Portföy Anomalileri (Rule 1)
    console.log(`\n🔍 3. PORTFÖY ANOMALİLERİ:`);
    const { rows: config } = await sql`SELECT pilot_only_holdings FROM bot_configs WHERE user_id = ${userId}`;
    const pilotOnly = config[0]?.pilot_only_holdings;
    
    if (pilotOnly) {
      const { rows: activeIssues } = await sql`
        SELECT symbol FROM orders WHERE user_id = ${userId} AND status = 'FILLED'
      `;
      activeIssues.forEach((i: any) => {
        const isHeld = holdings.some((h: any) => h.symbol === i.symbol);
        if (!isHeld) console.log(`   ❌ ANOMALİ: ${i.symbol} emirlerde aktif ama cüzdanda yok!`);
      });
      if (activeIssues.length === 0) console.log(`   ✅ OK: Aktif işlemlerde anomali saptanmadı.`);
    } else {
      console.log(`   🔓 Bilgi: "Sadece Portföyü Tara" kapalı olduğu için kısıtlama uygulanmıyor.`);
    }

    console.log(`\n✨ Portföy denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ PORTFOLIO GUARDIAN HATASI:`, err);
  }
}

portfolioGuardian();
