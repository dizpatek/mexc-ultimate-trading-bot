const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require' 
});
async function check() {
    const res = await pool.query(`
        SELECT DISTINCT symbol, status, meta::jsonb->>'smartTrade' as is_smart 
        FROM orders 
        WHERE user_id = 1 
        AND trading_mode = 'test' 
        AND status NOT IN ('CLOSED', 'CANCELED', 'REJECTED')
    `);
    console.log('Active Order Details:', res.rows);
}
check().catch(console.error).finally(() => pool.end());
