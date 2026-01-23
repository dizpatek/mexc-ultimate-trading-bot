import { NextResponse } from 'next/server';
import { createPortfolioSnapshot } from '@/lib/db';
import { getAccountInfo, getPrice } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

/**
 * Portfolio Snapshot Cron Job
 * This endpoint is called by Vercel Cron to create portfolio snapshots
 * Configured in vercel.json
 */

export async function GET(request: Request) {
    try {
        // Verify cron secret (security)
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`;

        if (authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting portfolio snapshot...');

        // Get account info
        const accountInfo = await getAccountInfo();
        const activeBalances = accountInfo.balances.filter(
            b => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        let totalValue = 0;
        let totalAssets = 0;
        const balancesDetail = [];

        // Calculate total value
        for (const balance of activeBalances) {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const totalQty = free + locked;
            const symbol = balance.asset;

            let price = 0;
            const pair = `${symbol}USDT`;

            if (symbol === 'USDT' || symbol === 'USDC') {
                price = 1;
            } else {
                try {
                    price = await getPrice(pair);
                } catch (e) {
                    console.warn(`[Cron] Could not get price for ${pair}`);
                }
            }

            const value = totalQty * price;

            if (value > 0.01) { // Only count assets worth more than $0.01
                totalValue += value;
                totalAssets++;

                balancesDetail.push({
                    asset: symbol,
                    free,
                    locked,
                    price,
                    value,
                    timestamp: Date.now()
                });
            }
        }

        // Create snapshot
        const snapshotId = await createPortfolioSnapshot(
            totalValue,
            totalAssets,
            balancesDetail
        );

        console.log(`[Cron] Portfolio snapshot created: ID ${snapshotId}, Value: $${totalValue.toFixed(2)}, Assets: ${totalAssets}`);

        return NextResponse.json({
            success: true,
            snapshotId,
            totalValue,
            totalAssets,
            timestamp: Date.now()
        });

    } catch (error: any) {
        console.error('[Cron] Error creating portfolio snapshot:', error);
        return NextResponse.json(
            { error: 'Failed to create snapshot', details: error.message },
            { status: 500 }
        );
    }
}
