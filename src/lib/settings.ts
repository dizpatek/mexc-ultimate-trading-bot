import { sql } from '@/lib/postgres';

export async function getSetting(key: string, userId: number): Promise<string | null> {
    try {
        const { rows } = await sql`SELECT value FROM system_settings WHERE key = ${key} AND user_id = ${userId}`;
        if (rows.length > 0) {
            return rows[0].value;
        }
        return null;
    } catch (error) {
        console.warn(`[Settings] Failed to fetch setting ${key} for user ${userId}:`, error);
        return null;
    }
}

export async function setSetting(key: string, value: string, userId: number) {
    const now = Date.now();
    await sql`
        INSERT INTO system_settings (user_id, key, value, updated_at)
        VALUES (${userId}, ${key}, ${value}, ${now})
        ON CONFLICT (user_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `;
}

import { type TradingMode } from './mexc-wrapper';

export async function getMexcCredentials(userId: number, forcedMode?: TradingMode) {
    // Check mode first. If simulation, return empty keys to force simulator usage.
    const mode = forcedMode || await getSetting('TRADING_MODE', userId) || 'test';
    if (mode === 'test') {
        return { apiKey: '', apiSecret: '' };
    }

    // Priority: DB -> Env (Only for Admin UID 1)
    const dbKey = await getSetting('MEXC_API_KEY', userId);
    const dbSecret = await getSetting('MEXC_API_SECRET', userId);

    if (dbKey && dbSecret) {
        return { apiKey: dbKey, apiSecret: dbSecret };
    }

    // Only allow Admin (UID 1) to use environment variables as fallback
    if (userId === 1) {
        return {
            apiKey: process.env.MEXC_KEY || '',
            apiSecret: process.env.MEXC_SECRET || ''
        };
    }

    return { apiKey: '', apiSecret: '' };
}
