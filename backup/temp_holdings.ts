import { sql } from "./src/lib/postgres";

async function run() {
  try {
    const res = await sql`
      SELECT symbol, balance, type 
      FROM portfolio 
      WHERE user_id = 1;
    `;
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

run();
