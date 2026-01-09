import { NextResponse } from 'next/server';
import { getStrategyById, getStrategySignals } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const strategy_id = searchParams.get('strategy_id');
        const limit = parseInt(searchParams.get('limit') || '100');

        if (!strategy_id) {
            return NextResponse.json({ error: 'strategy_id is required' }, { status: 400 });
        }

        const sid = parseInt(strategy_id);
        const strategy = await getStrategyById(sid);
        if (!strategy || strategy.user_id !== user.id) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        const signals = await getStrategySignals(sid, limit);
        return NextResponse.json(signals);
    } catch (error: any) {
        console.error('Error fetching strategy signals:', error);
        return NextResponse.json({ error: 'Failed to get signals' }, { status: 500 });
    }
}
