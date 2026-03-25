import { DiagnosticsService } from '../../src/lib/diagnostics';
import { pool } from '../../src/lib/postgres';

/**
 * 🔎 DB Quick Scan — Kullanıcıları ve orders tablosunu direkt incele
 */
async function quickScan() {
  // 1. Tüm kullanıcılar
  const users = await DiagnosticsService.getAllUsers();
  console.log('\n👥 TÜM KULLANICILAR:');
  (users as any[]).forEach(u =>
    console.log(`  [${u.id}] ${u.email} | admin:${u.is_admin} | orders:${u.order_count}`)
  );

  // 2. orders tablosundaki toplam kayıtlar
  const { rows: totalOrders } = await pool.query(
    'SELECT count(*) as total, count(CASE WHEN status = \'FILLED\' THEN 1 END) as active FROM orders'
  );
  console.log(`\n📦 ORDERS TABLOSU: Toplam: ${totalOrders[0].total} | Aktif (FILLED): ${totalOrders[0].active}`);

  // 3. Durum bazlı dağılım
  const { rows: statusBreakdown } = await pool.query(`
    SELECT status, count(*) as cnt FROM orders GROUP BY status ORDER BY cnt DESC
  `);
  console.log('\n📊 DURUM DAĞILIMI:');
  statusBreakdown.forEach(r => console.log(`  ${r.status.padEnd(12)}: ${r.cnt}`));

  // 4. User bazlı orders sayısı
  const { rows: userOrders } = await pool.query(`
    SELECT o.user_id, u.email, count(*) as cnt
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    GROUP BY o.user_id, u.email ORDER BY cnt DESC LIMIT 10
  `);
  console.log('\n👤 KULLANICI BAZLI İŞLEM SAYISI:');
  userOrders.forEach(r => console.log(`  [${r.user_id}] ${r.email || '?'}: ${r.cnt} emir`));

  // 5. Smart trade meta içeren kayıtlar
  const { rows: smartCheck } = await pool.query(`
    SELECT count(*) as total,
           count(CASE WHEN meta::jsonb->>'smartTrade' = 'true' THEN 1 END) as smart_trades
    FROM orders WHERE meta IS NOT NULL
  `);
  console.log(`\n🤖 SMARTTRADE META: Toplam Meta: ${smartCheck[0].total} | SmartTrade=true: ${smartCheck[0].smart_trades}`);

  // 6. Son 5 order raw
  const { rows: lastOrders } = await pool.query(`
    SELECT id, user_id, symbol, side, status, price, qty,
           substring(meta::text, 1, 120) as meta_preview,
           created_at
    FROM orders ORDER BY created_at DESC LIMIT 5
  `);
  console.log('\n🔍 SON 5 EMİR (RAW):');
  lastOrders.forEach(r => {
    const ts = new Date(parseInt(r.created_at || '0')).toLocaleString('tr-TR');
    console.log(`  [${r.id}] user:${r.user_id} | ${r.symbol} | ${r.side} | ${r.status} | ${ts}`);
    console.log(`     Meta önizleme: ${r.meta_preview}`);
  });

  await pool.end();
}

quickScan();
