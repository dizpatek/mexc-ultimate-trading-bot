const { Pool } = require("pg");

const connectionString =
  "postgresql://_dac56e2d25fd06df:_4168e8653df0249ec119b3a5f278b9@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29790/_68afee465836?sslmode=require";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
});

async function sql(strings, ...values) {
  const query = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );
  const sanitizedValues = values.map((v) =>
    typeof v === "object" && v !== null && !(v instanceof Date)
      ? JSON.stringify(v)
      : v,
  );
  const client = await pool.connect();
  try {
    return await client.query(query, sanitizedValues);
  } finally {
    client.release();
  }
}

(async () => {
  try {
    // Tüm aktif işlemler
    const { rows: active } = await sql`
      SELECT id, symbol, side, price, qty, status, trading_mode, meta, created_at, updated_at
      FROM orders
      WHERE user_id = 1
        AND meta->>'smartTrade' = 'true'
        AND status IN ('FILLED', 'PENDING', 'PARTIALLY_FILLED')
      ORDER BY symbol, side, updated_at DESC
    `;
    console.log("=== AKTIF ISLEMLER ===");
    for (const r of active) {
      const meta = typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta;
      const p = meta?.payload || {};
      const sl = p?.stopLoss;
      const tp = p?.takeProfit;
      const isCover = p?.mode === "COVER";
      const entry = Number(r.price);
      const slPrice = sl?.price ? Number(sl.price) : 0;
      const tpPrice = tp?.price ? Number(tp.price) : 0;
      const slDist =
        slPrice > 0 ? Math.abs((entry - slPrice) / entry) * 100 : 0;
      const tpDist =
        tpPrice > 0 ? Math.abs((entry - tpPrice) / entry) * 100 : 0;

      // TSL durumu
      const activeSl = meta?.activeStopLoss ? Number(meta.activeStopLoss) : 0;
      const tslActivated = meta?.tslActivated;
      const highest = meta?.highestPrice;
      const lowest = meta?.lowestPrice;

      console.log(
        JSON.stringify({
          id: r.id,
          symbol: r.symbol,
          side: r.side,
          mode: p?.mode || "TRADE",
          entry: entry,
          qty: r.qty,
          slPrice: slPrice,
          slDistPct: slDist.toFixed(2),
          slTrailing: sl?.trailing,
          slDev: sl?.deviation,
          tpPrice: tpPrice,
          tpDistPct: tpDist.toFixed(2),
          tpTrailing: tp?.trailing,
          tpDev: tp?.deviation,
          activeSl: activeSl,
          tslActivated: tslActivated,
          highestPrice: highest,
          lowestPrice: lowest,
          filledAt: meta?.filledAt,
          ageHours: (
            (Date.now() - (meta?.filledAt || Date.now())) /
            3600000
          ).toFixed(1),
        }),
      );
    }

    // Tüm kapalı işlemler (son 50)
    const { rows: closed } = await sql`
      SELECT id, symbol, side, price, qty, status, trading_mode, meta, created_at, updated_at
      FROM orders
      WHERE user_id = 1
        AND meta->>'smartTrade' = 'true'
        AND status = 'CLOSED'
      ORDER BY updated_at DESC
      LIMIT 50
    `;
    console.log("\n=== KAPALI ISLEMLER (Son 50) ===");
    for (const r of closed) {
      const meta = typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta;
      const p = meta?.payload || {};
      const entry = Number(r.price);
      const exitPrice = Number(meta?.exitPrice || 0);
      const pnl = Number(meta?.profitLoss || 0);
      const pnlPct = Number(meta?.profitLossPercentage || 0);

      console.log(
        JSON.stringify({
          id: r.id,
          symbol: r.symbol,
          side: r.side,
          mode: p?.mode || "TRADE",
          entry: entry,
          exitPrice: exitPrice,
          pnl: pnl.toFixed(4),
          pnlPct: pnlPct.toFixed(2),
          exitReason: meta?.exitReason,
          filledAt: meta?.filledAt,
          closedAt: meta?.closedAt,
          durationHours:
            meta?.filledAt && meta?.closedAt
              ? ((meta.closedAt - meta.filledAt) / 3600000).toFixed(1)
              : "N/A",
        }),
      );
    }

    // Özet istatistikler
    console.log("\n=== OZET ===");
    const { rows: stats } = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('FILLED','PENDING','PARTIALLY_FILLED')) as active_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED') as closed_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND (meta->>'profitLoss')::numeric > 0) as wins,
        COUNT(*) FILTER (WHERE status = 'CLOSED' AND (meta->>'profitLoss')::numeric < 0) as losses
      FROM orders
      WHERE user_id = 1 AND meta->>'smartTrade' = 'true'
    `;
    console.log(
      "Aktif:",
      stats[0].active_count,
      "Kapali:",
      stats[0].closed_count,
      "Kazanilan:",
      stats[0].wins,
      "Kaybedilen:",
      stats[0].losses,
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  await pool.end();
})();
