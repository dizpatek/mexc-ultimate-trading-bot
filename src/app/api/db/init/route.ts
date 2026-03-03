import { NextResponse } from 'next/server';
import { pool, sql } from '@/lib/postgres';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        const schemaPath = path.resolve(process.cwd(), 'scripts/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        console.log(`[DB Init] Starting initialization with ${statements.length} statements...`);

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (err: any) {
                // Ignore if table already exists, or other minor errors
                console.warn(`[DB Init] Warning executing statement: ${statement.substring(0, 50)}... Error: ${err.message}`);
            }
        }

        // Migration: Fix system_settings user_id if needed
        try {
            const { rows: nullUserRows } = await pool.query('SELECT count(*) FROM system_settings WHERE user_id IS NULL');
            if (parseInt(nullUserRows[0].count) > 0) {
                console.log(`[DB Init] Migrating ${nullUserRows[0].count} system_settings rows to user 1...`);
                await pool.query('UPDATE system_settings SET user_id = 1 WHERE user_id IS NULL');
                await pool.query('ALTER TABLE system_settings ALTER COLUMN user_id SET NOT NULL');
            }
        } catch (err: any) {
            console.warn('[DB Init] system_settings migration check skipped (table might be new):', err.message);
        }

        // Seed default admin user if none exists
        const { rows: users } = await pool.query('SELECT * FROM users LIMIT 1');
        if (users.length === 0) {
            const passwordHash = await bcrypt.hash('admin123', 10);
            const now = Date.now();
            await pool.query(
                'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
                ['admin', 'snat@bot.com', passwordHash, now, now]
            );
            console.log('[DB Init] Admin user seeded: snat@bot.com / admin123');
        }

        // Seed default bot config if none exists
        const { rows: configs } = await pool.query('SELECT * FROM bot_configs WHERE id = 1');
        if (configs.length === 0) {
            const now = Date.now();
            await pool.query(
                'INSERT INTO bot_configs (id, f4_length, whale_multiplier, ai_threshold, auto_trade, defense_mode, timeframe, updated_at) VALUES (1, 10, 1.8, 65, false, false, \'4h\', $1)',
                [now]
            );
            console.log('[DB Init] Default bot config seeded');
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Database initialized and seeded',
            loginHints: {
                email: 'snat@bot.com',
                password: 'admin123'
            }
        });
    } catch (error: any) {
        console.error('[DB Init] Fatal error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
