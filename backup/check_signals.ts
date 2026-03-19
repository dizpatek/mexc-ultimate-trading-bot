import { sql } from './src/lib/postgres';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const { rows } = await sql`SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 5`;
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
