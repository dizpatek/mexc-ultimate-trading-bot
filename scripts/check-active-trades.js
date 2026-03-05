const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_GS9y8aUfzwXB@ep-solitary-feather-ahx83kq2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function checkTrades() {
    try {
        await client.connect();
        const res = await client.query("SELECT id, symbol, side, qty, status, meta FROM orders WHERE status IN ('FILLED', 'PENDING')");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTrades();
