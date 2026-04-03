import { sql } from './src/lib/postgres';
import { config } from "dotenv";

config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function addConstraint() {
  try {
    console.log("Adding bot_configs_user_id_key constraint...");
    await sql`ALTER TABLE bot_configs ADD CONSTRAINT bot_configs_user_id_key UNIQUE(user_id)`;
    console.log("Constraint added successfully!");
  } catch (error) {
    if (error.message && error.message.includes("already exists")) {
       console.log("Constraint already exists, ignoring.");
    } else {
       console.error("Test failed:", error);
    }
  } finally {
    process.exit(0);
  }
}
addConstraint();
