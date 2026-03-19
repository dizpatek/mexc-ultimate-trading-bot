const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  try {
    const now = Date.now();
    console.log(`Current Time: ${now} (${new Date(now).toLocaleString()})`);
    
    console.log('\n--- LAST 30 SYSTEM LOGS ---');
    const logs = await pool.query(`
      SELECT level, message, details, timestamp
      FROM system_logs
      ORDER BY timestamp DESC
      LIMIT 30
    `);
    logs.rows.forEach(log => {
      console.log(`[${log.timestamp}] [${new Date(Number(log.timestamp)).toLocaleString()}] ${log.level}: ${log.message}`);
    });

    console.log('\n--- ERROR LOGS (Last 2 Hours) ---');
    const errors = await pool.query(`
      SELECT level, message, details, timestamp
      FROM system_logs
      WHERE level = 'ERROR' AND timestamp > ${now - 2 * 60 * 60 * 1000}
      ORDER BY timestamp DESC
      LIMIT 20
    `);
    errors.rows.forEach(log => {
      console.log(`[${log.timestamp}] ${log.message} - ${log.details}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
