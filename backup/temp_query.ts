import { sql } from "./src/lib/postgres";

async function run() {
  try {
    const res = await sql`
      SELECT symbol, signal_type, executed, execution_result::text, veto_reason 
      FROM strategy_signals 
      WHERE symbol IN ('DOTUSDT', 'SOLUSDT') 
      ORDER BY timestamp DESC 
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
