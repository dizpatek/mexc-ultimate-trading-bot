import { pool } from '../src/lib/postgres.js';

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      AND table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name
    `);
    console.log("--- ALL TABLES ---");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkSchema();
