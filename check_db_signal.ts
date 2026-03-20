
import { pool } from "./src/lib/postgres";

async function checkSignal(id: string) {
  try {
    const res = await pool.query("SELECT * FROM strategy_signals WHERE id = $1", [id]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log("--- SIGNAL DETAILS ---");
      console.log(`ID: ${row.id} | Symbol: ${row.symbol} | Side: ${row.side}`);
      console.log("Payload:", JSON.stringify(row.payload, null, 2));
    } else {
      console.log("Signal not found for ID:", id);
    }
  } catch (e: any) {
    console.error("DB Query failed:", e.message);
  }
  process.exit(0);
}

const id = process.argv[2] || "158564";
checkSignal(id);
