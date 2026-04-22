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
    const { rows: closed } = await sql`
      SELECT id, symbol, side, price, qty, status, trading_mode, meta, created_at, updated_at
      FROM orders
      WHERE user_id = 1
        AND meta->>'smartTrade' = 'true'
        AND status = 'CLOSED'
        AND symbol ILIKE '%cgpt%'
      ORDER BY updated_at DESC
      LIMIT 20
    `;
    console.log("=== KAPALI CGPT ISLEMLERI ===");
    for (const r of closed) {
      const meta = typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta;
      console.log(
        JSON.stringify(
          {
            id: r.id,
            symbol: r.symbol,
            side: r.side,
            status: r.status,
            price: r.price,
            qty: r.qty,
            mode: r.trading_mode,
            exitReason: meta?.exitReason,
            exitPrice: meta?.exitPrice,
            profitLoss: meta?.profitLoss,
            profitLossPercentage: meta?.profitLossPercentage,
            payload: meta?.payload,
            filledAt: meta?.filledAt,
            closedAt: meta?.closedAt,
          },
          null,
          2,
        ),
      );
    }
    if (closed.length === 0) console.log("Kapali CGPT islemi yok.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  await pool.end();
})();
