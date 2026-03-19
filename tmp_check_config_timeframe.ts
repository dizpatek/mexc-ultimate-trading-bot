import { sql } from './src/lib/postgres.ts';

async function checkConfig() {
  try {
    const config = await sql`SELECT pilot_timeframe, pilot_only_holdings FROM bot_configs LIMIT 1`;
    console.log(JSON.stringify(config.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkConfig();
