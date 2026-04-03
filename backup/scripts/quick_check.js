
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function check() {
  try {
    const res = await pool.query("SELECT id, symbol, side, status, created_at, meta FROM orders WHERE symbol LIKE '%VISTA%' ORDER BY created_at DESC LIMIT 5");
    console.log('ORDER_DATA_START');
    res.rows.forEach(row => {
      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      console.log(`--- ORDER ${row.id} ---`);
      console.log(`Symbol: ${row.symbol} | Side: ${row.side} | Status: ${row.status}`);
      console.log(`Exit Reason: ${meta.exitReason || meta.meta_status || 'N/A'}`);
      console.log(`TP: ${meta.payload?.takeProfit?.price} (Trailing: ${meta.payload?.takeProfit?.trailing}, Dev: ${meta.payload?.takeProfit?.deviation})`);
      console.log(`SL: ${meta.payload?.stopLoss?.price} (Trailing: ${meta.payload?.stopLoss?.trailing}, Dev: ${meta.payload?.stopLoss?.deviation})`);
      console.log(`Monitor Logs:`, meta.monitorLogs);
    });
    console.log('ORDER_DATA_END');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
