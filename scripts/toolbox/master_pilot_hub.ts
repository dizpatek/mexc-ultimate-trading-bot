import { DiagnosticsService } from '../../src/lib/diagnostics';

/**
 * 📡 MASTER PILOT HUB (Sinyal & İstihbarat Merkezi)
 * Gerçek zamanlı taramaları, sinyal akışını ve bot konfigürasyonlarını denetler.
 * 'src/lib/diagnostics' servisini kullanır.
 */

async function pilotHubCheck(userId: number = 14) {
  console.log(`\n--- 📡 MASTER PILOT HUB: SİNYAL VE BOT İZLEME (User: ${userId}) ---`);
  const startTime = Date.now();

  try {
    const data = await DiagnosticsService.getPilotHub(userId);

    // 1. Aktif Bot Konfigürasyonu
    console.log(`\n🤖 1. BOT KONFİGÜRASYONU:`);
    if (data.config) {
      const c = data.config;
      console.log(`   - Mod          : ${c.pilot_mode?.toUpperCase()}`);
      console.log(`   - Otomatik İşlem: ${c.auto_trade ? '✅ AÇIK' : '❌ KAPALI'}`);
      console.log(`   - Zaman Dilimi : ${c.pilot_timeframe}`);
      console.log(`   - Portföy Kilidi: ${c.pilot_only_holdings ? '✅ AKTİF' : '❌ PASİF'}`);
    } else {
      console.log(`   ❌ HATA: Kullanıcı için bot konfigürasyonu bulunamadı!`);
    }

    // 2. Son Gelen Sinyaller
    console.log(`\n⚡ 2. SON SİNYAL AKIŞI (Kişisel):`);
    if (data.recentSignals.length > 0) {
      data.recentSignals.forEach((s: any) => {
        const ts = Number(s.timestamp) || Date.now();
        const time = new Date(ts).toLocaleTimeString();
        console.log(`   - [${time}] ${String(s.type).padEnd(8)} | ${String(s.symbol).padEnd(10)} | TF: ${s.timeframe}`);
      });
    } else {
      console.log(`   ⚠️ UYARI: Son zamanlarda sinyal saptanmadı.`);
    }

    // 3. Aktif Tarama Durumu (Active Scans)
    console.log(`\n🔭 3. AKTİF TARAMA DURUMU (System Logs):`);
    if (data.recentScans.length > 0) {
      data.recentScans.forEach((l: any) => {
        const ts = Number(l.timestamp) || Date.now();
        const time = new Date(ts).toLocaleTimeString();
        console.log(`   - [${time}] ${l.message}`);
      });
    } else {
      console.log(`   ℹ️ Bilgi: Yakın zamanda tarama günlüğü saptanmadı.`);
    }

    console.log(`\n✨ İstihbarat denetimi ${Date.now() - startTime}ms içinde tamamlandı.`);

  } catch (err) {
    console.error(`\n❌ PILOT HUB HATASI:`, err);
  }
}

pilotHubCheck(Number(process.argv[2]) || 14);
