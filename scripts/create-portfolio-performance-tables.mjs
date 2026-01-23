import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function createPortfolioPerformanceTables() {
    console.log('🔧 Creating Portfolio Performance tables...');

    try {
        // 1. Extend portfolio_snapshots table
        console.log('📊 Adding columns to portfolio_snapshots...');
        await sql`
            ALTER TABLE portfolio_snapshots 
            ADD COLUMN IF NOT EXISTS holdings_detail JSONB,
            ADD COLUMN IF NOT EXISTS daily_pnl NUMERIC,
            ADD COLUMN IF NOT EXISTS weekly_pnl NUMERIC,
            ADD COLUMN IF NOT EXISTS monthly_pnl NUMERIC
        `;
        console.log('✅ portfolio_snapshots extended!');

        // 2. Create asset_price_history table
        console.log('📊 Creating asset_price_history table...');
        await sql`
            CREATE TABLE IF NOT EXISTS asset_price_history (
                id SERIAL PRIMARY KEY,
                symbol TEXT NOT NULL,
                price NUMERIC NOT NULL,
                price_24h_ago NUMERIC,
                price_7d_ago NUMERIC,
                price_30d_ago NUMERIC,
                change_24h_percent NUMERIC,
                change_7d_percent NUMERIC,
                change_30d_percent NUMERIC,
                volume_24h NUMERIC,
                timestamp BIGINT NOT NULL,
                UNIQUE(symbol, timestamp)
            )
        `;
        console.log('✅ asset_price_history table created!');

        // Create index
        await sql`
            CREATE INDEX IF NOT EXISTS idx_asset_price_history_symbol_timestamp 
            ON asset_price_history(symbol, timestamp DESC)
        `;
        console.log('✅ Index created on asset_price_history!');

        // 3. Create portfolio_daily_stats table
        console.log('📊 Creating portfolio_daily_stats table...');
        await sql`
            CREATE TABLE IF NOT EXISTS portfolio_daily_stats (
                id SERIAL PRIMARY KEY,
                date TEXT UNIQUE NOT NULL,
                opening_balance NUMERIC,
                closing_balance NUMERIC,
                high_balance NUMERIC,
                low_balance NUMERIC,
                total_trades INTEGER,
                realized_pnl NUMERIC,
                unrealized_pnl NUMERIC,
                best_asset TEXT,
                worst_asset TEXT,
                timestamp BIGINT NOT NULL
            )
        `;
        console.log('✅ portfolio_daily_stats table created!');

        // Show structures
        const { rows: priceHistoryCols } = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'asset_price_history'
            ORDER BY ordinal_position
        `;

        console.log('\n📊 asset_price_history structure:');
        console.table(priceHistoryCols);

        const { rows: dailyStatsCols } = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'portfolio_daily_stats'
            ORDER BY ordinal_position
        `;

        console.log('\n📊 portfolio_daily_stats structure:');
        console.table(dailyStatsCols);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating portfolio performance tables:', error);
        process.exit(1);
    }
}

createPortfolioPerformanceTables();
