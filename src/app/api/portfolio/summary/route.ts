import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice, get24hrTicker, type TradingMode } from '@/lib/mexc-wrapper';
import { getSessionUser } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Force reading from cookie
        const cookieStore = cookies();
        const mode = (await cookieStore).get('TRADING_MODE')?.value as TradingMode || 'test';

        const accountInfo = await getAccountInfo(mode);
        const activeBalances = accountInfo.balances.filter(
            b => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        let totalValueCurrent = 0;
        let assetsCount = 0;

        const assetResults = await Promise.all(activeBalances.map(async (balance) => {
            const sym = balance.asset;
            const totalQty = parseFloat(balance.free) + parseFloat(balance.locked);
            let price = 0;
            if (sym === 'USDT' || sym === 'USDC') price = 1;
            else {
                try { price = await getPrice(`${sym}USDT`); } catch (e) { }
            }
            return totalQty * price;
        }));

        totalValueCurrent = assetResults.reduce((a, b) => a + b, 0);
        assetsCount = activeBalances.length;

        return NextResponse.json({
            totalValue: totalValueCurrent,
            change24h: 0, // Simplified for stability
            changePercentage: 0,
            assets: assetsCount,
            mode: mode
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
