import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function createF4Tables() {
    console.log('🔧 Creating F4-related tables...');

    try {
        // Create f4_signals table
        await sql`
            CREATE TABLE IF NOT EXISTS f4_signals (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                f4_value NUMERIC,
                f4_fibo_value NUMERIC,
                signal_type TEXT,
                smc_structure TEXT,
                wt1 NUMERIC,
                wt2 NUMERIC,
                confluence_score INTEGER,
                action_recommendation TEXT,
                current_price NUMERIC,
                timestamp BIGINT NOT NULL,
                created_at BIGINT NOT NULL
            )
        `;

        console.log('✅ f4_signals table created!');

        // Create index for faster queries
        await sql`
            CREATE INDEX IF NOT EXISTS idx_f4_signals_symbol_timestamp 
            ON f4_signals(symbol, timestamp DESC)
        `;

        console.log('✅ Index created on f4_signals!');

        // Create f4_performance_metrics table
        await sql`
            CREATE TABLE IF NOT EXISTS f4_performance_metrics (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                total_signals INTEGER DEFAULT 0,
                buy_signals INTEGER DEFAULT 0,
                sell_signals INTEGER DEFAULT 0,
                long_recommendations INTEGER DEFAULT 0,
                short_recommendations INTEGER DEFAULT 0,
                avg_confluence_score NUMERIC DEFAULT 0,
                last_updated BIGINT NOT NULL,
                UNIQUE(symbol, timeframe)
            )
        `;

        console.log('✅ f4_performance_metrics table created!');

        // Show table structures
        const { rows: f4Columns } = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'f4_signals'
            ORDER BY ordinal_position
        `;

        console.log('\n📊 f4_signals table structure:');
        console.table(f4Columns);

        const { rows: metricsColumns } = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'f4_performance_metrics'
            ORDER BY ordinal_position
        `;

        console.log('\n📊 f4_performance_metrics table structure:');
        console.table(metricsColumns);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating F4 tables:', error);
        process.exit(1);
    }
}

createF4Tables();
