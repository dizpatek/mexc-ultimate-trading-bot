const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require' 
});
async function check() {
    const res = await pool.query("SELECT symbol FROM smart_trades WHERE status = 'active' AND trading_mode = 'test' LIMIT 50");
    console.log('Active Symbols:', res.rows.map(r => r.symbol));
    
    // Also revert pilot_only_holdings to true as per user request
    await pool.query("UPDATE bot_configs SET pilot_only_holdings = true WHERE id = 1");
    console.log('pilot_only_holdings reverted to true.');
}
check().catch(console.error).finally(() => pool.end());
