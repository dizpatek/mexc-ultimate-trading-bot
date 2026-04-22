import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += '?sslmode=require';
}

async function run() {
  const { getAccountInfo, getPrice } = await import('../../src/lib/mexc-wrapper');
  console.log('Testing portfolio fetching logic...');
  try {
    const accountInfo = await getAccountInfo(1, 'test');
    const activeBalances = (accountInfo.balances || []).filter(
      (b: any) => parseFloat(b.free) + parseFloat(b.locked) > 0
    );
    console.log(`Active balances: ${activeBalances.length}`);
    for (const b of activeBalances) {
      if (b.asset === 'USDT' || b.asset === 'USDC') continue;
      const pair = `${b.asset}USDT`;
      console.log(`Fetching price for ${pair}...`);
      try {
        const price = await getPrice(pair);
        console.log(`  Price: ${price}`);
      } catch (e: any) {
        console.error(`  Error for ${pair}: ${e.message}`);
      }
    }
  } catch (e: any) {
    console.error('Fatal error:', e.message);
  }
  process.exit(0);
}
run();
