/**
 * Utility for sanitizing trading symbols and asset names.
 * Ensures symbols like "BTC/USDT", "BTCUSDT", "BTC/USDTUSDT" are all normalized.
 */

/**
 * Normalizes a symbol to "BTCUSDT" format (no slashes, single USDT suffix).
 */
export function normalizeSymbol(symbol: string): string {
    if (!symbol) return '';
    
    // 1. Remove slashes and spaces
    let clean = symbol.replace(/[\/\s]/g, '').toUpperCase();
    
    // 2. Remove multiple "USDT" or "USDC" at the end
    while (clean.endsWith('USDTUSDT')) {
        clean = clean.slice(0, -4);
    }
    while (clean.endsWith('USDCUSDC')) {
        clean = clean.slice(0, -4);
    }
    
    // 3. Special case: if it's just "USDT" or "USDC", don't add anything
    if (clean === 'USDT' || clean === 'USDC') return clean;
    
    // 4. Ensure it ends with USDT if it's a pair request (most common use case here)
    if (!clean.endsWith('USDT') && !clean.endsWith('USDC')) {
        clean = clean + 'USDT';
    }
    
    return clean;
}

/**
 * Extracts the base asset from a symbol (e.g., "BTCUSDT" -> "BTC").
 */
export function extractBaseAsset(symbol: string): string {
    if (!symbol) return '';
    const clean = symbol.replace(/[\/\s]/g, '').toUpperCase();
    
    // Remove USDT or USDC from the end
    if (clean.endsWith('USDT')) return clean.slice(0, -4);
    if (clean.endsWith('USDC')) return clean.slice(0, -4);
    
    return clean;
}

/**
 * Ensures a symbol has a slash (e.g., "BTC/USDT").
 */
export function formatWithSlash(symbol: string): string {
    const normalized = normalizeSymbol(symbol);
    if (normalized.endsWith('USDT')) return normalized.slice(0, -4) + '/USDT';
    if (normalized.endsWith('USDC')) return normalized.slice(0, -4) + '/USDC';
    return normalized;
}
