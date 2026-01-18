import { NextResponse } from 'next/server';
import { getMexcCredentials, setSetting } from '@/lib/settings';
import { testConnection } from '@/lib/mexc';
import { ensureTablesExist } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        // Ensure tables exist on first load of settings page
        // (This is a lazy init strategy since we don't have a distinct migrate step in Vercel)
        await ensureTablesExist();

        const { apiKey, apiSecret } = await getMexcCredentials();
        const hasKeys = !!apiKey && !!apiSecret;

        // Test connection
        let health = 'unknown';
        let error = null;
        if (hasKeys) {
            try {
                await testConnection();
                health = 'ok';
            } catch (e: any) {
                health = 'error';
                error = e.message;
            }
        }

        return NextResponse.json({
            hasKeys,
            health,
            error,
            apiKeyMasked: apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 6)}` : null
        });
    } catch (e: any) {
        return NextResponse.json({ error: 'Failed to fetch settings: ' + e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { apiKey, apiSecret } = body;

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Missing keys' }, { status: 400 });
        }

        await ensureTablesExist();

        await setSetting('MEXC_API_KEY', apiKey);
        await setSetting('MEXC_API_SECRET', apiSecret);

        // Test immediately with the new keys (which are now in DB)
        // Wait, getMexcCredentials fetches from DB, so testConnection() which calls getMexcCredentials() will use new keys.
        try {
            await testConnection();
            return NextResponse.json({ success: true, health: 'ok' });
        } catch (e: any) {
            return NextResponse.json({ success: true, health: 'error', warning: 'Keys saved but connection failed: ' + e.message });
        }

    } catch (e: any) {
        console.error('Settings save error:', e);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
