import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { getHoldings, type HoldingItem } from '@/lib/mexc-wrapper';
import { handleSellSignal } from '@/lib/trade';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('EMERGENCY: Panic Sell triggered by user');
        
        // 1. Get all holdings
        const holdings = await getHoldings();
        const assetsToSell = holdings.filter((h: HoldingItem) => 
            h.symbol !== 'USDT' && 
            h.symbol !== 'USDC' && 
            h.holding > 0
        );

        if (assetsToSell.length === 0) {
            return NextResponse.json({ success: true, message: 'No assets to sell.' });
        }

        // 2. Execute market sell for each asset
        const results = await Promise.all(assetsToSell.map(async (asset: HoldingItem) => {
            try {
                const pair = `${asset.symbol}USDT`;
                const res = await handleSellSignal({
                    pair,
                    percent: 100 // Sell everything
                });
                return { symbol: asset.symbol, success: res.ok !== false, message: res.message || 'Sold' };
            } catch (err: any) {
                return { symbol: asset.symbol, success: false, error: err.message };
            }
        }));

        return NextResponse.json({ 
            success: true, 
            message: `Panic sell completed for ${assetsToSell.length} assets`,
            results 
        });

    } catch (error: any) {
        console.error('Panic Sell Error:', error);
        return NextResponse.json({ error: 'Panic sell failed' }, { status: 500 });
    }
}
