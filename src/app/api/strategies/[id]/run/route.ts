import { NextResponse } from 'next/server';
import { getStrategyById, createStrategySignal } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';
import { createStrategy } from '@/lib/strategies';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const strategyId = parseInt(id);
        const strategy = await getStrategyById(strategyId);

        if (!strategy || strategy.user_id !== user.id) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        const strategyInstance = createStrategy(strategy.strategy_type, strategy.symbol, strategy.parameters);
        const signal = await strategyInstance.analyze();

        if (signal) {
            await createStrategySignal({
                strategy_id: strategyId,
                signal_type: signal.signal,
                price: signal.indicators.rsi || (signal.indicators.macd ? (signal.indicators.macd as any).histogram : null),
                timestamp: signal.timestamp
            });
        }

        return NextResponse.json({ signal });
    } catch (error: any) {
        console.error('Error running strategy:', error);
        return NextResponse.json({ error: 'Failed to run strategy' }, { status: 500 });
    }
}
