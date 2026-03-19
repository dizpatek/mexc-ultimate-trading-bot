import { sql } from "./src/lib/postgres";

async function check() {
    try {
        console.log("--- SYSTEM STATUS CHECK ---");
        
        const locks = await sql`SELECT * FROM system_locks`;
        console.log("Active Locks:", JSON.stringify(locks.rows, null, 2));

        const signals = await sql`SELECT symbol, signal_type, timeframe, timestamp, executed FROM strategy_signals ORDER BY timestamp DESC LIMIT 10`;
        console.log("Recent Signals:", JSON.stringify(signals.rows, null, 2));

        const logs = await sql`SELECT level, message, timestamp FROM system_logs ORDER BY timestamp DESC LIMIT 10`;
        console.log("Recent System Logs:", JSON.stringify(logs.rows, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error("Check failed:", err);
        process.exit(1);
    }
}

check();
