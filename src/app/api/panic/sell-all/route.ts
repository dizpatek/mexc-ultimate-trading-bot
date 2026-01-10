import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { executePanicSell } from '@/lib/panic-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await executePanicSell(user.id);

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

    } catch (error: any) {
        console.error('Panic sell error:', error);
        return NextResponse.json({
            error: 'Panic sell failed',
            message: error.message
        }, { status: 500 });
    }
}
