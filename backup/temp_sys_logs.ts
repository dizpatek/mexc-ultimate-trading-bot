import { sql } from "./src/lib/postgres";

async function run() {
  try {
    const res = await sql`
      SELECT level, module, message 
      FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT 10;
    `;
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
