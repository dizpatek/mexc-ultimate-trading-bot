import { sql } from '@vercel/postgres';
import { getAccountInfo, marketSellByQty } from './mexc';

export async function executePanicSell(userId: string) {
    try {
        console.log(`[PanicService] Initiating Panic Sell for user ${userId}`);

        // Get all current balances
        const accountInfo = await getAccountInfo();

        // Filter assets: >0 balance and not USDT/USDC
        const activeBalances = accountInfo.balances.filter(
            b => {
                const total = parseFloat(b.free) + parseFloat(b.locked);
                return total > 0 && b.asset !== 'USDT' && b.asset !== 'USDC';
            }
        );

        if (activeBalances.length === 0) {
            console.log('[PanicService] No active assets to sell');
            return { success: false, message: 'No assets to sell', totalUsdtValue: 0 };
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
                // Check if symbol exists/is tradable? Assuming mostly yes for major assets
                // In a perfect world we check exchangeInfo

                const sellResult = await marketSellByQty(symbol, String(quantity));

                const usdtReceived = parseFloat(sellResult.cummulativeQuoteQty || '0');
                totalUsdtValue += usdtReceived;

                console.log(`[PanicService] Sold ${asset}: +${usdtReceived} USDT`);

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
                console.error(`[PanicService] Failed to sell ${asset}:`, error.message);
                sellResults.push({
                    asset,
                    success: false,
                    error: error.message
                });
            }
        }

        // Save snapshot to database
        try {
            const timestamp = Date.now();
            await sql`
                INSERT INTO panic_snapshots (user_id, snapshot_data, total_usdt_value, created_at)
                VALUES (${userId}, ${JSON.stringify(snapshotData)}, ${totalUsdtValue}, ${timestamp})
            `;
            console.log(`[PanicService] Snapshot saved for user ${userId}`);
        } catch (dbError) {
            console.error('[PanicService] Failed to save snapshot:', dbError);
            // Don't fail the whole operation if DB write fails, but log it
        }

        return {
            success: true,
            totalUsdtValue,
            results: sellResults,
            soldCount: sellResults.filter(r => r.success).length
        };

    } catch (error: any) {
        console.error('[PanicService] Critical error:', error);
        throw error;
    }
}
