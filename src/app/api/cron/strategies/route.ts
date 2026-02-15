import { NextResponse } from 'next/server';
import { runActiveStrategies } from '@/lib/strategy-engine';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Basic authorization check (can be enhanced with CRON_SECRET)
        // const { searchParams } = new URL(req.url);
        // const secret = searchParams.get('secret');
        // if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        console.log('[Cron] Triggering strategy execution...');
        
        // Run asynchronously to not timeout
        await runActiveStrategies();

        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (error: any) {
        console.error('Strategy cron job failed:', error);
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
    }
}
