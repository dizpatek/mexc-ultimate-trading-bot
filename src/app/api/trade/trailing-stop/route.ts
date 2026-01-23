import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';
import { getPrice } from '@/lib/mexc-wrapper';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { rows } = await sql`
            SELECT * FROM trailing_stops WHERE user_id = ${user.id} AND status = 'ACTIVE'
        `;

        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { symbol, callbackRate, quantity, activationPrice } = await request.json();

        if (!symbol || !callbackRate || !quantity) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get current price to set initial highest_price
        const currentPrice = await getPrice(symbol);

        // Use activation price if provided and higher than current (pending activation)
        // Or start trailing immediately from current price
        const initialHigh = activationPrice && activationPrice > currentPrice
            ? activationPrice // Wait until this price to start trailing logic (handled in engine)
            : currentPrice;

        // Cancel existing stops for this symbol? Usually one per symbol is safer.
        await sql`
            UPDATE trailing_stops SET status = 'CANCELLED' 
            WHERE user_id = ${user.id} AND symbol = ${symbol} AND status = 'ACTIVE'
        `;

        const result = await sql`
            INSERT INTO trailing_stops (
                user_id, symbol, quantity, entry_price, highest_price, 
                callback_rate, activation_price, status, created_at, updated_at
            ) VALUES (
                ${user.id}, ${symbol}, ${quantity}, ${currentPrice}, ${initialHigh}, 
                ${callbackRate}, ${activationPrice || null}, 'ACTIVE', ${Date.now()}, ${Date.now()}
            ) RETURNING id
        `;

        return NextResponse.json({ success: true, id: result.rows[0].id });

    } catch (error: any) {
        console.error('Create Trailing Stop Error:', error);
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
            UPDATE trailing_stops SET status = 'CANCELLED', updated_at = ${Date.now()}
            WHERE id = ${id} AND user_id = ${user.id}
        `;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
