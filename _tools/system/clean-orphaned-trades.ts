import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
    const separator = process.env.POSTGRES_URL.includes('?') ? '&' : '?';
    process.env.POSTGRES_URL += `${separator}sslmode=require`;
}
(process.env as any).NODE_ENV = 'production';

async function cleanOrphanedTrades() {
  try {
    const { sql } = await import('../../src/lib/postgres');
    
    console.log("==================================================");
    console.log("🧹 HAYALET (ORPHANED) ISLEMLER TEMIZLIK ARACI");
    console.log("==================================================");

    const { rows } = await sql`
      SELECT id, symbol, side, created_at, meta
      FROM orders
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const rawData: any[] = rows as any[];
    
    // Find orphaned active trades older than 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const orphanedTrades = rawData.filter((row: any) => {
      try {
        const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
        const isActive = meta.tradeState === 'TRADE_ACTIVE' || meta.tradeState === 'COVER_SOLD';
        const isOld = Number(row.created_at) < twentyFourHoursAgo;
        return isActive && isOld;
      } catch (e) {
        return false;
      }
    });

    if (orphanedTrades.length === 0) {
      console.log("✅ Temizlenecek 24 saatten eski hayalet işlem bulunamadı.");
      return;
    }

    console.log(`⚠️ Toplam ${orphanedTrades.length} adet hayalet işlem tespit edildi. Veritabanı güncelleniyor...`);

    let successCount = 0;
    
    for (const row of orphanedTrades) {
      let metaObj: any = {};
      try { metaObj = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {}); } catch(e) {}
      
      // Mark as completed
      metaObj.tradeState = row.side === 'BUY' ? 'TRADE_COMPLETED' : 'COVER_COMPLETED';
      metaObj.exitReason = 'ORPHANED_CLEANUP_BY_ADMIN';
      metaObj.closedAt = Date.now();
      
      try {
        await sql`
          UPDATE orders 
          SET meta = ${JSON.stringify(metaObj)}::jsonb, status = 'CLOSED'
          WHERE id = ${row.id}
        `;
        successCount++;
        console.log(`[#${row.id}] ${row.symbol} (${row.side}) veritabanında başarıyla kapatıldı.`);
      } catch (updateErr) {
        console.error(`[#${row.id}] işlemi güncellenirken hata oluştu:`, updateErr);
      }
    }
    
    console.log("\n==================================================");
    console.log(`✨ Temizlik Tamamlandı! ${successCount} adet eski işlem tamamen kapatıldı.`);
    console.log("==================================================");

  } catch (err) {
    console.error("Kritik Hata:", err);
  } finally {
    process.exit(0);
  }
}

cleanOrphanedTrades();
