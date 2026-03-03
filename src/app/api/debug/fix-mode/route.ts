
import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';

export async function GET() {
    try {
        const userId = 1;
        const now = Date.now();
        await sql`
            INSERT INTO system_settings (user_id, key, value, updated_at)
            VALUES (${userId}, 'TRADING_MODE', 'test', ${now})
            ON CONFLICT (user_id, key) DO UPDATE SET
            value = 'test',
            updated_at = EXCLUDED.updated_at
        `;
        return NextResponse.json({ success: true, message: 'Trading mode set to test for user 1' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
