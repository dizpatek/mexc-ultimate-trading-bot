import { sql } from '@vercel/postgres';

export async function ensureTablesExist() {
    try {
        console.log('[DB-Init] Checking and creating tables if necessary...');

        // Users table
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;
        console.log('[DB-Init] users table verified');

        // Orders table
        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                mexc_order_id TEXT,
                symbol TEXT,
                side TEXT,
                type TEXT,
                qty NUMERIC,
                quote NUMERIC,
                price NUMERIC,
                status TEXT,
                created_at BIGINT,
                updated_at BIGINT,
                meta TEXT
            );
        `;
        console.log('[DB-Init] orders table verified');

        // Trade history table
        await sql`
            CREATE TABLE IF NOT EXISTS trade_history (
                id SERIAL PRIMARY KEY,
                order_id INTEGER REFERENCES orders(id),
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                type TEXT,
                qty NUMERIC,
                price NUMERIC,
                quote_qty NUMERIC,
                commission NUMERIC,
                commission_asset TEXT,
                profit_loss NUMERIC,
                profit_loss_percentage NUMERIC,
                created_at BIGINT
            );
        `;
        console.log('[DB-Init] trade_history table verified');

        // Portfolio snapshots table
        await sql`
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                total_value NUMERIC,
                total_assets INTEGER,
                snapshot_date BIGINT,
                balances TEXT
            );
        `;
        console.log('[DB-Init] portfolio_snapshots table verified');

        // Performance metrics table
        await sql`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                date TEXT UNIQUE,
                total_trades INTEGER DEFAULT 0,
                winning_trades INTEGER DEFAULT 0,
                losing_trades INTEGER DEFAULT 0,
                total_profit_loss NUMERIC DEFAULT 0,
                win_rate NUMERIC DEFAULT 0,
                avg_profit NUMERIC DEFAULT 0,
                avg_loss NUMERIC DEFAULT 0,
                best_trade NUMERIC DEFAULT 0,
                worst_trade NUMERIC DEFAULT 0
            );
        `;
        console.log('[DB-Init] performance_metrics table verified');

        // Strategies table
        await sql`
            CREATE TABLE IF NOT EXISTS strategies (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                symbol TEXT NOT NULL,
                strategy_type TEXT NOT NULL,
                parameters TEXT NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;
        console.log('[DB-Init] strategies table verified');

        // Strategy signals table
        await sql`
            CREATE TABLE IF NOT EXISTS strategy_signals (
                id SERIAL PRIMARY KEY,
                strategy_id INTEGER NOT NULL REFERENCES strategies(id),
                signal_type TEXT NOT NULL,
                price NUMERIC NOT NULL,
                volume NUMERIC,
                timestamp BIGINT NOT NULL,
                executed BOOLEAN DEFAULT FALSE,
                execution_result TEXT
            );
        `;
        console.log('[DB-Init] strategy_signals table verified');

        // Alarms Table
        await sql`
            CREATE TABLE IF NOT EXISTS alarms (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL, 
                symbol VARCHAR(20) NOT NULL,
                indicator_type VARCHAR(50) DEFAULT 'F3',
                condition_type VARCHAR(20) NOT NULL,
                action_type VARCHAR(20) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at BIGINT NOT NULL,
                last_triggered_at BIGINT
            );
        `;
        console.log('[DB-Init] alarms table verified');

        // Alarm Logs Table
        await sql`
            CREATE TABLE IF NOT EXISTS alarm_logs (
                id SERIAL PRIMARY KEY,
                alarm_id INTEGER REFERENCES alarms(id),
                triggered_at BIGINT NOT NULL,
                signal_value DECIMAL(20, 8),
                action_result JSONB,
                success BOOLEAN
            );
        `;
        console.log('[DB-Init] alarm_logs table verified');

        // Panic Snapshots Table
        await sql`
            CREATE TABLE IF NOT EXISTS panic_snapshots (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                snapshot_data JSONB NOT NULL,
                total_usdt_value DECIMAL(20, 8) NOT NULL,
                created_at BIGINT NOT NULL
            );
        `;
        console.log('[DB-Init] panic_snapshots table verified');

        // System Settings Table (For API Keys)
        await sql`
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;
        console.log('[DB-Init] system_settings table verified');

        return true;
    } catch (error) {
        console.error('[DB-Init] Error initializing database tables:', error);
        throw error;
    }
}
