import { sql } from './src/lib/postgres.ts';

async function checkConfig() {
  try {
    const config = await sql`SELECT * FROM bot_configs WHERE id = 1`;
    console.log(JSON.stringify(config.rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkConfig();
