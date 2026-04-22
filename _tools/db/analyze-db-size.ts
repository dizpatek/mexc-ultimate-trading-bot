import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

async function run() {
  const { sql } = await import('../../src/lib/postgres');
  
  console.log('📊 Veri Hacmi Analizi:\n');
  
  const signalsCount = await sql`SELECT COUNT(*) FROM strategy_signals`;
  const logsCount = await sql`SELECT COUNT(*) FROM system_logs`;
  const ordersCount = await sql`SELECT COUNT(*) FROM orders`;
  
  console.log(`  strategy_signals: ${signalsCount.rows[0].count} satır`);
  console.log(`  system_logs: ${logsCount.rows[0].count} satır`);
  console.log(`  orders: ${ordersCount.rows[0].count} satır`);
  
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSignals = await sql`SELECT COUNT(*) FROM strategy_signals WHERE timestamp > ${sevenDaysAgo}`;
  const recentLogs = await sql`SELECT COUNT(*) FROM system_logs WHERE timestamp > ${sevenDaysAgo}`;
  
  console.log(`\n📅 Son 7 Günlük Hacim:`);
  console.log(`  Sinyaller: ${recentSignals.rows[0].count}`);
  console.log(`  Sistem Logları: ${recentLogs.rows[0].count}`);
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
