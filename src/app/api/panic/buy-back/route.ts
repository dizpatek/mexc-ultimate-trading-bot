import { NextResponse } from 'next/server';
import { marketBuyByQuote } from '@/lib/mexc';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the most recent panic snapshot
        const result = await sql`
            SELECT * FROM panic_snapshots 
            WHERE user_id = ${user.id}
            ORDER BY created_at DESC 
            LIMIT 1
        `;

        if (result.rows.length === 0) {
            return NextResponse.json({
                error: 'No panic snapshot found',
                message: 'You need to perform a panic sell first'
            }, { status: 404 });
        }

        const snapshot = result.rows[0];
        const snapshotData = snapshot.snapshot_data as any[];

        const buyResults: any[] = [];
        let totalSpent = 0;

        // Buy back all assets from snapshot
        for (const item of snapshotData) {
            try {
                const { asset, usdtValue, symbol } = item;

                // Use the USDT value from the snapshot to buy back
                const buyResult = await marketBuyByQuote(symbol, String(usdtValue));

                const quantityReceived = parseFloat(buyResult.executedQty || '0');
                const spent = parseFloat(buyResult.cummulativeQuoteQty || '0');
                totalSpent += spent;

                buyResults.push({
                    asset,
                    success: true,
                    quantityReceived,
                    usdtSpent: spent,
                    originalQuantity: item.quantity
                });

            } catch (error: any) {
                console.error(`Failed to buy back ${item.asset}:`, error.message);
                buyResults.push({
                    asset: item.asset,
                    success: false,
                    error: error.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Bought back ${buyResults.filter(r => r.success).length} assets`,
            totalSpent,
            results: buyResults,
            snapshotTimestamp: snapshot.created_at
        });

    } catch (error: any) {
        console.error('Buy back error:', error);
        return NextResponse.json({
            error: 'Buy back failed',
            message: error.message
        }, { status: 500 });
    }
}
