import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
    try {
        console.log('Starting migration for alarms tables...');

        // Create alarms table
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
        console.log('Created alarms table');

        // Create alarm_logs table
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
        console.log('Created alarm_logs table');

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
