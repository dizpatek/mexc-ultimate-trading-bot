import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { marketBuyByQuote, type TradingMode } from '@/lib/mexc-wrapper';
import { getSessionUser } from '@/lib/auth-utils';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cookieStore = await cookies();
        const mode = cookieStore.get('TRADING_MODE')?.value as TradingMode || 'test';

        console.log(`[BuyBack] Initiating buy-back for user ${user.id} in ${mode.toUpperCase()} mode`);

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
        const snapshotData = snapshot.snapshot_data as { asset: string; usdtValue: number; symbol: string; quantity: number }[];

        const buyResults: { asset: string; success: boolean; quantityReceived?: number; usdtSpent?: number; originalQuantity?: number; error?: string }[] = [];
        let totalSpent = 0;

        // Buy back all assets from snapshot
        for (const item of snapshotData) {
            try {
                const { asset, usdtValue, symbol } = item;

                // Use the USDT value from the snapshot to buy back
                const buyResult = await marketBuyByQuote(user.id, symbol, String(usdtValue), mode);

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

            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to buy back ${item.asset}:`, message);
                buyResults.push({
                    asset: item.asset,
                    success: false,
                    error: message
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Bought back ${buyResults.filter(r => r.success).length} assets`,
            totalSpent,
            results: buyResults,
            snapshotTimestamp: snapshot.created_at,
            mode
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Buy back error:', message);
        return NextResponse.json({
            error: 'Buy back failed',
            message
        }, { status: 500 });
    }
}
