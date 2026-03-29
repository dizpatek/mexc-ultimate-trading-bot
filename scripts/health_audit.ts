/**
 * 🔍 MASTER SYSTEM HEALTH AUDIT SCRIPT v2.3
 * Admin kullanıcısının tüm sistemini tek seferde inceler.
 * SSL ve Import Hoisting sorunları için dinamik yükleme yapar.
 */
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from root BEFORE other imports
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Force SSL for remote DBs (Vercel/Neon requirement)
process.env.PGSSLMODE = 'require';

function sep(title: string) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  🔍 ${title}`);
  console.log('═'.repeat(70));
}

function safe(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val).substring(0, 80);
  return String(val).substring(0, 80);
}

async function run() {
  // Dinamik importlar
  const { sql } = await import('../src/lib/postgres');
  const { DiagnosticsService } = await import('../src/lib/diagnostics');
  const { getHoldings } = await import('../src/lib/mexc-wrapper');
  const { getSetting } = await import('../src/lib/settings');

  try {
    // 1. ADMIN USER BİLGİSİ
    sep('1. ADMIN KULLANICI BİLGİSİ');
    const { rows: users } = await sql`
      SELECT id, username, email, is_admin,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id AND status IN ('OPEN','PENDING','FILLED')) as active_count,
        (SELECT MAX(timestamp) FROM strategy_signals WHERE user_id = users.id) as last_signal_time
      FROM users
      ORDER BY id ASC
    `;
    const adminUser = users.find((u: any) => u.is_admin) || users[0];
    const ADMIN_ID = Number(adminUser?.id || 1);
    
    console.table(users.map((u: any) => ({
      id: u.id,
      username: u.username,
      isAdmin: u.is_admin,
      totalOrders: u.order_count,
      activeOrders: u.active_count,
      lastSignal: u.last_signal_time ? new Date(Number(u.last_signal_time)).toLocaleString('tr-TR') : 'Hiç yok'
    })));
    console.log(`\n→ Kullanılan Admin User ID: ${ADMIN_ID} (${adminUser?.email})`);

    // 2. BOT KONFİGÜRASYONU
    sep('2. BOT KONFİGÜRASYONU (MOD + PİLOT AYARLARI)');
    const { rows: configs } = await sql`
      SELECT pilot_timeframe, pilot_mtf_veto, pilot_only_holdings, auto_trade
      FROM bot_configs WHERE user_id = ${ADMIN_ID}
    `;
    const activeMode = (await getSetting('TRADING_MODE', ADMIN_ID)) || 'test';
    console.log(`  📊 GÜNCEL MOD        : ${activeMode === 'production' ? '🚀 PRODUCTION (GERÇEK)' : '🔬 TEST (SIMÜLASYON)'}`);
    if (configs.length > 0) {
      const cfg = configs[0] as any;
      console.log(`  Pilot Timeframe    : ${cfg.pilot_timeframe}`);
      console.log(`  MTF Veto Aktif     : ${cfg.pilot_mtf_veto ? '✅ EVET' : '❌ HAYIR'}`);
      console.log(`  Sadece Portföy     : ${cfg.pilot_only_holdings ? '✅ EVET' : '❌ HAYIR'}`);
      console.log(`  Auto Trade         : ${cfg.auto_trade ? '✅ EVET' : '❌ HAYIR'}`);
    }

    // 3. CÜZDAN & BAKİYE KONTROLÜ (BOTUN GÖRDÜĞÜ)
    sep('3. CÜZDAN & BAKİYE KONTROLÜ (BOTUN GÖRDÜĞÜ)');
    const holdings = await getHoldings(ADMIN_ID, activeMode as any);
    if (holdings.length === 0) {
      console.log('⚠️  Bot hiçbir varlık göremiyor!');
    } else {
      console.table(holdings.map((h: any) => ({
        Varlık: h.asset || h.symbol,
        Serbest: Number(h.free).toFixed(4),
        Kilitli: Number(h.locked).toFixed(4),
        Toplam: (Number(h.free) + Number(h.locked)).toFixed(4)
      })));
      
      const xrp = holdings.find((h: any) => (h.asset || h.symbol) === 'XRP');
      if (xrp) {
        console.log(`\n✅ XRP TESPİT EDİLDİ: Toplam ${(Number(xrp.free) + Number(xrp.locked)).toFixed(4)}`);
      } else {
        console.log('\n❌ XRP BAKİYESİ BULUNAMADI! Bot XRP\'yi görmüyor.');
      }
    }

    // 4. SON SİNYALLER & VETO SEBEPLERİ
    sep('4. SON SİNYALLER — VETO / ONAY DURUMU');
    const { rows: signals } = await sql`
      SELECT symbol, signal_type, executed, veto_reason, timestamp
      FROM strategy_signals WHERE user_id = ${ADMIN_ID}
      ORDER BY timestamp DESC LIMIT 15
    `;
    console.table(signals.map((s: any) => ({
      symbol: s.symbol,
      type: s.signal_type,
      executed: s.executed ? '✅ EVET' : '❌ HAYIR',
      vetoReason: safe(s.veto_reason),
      time: new Date(Number(s.timestamp)).toLocaleString('tr-TR')
    })));

    // 5. SİSTEM LOGLARI
    sep('5. SİSTEM LOGLARI (Son 15)');
    const { rows: logs } = await sql`
      SELECT timestamp, message FROM system_logs
      WHERE user_id = ${ADMIN_ID} AND (message ILIKE '%pilot%' OR message ILIKE '%veto%' OR message ILIKE '%error%')
      ORDER BY timestamp DESC LIMIT 15
    `;
    logs.forEach((r: any) => {
      console.log(`[${new Date(Number(r.timestamp)).toLocaleString('tr-TR')}] ${r.message}`);
    });

    sep('✅ AUDIT TAMAMLANDI');
  } catch (err: any) {
    console.error('\n❌ AUDIT HATASI:', err.message);
  }
  process.exit(0);
}

run();
