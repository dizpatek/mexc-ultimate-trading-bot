import { sql } from './src/lib/postgres';
async function displayLogs() {
  try {
    const res = await sql`SELECT * FROM strategy_signals 
                          WHERE symbol IN ('LINKUSDT', 'AVAXUSDT', 'DOGEUSDT') 
                          ORDER BY timestamp DESC LIMIT 20`;
    console.log("--- SIGNAL LOGS ---");
    console.dir(res.rows.map(r => ({ symbol: r.symbol, type: r.signal_type, time: new Date(Number(r.timestamp)).toLocaleTimeString(), exec: r.execution_result, veto: r.veto_reason })), { depth: null });
  } catch(e) { console.error(e); }
  finally { process.exit(0); }
}
displayLogs();
