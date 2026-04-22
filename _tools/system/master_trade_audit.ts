import { Pool } from 'pg';

const connectionString = "postgresql://_dac56e2d25fd06df:_4168e8653df0249ec119b3a5f278b9@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29790/_68afee465836?sslmode=require";

async function clean() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        const now = Date.now();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        console.log("🧹 Agresif Temizlik Başlatılıyor...");
        
        // 1. Market Trades (4h)
        const resMarket = await pool.query("DELETE FROM market_trades WHERE t < $1", [now - FOUR_HOURS]);
        console.log(`✅ market_trades: ${resMarket.rowCount} satır silindi.`);

        // 2. System Logs (4h for INFO/DEBUG, 24h for OTHERS)
        const resLogsLow = await pool.query("DELETE FROM system_logs WHERE timestamp < $1 AND level IN ('DEBUG', 'INFO')", [now - FOUR_HOURS]);
        const resLogsHigh = await pool.query("DELETE FROM system_logs WHERE timestamp < $1 AND level IN ('SYSTEM', 'ERROR', 'CRITICAL', 'ALARM')", [now - TWENTY_FOUR_HOURS]);
        console.log(`✅ system_logs: ${(resLogsLow.rowCount ?? 0) + (resLogsHigh.rowCount ?? 0)} satır silindi.`);

        // 3. Check finale size
        const total = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database()))");
        console.log(`\n📦 Temizlik Sonrası Boyut: ${total.rows[0].pg_size_pretty}`);
        
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await pool.end();
    }
}

clean();
