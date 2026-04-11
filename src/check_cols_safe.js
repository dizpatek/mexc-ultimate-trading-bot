// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sql, pool } = require('./lib/postgres');

async function checkColumns() {
  try {
    const { rows } = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'strategy_signals'
    `;
    console.log('COLUMNS_LIST:', rows.map(r => r.column_name).join(','));
  } catch (e) {
    console.error('CHECK FAILED:', e.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
