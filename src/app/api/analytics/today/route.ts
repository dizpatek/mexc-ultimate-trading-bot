import { NextResponse } from 'next/server';
import { calculateDailyPerformance } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const todayMetrics = await calculateDailyPerformance();
        return NextResponse.json(todayMetrics || { message: 'No trades today' });
    } catch (error: any) {
        console.error('Error calculating today\'s performance:', error);
        return NextResponse.json({ error: 'Failed to calculate performance' }, { status: 500 });
    }
}
