import { sql } from "./src/lib/db";

async function checkColumns() {
  try {
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bot_configs'
    `;
    console.log("bot_configs columns:");
    console.table(result.rows);
  } catch (e) {
    console.error(e);
  }
}

checkColumns();
