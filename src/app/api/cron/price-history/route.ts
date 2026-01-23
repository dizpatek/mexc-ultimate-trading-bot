import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getTopAssets, get24hrTicker } from '@/lib/mexc';

export const dynamic = 'force-dynamic';

/**
 * Price History Tracking Cron Job
 * Tracks historical price data for portfolio assets
 * Runs hourly via Vercel Cron
 */

export async function GET(request: Request) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`;

        if (authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Cron] Starting price history tracking...');

        // Get top trading pairs
        const topAssets = await getTopAssets(50); // Top 50 by volume
        const timestamp = Date.now();
        let recordedCount = 0;

        for (const asset of topAssets) {
            try {
                const ticker = asset;
                const symbol = ticker.symbol;
                const currentPrice = parseFloat(ticker.lastPrice);
                const volume24h = parseFloat(ticker.quoteVolume);
                const change24hPercent = parseFloat(ticker.priceChangePercent);

                // Calculate historical prices based on percentage changes
                // This is an approximation until we have real historical data
                const price24hAgo = currentPrice / (1 + (change24hPercent / 100));

                // Insert or update price history
                await sql`
                    INSERT INTO asset_price_history (
                        symbol, 
                        price, 
                        price_24h_ago,
                        change_24h_percent,
                        volume_24h,
                        timestamp
                    )
                    VALUES (
                        ${symbol},
                        ${currentPrice},
                        ${price24hAgo},
                        ${change24hPercent},
                        ${volume24h},
                        ${timestamp}
                    )
                    ON CONFLICT (symbol, timestamp) DO UPDATE SET
                        price = EXCLUDED.price,
                        price_24h_ago = EXCLUDED.price_24h_ago,
                        change_24h_percent = EXCLUDED.change_24h_percent,
                        volume_24h = EXCLUDED.volume_24h
                `;

                recordedCount++;
            } catch (error: any) {
                console.warn(`[Cron] Failed to record price for ${asset.symbol}:`, error.message);
            }
        }

        console.log(`[Cron] Price history tracking completed: ${recordedCount} assets recorded`);

        return NextResponse.json({
            success: true,
            recordedCount,
            timestamp
        });

    } catch (error: any) {
        console.error('[Cron] Error tracking price history:', error);
        return NextResponse.json(
            { error: 'Failed to track price history', details: error.message },
            { status: 500 }
        );
    }
}
