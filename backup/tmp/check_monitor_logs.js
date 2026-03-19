const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const now = Date.now();
    console.log(`Current Time: ${now} (${new Date(now).toLocaleString()})`);
    
    console.log('\n--- MONITOR LOGS (Last 5 Minutes) ---');
    const logs = await pool.query(`
      SELECT message, details, timestamp
      FROM system_logs
      WHERE (message LIKE '%SmartMonitor%' OR message LIKE '%TSL%' OR message LIKE '%TP%')
      AND timestamp > ${now - 5 * 60 * 1000}
      ORDER BY timestamp DESC
      LIMIT 30
    `);
    logs.rows.forEach(log => {
      console.log(`[${new Date(Number(log.timestamp)).toLocaleString()}] ${log.message} - ${log.details}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
