import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth-utils';
import { executePanicSell } from '@/lib/panic-service';
import { TradingMode } from '@/lib/mexc-wrapper';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[EmergencyAPI] Panic Sell triggered for user ${user.id}`);
        
        // Retrieve trading mode from cookies for consistency with other routes
        const cookieStore = await cookies();
        const mode = (cookieStore.get('TRADING_MODE')?.value as TradingMode) || 'test';

        const result = await executePanicSell(user.id, mode);

        if (!result.success && result.message === 'No assets to sell') {
             return NextResponse.json({ success: true, message: 'No assets to sell.' });
        }

        return NextResponse.json(result);

    } catch (error: unknown) {
        console.error('[EmergencyAPI] Panic Sell Critical Error:', error);
        return NextResponse.json({ error: 'Panic sell failed', detail: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}
