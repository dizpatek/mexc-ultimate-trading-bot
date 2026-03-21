import { sql } from '../../src/lib/postgres';

/**
 * 📡 MASTER PILOT HUB (Sinyal & İstihbarat Merkezi)
 * Gerçek zamanlı taramaları, sinyal akışını ve bot konfigürasyonlarını denetler.
 */

interface BotConfig {
  pilot_mode: string | null;
  auto_trade: boolean | null;
  pilot_timeframe: string | null;
  pilot_only_holdings: boolean | null;
}

interface StrategySignal {
  symbol: string;
  type: string;
  timeframe: string;
  timestamp: number | string;
}

async function pilotHubCheck(userId: number = 14) {
  console.log(`\n--- 📡 MASTER PILOT HUB: SİNYAL VE BOT İZLEME (User: ${userId}) ---`);
  const startTime = Date.now();

  try {
    // 1. Aktif Bot Konfigürasyonu
    console.log(`\n🤖 1. BOT KONFİGÜRASYONU:`);
    const { rows: config } = await sql`SELECT pilot_mode, auto_trade, pilot_timeframe, pilot_only_holdings FROM bot_configs WHERE user_id = ${userId}` as unknown as { rows: BotConfig[] };
    if (config.length > 0) {
      const c = config[0];
      console.log(`   - Mod          : ${c.pilot_mode?.toUpperCase()}`);
      console.log(`   - Otomatik İşlem: ${c.auto_trade ? '✅ AÇIK' : '❌ KAPALI'}`);
      console.log(`   - Zaman Dilimi : ${c.pilot_timeframe}`);
      console.log(`   - Portföy Kilidi: ${c.pilot_only_holdings ? '✅ AKTİF' : '❌ PASİF'}`);
    } else {
      console.log(`   ❌ HATA: Kullanıcı için bot konfigürasyonu bulunamadı!`);
    }

    // 2. Son Gelen Sinyaller (Raw Flow)
    console.log(`\n⚡ 2. SON SİNYAL AKIŞI (Global):`);
    const { rows: signals } = await sql`
      SELECT symbol, signal_type as type, timeframe, timestamp 
      FROM strategy_signals 
      ORDER BY timestamp DESC LIMIT 5
    ` as unknown as { rows: StrategySignal[] };
    
    if (signals.length > 0) {
      signals.forEach((s) => {
        const ts = typeof s.timestamp === 'number' ? s.timestamp : Number(s.timestamp) || Date.now();
        const time = new Date(ts).toLocaleTimeString();
        console.log(`   - [${time}] ${String(s.type).padEnd(8)} | ${String(s.symbol).padEnd(10)} | TF: ${s.timeframe}`);
      });
    } else {
      console.log(`   ⚠️ UYARI: Son 1 saat içinde sinyal saptanmadı.`);
    }

    // 3. Aktif Tarama Durumu (Active Scans)
    console.log(`\n🔭 3. AKTİF TARAMA DURUMU (System Logs):`);
    const { rows: logs } = await sql`
      SELECT message, timestamp FROM system_logs 
      WHERE user_id = ${userId} 
        AND (message ILIKE '%scan%' OR message ILIKE '%tarama%')
      ORDER BY timestamp DESC LIMIT 3
    `;
    
    if (logs.length > 0) {
      logs.forEach((l: any) => {
        const ts = typeof l.timestamp === 'number' ? l.timestamp : Number(l.timestamp) || Date.now();
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

pilotHubCheck();
