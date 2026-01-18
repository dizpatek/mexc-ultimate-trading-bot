import { sql } from '@vercel/postgres';

export async function getSetting(key: string): Promise<string | null> {
    try {
        const { rows } = await sql`SELECT value FROM system_settings WHERE key = ${key}`;
        if (rows.length > 0) {
            return rows[0].value;
        }
        return null;
    } catch (error) {
        console.warn(`[Settings] Failed to fetch setting ${key}:`, error);
        return null;
    }
}

export async function setSetting(key: string, value: string) {
    const now = Date.now();
    await sql`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (${key}, ${value}, ${now})
        ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `;
}

export async function getMexcCredentials() {
    // Priority: DB -> Env
    const dbKey = await getSetting('MEXC_API_KEY');
    const dbSecret = await getSetting('MEXC_API_SECRET');

    if (dbKey && dbSecret) {
        return { apiKey: dbKey, apiSecret: dbSecret };
    }

    return {
        apiKey: process.env.MEXC_KEY || '',
        apiSecret: process.env.MEXC_SECRET || ''
    };
}
