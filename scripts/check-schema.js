const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_GS9y8aUfzwXB@ep-solitary-feather-ahx83kq2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        const { rows: columns } = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'strategy_signals'
        `);
        console.log('strategy_signals columns:', columns);
        
        const { rows: signals } = await pool.query('SELECT * FROM strategy_signals ORDER BY timestamp DESC LIMIT 5');
        console.log('Latest signals symbols:', signals.map(s => s.symbol));
        
    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

checkSchema();
