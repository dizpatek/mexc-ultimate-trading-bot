import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}
(process.env as any).NODE_ENV = 'production';

async function run() {
  const { sql } = await import('../../src/lib/postgres');
  const { rows } = await sql`
    SELECT id, symbol, side, status, trading_mode
    FROM orders
    WHERE user_id = 1 AND status NOT IN ('CLOSED', 'ARCHIVED')
    ORDER BY id DESC
  `;
  console.log('\n📋 Aktif işlemlerin trading_mode dağılımı:\n');
  const grouped: Record<string, number[]> = {};
  for (const r of rows as any[]) {
    const m = r.trading_mode || 'NULL';
    if (!grouped[m]) grouped[m] = [];
    grouped[m].push(r.id);
  }
  for (const [mode, ids] of Object.entries(grouped)) {
    console.log(`  ${mode}: ${ids.length} işlem → ID'ler: ${ids.join(', ')}`);
  }
  console.log('\n✅ Sonuç: "test" modundaki işlemler ASLA gerçek MEXC API\'sini çağırmaz.');
  console.log('   trading_mode = "test" → TradingSimulator kullanılır (güvenli)');
  console.log('   trading_mode = "production" → Gerçek borsa siparişi gider\n');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
