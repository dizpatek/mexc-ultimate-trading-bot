import { sql } from "./src/lib/postgres";

async function check() {
  console.log("--- Checking Bot Config ---");
  const config = await sql`SELECT * FROM bot_configs WHERE id = 1`;
  console.log("Bot Config:", JSON.stringify(config.rows[0], null, 2));

  console.log("\n--- Checking Recent System Logs ---");
  const logs = await sql`SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 20`;
  logs.rows.forEach(log => {
    console.log(`[${new Date(Number(log.timestamp)).toISOString()}] ${log.level}: ${log.message} | ${log.details}`);
  });

  console.log("\n--- Checking Recent Signal Logs ---");
  const signals = await sql`SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 10`;
  signals.rows.forEach(s => {
    console.log(`[${new Date(Number(s.timestamp)).toISOString()}] ${s.symbol} ${s.signal_type} | Executed: ${s.executed} | Veto: ${s.veto_reason} | Result: ${s.execution_result}`);
  });
}

check().catch(console.error);
