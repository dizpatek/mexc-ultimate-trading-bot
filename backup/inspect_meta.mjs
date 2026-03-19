import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://antigravity:antigravity@localhost:5432/antigravity"
});

async function main() {
  try {
    const { rows } = await pool.query(`
      SELECT meta FROM orders WHERE id = 101
    `);
    
    if (rows.length > 0) {
      console.log(JSON.stringify(JSON.parse(rows[0].meta), null, 2));
    } else {
      console.log("Order 101 not found");
    }
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
