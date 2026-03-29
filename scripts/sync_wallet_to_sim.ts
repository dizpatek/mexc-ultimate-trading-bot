/**
 * ♻️ WALLET TO SIMULATOR SYNC TOOL
 * Gerçek MEXC bakiye verilerini Simülasyon (Test) moduna aktarır.
 * Bu sayede "Portföyü Tara" aktifken gerçek varlıklarınızla test yapabilirsiniz.
 */
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function run() {
  const { getHoldings } = await import('../src/lib/mexc-wrapper');
  const { setSetting } = await import('../src/lib/settings');
  const { sql } = await import('../src/lib/postgres');

  const ADMIN_ID = 1; // Standart Admin ID

  console.log(`\n♻️  Cüzdan Senkronizasyonu Başlatıldı (User: ${ADMIN_ID})...`);

  try {
    // 1. Gerçek bakiyeleri çek (Production modundan)
    console.log('  → Gerçek MEXC bakiyeleri okunuyor...');
    const realHoldings = await getHoldings(ADMIN_ID, 'production');

    if (realHoldings.length === 0) {
      console.log('  ❌ Gerçek cüzdanda hiç varlık bulunamadı veya API anahtarları hatalı.');
      return;
    }

    // 2. Formatla (Simülasyonun beklediği format)
    const simBalances = realHoldings.map((h: any) => ({
      asset: h.asset || h.symbol,
      free: Number(h.free),
      locked: Number(h.locked)
    }));

    // 3. Simülasyon ayarlarına kaydet
    console.log(`  → ${simBalances.length} varlık simülasyona aktarılıyor...`);
    await setSetting('SIMULATED_BALANCES', JSON.stringify(simBalances), ADMIN_ID);
    
    // 4. Force V3 migration flag if needed
    if (simBalances.length >= 8) {
       await setSetting('SIM_V3_MIGRATED', 'true', ADMIN_ID);
    }

    console.log('\n✅ SENKRONİZASYON TAMAMLANDI!');
    console.log('   Artık Test Modu cüzdanınız, gerçek cüzdanınızla aynı.');
    
    // 5. XRP Kontrolü
    const xrp = simBalances.find(b => b.asset === 'XRP');
    if (xrp) {
      console.log(`   🚀 XRP tespit edildi: ${xrp.free.toFixed(4)}`);
    }

  } catch (err: any) {
    console.error('\n❌ HATA:', err.message);
  }
  process.exit(0);
}

run();
