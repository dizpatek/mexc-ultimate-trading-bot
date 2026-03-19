import { sql } from "./src/lib/postgres";

async function run() {
  try {
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS scalp_length INTEGER DEFAULT 11;`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS scalp_volume_multiplier NUMERIC DEFAULT 3.0;`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS swing_length INTEGER DEFAULT 10;`;
    await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS swing_volume_multiplier NUMERIC DEFAULT 1.2;`;
    console.log("Columns added successfully!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
