const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  connectionTimeoutMillis: 15000 
});

async function cleanup() {
  console.log('--- DB CLEANUP TASK START ---');
  try {
    // 1. Get stats before truncate (Investigation)
    const stats = await pool.query(`
      SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) as size 
      FROM pg_catalog.pg_stat_user_tables 
      WHERE relname IN ('market_trades', 'system_logs', 'strategy_signals', 'alarm_logs', 'trade_history');
    `);
    console.log('--- PRE-CLEANUP SIZES ---');
    stats.rows.forEach(r => console.log(`${r.relname}: ${r.size}`));

    // 2. Perform TRUNCATE on bloated log tables
    console.log('Truncating market_trades...');
    await pool.query('TRUNCATE TABLE market_trades;');
    
    console.log('Truncating system_logs...');
    await pool.query('TRUNCATE TABLE system_logs;');

    // 3. Selective delete for signals (older than 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    console.log('Deleting signals older than 7 days...');
    const delRes = await pool.query('DELETE FROM strategy_signals WHERE timestamp < $1', [sevenDaysAgo]);
    console.log(`Deleted ${delRes.rowCount} old signals.`);

    // 4. Verify post-cleanup database size
    const postStats = await pool.query(`SELECT pg_size_pretty(pg_database_size('_169a43476a1c')) as total_db_size;`);
    console.log('--- TOTAL DB SIZE (CLEANED) ---');
    console.log(`Total DB Size: ${postStats.rows[0].total_db_size}`);

    console.log('SUCCESS: Database storage cleaned up.');
  } catch (e) {
    console.error('CRITICAL ERROR during cleanup:', e.stack || e.message);
  } finally {
    await pool.end();
  }
}

cleanup();
