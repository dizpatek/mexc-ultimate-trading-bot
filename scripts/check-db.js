const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_GS9y8aUfzwXB@ep-solitary-feather-ahx83kq2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkSignals() {
    try {
        const { rows: countRows } = await pool.query('SELECT count(*) FROM strategy_signals');
        console.log('Signals count:', countRows[0].count);
        
        const { rows: signals } = await pool.query('SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 5');
        console.log('Latest signals:', signals);
        
        const { rows: userCount } = await pool.query('SELECT count(*) FROM users');
        console.log('User count:', userCount[0].count);

        const { rows: users } = await pool.query('SELECT id, name, email FROM users');
        console.log('Users:', users);
        
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

checkSignals();
