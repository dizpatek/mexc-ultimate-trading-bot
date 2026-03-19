import { sql } from "./src/lib/postgres";

async function run() {
  try {
    const res = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bot_configs';
    `;
    console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
