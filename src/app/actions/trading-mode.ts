'use server';

import { setSetting } from '@/lib/settings';
import { type TradingMode } from '@/lib/mexc-wrapper';

export async function updateTradingMode(mode: TradingMode, userId: number) {
    try {
        await setSetting('TRADING_MODE', mode, userId);
        return { success: true };
    } catch (error: unknown) {
        console.error('Failed to update trading mode:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}
