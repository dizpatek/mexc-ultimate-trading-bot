import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 🗄️ MASTER DB ORCHESTRATOR
 */

async function dbOrchestrate() {
  console.log(`\n--- 🗄️ MASTER DB ORCHESTRATOR: VERİTABANI YÖNETİM MERKEZİ ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getDbStatus();
    console.log(`   - Şema Dosyası: ${data.schemaFileExists ? '✅ OK' : '❌ EKSİK'}`);
    console.log(`   - Kullanıcı Sayısı: ${data.userCount}`);
    console.log(`\n✨ DB Orkestrasyonu ${Date.now() - startTime}ms içinde tamamlandı.`);
  } catch (err) {
    console.error(`\n❌ DB ORCHESTRATOR HATASI:`, err);
  }
}

dbOrchestrate();
