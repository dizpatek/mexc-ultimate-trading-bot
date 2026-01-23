import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function createSystemSettingsTable() {
    console.log('🔧 Creating system_settings table...');

    try {
        // Create system_settings table
        await sql`
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at BIGINT NOT NULL
            )
        `;

        console.log('✅ system_settings table created successfully!');

        // Check if table exists and show structure
        const { rows } = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'system_settings'
            ORDER BY ordinal_position
        `;

        console.log('\n📊 Table structure:');
        console.table(rows);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating system_settings table:', error);
        process.exit(1);
    }
}

createSystemSettingsTable();
