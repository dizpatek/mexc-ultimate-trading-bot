import { NextResponse } from 'next/server';
import { getPortfolioSnapshots } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        const snapshots = await getPortfolioSnapshots(days);

        const history = snapshots.map(snapshot => ({
            date: new Date(snapshot.snapshot_date).toISOString(),
            totalValue: snapshot.total_value,
            totalAssets: snapshot.total_assets
        }));

        return NextResponse.json(history);
    } catch (error: any) {
        console.error('Error fetching portfolio history:', error);
        return NextResponse.json({ error: 'Failed to fetch portfolio history' }, { status: 500 });
    }
}
