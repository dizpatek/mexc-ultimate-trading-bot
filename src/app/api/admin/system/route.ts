import { NextResponse } from 'next/server';
import { getBotConfig, updateBotConfig } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';
import { ensureTablesExist } from '@/lib/db-init';

export async function GET(request: Request) {
    const user = await getSessionUser(request);
    if (!user || user.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await ensureTablesExist();
        const config = await getBotConfig();
        return NextResponse.json({ success: true, config });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = await getSessionUser(request);
    if (!user || user.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await ensureTablesExist();
        const updates = await request.json();
        await updateBotConfig(updates);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
