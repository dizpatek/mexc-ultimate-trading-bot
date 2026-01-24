import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice, get24hrTicker, type TradingMode } from '@/lib/mexc-wrapper';
import { getSessionUser } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get mode from cookies
        const cookieStore = cookies();
        const mode = (await cookieStore).get('TRADING_MODE')?.value as TradingMode || 'test';

        const accountInfo = await getAccountInfo(mode);
        const activeBalances = accountInfo.balances.filter(
            b => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        let totalValue = 0;
        const holdingsData = await Promise.all(activeBalances.map(async (balance) => {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const totalQty = free + locked;
            const symbol = balance.asset;
            const pair = `${symbol}USDT`;

            let currentPrice = 0;
            let change24h = 0;

            if (symbol === 'USDT' || symbol === 'USDC') {
                currentPrice = 1;
                change24h = 0;
            } else {
                try {
                    currentPrice = await getPrice(pair);
                    const ticker = await get24hrTicker(pair);
                    if (ticker) change24h = parseFloat(ticker.priceChangePercent || '0');
                } catch (e) {
                    // Ignore
                }
            }

            const value = totalQty * currentPrice;
            totalValue += value;

            return {
                id: symbol,
                symbol,
                name: symbol, // Could fetch from a mapping if needed
                holding: totalQty,
                price: currentPrice,
                value,
                change24h,
                allocation: 0 // Will calculate after loop
            };
        }));

        // Calculate allocation
        const finalHoldings = holdingsData.map(h => ({
            ...h,
            allocation: totalValue > 0 ? (h.value / totalValue) * 100 : 0
        }));

        // Sort by value DESC
        finalHoldings.sort((a, b) => b.value - a.value);

        return NextResponse.json(finalHoldings);
    } catch (error: any) {
        console.error('Error fetching holdings:', error);
        return NextResponse.json({ error: 'Failed to fetch holdings', details: error.message }, { status: 500 });
    }
}
