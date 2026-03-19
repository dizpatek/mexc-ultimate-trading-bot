import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("Fetching recent strategy signals...");
    // Sinyalleri çek: Son 2 saat, type BUY veya SELL
    const signals = await pool.query(`
        SELECT id, symbol, signal_type, timeframe, veto_reason, executed, timestamp
        FROM strategy_signals
        ORDER BY timestamp DESC
        LIMIT 20
    `);
    
    console.log("--- RECENT SIGNALS ---");
    signals.rows.forEach(s => {
        console.log(`[${new Date(s.timestamp).toLocaleTimeString()}] ${s.symbol} ${s.signal_type} | Exec: ${s.executed} | Veto: ${s.veto_reason}`);
    });

    console.log("\nFetching recent system logs...");
    const logs = await pool.query(`
        SELECT id, type, message, created_at
        FROM system_logs
        WHERE type IN ('TRADE', 'ERROR', 'SYSTEM') OR message ILIKE '%veto%' OR message ILIKE '%pilot%'
        ORDER BY created_at DESC
        LIMIT 30
    `);
    
    console.log("--- SYSTEM LOGS ---");
    logs.rows.forEach(l => {
        console.log(`[${new Date(l.created_at).toLocaleTimeString()}] ${l.type}: ${l.message}`);
    });

    pool.end();
}

main().catch(console.error);
