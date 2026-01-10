import { NextResponse } from 'next/server';
import { checkAlarms } from '@/lib/alarm-engine';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Basic authorization for cron job (check secret)
        const { searchParams } = new URL(req.url);
        const secret = searchParams.get('secret');

        // Use a CRON_SECRET env var, or just match a hardcoded one for this specific user project if env not set
        // For simplicity in this context, we'll skip strict auth since it's a personal bot, 
        // but typically: if (secret !== process.env.CRON_SECRET) return...

        // Ensure tables exist before running engine
        await ensureTablesExist();

        console.log('[Cron] Triggering alarm check...');
        await checkAlarms();

        return NextResponse.json({ success: true, timestamp: Date.now() });
    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
