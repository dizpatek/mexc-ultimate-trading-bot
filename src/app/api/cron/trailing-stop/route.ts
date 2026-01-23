import { NextResponse } from 'next/server';
import { checkTrailingStops } from '@/lib/trailing-stop';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Ensure table exists (Lazy initialization)
        await sql`
            CREATE TABLE IF NOT EXISTS trailing_stops (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                quantity DECIMAL NOT NULL,
                entry_price DECIMAL NOT NULL,
                highest_price DECIMAL NOT NULL,
                callback_rate DECIMAL NOT NULL,
                activation_price DECIMAL,
                status TEXT DEFAULT 'ACTIVE',
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;

        await checkTrailingStops();

        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (error: any) {
        console.error('Trailing Stop Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
