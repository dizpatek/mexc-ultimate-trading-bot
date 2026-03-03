import { NextResponse } from 'next/server';
import { sql } from '@/lib/postgres';
import { getSessionUser } from '@/lib/auth-utils';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Auto-migrate if needed
        await ensureTablesExist();

        // Fetch both trade signals and system logs for a complete CombatLog feel
        const { rows } = await sql`
            (
                SELECT 
                    s.id::text,
                    COALESCE(st.name, 'Pilot ON') as strategy_name,
                    COALESCE(s.symbol, st.symbol, 'Global') as symbol,
                    s.signal_type as type,
                    s.price::text as price,
                    s.timestamp,
                    s.executed,
                    s.execution_result::text as detail
                FROM strategy_signals s
                LEFT JOIN strategies st ON s.strategy_id = st.id
            )
            UNION ALL
            (
                SELECT 
                    'sys-' || id::text as id,
                    'Sistem' as strategy_name,
                    'SYSTEM' as symbol,
                    level as type,
                    '---' as price,
                    timestamp,
                    true as executed,
                    message || ': ' || COALESCE(details, '') as detail
                FROM system_logs
            )
            ORDER BY timestamp DESC
            LIMIT 50
        `;

        return NextResponse.json(rows);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
