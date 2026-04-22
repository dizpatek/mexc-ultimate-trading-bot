import { ensureTablesExist } from "./src/lib/db-init";
import { updateBotConfig, getBotConfig, sql } from "./src/lib/db";

async function main() {
  await ensureTablesExist();
  
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'bot_configs'`;
  const colNames = cols.rows.map(r => r.column_name);
  console.log("bot_configs columns:");
  console.log(colNames.includes('pilot_tp_percent') ? '✅ pilot_tp_percent is in DB' : '❌ pilot_tp_percent is MISSING');
  console.log(colNames.includes('pilot_sl_percent') ? '✅ pilot_sl_percent is in DB' : '❌ pilot_sl_percent is MISSING');

  // get user 1
  const config = await getBotConfig(1);
  console.log("Current config:");
  console.log("pilot_tp_percent:", (config as any).pilot_tp_percent);
  console.log("timeframe_settings:", config.timeframe_settings);
  
  console.log("Updating to test...");
  await updateBotConfig(1, { pilot_tp_percent: 5.5, pilot_sl_percent: 2.2 });
  const updated = await getBotConfig(1);
  console.log("Updated config:");
  console.log("pilot_tp_percent:", (updated as any).pilot_tp_percent);
  console.log("pilot_sl_percent:", (updated as any).pilot_sl_percent);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
