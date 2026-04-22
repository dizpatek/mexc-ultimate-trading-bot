import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

async function run() {
  // Simulate what the holdings API does for user 1 in test mode
  const { getAccountInfo } = await import('../../src/lib/mexc-wrapper');
  
  console.log('📊 Holdings API Simülasyonu (User 1, test mode)\n');
  
  const accountInfo = await getAccountInfo(1, 'test');
  const activeBalances = (accountInfo.balances || []).filter(
    (b: any) => parseFloat(b.free) + parseFloat(b.locked) > 0
  );
  
  console.log(`Toplam bakiye sayısı: ${activeBalances.length}`);
  console.log('Varlıklar:');
  for (const b of activeBalances) {
    const total = parseFloat(b.free) + parseFloat(b.locked);
    console.log(`  ${b.asset}: ${total.toFixed(4)} (free: ${b.free}, locked: ${b.locked})`);
  }
  
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
