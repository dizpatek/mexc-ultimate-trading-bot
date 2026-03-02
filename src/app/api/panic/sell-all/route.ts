import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth-utils';
import { executePanicSell } from '@/lib/panic-service';
import { type TradingMode } from '@/lib/mexc-wrapper';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const cookieStore = await cookies();
        const mode = cookieStore.get('TRADING_MODE')?.value as TradingMode || 'test';

        const result = await executePanicSell(user.id, mode);

        if (!result.success) {
            return NextResponse.json({
                error: 'No assets to sell',
                message: result.message
            }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: `Sold ${result.soldCount} assets`,
            totalUsdtValue: result.totalUsdtValue,
            results: result.results,
            timestamp: Date.now()
        });

    } catch (error: unknown) {
        console.error('Panic sell error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Panic sell failed',
            message
        }, { status: 500 });
    }
}
