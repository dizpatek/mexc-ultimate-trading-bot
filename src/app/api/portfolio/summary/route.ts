import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get real data from MEXC API
        const accountInfo = await getAccountInfo();

        // Calculate total portfolio value and assets count
        let totalValue = 0;
        let assetsCount = 0;

        // Get prices for major cryptocurrencies
        const btcPrice = await getPrice('BTCUSDT').catch(() => 0);
        const ethPrice = await getPrice('ETHUSDT').catch(() => 0);
        const bnbPrice = await getPrice('BNBUSDT').catch(() => 0);
        const solPrice = await getPrice('SOLUSDT').catch(() => 0);

        // Map of symbols to prices for calculation
        const prices: Record<string, number> = {
            'BTC': btcPrice,
            'ETH': ethPrice,
            'BNB': bnbPrice,
            'SOL': solPrice,
            'USDT': 1,
            'USDC': 1
        };

        // Calculate total value and count assets
        for (const balance of accountInfo.balances) {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const total = free + locked;

            if (total > 0) {
                assetsCount++;

                const symbol = balance.asset;
                const price = prices[symbol];
                if (price) {
                    totalValue += total * price;
                }
            }
        }

        // Mock 24h change for now
        const change24h = totalValue * 0.02;
        const changePercentage = 2.0;

        return NextResponse.json({
            totalValue,
            change24h,
            changePercentage,
            assets: assetsCount
        });
    } catch (error: any) {
        console.error('Error fetching portfolio summary:', error);
        return NextResponse.json({ error: 'Failed to fetch portfolio summary' }, { status: 500 });
    }
}
