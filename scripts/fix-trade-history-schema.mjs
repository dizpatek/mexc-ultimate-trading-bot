import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixTradeHistorySchema() {
    console.log('Starting trade_history schema fix...');
    try {
        // Add user_id column
        await sql`
            ALTER TABLE trade_history 
            ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
        `;
        console.log('Added user_id column.');

        // Add order_id column
        await sql`
            ALTER TABLE trade_history 
            ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);
        `;
        console.log('Added order_id column.');

        // Add commission columns if missing (just in case)
        await sql`
            ALTER TABLE trade_history 
            ADD COLUMN IF NOT EXISTS commission NUMERIC DEFAULT 0;
        `;
        await sql`
            ALTER TABLE trade_history 
            ADD COLUMN IF NOT EXISTS commission_asset TEXT;
        `;

        console.log('Schema fix completed successfully.');
    } catch (error) {
        console.error('Error fixing schema:', error);
    }
}

fixTradeHistorySchema();
