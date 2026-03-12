import { Pool } from 'pg';
import 'dotenv/config';

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

        // Add pilot_only_holdings to bot_configs
        await client.query(`
            ALTER TABLE bot_configs 
            ADD COLUMN IF NOT EXISTS pilot_only_holdings BOOLEAN DEFAULT FALSE;
        `);
        console.log('Updated bot_configs table with pilot_only_holdings.');

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
