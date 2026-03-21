import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 📈 MASTER PERFORMANCE ANALYZER (Ticaret Analitiği)
 * PnL, başarı oranı, çıkış nedenleri ve mod bazlı kuralları (Rule 3 & 4) denetler.
 * 'src/lib/diagnostics' servisini kullanır.
 */

async function performanceAnalyzer(userId: number = 14) {
  console.log(`\n--- 📈 MASTER PERFORMANCE ANALYZER: TİCARET VE MOD DENETİMİ ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getPerformance(userId);

    // 1. Genel Performans Özeti (Kârlı/Zararlı)
    console.log(`\n📊 1. GENEL PERFORMANS (Son 50 İşlem):`);
    if (data.total > 0) {
       console.log(`   - Toplam  : ${data.total}`);
       console.log(`   - Başarı Oranı: %${data.winRate.toFixed(1)}`);
    } else {
      console.log(`   ℹ️ Bilgi: Tamamlanmış son işlem bulunamadı.`);
    }

    // 2. Çıkış Nedenleri Analizi
    console.log(`\n🚪 2. ÇIKIŞ NEDENLERİ:`);
    Object.entries(data.reasons).forEach(([r, count]) => {
      console.log(`   - ${r.padEnd(20)}: ${count} adet`);
    });

    console.log(`\n✨ Performans denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ PERFORMANCE ANALYZER HATASI:`, err);
  }
}

performanceAnalyzer();
