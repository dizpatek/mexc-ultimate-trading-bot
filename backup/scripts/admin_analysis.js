
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require"
});

async function analyzeAdmin() {
  try {
    const res = await pool.query(`
      SELECT 
        o.id, o.symbol, o.side, o.price as entry_price, 
        o.meta::jsonb->>'exitPrice' as exit_price,
        o.meta::jsonb->>'exitReason' as exit_reason,
        o.meta::jsonb->>'highestPrice' as highest_reached,
        o.meta::jsonb->>'lowestPrice' as lowest_reached,
        o.meta::jsonb->'payload'->'stopLoss'->>'price' as initial_sl,
        o.meta::jsonb->'payload'->'takeProfit'->>'price' as initial_tp,
        o.meta::jsonb->'payload'->'takeProfit'->>'deviation' as tp_dev,
        o.meta::jsonb->'payload'->'stopLoss'->>'deviation' as sl_dev,
        o.created_at,
        o.meta
      FROM orders o
      WHERE o.user_id = 1 AND o.status = 'CLOSED'
      ORDER BY o.created_at DESC 
      LIMIT 100
    `);

    console.log('ADMIN_ANALYSIS_START');
    const logs = [];
    let totalPl = 0;
    let winCount = 0;
    let lossCount = 0;

    res.rows.forEach(row => {
      const entry = parseFloat(row.entry_price);
      const exit = parseFloat(row.exit_price || 0);
      const high = parseFloat(row.highest_reached || entry);
      const low = parseFloat(row.lowest_reached || entry);
      const isLong = row.side === 'BUY';
      
      let plPct = 0;
      if (exit > 0 && entry > 0) {
        plPct = isLong ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
      }

      // Max potential profit during trade life
      let maxPotential = isLong ? ((high - entry) / entry) * 100 : ((entry - low) / entry) * 100;
      
      totalPl += plPct;
      if (plPct > 0) winCount++; else lossCount++;

      logs.push({
        id: row.id,
        symbol: row.symbol,
        pl: plPct.toFixed(2) + '%',
        maxPotential: maxPotential.toFixed(2) + '%',
        exit: row.exit_reason,
        sl: row.initial_sl,
        tp: row.initial_tp,
        duration: row.meta ? ((JSON.parse(row.meta).closedAt - row.created_at) / 60000).toFixed(1) + 'm' : 'N/A'
      });
    });

    console.log(JSON.stringify(logs, null, 2));
    console.log('--- STATS ---');
    console.log(`Total Trades: ${res.rows.length}`);
    console.log(`Wins: ${winCount} | Losses: ${lossCount}`);
    console.log(`Win Rate: ${((winCount / res.rows.length) * 100).toFixed(1)}%`);
    console.log(`Avg P/L: ${(totalPl / res.rows.length).toFixed(2)}%`);
    console.log('ADMIN_ANALYSIS_END');

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
analyzeAdmin();
