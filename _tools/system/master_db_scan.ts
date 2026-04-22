import { pool } from '../../src/lib/db';

async function analyzeDatabase() {
    console.log("🔍 Database Boyut Analizi Başlatılıyor...\n");
    
    try {
        const query = `
            SELECT 
                relname AS table_name,
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                pg_size_pretty(pg_relation_size(relid)) AS table_size,
                pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size,
                n_live_tup AS row_count
            FROM pg_stat_user_tables 
            ORDER BY pg_total_relation_size(relid) DESC;
        `;
        
        const res = await pool.query(query);
        
        console.table(res.rows);
        
        const totalRaw = await pool.query("SELECT pg_size_pretty(pg_database_size(current_database()))");
        console.log(`\n📊 Toplam Veritabanı Boyutu: ${totalRaw.rows[0].pg_size_pretty}`);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Analiz hatası:", error);
        process.exit(1);
    }
}

analyzeDatabase();
