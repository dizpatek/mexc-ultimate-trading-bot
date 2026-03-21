import { sql } from '../../src/lib/postgres';

/**
 * 🛠️ MASTER SYSTEM AUDIT (Sistem & Altyapı Denetçisi)
 * Veritabanı, şema, ayarlar ve çevre değişkenlerini tek noktadan doğrular.
 */

async function systemAudit() {
  console.log(`\n--- 🛠️ MASTER SYSTEM AUDIT: ALTYAPI VE SAĞLIK RAPORU ---`);
  const startTime = Date.now();

  try {
    // 1. Veritabanı Bağlantı Testi
    console.log(`\n🗄️ 1. VERİTABANI BAĞLANTISI:`);
    const { rows: dbTest } = await sql`SELECT version(), now()`;
    const dbInfo = dbTest[0] as any;
    console.log(`   ✅ Bağlantı Başarılı!`);
    console.log(`   🔸 Sürüm: ${dbInfo?.version?.split(' ')[0]}`);
    console.log(`   🔸 Sunucu Saati: ${new Date(dbInfo?.now).toLocaleString()}`);

    // 2. Kritik Tablo Şema Kontrolü
    console.log(`\n📊 2. ŞEMA VE TABLO KONTROLÜ:`);
    const tables = ['system_settings', 'bot_configs', 'strategy_signals', 'orders', 'system_logs', 'portfolio'];
    
    for (const t of tables) {
      const { rows } = await sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = ${t}
      `;
      console.log(`   - ${t.padEnd(20)}: ${rows.length > 0 ? '✅ OK' : '❌ EKSİK!'}`);
    }

    // 3. Sistem Ayarları (Settings) Denetimi
    console.log(`\n⚙️ 3. KRİTİK SİSTEM AYARLARI:`);
    const { rows: settings } = await sql`SELECT key, value FROM system_settings`;
    if (settings.length > 0) {
      settings.forEach((s: any) => console.log(`   - ${String(s.key).padEnd(15)}: ${s.value}`));
    } else {
      console.log(`   ⚠️ UYARI: system_settings tablosunda veri saptanmadı!`);
    }

    // 4. Zaman Damgası Senkronizasyonu
    console.log(`\n🕒 4. ZAMAN SENKRONİZASYONU:`);
    const clientTime = Date.now();
    const serverTime = new Date(dbInfo?.now).getTime();
    const drift = Math.abs(clientTime - serverTime);
    console.log(`   🔸 Yerel Saat   : ${new Date(clientTime).toLocaleString()}`);
    console.log(`   🔸 DB Drift     : ${drift}ms ${drift > 5000 ? '⚠️ KRİTİK!' : '✅ STABİL'}`);

    console.log(`\n✨ Sistem denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ SİSTEM AUDIT HATASI:`, err);
  }
}

systemAudit();
