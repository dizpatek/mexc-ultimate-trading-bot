import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';
import { getPrice } from '@/lib/mexc-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get ACTIVE and PAUSED bots, ordered by created_at DESC
        const { rows } = await sql`
            SELECT * FROM dca_bots 
            WHERE user_id = ${user.id} AND status IN ('ACTIVE', 'PAUSED')
            ORDER BY created_at DESC
        `;

        // Calculate current performance for each bot (optional real-time check)
        // For simplicity, we just return DB state. Frontend can fetch real-time price.
        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { symbol, amount, intervalHours, takeProfitPercent } = await request.json();

        if (!symbol || !amount || !intervalHours) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO dca_bots (
                user_id, symbol, amount, interval_hours, take_profit_percent,
                total_invested, total_bought_qty, average_price,
                status, last_run_at, created_at, updated_at
            ) VALUES (
                ${user.id}, ${symbol}, ${amount}, ${intervalHours}, ${takeProfitPercent || null},
                0, 0, 0,
                'ACTIVE', 0, ${Date.now()}, ${Date.now()}
            ) RETURNING id
        `;

        return NextResponse.json({ success: true, id: result.rows[0].id });

    } catch (error: any) {
        console.error('Create DCA Bot Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await sql`
            UPDATE dca_bots SET status = 'CANCELLED', updated_at = ${Date.now()}
            WHERE id = ${id} AND user_id = ${user.id}
        `;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
