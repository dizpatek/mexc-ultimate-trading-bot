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
    SELECT id, symbol, side, status, created_at
    FROM orders
    WHERE user_id = 1
    ORDER BY id DESC
    LIMIT 50
  `;

  const active = rows.filter((r: any) => r.status !== 'CLOSED' && r.status !== 'ARCHIVED');
  console.log(`\n✅ Veritabanında aktif (status != CLOSED/ARCHIVED) işlem sayısı: ${active.length}\n`);
  for (const r of active) {
    const date = new Date(Number(r.created_at)).toLocaleString('tr-TR');
    console.log(`  [#${r.id}] ${r.symbol} | ${r.side} | status: ${r.status} | ${date}`);
  }
  process.exit(0);
}
run();
