import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getSessionUser } from '@/lib/auth-utils';
import { ensureTablesExist } from '@/lib/db-init';

export async function GET(req: Request) {
    try {
        const user = await getSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Auto-initialize tables if they don't exist
        await ensureTablesExist();

        const { rows } = await sql`
            SELECT * FROM alarms 
            WHERE user_id = ${user.id} 
            ORDER BY created_at DESC
        `;

        return NextResponse.json(rows);
    } catch (error) {
        console.error('Failed to fetch alarms:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await ensureTablesExist();

        const body = await req.json();
        const { symbol, condition_type, action_type } = body;

        if (!symbol || !condition_type || !action_type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { rows } = await sql`
            INSERT INTO alarms (user_id, symbol, condition_type, action_type, created_at, is_active)
            VALUES (${user.id}, ${symbol}, ${condition_type}, ${action_type}, ${Date.now()}, true)
            RETURNING *
        `;

        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error('Failed to create alarm:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const user = await getSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await ensureTablesExist();

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        }

        await sql`
            DELETE FROM alarms 
            WHERE id = ${id} AND user_id = ${user.id}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete alarm:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
