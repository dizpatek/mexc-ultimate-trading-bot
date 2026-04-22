import { Pool } from 'pg';

const connectionString = "postgresql://_dac56e2d25fd06df:_4168e8653df0249ec119b3a5f278b9@primary.mexc-db--2b7df8pbxjzq.addon.code.run:29790/_68afee465836?sslmode=require";

async function check() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        console.log("📊 Veritabanı Tablo Boyutları Analizi:");
        const res = await pool.query(`
            SELECT 
                relname AS table_name,
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                n_live_tup AS row_count
            FROM pg_stat_user_tables 
            ORDER BY pg_total_relation_size(relid) DESC
            LIMIT 10;
        `);
        console.table(res.rows);
        
        const total = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database()))");
        console.log(`\n📦 Toplam Veritabanı Boyutu: ${total.rows[0].pg_size_pretty}`);
        
    } catch (e) {
        console.error("Hata:", e);
    } finally {
        await pool.end();
    }
}

check();
