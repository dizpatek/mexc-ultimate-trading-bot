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

        // Detect if we are in mock mode (accountInfo might return mock data logic)
        // Ideally we check env vars but this runs in runtime
        const isMock = !process.env.MEXC_KEY || !process.env.MEXC_SECRET;

        const activeBalances = accountInfo.balances.filter(
            b => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        let totalValueCurrent = 0;
        let totalValue24hAgo = 0;
        let assetsCount = 0;

        const assetPromises = activeBalances.map(async (balance) => {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const totalQty = free + locked;
            const symbol = balance.asset;

            let priceCurrent = 0;
            let changePercent = 0;
            let pair = `${symbol}USDT`;

            if (symbol === 'USDT' || symbol === 'USDC') {
                priceCurrent = 1;
                changePercent = 0;
            } else {
                try {
                    priceCurrent = await getPrice(pair);
                    const ticker = await get24hrTicker(pair);

                    if (ticker && ticker.priceChangePercent) {
                        changePercent = parseFloat(ticker.priceChangePercent);
                    }
                } catch (e) {
                    // console.warn(`Skipping price for ${pair}`);
                }
            }

            const valueCurrent = totalQty * priceCurrent;
            // Calculate price 24h ago: price / (1 + pct/100)
            const price24hAgo = priceCurrent / (1 + (changePercent / 100));
            const value24hAgo = totalQty * price24hAgo;

            return { valueCurrent, value24hAgo };
        });

        const assetResults = await Promise.all(assetPromises);

        for (const result of assetResults) {
            if (result.valueCurrent > 0) {
                totalValueCurrent += result.valueCurrent;
                totalValue24hAgo += result.value24hAgo;
                assetsCount++;
            }
        }

        const change24hValue = totalValueCurrent - totalValue24hAgo;
        const changePercentage = totalValue24hAgo > 0
            ? ((change24hValue / totalValue24hAgo) * 100)
            : 0;

        return NextResponse.json({
            totalValue: totalValueCurrent,
            change24h: change24hValue,
            changePercentage: changePercentage,
            assets: assetsCount,
            isMock
        });
    } catch (error: any) {
        console.error('Error fetching real portfolio summary:', error);
        return NextResponse.json({ error: 'Failed to fetch portfolio summary' }, { status: 500 });
    }
}
