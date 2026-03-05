/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_GS9y8aUfzwXB@ep-solitary-feather-ahx83kq2-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require' });

async function checkTrade() {
    try {
        await client.connect();
        const res = await client.query("SELECT * FROM orders WHERE id = 286");
        const trade = res.rows[0];
        if (trade) {
            console.log(`ID: ${trade.id}`);
            console.log(`Symbol: ${trade.symbol}`);
            console.log(`Side: ${trade.side}`);
            console.log(`Qty: ${trade.qty}`);
            console.log(`Status: ${trade.status}`);
            console.log(`Meta:`, JSON.stringify(trade.meta, null, 2));
        } else {
            console.log("Trade not found");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTrade();
