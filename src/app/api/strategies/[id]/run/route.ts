import { NextResponse } from 'next/server';
import { getStrategyById, createStrategySignal } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';
import { createStrategy, type StrategyParameters } from '@/lib/strategies';

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

        // Cast parameters to StrategyParameters type
        const parameters = (strategy.parameters || {}) as StrategyParameters;
        const strategyInstance = createStrategy(strategy.strategy_type, strategy.symbol, parameters);
        const signal = await strategyInstance.analyze();

        if (signal && signal.signal) {
            const price = signal.indicators.rsi !== undefined 
                ? Number(signal.indicators.rsi) 
                : (signal.indicators.macd ? Number((signal.indicators.macd as Record<string, unknown>).histogram) : undefined);
            
            await createStrategySignal({
                strategy_id: strategyId,
                signal_type: signal.signal,
                price: price,
                timestamp: signal.timestamp
            });
        }

        return NextResponse.json({ signal });
    } catch (error: unknown) {
        console.error('Error running strategy:', error);
        return NextResponse.json({ error: 'Failed to run strategy' }, { status: 500 });
    }
}
