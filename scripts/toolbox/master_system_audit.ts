import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🛠️ MASTER SYSTEM AUDIT (Sistem & Altyapı Denetçisi)
 * Veritabanı, şema, ayarlar ve çevre değişkenlerini tek noktadan doğrular.
 * Bu araç artık 'src/lib/diagnostics' servisinden güç almaktadır.
 */

async function systemAudit(userId: number = 14) {
  console.log(`\n--- 🛠️ MASTER SYSTEM AUDIT: ALTYAPI VE SAĞLIK RAPORU (User: ${userId}) ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getSystemAudit(userId);

    // 1. Veritabanı Bağlantı Testi
    console.log(`\n🗄️ 1. VERİTABANI BAĞLANTISI:`);
    console.log(`   ✅ Bağlantı Başarılı!`);
    console.log(`   🔸 Sürüm: ${data.dbVersion}`);
    console.log(`   🔸 Sunucu Saati: ${new Date(data.serverTime).toLocaleString()}`);

    // 2. Kritik Tablo Şema Kontrolü
    console.log(`\n📊 2. ŞEMA VE TABLO KONTROLÜ:`);
    data.tableStatus.forEach((t: any) => {
      console.log(`   - ${t.name.padEnd(20)}: ${t.exists ? '✅ OK' : '❌ EKSİK!'}`);
    });

    // 3. Sistem Ayarları (Settings) Denetimi
    console.log(`\n⚙️ 3. KRİTİK SİSTEM AYARLARI:`);
    if (data.settings.length > 0) {
      data.settings.forEach((s: any) => console.log(`   - ${String(s.key).padEnd(15)}: ${s.value}`));
    } else {
      console.log(`   ⚠️ UYARI: system_settings tablosunda veri saptanmadı!`);
    }

    // 4. Zaman Damgası Senkronizasyonu
    console.log(`\n🕒 4. ZAMAN SENKRONİZASYONU:`);
    const drift = Math.abs(data.drift);
    console.log(`   🔸 Yerel Saat   : ${new Date().toLocaleString()}`);
    console.log(`   🔸 DB Drift     : ${drift}ms ${drift > 5000 ? '⚠️ KRİTİK!' : '✅ STABİL'}`);

    console.log(`\n✨ Sistem denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ SİSTEM AUDIT HATASI:`, err);
  }
}

systemAudit(Number(process.argv[2]) || 14);
