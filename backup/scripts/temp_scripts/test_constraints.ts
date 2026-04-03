import { sql } from './src/lib/postgres';
import { config } from "dotenv";

config({ path: ".env.local" });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function check() {
  try {
    const { rows } = await sql`SELECT conname FROM pg_constraint WHERE conrelid = 'bot_configs'::regclass`;
    console.log('Constraints:', rows);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit(0);
  }
}
check();
