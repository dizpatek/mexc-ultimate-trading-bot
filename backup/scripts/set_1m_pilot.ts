import { sql } from '../src/lib/postgres';

async function run() {
  try {
    await sql`UPDATE bot_configs SET pilot_timeframe = '1m', pilot_mtf_veto = true WHERE user_id = 1`;
    const { rows } = await sql`SELECT pilot_timeframe, pilot_mtf_veto, pilot_mtf_short_threshold, pilot_mtf_long_threshold FROM bot_configs WHERE user_id = 1`;
    console.log('✅ Bot config updated for Admin (User 1):', rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Update failed:', err);
    process.exit(1);
  }
}
run();
