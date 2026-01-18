import { sql } from '@vercel/postgres';

export async function ensureTablesExist() {
    try {
        console.log('[DB-Init] Checking and creating tables if necessary...');

        // 1. Alarms Table
        await sql`
            CREATE TABLE IF NOT EXISTS alarms (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL, 
                symbol VARCHAR(20) NOT NULL,
                indicator_type VARCHAR(50) DEFAULT 'F3',
                condition_type VARCHAR(20) NOT NULL, -- 'BUY_SIGNAL', 'SELL_SIGNAL', 'PRICE_ABOVE', 'PRICE_BELOW'
                action_type VARCHAR(20) NOT NULL, -- 'NOTIFY', 'TRADE', 'PANIC_SELL'
                is_active BOOLEAN DEFAULT true,
                created_at BIGINT NOT NULL,
                last_triggered_at BIGINT
            );
        `;
        console.log('[DB-Init] alarms table verified');

        // 2. Alarm Logs Table
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

        // 3. Panic Snapshots Table (for completeness)
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

        // 4. System Settings Table (For API Keys)
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
