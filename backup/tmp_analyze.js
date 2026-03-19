const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function run() {
  const { rows } = await pool.query(`
    SELECT id, symbol, side, status, meta::jsonb->>'closeReason' as reason, 
           meta::jsonb->>'entryPrice' as entry, meta::jsonb->>'exitPrice' as exit, 
           meta::jsonb->>'activeStopLoss' as sl,
           meta::jsonb->>'tpTriggered' as tp_hit,
           (updated_at - created_at)/1000 as duration_sec
    FROM orders 
    WHERE status = 'CLOSED' 
    ORDER BY updated_at DESC 
    LIMIT 30
  `);
  console.table(rows);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
