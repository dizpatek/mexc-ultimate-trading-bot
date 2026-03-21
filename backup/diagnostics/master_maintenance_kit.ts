import { sql } from '../../src/lib/postgres';

/**
 * 🛠️ MASTER MAINTENANCE KIT (Bakım & Onarım Kiti)
 * Mükerrer işlem temizliği, şema onarımı ve operasyonel bakım görevlerini yürütür.
 */

async function maintenanceKit() {
  console.log(`\n--- 🛠️ MASTER MAINTENANCE KIT: SİSTEM BAKIM VE ONARIM ---`);
  const startTime = Date.now();

  try {
    // 1. Mükerrer İşlem Denetimi (Hedge Rules)
    console.log(`\n🧹 1. MÜKERRER İŞLEM TARAMASI:`);
    const { rows: duplicates } = await sql`
      SELECT symbol, meta::jsonb->>'mode' as mode, count(*) 
      FROM orders 
      WHERE status = 'FILLED'
      GROUP BY symbol, meta::jsonb->>'mode'
      HAVING count(*) > 1
    `;
    
    if (duplicates.length > 0) {
      console.log(`   ⚠️ UYARI: ${duplicates.length} adet mükerrer işlem grubu saptandı!`);
      duplicates.forEach((d: any) => console.log(`      - ${d.symbol} [${d.mode}]: ${d.count} adet`));
      console.log(`   💡 İpucu: Bu işlemleri 'cleanup_duplicate_trades.js' ile temizleyebilirsiniz.`);
    } else {
      console.log(`   ✅ OK: Mükerrer aktif işlem bulunamadı.`);
    }

    // 2. Eksik Şema / Tablo Onarımı Ön-Kontrolü
    console.log(`\n🛠️ 2. ŞEMA SAĞLIĞI:`);
    const { rows: indexes } = await sql`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'orders' AND indexname LIKE '%user_id%'
    `;
    if (indexes.length > 0) {
      console.log(`   ✅ OK: 'orders' tablosu user_id indeksleri mevcut.`);
    } else {
      console.log(`   ⚠️ TAVSİYE: Performans için 'orders' tablosuna user_id indeksi eklenmeli.`);
    }

    // 3. Admin ve Kullanıcı Durumu
    console.log(`\n👤 3. KULLANICI ERİŞİM DURUMU:`);
    const { rows: users } = await sql`SELECT id, email, is_admin FROM users LIMIT 5`;
    users.forEach((u: any) => console.log(`   - ID: ${u.id} | Email: ${u.email} | Admin: ${u.is_admin ? 'EVET' : 'HAYIR'}`));

    console.log(`\n✨ Bakım denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ MAINTENANCE KIT HATASI:`, err);
  }
}

maintenanceKit();
