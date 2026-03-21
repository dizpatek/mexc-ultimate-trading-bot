import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🛠️ MASTER MAINTENANCE KIT (Bakım & Onarım Kiti)
 */

async function maintenanceKit() {
  console.log(`\n--- 🛠️ MASTER MAINTENANCE KIT: SİSTEM BAKIM VE ONARIM ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getMaintenance();

    // 1. Mükerrer İşlem Denetimi
    console.log(`\n🧹 1. MÜKERRER İŞLEM TARAMASI:`);
    if (data.duplicates.length > 0) {
      console.log(`   ⚠️ UYARI: ${data.duplicates.length} adet mükerrer işlem grubu saptandı!`);
      data.duplicates.forEach((d: any) => console.log(`      - ${d.symbol}: ${d.count} adet`));
    } else {
      console.log(`   ✅ OK: Mükerrer aktif işlem bulunamadı.`);
    }

    // 2. Şema Sağlığı
    console.log(`\n🛠️ 2. ŞEMA SAĞLIĞI:`);
    if (data.indexHealth) {
      console.log(`   ✅ OK: 'orders' tablosu user_id indeksleri mevcut.`);
    } else {
      console.log(`   ⚠️ TAVSİYE: Performans için 'orders' tablosuna user_id indeksi eklenmeli.`);
    }

    console.log(`\n✨ Bakım denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ MAINTENANCE KIT HATASI:`, err);
  }
}

maintenanceKit();
