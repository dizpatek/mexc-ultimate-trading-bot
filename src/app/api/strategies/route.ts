import { NextResponse } from 'next/server';
import { getStrategiesByUser, createStrategy } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';
import { AVAILABLE_STRATEGIES } from '@/lib/strategies';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const strategies = await getStrategiesByUser(user.id);
        return NextResponse.json(strategies);
    } catch (error: any) {
        console.error('Error fetching strategies:', error);
        return NextResponse.json({ error: 'Failed to fetch strategies' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, symbol, strategy_type, parameters } = body;

        if (!name || !symbol || !strategy_type) {
            return NextResponse.json({ error: 'Name, symbol, and strategy_type are required' }, { status: 400 });
        }

        // @ts-ignore
        if (!AVAILABLE_STRATEGIES[strategy_type]) {
            return NextResponse.json({ error: 'Invalid strategy type' }, { status: 400 });
        }

        const strategyId = await createStrategy({
            user_id: user.id,
            name,
            symbol,
            strategy_type,
            parameters
        });

        return NextResponse.json({ id: strategyId, success: true });
    } catch (error: any) {
        console.error('Error creating strategy:', error);
        return NextResponse.json({ error: 'Failed to create strategy' }, { status: 500 });
    }
}
