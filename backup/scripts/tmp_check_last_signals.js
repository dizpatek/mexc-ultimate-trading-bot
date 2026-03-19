const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require' 
});
async function check() {
    const res = await pool.query("SELECT symbol, signal_type, timeframe, timestamp FROM strategy_signals WHERE timestamp > (EXTRACT(EPOCH FROM now()) * 1000 - 600000) ORDER BY timestamp DESC LIMIT 20");
    console.log('Recent (10m) Signals:', res.rows.length);
    res.rows.forEach(r => console.log(`- ${r.symbol} (${r.timeframe}): ${r.signal_type} @ ${new Date(r.timestamp).toLocaleTimeString()}`));
}
check().catch(console.error).finally(() => pool.end());
