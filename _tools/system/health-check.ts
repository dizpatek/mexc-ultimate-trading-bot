import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}
process.env.NODE_ENV = 'production';

// Fetch current price from MEXC
async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const clean = symbol.replace('/', '').toUpperCase();
    const res = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${clean}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const d: any = await res.json();
    const p = parseFloat(d.price);
    return isNaN(p) || p <= 0 ? null : p;
  } catch { return null; }
}

async function run() {
  const { sql } = await import('../src/lib/postgres.ts');
  const { rows } = await sql`
    SELECT id, symbol, side, status, price, qty, created_at, meta
    FROM orders
    WHERE user_id = 1 AND status NOT IN ('CLOSED', 'ARCHIVED')
    ORDER BY id DESC
  `;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔬 DETAYLI İŞLEM SAĞLIK RAPORU — ${new Date().toLocaleString('tr-TR')}`);
  console.log(`${'='.repeat(70)}\n`);

  let problemCount = 0;

  for (const row of rows) {
    let meta: any = {};
    try { meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {}); } catch {}
    const payload: any = meta.payload || {};

    const id = row.id;
    const symbol = row.symbol;
    const side = row.side;       // BUY=LONG, SELL=SHORT
    const mode = meta.mode || (side === 'BUY' ? 'TRADE' : 'COVER');
    const isLong = mode === 'TRADE';
    const isShort = mode === 'COVER';

    const entryPrice  = parseFloat(String(row.price));
    const sl          = meta.activeStopLoss  ? parseFloat(String(meta.activeStopLoss))  : parseFloat(payload?.stopLoss?.price  || '0');
    const tp          = meta.activeTakeProfit ? parseFloat(String(meta.activeTakeProfit)) : parseFloat(payload?.takeProfit?.price || '0');
    const tslActive   = !!meta.tslActivated;
    const tpTriggered = !!meta.tpTriggered;
    const highestSeen = meta.highestPrice ? parseFloat(String(meta.highestPrice)) : entryPrice;
    const lowestSeen  = meta.lowestPrice  ? parseFloat(String(meta.lowestPrice))  : entryPrice;

    // Fetch live price
    const currentPrice = await fetchPrice(symbol);

    const pnlPct = currentPrice && entryPrice > 0
      ? isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100
      : null;

    // ---- HEALTH CHECKS ----
    const problems: string[] = [];

    if (currentPrice && sl > 0) {
      if (isLong  && currentPrice <= sl) problems.push(`🚨 SL'YE DÜŞMÜŞ AMA KAPANMADI! Şu an: $${currentPrice.toFixed(6)} | SL: $${sl.toFixed(6)}`);
      if (isShort && currentPrice >= sl) problems.push(`🚨 SL'YE YÜKSELMİŞ AMA KAPANMADI! Şu an: $${currentPrice.toFixed(6)} | SL: $${sl.toFixed(6)}`);
    }

    if (currentPrice && tp > 0) {
      if (isLong  && currentPrice >= tp && !tpTriggered) problems.push(`⚠️ TP'YE ULAŞMIŞ AMA TTP DEVREYE GİRMEMİŞ! Şu an: $${currentPrice.toFixed(6)} | TP: $${tp.toFixed(6)}`);
      if (isShort && currentPrice <= tp && !tpTriggered) problems.push(`⚠️ TP'YE DÜŞMÜŞ AMA TTP DEVREYE GİRMEMİŞ! Şu an: $${currentPrice.toFixed(6)} | TP: $${tp.toFixed(6)}`);
    }

    if (!sl || sl <= 0) problems.push(`❓ STOP LOSS YOK! İşlem korumasız.`);
    if (!tp || tp <= 0) problems.push(`❓ TAKE PROFIT YOK! Kâr hedefi belirsiz.`);

    const openMs   = Date.now() - Number(row.created_at);
    const openHrs  = openMs / 3600000;
    if (openHrs > 72) problems.push(`⏰ 72 saatten fazladır açık (${openHrs.toFixed(0)} saat). Gözden geçir!`);

    // ---- STATUS ----
    let statusIcon = '🟡';
    if (problems.length === 0) {
      if (tpTriggered) statusIcon = '🚀';
      else if (tslActive) statusIcon = '🛡️';
      else statusIcon = '✅';
    } else {
      statusIcon = '🔴';
      problemCount += problems.length;
    }

    const slDistPct = sl > 0 && currentPrice
      ? isLong ? ((currentPrice - sl) / currentPrice * 100) : ((sl - currentPrice) / currentPrice * 100)
      : null;
    const tpDistPct = tp > 0 && currentPrice
      ? isLong ? ((tp - currentPrice) / currentPrice * 100) : ((currentPrice - tp) / currentPrice * 100)
      : null;

    console.log(`${statusIcon} [#${id}] ${symbol} | ${mode} | Giriş: $${entryPrice}`);
    console.log(`   Anlık: ${currentPrice ? '$' + currentPrice.toFixed(6) : '⚡ API timeout'} | PnL: ${pnlPct !== null ? (pnlPct >= 0 ? '▲' : '▼') + Math.abs(pnlPct).toFixed(3) + '%' : 'N/A'}`);
    console.log(`   SL: ${sl > 0 ? '$' + sl.toFixed(6) + (slDistPct !== null ? ` (%${slDistPct.toFixed(2)} uzakta)` : '') : '—'} | TP: ${tp > 0 ? '$' + tp.toFixed(6) + (tpDistPct !== null ? ` (%${tpDistPct.toFixed(2)} uzakta)` : '') : '—'}`);
    console.log(`   TSL: ${tslActive ? '🛡️ AKTİF' : '⏳ Henüz aktifleşmedi'} | TTP: ${tpTriggered ? '🚀 HEDEF KISIMI' : '⏳ Bekleniyor'}`);
    console.log(`   Süre: ${openHrs.toFixed(1)} saat | En yüksek: $${highestSeen} | En düşük: $${lowestSeen}`);

    if (problems.length > 0) {
      for (const p of problems) console.log(`   └─ ${p}`);
    }
    console.log('');
  }

  console.log(`${'='.repeat(70)}`);
  if (problemCount === 0) {
    console.log(`✅ Tüm işlemler sağlıklı görünüyor. Toplam sorun: 0`);
  } else {
    console.log(`🔴 TOPLAM ${problemCount} SORUN TESPİT EDİLDİ! Yukarıdaki detaylara bakın.`);
  }
  console.log(`${'='.repeat(70)}\n`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
