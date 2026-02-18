import { sql } from '@vercel/postgres';

export async function ensureTablesExist() {
    try {
        console.log('[DB-Init] Checking and creating all necessary tables...');

        // 1. Users Table
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

        // 2. Orders Table (Now with user_id)
        await sql`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
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

        // 3. Trade History Table (Standardized name, now with user_id)
        await sql`
            CREATE TABLE IF NOT EXISTS trade_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
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

        // 4. Portfolio Table (For direct balance tracking)
        await sql`
            CREATE TABLE IF NOT EXISTS portfolio (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                symbol TEXT NOT NULL,
                balance NUMERIC NOT NULL DEFAULT 0,
                type TEXT DEFAULT 'SIMULATOR',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                UNIQUE(user_id, symbol, type)
            );
        `;

        // 5. Portfolio Snapshots (Now with user_id)
        await sql`
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                total_value NUMERIC,
                total_assets INTEGER,
                snapshot_date BIGINT,
                balances TEXT
            );
        `;

        // 6. Performance Metrics (Per user per date)
        await sql`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                date TEXT NOT NULL,
                total_trades INTEGER DEFAULT 0,
                winning_trades INTEGER DEFAULT 0,
                losing_trades INTEGER DEFAULT 0,
                total_profit_loss NUMERIC DEFAULT 0,
                win_rate NUMERIC DEFAULT 0,
                avg_profit NUMERIC DEFAULT 0,
                avg_loss NUMERIC DEFAULT 0,
                best_trade NUMERIC DEFAULT 0,
                worst_trade NUMERIC DEFAULT 0,
                UNIQUE(user_id, date)
            );
        `;

        // 7. DCA Bots
        await sql`
            CREATE TABLE IF NOT EXISTS dca_bots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                symbol TEXT NOT NULL,
                amount NUMERIC NOT NULL,
                interval_hours INTEGER NOT NULL,
                take_profit_percent NUMERIC,
                total_invested NUMERIC DEFAULT 0,
                total_bought_qty NUMERIC DEFAULT 0,
                average_price NUMERIC DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                last_run_at BIGINT DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL,
                meta TEXT
            );
        `;

        try {
            await sql`ALTER TABLE dca_bots ADD COLUMN IF NOT EXISTS meta TEXT`;
        } catch { /* ignore */ }

        // 8. Strategies
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

        // 9. Strategy Signals
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

        // 10. Alarms
        await sql`
            CREATE TABLE IF NOT EXISTS alarms (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id), 
                symbol VARCHAR(20) NOT NULL,
                indicator_type VARCHAR(50) DEFAULT 'F3',
                condition_type VARCHAR(20) NOT NULL,
                action_type VARCHAR(20) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at BIGINT NOT NULL,
                last_triggered_at BIGINT
            );
        `;

        // 11. Alarm Logs
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

        // 12. Panic Snapshots
        await sql`
            CREATE TABLE IF NOT EXISTS panic_snapshots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                snapshot_data JSONB NOT NULL,
                total_usdt_value DECIMAL(20, 8) NOT NULL,
                created_at BIGINT NOT NULL
            );
        `;

        // 13. System Settings (Per User)
        await sql`
            CREATE TABLE IF NOT EXISTS system_settings (
                user_id INTEGER REFERENCES users(id),
                key VARCHAR(50) NOT NULL,
                value TEXT NOT NULL,
                updated_at BIGINT NOT NULL,
                PRIMARY KEY (user_id, key)
            );
        `;

        // 14. Bot Config (Global)
        try {
            await sql`
                CREATE TABLE IF NOT EXISTS bot_configs (
                    id INTEGER PRIMARY KEY,
                    f4_length INTEGER DEFAULT 10,
                    whale_multiplier NUMERIC DEFAULT 1.8,
                    ai_threshold INTEGER DEFAULT 65,
                    auto_trade BOOLEAN DEFAULT FALSE,
                    defense_mode BOOLEAN DEFAULT FALSE,
                    timeframe VARCHAR(10) DEFAULT '4h',
                    updated_at BIGINT NOT NULL
                );
            `;
            console.log('[DB-Init] bot_configs table verified.');
        } catch (e) {
            console.warn('[DB-Init] bot_configs table creation warning:', e);
        }

        // Migration: Ensure all modern columns exist for older installations
        // We use individual try-catch blocks with explicit template literals to ensure compatibility
        try {
            await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS auto_trade BOOLEAN DEFAULT FALSE`;
        } catch { /* ignore */ }

        try {
            await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS defense_mode BOOLEAN DEFAULT FALSE`;
        } catch { /* ignore */ }

        try {
            await sql`ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '4h'`;
        } catch { /* ignore */ }

        // Force '4h' if currently '1h' or NULL
        try {
            await sql`UPDATE bot_configs SET timeframe = '4h' WHERE id = 1 AND (timeframe = '1h' OR timeframe IS NULL)`;
        } catch (err) {
            console.warn('[DB-Init] timeframe upgrade warning:', err);
        }

        // Insert default config if table is empty
        try {
            const { rowCount } = await sql`SELECT 1 FROM bot_configs WHERE id = 1`;
            if (rowCount === 0) {
                await sql`
                    INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, timeframe, updated_at)
                    VALUES (1, 10, 1.8, 65, false, false, '4h', ${Date.now()})
                `;
                console.log('[DB-Init] Default bot config inserted.');
            }
        } catch (e) {
            console.error('[DB-Init] default config check/insert error:', e);
        }

        console.log('[DB-Init] All tables verified successfully.');
        return true;
    } catch (error) {
        console.error('[DB-Init] Error initializing database tables:', error);
        throw error;
    }
}
