import { NextResponse } from 'next/server';
import { checkDcaBots } from '@/lib/dca-engine';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Ensure table exists
        await sql`
            CREATE TABLE IF NOT EXISTS dca_bots (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                amount DECIMAL NOT NULL,
                interval_hours INTEGER NOT NULL,
                take_profit_percent DECIMAL,
                total_invested DECIMAL DEFAULT 0,
                total_bought_qty DECIMAL DEFAULT 0,
                average_price DECIMAL DEFAULT 0,
                status TEXT DEFAULT 'ACTIVE',
                last_run_at BIGINT DEFAULT 0,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            );
        `;

        await checkDcaBots();

        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (error: any) {
        console.error('DCA Cron Failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
