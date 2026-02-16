import { sql } from '@vercel/postgres';
import 'dotenv/config';

async function check() {
    try {
        const tables = ['portfolio_snapshots', 'strategies', 'strategy_signals'];
        for (const table of tables) {
            const { rows } = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${table}`;
            console.log(`Columns in ${table}:`, rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
        }
    } catch (e) {
        console.error('Check failed:', e);
    }
}
check();
