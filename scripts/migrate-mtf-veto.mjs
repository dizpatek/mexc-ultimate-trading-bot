import { Pool } from 'pg';
import 'dotenv/config';

// Try multiple environment variables to match src/lib/postgres.ts
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URI;

if (!connectionString) {
    console.error('No database connection string found in environment variables!');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('neon') || connectionString.includes('vercel') || connectionString.includes('aws')
        ? { rejectUnauthorized: false }
        : false
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log(`Starting migration on: ${connectionString.split('@')[1]?.split('/')[0] || 'Unknown Host'}...`);

        // Add columns to strategy_signals
        await client.query(`
            ALTER TABLE strategy_signals 
            ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test',
            ADD COLUMN IF NOT EXISTS timeframe TEXT,
            ADD COLUMN IF NOT EXISTS veto_reason TEXT;
        `);
        console.log('Updated strategy_signals table.');

        // Add columns to bot_configs
        await client.query(`
            ALTER TABLE bot_configs 
            ADD COLUMN IF NOT EXISTS pilot_mtf_veto BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS pilot_mtf_threshold NUMERIC DEFAULT 3;
        `);
        console.log('Updated bot_configs table.');

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
        process.exit(0);
    }
}

migrate();
