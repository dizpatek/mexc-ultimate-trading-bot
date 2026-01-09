import { NextResponse } from 'next/server';
import { startAutopilot, stopAutopilot } from '@/lib/autopilot';
import { getSessionUser } from '@/lib/auth-utils';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { active } = await request.json();

        if (active) {
            const result = await startAutopilot();
            return NextResponse.json(result);
        } else {
            const result = await stopAutopilot();
            return NextResponse.json(result);
        }
    } catch (error: any) {
        console.error('Error toggling autopilot:', error);
        return NextResponse.json({ error: 'Failed to toggle autopilot' }, { status: 500 });
    }
}
