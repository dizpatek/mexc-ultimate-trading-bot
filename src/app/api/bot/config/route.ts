import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { getBotConfig, updateBotConfig } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const config = await getBotConfig();
        return NextResponse.json(config);
    } catch (error: any) {
        console.error('Fetch Bot Config Error:', error);
        return NextResponse.json({ error: 'Failed to fetch bot config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updates = await request.json();
        await updateBotConfig(updates);
        
        const updatedConfig = await getBotConfig();
        return NextResponse.json({ success: true, config: updatedConfig });
    } catch (error: any) {
        console.error('Update Bot Config Error:', error);
        return NextResponse.json({ error: 'Failed to update bot config' }, { status: 500 });
    }
}
