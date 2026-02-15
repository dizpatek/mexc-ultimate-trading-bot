import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { handleBuySignal, handleSellSignal } from '@/lib/trade';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { symbol, side, usdtAmount, quantity } = body;

        if (!symbol || !side) {
            return NextResponse.json({ error: 'Symbol and side are required' }, { status: 400 });
        }

        const pair = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;

        if (side === 'BUY') {
            const amount = usdtAmount || 10; // Default 10 USDT
            const result = await handleBuySignal({ 
                pair, 
                usdt: parseFloat(amount.toString()),
                risk: 0.01 // Standard risk
            });
            return NextResponse.json({ success: true, result });
        } else if (side === 'SELL') {
            const result = await handleSellSignal({ 
                pair,
                amount: quantity ? parseFloat(quantity.toString()) : null,
                percent: quantity ? null : 100 // Default 100% if no qty
            });
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: 'Invalid side' }, { status: 400 });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Quick trade error:', error);
        return NextResponse.json({ 
            error: 'Trade failed', 
            message: message 
        }, { status: 500 });
    }
}
