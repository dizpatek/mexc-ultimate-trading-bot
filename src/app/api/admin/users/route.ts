import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    const user = await getSessionUser(request);
    if (!user || user.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { rows } = await sql`SELECT id, username, email, created_at FROM users ORDER BY id ASC`;
        return NextResponse.json({ success: true, users: rows });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const user = await getSessionUser(request);
    if (!user || user.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const targetId = searchParams.get('id');

        if (!targetId || parseInt(targetId) === 1) {
            return NextResponse.json({ error: 'Invalid User ID' }, { status: 400 });
        }

        // Clean up user data - Order matters for foreign keys
        // user_id might be INTEGER or TEXT in different tables due to mixed schema definitions
        const userIdStr = String(targetId);
        const userIdNum = parseInt(targetId);

        console.log(`[Admin] Purging data for User ${targetId}...`);

        const safeDelete = async (label: string, query: () => Promise<unknown>) => {
            try {
                await query();
                console.log(`[Admin] Cleaned: ${label}`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                console.warn(`[Admin] Skip/Fail ${label}: ${message}`);
                // Continue despite table-not-found or other minor errors
            }
        };

        await safeDelete('alarm_logs', () => sql`DELETE FROM alarm_logs WHERE alarm_id IN (SELECT id FROM alarms WHERE user_id = ${userIdNum} OR user_id = ${userIdStr})`);
        await safeDelete('alarms', () => sql`DELETE FROM alarms WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('dca_bots', () => sql`DELETE FROM dca_bots WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('performance_metrics', () => sql`DELETE FROM performance_metrics WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('panic_snapshots', () => sql`DELETE FROM panic_snapshots WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('system_settings', () => sql`DELETE FROM system_settings WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('strategy_signals', () => sql`DELETE FROM strategy_signals WHERE strategy_id IN (SELECT id FROM strategies WHERE user_id = ${userIdNum} OR user_id = ${userIdStr})`);
        await safeDelete('strategies', () => sql`DELETE FROM strategies WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('trade_history', () => sql`DELETE FROM trade_history WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('orders', () => sql`DELETE FROM orders WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('portfolio', () => sql`DELETE FROM portfolio WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('portfolio_snapshots', () => sql`DELETE FROM portfolio_snapshots WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        await safeDelete('trailing_stops', () => sql`DELETE FROM trailing_stops WHERE user_id = ${userIdNum} OR user_id = ${userIdStr}`);
        
        console.log(`[Admin] Finalizing user removal for ID ${targetId}`);
        await sql`DELETE FROM users WHERE id = ${targetId}`;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
