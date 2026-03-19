const { Pool } = require('pg');
const pool = new Pool({ 
    connectionString: 'postgresql://_2f70cc4a3ea5b8f7:_d22ac6f3ba99d77c9748a6968eb248@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29643/_169a43476a1c?sslmode=require' 
});
async function check() {
    const signals = await pool.query(`
        SELECT symbol, timeframe, signal_type, veto_reason, 
               (execution_result::jsonb)->>'mtfVerdict' as mtf, 
               (execution_result::jsonb)->>'mtfScore' as mtf_score, 
               timestamp 
        FROM strategy_signals 
        WHERE timestamp > (EXTRACT(EPOCH FROM now()) * 1000 - 3600000) 
        ORDER BY timestamp DESC LIMIT 20
    `);
    
    console.log('Recent Signals (1h):', signals.rows.length);
    signals.rows.forEach(s => {
        const time = new Date(Number(s.timestamp)).toLocaleTimeString();
        console.log(`- ${s.symbol} (${s.timeframe}): ${s.signal_type} | MTF: ${s.mtf} (Score: ${s.mtf_score}) | Veto: ${s.veto_reason || 'NONE'} | @ ${time}`);
    });
}
check().catch(console.error).finally(() => pool.end());
