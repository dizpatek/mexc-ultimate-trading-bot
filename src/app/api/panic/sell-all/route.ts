import { NextResponse } from 'next/server';
import { getAccountInfo, marketSellByQty } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all current balances
        const accountInfo = await getAccountInfo();
        const activeBalances = accountInfo.balances.filter(
            b => {
                const total = parseFloat(b.free) + parseFloat(b.locked);
                return total > 0 && b.asset !== 'USDT' && b.asset !== 'USDC';
            }
        );

        if (activeBalances.length === 0) {
            return NextResponse.json({
                error: 'No assets to sell',
                message: 'Your portfolio only contains USDT/USDC'
            }, { status: 400 });
        }

        const snapshotData: any[] = [];
        const sellResults: any[] = [];
        let totalUsdtValue = 0;

        // Sell all assets
        for (const balance of activeBalances) {
            const asset = balance.asset;
            const quantity = parseFloat(balance.free);

            if (quantity <= 0) continue;

            try {
                const symbol = `${asset}USDT`;
                const sellResult = await marketSellByQty(symbol, String(quantity));

                const usdtReceived = parseFloat(sellResult.cummulativeQuoteQty || '0');
                totalUsdtValue += usdtReceived;

                snapshotData.push({
                    asset,
                    quantity,
                    symbol,
                    usdtValue: usdtReceived,
                    orderId: sellResult.orderId
                });

                sellResults.push({
                    asset,
                    success: true,
                    quantity,
                    usdtReceived
                });

            } catch (error: any) {
                console.error(`Failed to sell ${asset}:`, error.message);
                sellResults.push({
                    asset,
                    success: false,
                    error: error.message
                });
            }
        }

        // Save snapshot to database
        const timestamp = Date.now();
        await sql`
            INSERT INTO panic_snapshots (user_id, snapshot_data, total_usdt_value, created_at)
            VALUES (${user.id}, ${JSON.stringify(snapshotData)}, ${totalUsdtValue}, ${timestamp})
        `;

        return NextResponse.json({
            success: true,
            message: `Sold ${sellResults.filter(r => r.success).length} assets`,
            totalUsdtValue,
            results: sellResults,
            timestamp
        });

    } catch (error: any) {
        console.error('Panic sell error:', error);
        return NextResponse.json({
            error: 'Panic sell failed',
            message: error.message
        }, { status: 500 });
    }
}
