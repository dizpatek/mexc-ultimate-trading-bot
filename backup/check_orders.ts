import { sql } from "./src/lib/postgres";

async function main() {
  try {
    const { rows } = await sql`
      SELECT id, symbol, status, meta 
      FROM orders 
      WHERE symbol = 'AVAXUSDT' 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
