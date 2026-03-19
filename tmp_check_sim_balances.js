const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require' 
});
async function check() {
    const res = await pool.query("SELECT key, value FROM system_settings WHERE user_id = 1 AND key = 'SIMULATED_BALANCES'");
    if (res.rows[0]) {
        const balances = JSON.parse(res.rows[0].value);
        console.log('Simulated Assets:', balances.map(b => b.asset));
        console.log('Total Count:', balances.length);
    } else {
        console.log('No Simulated Balances found for user 1');
    }
}
check().catch(console.error).finally(() => pool.end());
