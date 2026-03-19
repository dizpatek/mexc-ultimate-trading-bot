import { sql } from "./src/lib/postgres";
import fs from "fs";

async function run() {
  try {
    const res = await sql`
      SELECT symbol, signal_type, executed, execution_result::text, veto_reason 
      FROM strategy_signals 
      WHERE symbol IN ('DOGEUSDT', 'ETHUSDT', 'BTCUSDT', 'XRPUSDT', 'DOTUSDT', 'SOLUSDT') 
      ORDER BY timestamp DESC 
      LIMIT 10;
    `;
    fs.writeFileSync("output.json", JSON.stringify(res.rows, null, 2));
    console.log("Written to output.json");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
