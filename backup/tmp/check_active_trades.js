const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('--- BOT CONFIG ---');
    const config = await pool.query('SELECT * FROM bot_config LIMIT 1');
    console.log(JSON.stringify(config.rows[0], null, 2));

    console.log('\n--- ACTIVE TRADES (FILLED/PENDING) ---');
    const trades = await pool.query(`
      SELECT id, symbol, side, status, price, qty, meta
      FROM orders
      WHERE status IN ('FILLED', 'PENDING') AND (meta::jsonb->>'smartTrade' = 'true')
    `);
    trades.rows.forEach(t => {
      const meta = typeof t.meta === 'string' ? JSON.parse(t.meta) : t.meta;
      console.log(`ID: ${t.id} | ${t.symbol} | ${t.side} | Status: ${t.status} | Price: ${t.price}`);
      console.log(`   SL: ${meta.payload?.stopLoss?.price || 'NO'} | TP: ${meta.payload?.takeProfit?.price || 'NO'}`);
      if (meta.pilotVetoReason) {
        console.log(`   VETO: ${meta.pilotVetoReason}`);
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
