import { NextResponse } from 'next/server';
import { getPerformanceMetrics } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        const metrics = await getPerformanceMetrics(days);
        return NextResponse.json(metrics);
    } catch (error: any) {
        console.error('Error fetching performance metrics:', error);
        return NextResponse.json({ error: 'Failed to fetch performance metrics' }, { status: 500 });
    }
}
