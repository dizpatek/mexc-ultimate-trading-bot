import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice, get24hrTicker } from '@/lib/mexc-wrapper';
import { getPortfolioSnapshots } from '@/lib/db';
import { getSessionUser } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accountInfo = await getAccountInfo();
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
            const pair = `${symbol}USDT`;

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

        // Strategy 1: Estimated change based on current holdings assets 24h performance
        const change24hEstimated = totalValueCurrent - totalValue24hAgo;

        // Strategy 2: Real portfolio change based on snapshots
        let realChangeValue = change24hEstimated;
        let realChangePercent = 0;

        try {
            // Get snapshots for last 2 days
            const snapshots = await getPortfolioSnapshots(2);

            // Find a snapshot close to 24h ago (between 23h and 25h ago)
            const now = Date.now();
            const targetTime = now - (24 * 60 * 60 * 1000);
            const tolerance = 2 * 60 * 60 * 1000; // 2 hours tolerance

            const snapshot24h = snapshots.find((s: any) =>
                Math.abs(Number(s.snapshot_date) - targetTime) < tolerance
            );

            if (snapshot24h) {
                const prevValue = Number(snapshot24h.total_value);
                if (prevValue > 0) {
                    realChangeValue = totalValueCurrent - prevValue;
                    realChangePercent = (realChangeValue / prevValue) * 100;
                }
            } else {
                // Fallback to estimated calculation if no snapshot
                realChangePercent = totalValue24hAgo > 0
                    ? ((change24hEstimated / totalValue24hAgo) * 100)
                    : 0;
            }
        } catch (e) {
            console.warn('Failed to calculate real portfolio change from DB', e);
            // Fallback
            realChangePercent = totalValue24hAgo > 0
                ? ((change24hEstimated / totalValue24hAgo) * 100)
                : 0;
        }

        return NextResponse.json({
            totalValue: totalValueCurrent,
            change24h: realChangeValue,
            changePercentage: realChangePercent,
            assets: assetsCount
        });
    } catch (error: any) {
        console.error('Error fetching real portfolio summary:', error);
        return NextResponse.json({ error: 'Failed to fetch portfolio summary' }, { status: 500 });
    }
}
