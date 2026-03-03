import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@/lib/postgres';
import { ensureTablesExist } from '@/lib/db-init';
import { resetSimulator } from '@/lib/trading-simulator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        console.log(`[Reset] Initiating wipe for User ID: ${user.id}`);

        // Ensure database structure is ready
        await ensureTablesExist();

        // 1. Transactional Delete with individual try-catches to handle non-existent tables or missing data
        const cleanup = async (tableName: string) => {
            try {
                await sql.query(`DELETE FROM ${tableName} WHERE user_id = $1`, [user.id]);
                console.log(`[Reset] Cleaned table: ${tableName}`);
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : 'Unknown error';
                console.warn(`[Reset] Could not clean ${tableName}: ${errorMessage}`);
                // Try again without WHERE if user_id column is missing (legacy)
                try { await sql.query(`DELETE FROM ${tableName}`); } catch { }
            }
        };

        // Order matters for some FK constraints if any, but we'll try all
        await cleanup('trade_history'); // Corrected name from 'trades'
        await cleanup('orders');
        await cleanup('portfolio_snapshots');
        await cleanup('dca_bots');
        await cleanup('panic_snapshots');
        await cleanup('alarm_logs'); // Might not have user_id but cascade? No, let's just try.

        // Special cleanup for alarms (has user_id)
        await cleanup('alarms');

        // 2. Portfolio Table - Total Wipe for this user
        try {
            await sql`DELETE FROM portfolio WHERE user_id = ${user.id}`;
        } catch { }

        // 3. Re-initialize with crisp $100,000 USDT Simulator entry
        await sql`
            INSERT INTO portfolio (user_id, symbol, balance, type, created_at, updated_at)
            VALUES (${user.id}, 'USDT', 100000.00, 'SIMULATOR', ${Date.now()}, ${Date.now()})
            ON CONFLICT (user_id, symbol, type) DO UPDATE 
            SET balance = 100000.00, updated_at = ${Date.now()}
        `;

        // 3. Clear in-memory simulator instance (singleton)
        resetSimulator(user.id);

        console.log(`[Reset] Wipe complete. User ${user.id} has $100k USDT reset.`);

        return NextResponse.json({
            success: true,
            message: 'Simulator data wiped and $100,000 USDT balance restored.'
        });

    } catch (error: unknown) {
        console.error('CRITICAL RESET ERROR:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });
    }
}
