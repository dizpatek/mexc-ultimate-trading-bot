import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accountInfo = await getAccountInfo();

        const btcPrice = await getPrice('BTCUSDT').catch(() => 0);
        const ethPrice = await getPrice('ETHUSDT').catch(() => 0);
        const bnbPrice = await getPrice('BNBUSDT').catch(() => 0);
        const solPrice = await getPrice('SOLUSDT').catch(() => 0);

        const prices: Record<string, { price: number; name: string }> = {
            'BTC': { price: btcPrice, name: 'Bitcoin' },
            'ETH': { price: ethPrice, name: 'Ethereum' },
            'BNB': { price: bnbPrice, name: 'Binance Coin' },
            'SOL': { price: solPrice, name: 'Solana' },
            'USDT': { price: 1, name: 'Tether' },
            'USDC': { price: 1, name: 'USD Coin' }
        };

        const holdings = accountInfo.balances
            .filter(balance => (parseFloat(balance.free) + parseFloat(balance.locked)) > 0)
            .map((balance, index) => {
                const free = parseFloat(balance.free);
                const locked = parseFloat(balance.locked);
                const total = free + locked;
                const symbol = balance.asset;
                const priceInfo = prices[symbol];
                const price = priceInfo ? priceInfo.price : 0;
                const name = priceInfo ? priceInfo.name : symbol;
                const value = total * price;

                const change24h = (Math.random() * 10) - 5;

                return {
                    id: String(index + 1),
                    symbol,
                    name,
                    price,
                    change24h,
                    holding: total,
                    value,
                    allocation: 0
                };
            });

        const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

        const holdingsWithAllocation = holdings.map(holding => ({
            ...holding,
            allocation: totalValue > 0 ? (holding.value / totalValue) * 100 : 0
        }));

        return NextResponse.json(holdingsWithAllocation);
    } catch (error: any) {
        console.error('Error fetching holdings:', error);
        return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }
}
