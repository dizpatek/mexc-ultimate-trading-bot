import { NextResponse } from 'next/server';
import { getOpenOrders } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const openOrders = await getOpenOrders();

        const orders = openOrders.map((order, index) => ({
            id: String(index + 1),
            symbol: order.symbol,
            type: order.side.toLowerCase(),
            price: parseFloat(order.price),
            amount: parseFloat(order.origQty),
            total: parseFloat(order.price) * parseFloat(order.origQty),
            time: new Date(order.time).toISOString(),
            status: order.status.toLowerCase()
        }));

        return NextResponse.json(orders);
    } catch (error: any) {
        console.error('Error fetching open orders:', error);
        return NextResponse.json({ error: 'Failed to fetch open orders' }, { status: 500 });
    }
}
