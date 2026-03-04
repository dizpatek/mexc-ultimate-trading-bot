import { sql } from './src/lib/postgres.js';

async function checkSignals() {
    try {
        const { rows } = await sql`SELECT count(*) FROM strategy_signals`;
        console.log('Signals count:', rows[0].count);
        
        const { rows: signals } = await sql`SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 5`;
        console.log('Latest signals:', signals);
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        process.exit(0);
    }
}

checkSignals();
