export type TradingMode = 'test' | 'production';

export function getTradingMode(): TradingMode {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('TRADING_MODE');
        if (stored === 'production' || stored === 'test') return stored as TradingMode;
    }
    return (process.env.TRADING_MODE as TradingMode) || (process.env.NEXT_PUBLIC_TRADING_MODE as TradingMode) || 'test';
}

export function getTradingModeSync(): TradingMode {
    return getTradingMode();
}

export function setTradingModeClient(mode: TradingMode) {
    if (typeof window !== 'undefined') {
        localStorage.setItem('TRADING_MODE', mode);
        // Sync to cookie for server-side awareness
        document.cookie = `TRADING_MODE=${mode}; path=/; max-age=31536000; SameSite=Lax`;
        window.dispatchEvent(new Event('tradingModeChanged'));
    }
}
