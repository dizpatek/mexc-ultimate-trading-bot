import { NextResponse } from 'next/server';
import { logSystemEvent } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { level, message, details } = await request.json();
        await logSystemEvent(Number(user.id), level || 'INFO', message, details);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
