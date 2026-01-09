import { NextResponse } from 'next/server';
import { getAutopilotStatus } from '@/lib/autopilot';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const status = await getAutopilotStatus();
        return NextResponse.json(status);
    } catch (error: any) {
        console.error('Error fetching autopilot status:', error);
        return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
    }
}
