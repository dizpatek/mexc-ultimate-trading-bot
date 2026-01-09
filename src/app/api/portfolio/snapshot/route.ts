import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice } from '@/lib/mexc';
import { createPortfolioSnapshot } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accountInfo = await getAccountInfo();

        let totalValue = 0;
        let assetsCount = 0;

        const prices: Record<string, number> = {
            'BTC': await getPrice('BTCUSDT').catch(() => 0),
            'ETH': await getPrice('ETHUSDT').catch(() => 0),
            'BNB': await getPrice('BNBUSDT').catch(() => 0),
            'SOL': await getPrice('SOLUSDT').catch(() => 0),
            'USDT': 1,
            'USDC': 1
        };

        const balances = accountInfo.balances
            .filter(b => (parseFloat(b.free) + parseFloat(b.locked)) > 0)
            .map(b => {
                const total = parseFloat(b.free) + parseFloat(b.locked);
                const price = prices[b.asset] || 0;
                const value = total * price;
                if (total > 0) {
                    assetsCount++;
                    totalValue += value;
                }
                return { asset: b.asset, amount: total, value };
            });

        const snapshotId = await createPortfolioSnapshot(totalValue, assetsCount, balances);

        return NextResponse.json({ ok: true, snapshotId, totalValue, assetsCount });
    } catch (error: any) {
        console.error('Error creating portfolio snapshot:', error);
        return NextResponse.json({ error: 'Failed to create portfolio snapshot' }, { status: 500 });
    }
}
