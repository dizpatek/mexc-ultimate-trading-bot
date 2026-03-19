import { sql } from './src/lib/postgres.ts';

async function getRecent() {
  try {
    const signals = await sql`SELECT symbol, signal_type, timestamp FROM strategy_signals WHERE timestamp > ${Date.now() - 30 * 60 * 1000} ORDER BY timestamp DESC LIMIT 20`;
    console.log("--- Son 30 Dakikalık Sinyaller ---");
    signals.rows.forEach(s => {
      console.log(`${new Date(Number(s.timestamp)).toLocaleTimeString()} | ${s.symbol} | ${s.signal_type}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

getRecent();
