import { sql } from "./src/lib/postgres";

async function run() {
  try {
    const res = await sql`
      SELECT pilot_mtf_threshold, pilot_mtf_veto, f4_length, fibo_length, ai_threshold 
      FROM bot_configs 
      LIMIT 1;
    `;
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
