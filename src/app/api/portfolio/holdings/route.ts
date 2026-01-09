import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice, get24hrTicker } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accountInfo = await getAccountInfo();

        // Filter for non-zero balances
        const activeBalances = accountInfo.balances.filter(
            b => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        const holdingsPromises = activeBalances.map(async (balance, index) => {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const total = free + locked;
            const symbol = balance.asset;

            // Determine pair for price fetching (default to USDT)
            // If the asset IS USDT, price is 1.
            let price = 0;
            let change24h = 0;
            let pair = `${symbol}USDT`;

            if (symbol === 'USDT' || symbol === 'USDC') {
                price = 1;
                change24h = 0;
            } else {
                try {
                    // Fetch real current price
                    price = await getPrice(pair);

                    // Fetch real 24h ticker info
                    // Note: get24hrTicker might return an object or fail if pair doesn't exist
                    const ticker = await get24hrTicker(pair);

                    if (ticker && ticker.priceChangePercent) {
                        change24h = parseFloat(ticker.priceChangePercent);
                    }
                } catch (e) {
                    console.warn(`Could not fetch market data for ${pair}`, e);
                    // Fallback: price 0 if not found (maybe delisted or different pair suffix)
                }
            }

            const value = total * price;

            return {
                id: String(index + 1),
                symbol,
                name: symbol, // Could fetch full names, but symbol is fine for now
                price,
                change24h,
                holding: total,
                value,
                allocation: 0
            };
        });

        const holdings = await Promise.all(holdingsPromises);

        // Sort by value descending
        const sortedHoldings = holdings.sort((a, b) => b.value - a.value);

        const totalValue = sortedHoldings.reduce((sum, h) => sum + h.value, 0);

        const holdingsWithAllocation = sortedHoldings.map(holding => ({
            ...holding,
            allocation: totalValue > 0 ? (holding.value / totalValue) * 100 : 0
        }));

        return NextResponse.json(holdingsWithAllocation);
    } catch (error: any) {
        console.error('Error fetching real holdings:', error);
        return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }
}
