import { NextResponse } from 'next/server';
import { getAccountInfo, getPrice, get24hrTicker, type TradingMode } from '@/lib/mexc-wrapper';
import { getMexcCredentials } from '@/lib/settings';
import { getSessionUser } from '@/lib/auth-utils';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get mode from cookies (Next.js 15+ await cookies())
        const cookieStore = await cookies();
        const mode = cookieStore.get('TRADING_MODE')?.value as TradingMode || 'test';

        if (mode === 'production') {
            const { apiKey, apiSecret } = await getMexcCredentials(user.id, mode);
            if (!apiKey || !apiSecret) {
                return NextResponse.json({ 
                    error: 'Production mode requires API keys. Please configure them in Settings.' 
                }, { status: 400 });
            }
        }

        console.log(`[PortfolioHoldings] Fetching for user ${user.id} in ${mode} mode`);

        const accountInfo = await getAccountInfo(user.id, mode);
        const activeBalances = (accountInfo.balances || []).filter(
            (b: { free: string; locked: string }) => parseFloat(b.free) + parseFloat(b.locked) > 0
        );

        let totalValue = 0;
        const holdingsData = await Promise.all(activeBalances.map(async (balance: { asset: string; free: string; locked: string }) => {
            const free = parseFloat(balance.free);
            const locked = parseFloat(balance.locked);
            const totalQty = free + locked;
            const symbol = balance.asset;
            const pair = `${symbol}USDT`;

            let currentPrice = 0;
            let change24h = 0;

            if (symbol === 'USDT' || symbol === 'USDC') {
                currentPrice = 1;
                change24h = 0;
            } else {
                try {
                    currentPrice = await getPrice(pair);
                    const ticker = await get24hrTicker(pair);
                    if (ticker && ticker.openPrice && parseFloat(ticker.openPrice) > 0) {
                        const open = parseFloat(ticker.openPrice);
                        const last = parseFloat(ticker.lastPrice);
                        // Manual calculation to ensure consistency (Percent = (Last/Open - 1) * 100)
                        change24h = ((last / open) - 1) * 100;
                    }
                } catch {
                    // console.warn(`Price fetch failed for ${pair}`, e);
                }
            }

            const value = totalQty * currentPrice;
            totalValue += value;

            return {
                id: symbol,
                symbol,
                name: symbol, // Could fetch from a mapping if needed
                holding: totalQty,
                price: currentPrice,
                value,
                change24h,
                allocation: 0 // Will calculate after loop
            };
        }));

        // Calculate allocation
        const finalHoldings = holdingsData.map(h => ({
            ...h,
            allocation: totalValue > 0 ? (h.value / totalValue) * 100 : 0
        }));

        // Sort by value DESC
        finalHoldings.sort((a, b) => b.value - a.value);

        return NextResponse.json(finalHoldings);
    } catch (error) {
        const err = error as Error;
        console.error('Error fetching holdings [500]:', err);
        return NextResponse.json({ 
            error: 'Failed to fetch holdings', 
            details: err.message,
            stack: err.stack 
        }, { status: 500 });
    }
}
