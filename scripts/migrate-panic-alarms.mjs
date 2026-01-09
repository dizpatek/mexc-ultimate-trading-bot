import { sql } from '@vercel/postgres';

async function migrate() {
    try {
        console.log('Creating panic_snapshots table...');

        await sql`
            CREATE TABLE IF NOT EXISTS panic_snapshots (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                snapshot_data JSONB NOT NULL,
                total_usdt_value DECIMAL(20, 8),
                created_at BIGINT NOT NULL
            );
        `;

        console.log('✓ panic_snapshots table created successfully');

        console.log('Creating alarms table...');

        await sql`
            CREATE TABLE IF NOT EXISTS alarms (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                symbol VARCHAR(20) NOT NULL,
                indicator_type VARCHAR(50) DEFAULT 'F3',
                enabled BOOLEAN DEFAULT true,
                link_to_panic BOOLEAN DEFAULT false,
                parameters JSONB,
                created_at BIGINT NOT NULL
            );
        `;

        console.log('✓ alarms table created successfully');

        console.log('Creating alarm_signals table...');

        await sql`
            CREATE TABLE IF NOT EXISTS alarm_signals (
                id SERIAL PRIMARY KEY,
                alarm_id INTEGER REFERENCES alarms(id),
                signal_type VARCHAR(10),
                price DECIMAL(20, 8),
                triggered_at BIGINT NOT NULL,
                action_taken VARCHAR(50)
            );
        `;

        console.log('✓ alarm_signals table created successfully');
        console.log('\n✅ All tables created successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
