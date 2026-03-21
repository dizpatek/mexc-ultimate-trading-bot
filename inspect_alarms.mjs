import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
});

async function inspect() {
  try {
    const res = await pool.query(`
      SELECT table_schema, table_name, 
      (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
      FROM (
        SELECT table_schema, table_name, 
        query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as xml_count
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        AND table_type = 'BASE TABLE'
      ) t
      WHERE table_name ILIKE '%alarm%'
      ORDER BY row_count DESC;
    `);
    console.log("--- ALARM RELATED TABLES ---");
    console.table(res.rows);
  } catch (err) {
    console.error("Error inspecting DB:", err.message);
  } finally {
    await pool.end();
  }
}

inspect();
