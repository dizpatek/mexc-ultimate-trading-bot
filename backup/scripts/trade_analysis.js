
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function analyze() {
  try {
    const res = await pool.query(`
      SELECT 
        id, symbol, side, status, price as entry_price, 
        meta::jsonb->>'exitPrice' as exit_price,
        meta::jsonb->>'exitReason' as exit_reason,
        meta::jsonb->'payload'->'stopLoss'->>'price' as initial_sl,
        meta::jsonb->'payload'->'takeProfit'->>'price' as initial_tp,
        meta::jsonb->'payload'->'takeProfit'->>'deviation' as tp_dev,
        meta::jsonb->'payload'->'stopLoss'->>'deviation' as sl_dev,
        created_at,
        meta
      FROM orders 
      WHERE status = 'CLOSED' 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    console.log('TRADE_ANALYSIS_START');
    const analysis = res.rows.map(row => {
      const entry = parseFloat(row.entry_price);
      const exit = parseFloat(row.exit_price || 0);
      const isLong = row.side === 'BUY';
      
      let plPct = 0;
      if (exit > 0 && entry > 0) {
        plPct = isLong ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
      }

      const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
      
      return {
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        plPct: plPct.toFixed(2) + '%',
        exitReason: row.exit_reason || 'N/A',
        initialSl: row.initial_sl,
        initialTp: row.initial_tp,
        tpDev: row.tp_dev,
        slDev: row.sl_dev,
        duration: meta.closedAt ? ((meta.closedAt - row.created_at) / 60000).toFixed(1) + 'm' : 'N/A',
        aiScore: meta.lastAiScore || meta.payload?.aiScore
      };
    });
    console.log(JSON.stringify(analysis, null, 2));
    console.log('TRADE_ANALYSIS_END');

    // Pattern Analysis
    const reasons = analysis.reduce((acc, trade) => {
      acc[trade.exitReason] = (acc[trade.exitReason] || 0) + 1;
      return acc;
    }, {});
    console.log('EXIT_REASONS_DISTRIBUTION', reasons);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
analyze();
