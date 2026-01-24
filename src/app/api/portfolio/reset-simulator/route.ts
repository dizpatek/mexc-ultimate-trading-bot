import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        console.log(`[Reset] User ${user.id} requested a simulator reset.`);

        // Ensure tables exist before deleting
        await ensureTablesExist();

        // 1. Delete all test data for this user
        // Using try-catch for each to handle cases where some might be empty or missing
        try { await sql`DELETE FROM trades WHERE user_id = ${user.id}`; } catch (e) { }
        try { await sql`DELETE FROM orders WHERE user_id = ${user.id}`; } catch (e) { }
        try { await sql`DELETE FROM portfolio_snapshots WHERE user_id = ${user.id}`; } catch (e) { }
        try { await sql`DELETE FROM portfolio WHERE user_id = ${user.id}`; } catch (e) { }
        try { await sql`DELETE FROM dca_bots WHERE user_id = ${user.id}`; } catch (e) { }

        // 2. Re-initialize with $100,000 USDT
        await sql`
            INSERT INTO portfolio (user_id, symbol, balance, type, created_at, updated_at)
            VALUES (${user.id}, 'USDT', 100000.00, 'SIMULATOR', ${Date.now()}, ${Date.now()})
            ON CONFLICT (user_id, symbol) DO UPDATE SET balance = 100000.00, updated_at = ${Date.now()}
        `;

        return NextResponse.json({ success: true, message: 'Simulator reset successfully' });

    } catch (error: any) {
        console.error('Reset Simulator Error:', error);
        return NextResponse.json({ error: 'Reset failed: ' + error.message }, { status: 500 });
    }
}
