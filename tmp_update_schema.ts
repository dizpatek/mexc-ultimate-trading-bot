
import { sql } from './src/lib/postgres';

async function updateSchema() {
  try {
    console.log("Updating database schema...");
    await sql`ALTER TABLE strategy_signals ADD COLUMN IF NOT EXISTS veto_reason TEXT`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_veto BOOLEAN DEFAULT TRUE`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS pilot_mtf_threshold INTEGER DEFAULT 60`;
    console.log("SCHEMA UPDATED SUCCESSFULLY");
  } catch (e) {
    console.error("SCHEMA UPDATE FAILED:", e);
  } finally {
    process.exit();
  }
}

updateSchema();
