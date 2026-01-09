import { NextResponse } from 'next/server';
import { getTradeHistory } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        const tradeHistory = await getTradeHistory(limit);

        const trades = tradeHistory.map(trade => ({
            id: String(trade.id),
            symbol: trade.symbol,
            type: trade.side.toLowerCase(),
            price: trade.price,
            amount: trade.qty,
            total: trade.quote_qty,
            time: new Date(trade.created_at).toISOString(),
            status: 'completed',
            profitLoss: trade.profit_loss,
            profitLossPercentage: trade.profit_loss_percentage
        }));

        return NextResponse.json(trades);
    } catch (error: any) {
        console.error('Error fetching trades:', error);
        return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 });
    }
}
