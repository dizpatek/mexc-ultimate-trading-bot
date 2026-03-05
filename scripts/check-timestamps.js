/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_GS9y8aUfzwXB@ep-solitary-feather-ahx83kq2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkTimestamps() {
    try {
        const { rows } = await pool.query('SELECT symbol, timestamp, (NOW() - TO_TIMESTAMP(timestamp/1000)) as ago FROM strategy_signals ORDER BY timestamp DESC LIMIT 5');
        console.log('Latest signals with ago:', rows);
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

checkTimestamps();
