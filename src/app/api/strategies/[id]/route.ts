import { NextResponse } from 'next/server';
import { getStrategyById, updateStrategy, deleteStrategy } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const strategyId = parseInt(id);
        const existingStrategy = await getStrategyById(strategyId);

        if (!existingStrategy || existingStrategy.user_id !== user.id) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        const body = await request.json();
        await updateStrategy(strategyId, body);

        const updatedStrategy = await getStrategyById(strategyId);
        return NextResponse.json(updatedStrategy);
    } catch (error: any) {
        console.error('Error updating strategy:', error);
        return NextResponse.json({ error: 'Failed to update strategy' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const strategyId = parseInt(id);
        const existingStrategy = await getStrategyById(strategyId);

        if (!existingStrategy || existingStrategy.user_id !== user.id) {
            return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
        }

        await deleteStrategy(strategyId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting strategy:', error);
        return NextResponse.json({ error: 'Failed to delete strategy' }, { status: 500 });
    }
}
