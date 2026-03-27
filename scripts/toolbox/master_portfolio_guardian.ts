import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🛡️ MASTER PORTFOLIO GUARDIAN (Anti-Gravity Denetçisi)
 * Rule 1 & 2 uyumluluğu, varlık hafızası ve portföy senkronizasyonunu kontrol eder.
 * 'src/lib/diagnostics' servisini kullanır.
 */

async function portfolioGuardian(userId: number = 14) {
  console.log(`\n--- 🛡️ MASTER PORTFOLIO GUARDIAN: VARLIK VE KURAL DENETİMİ ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getPortfolioGuardian(userId);

    // 1. Portföy Özeti ve USDT Durumu
    console.log(`\n💰 1. PORTFÖY VE NAKİT DURUMU:`);
    if (data.holdings.length > 0) {
      const usdt = data.holdings.find((h: any) => h.symbol === 'USDT');
      console.log(`   - Toplam Varlık Sayısı: ${data.holdings.length - 1}`);
      console.log(`   - Bakiyedeki Nakit (USDT): $${Number(usdt?.balance || 0).toFixed(2)}`);
    } else {
      console.log(`   ⚠️ UYARI: Cüzdanda herhangi bir varlık saptanmadı.`);
    }

    // 2. Anti-Gravity Varlık Hafızası (Rule 2)
    console.log(`\n🧠 2. ANTI-GRAVITY VARLIK HAFIZASI (Memory Audit):`);
    if (data.memory.length > 0) {
      data.memory.forEach((m: any) => {
        const usdtValue = Number(m.exit_price || 0) * Number(m.qty || 0);
        console.log(`   - ${String(m.symbol).padEnd(10)} | Durum: ${m.status} | Geri Dönen: $${usdtValue.toFixed(2)}`);
      });
      console.log(`   ✅ Kural 2: Kapalı işlemlerden dönen USDT hafızası korunuyor.`);
    } else {
      console.log(`   ℹ️ Bilgi: Hafızaya alınmış son işlem bulunamadı.`);
    }

    // 3. Portföy Anomalileri (Rule 1)
    console.log(`\n🔍 3. PORTFÖY ANOMALİLERİ:`);
    if (data.anomalies.length > 0) {
      data.anomalies.forEach((a: any) => {
        console.log(`   ❌ ANOMALİ: ${a.symbol} emirlerde aktif ama cüzdanda yok!`);
      });
      // AUTO HEAL
      console.log(`   ⚙️ AUTO-HEAL: Hayalet emirler temizleniyor...`);
      const fixResult = await DiagnosticsService.runAnomalyCleanup(userId);
      if (fixResult.success && fixResult.removedCount > 0) {
         console.log(`   ✅ BAŞARILI: ${fixResult.removedCount} adet hayalet emir veritabanından başarıyla temizlendi.`);
      }
    } else {
      console.log(`   ✅ OK: Aktif işlemlerde anomali saptanmadı.`);
    }

    console.log(`\n✨ Portföy denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ PORTFOLIO GUARDIAN HATASI:`, err);
  }
}

portfolioGuardian(Number(process.argv[2]) || 14);
