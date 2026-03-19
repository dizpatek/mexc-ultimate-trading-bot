import { getAccountInfo } from './src/lib/mexc-wrapper';

async function checkHoldings() {
  try {
    const acc = await getAccountInfo(1, 'test');
    if (!acc || !acc.balances) {
      console.log("Hesap bilgisi veya bakiye bulunamadı.");
      process.exit(0);
    }
    const holdings = acc.balances.filter((b: any) => parseFloat(b.free) + parseFloat(b.locked) > 0);
    console.log("--- MEXC Holdings ---");
    console.log(JSON.stringify(holdings, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Hata:", err);
    process.exit(1);
  }
}

checkHoldings();
