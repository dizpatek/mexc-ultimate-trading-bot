const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

/**
 * 🧹 Mükerrer İşlem Temizlik Aracı (Matrix Cleanup)
 * Hedge modundaki "Max 1 Long, Max 1 Short" kuralına uymayan 
 * eski işlemleri tespit eder ve veritabanında kapatır.
 */

async function cleanup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const userId = 14;
    console.log(`\n--- 🧹 MÜKERRER İŞLEM TEMİZLİĞİ BAŞLATILIYOR (User: ${userId}) ---`);

    // 1. Aktif İşlemleri Grupla (Side bazlı)
    const { rows: allActive } = await client.query(`
      SELECT id, symbol, (meta::jsonb->>'mode') as mode, created_at
      FROM orders 
      WHERE user_id = $1 AND status = 'FILLED' AND meta::jsonb->>'smartTrade' = 'true'
      ORDER BY created_at DESC
    `, [userId]);

    if (allActive.length <= 2) {
      console.log('✨ Temizlenecek mükerrer işlem bulunamadı. (Kurallara uygun)');
      return;
    }

    const tradeToKeep = allActive.find(o => o.mode === 'TRADE');
    const coverToKeep = allActive.find(o => o.mode === 'COVER');

    const idsToClose = allActive
      .filter(o => o.id !== tradeToKeep?.id && o.id !== coverToKeep?.id)
      .map(o => o.id);

    if (idsToClose.length > 0) {
      console.log(`\n⚠️ TOPLAM ${idsToClose.length} ADET MÜKERRER İŞLEM KAPATILACAK.`);
      console.log(`   💎 KORUNANLAR: 
      - LONG : ${tradeToKeep ? tradeToKeep.symbol : 'Yok'}
      - SHORT: ${coverToKeep ? coverToKeep.symbol : 'Yok'}`);

      // 2. İşlemleri Kapat (Batch Update)
      const res = await client.query(`
        UPDATE orders 
        SET status = 'CLOSED', 
            updated_at = $1,
            meta = (meta::jsonb || '{"exitReason": "CLEANUP_DUPLICATE_REMOVED", "cleaned_at": "' || $1 || '"}'::jsonb)::text
        WHERE id = ANY($2)
      `, [Date.now(), idsToClose]);

      console.log(`\n✅ BAŞARILI: ${res.rowCount} işlem veritabanında 'CLOSED' olarak işaretlendi.`);
      console.log(`💡 Not: Bu işlem sadece veritabanı temizliğidir. Borsa tarafındaki gerçek pozisyonlarınızı kontrol etmeyi unutmayın.`);
    } else {
      console.log('\n✨ Temizlenecek mükerrer işlem saptanmadı.');
    }

  } catch (err) {
    console.error('❌ Hata:', err);
  } finally {
    await client.end();
  }
}

cleanup();
