const { sql, pool } = require('../lib/postgres');

async function checkColumns() {
  try {
    const { rows } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'strategy_signals'
    `;
    console.log('COLUMNS:', rows.map(r => r.column_name));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkColumns();
