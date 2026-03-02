import { NextResponse } from 'next/server';
import { createPortfolioSnapshot } from '@/lib/db';
import { getAccountInfo, getPrice } from '@/lib/mexc-wrapper';

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
        // Use 'dev-secret' ONLY in non-production environments for local testing
        const isDev = process.env.NODE_ENV !== 'production';
        const cronSecret = process.env.CRON_SECRET || (isDev ? 'dev-secret' : null);
        
        if (!cronSecret) {
            console.error('[Cron] CRON_SECRET is not configured. Aborting snapshot.');
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
        }
        
        const expectedAuth = `Bearer ${cronSecret}`;

        if (authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting portfolio snapshot...');

        // Get account info (cron uses user 1 as default)
        const accountInfo = await getAccountInfo(1);
        const activeBalances = (accountInfo.balances || []).filter(
            (b: { free: string; locked: string }) => parseFloat(b.free) + parseFloat(b.locked) > 0
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
                } catch {
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
        // P3.1: TODO: Add a mechanism to identify and handle delisted or untradeable assets gracefully.
        // P4.1: TODO: Implement a more robust error handling for price fetching, possibly with retries or fallback sources.
        // P4.2: TODO: Consider adding a cache for price data to reduce API calls and improve performance.
        // P4.3: TODO: Evaluate the impact of parallelizing price fetching for all active balances.

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

    } catch (error: unknown) {
        console.error('[Cron] Error creating portfolio snapshot:', error);
        return NextResponse.json(
            { error: 'Failed to create snapshot', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
