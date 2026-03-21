/**
 * Utility for sanitizing trading symbols and asset names.
 * Ensures symbols like "BTC/USDT", "BTCUSDT", "BTC/USDTUSDT" are all normalized.
 */

const REBRANDED_SYMBOLS: Record<string, string> = {
  MATIC: "POL",
  RNDR: "RENDER",
  GAL: "G",
};

const QUOTE_ASSETS = ["USDT", "USDC"];

/**
 * Normalizes a symbol to "BTCUSDT" format (no slashes, single USDT suffix).
 */
export function normalizeSymbol(symbol: string): string {
  if (!symbol) return "";

  // 1. Clean
  let clean = cleanSlashesAndSpaces(symbol);
  clean = deduplicateSuffixes(clean);

  if (QUOTE_ASSETS.includes(clean)) return clean;

  // 2. Deconstruct
  const parts = getSymbolParts(clean);
  let base = parts.base;
  const quote = parts.quote;

  // 3. Transform (Rebrand)
  base = applyRebrandingToBase(base);

  // 4. Reconstruct
  return `${base}${quote}`;
}

function cleanSlashesAndSpaces(s: string): string {
  return s.replace(/[\/\s-]/g, "").toUpperCase();
}

function deduplicateSuffixes(s: string): string {
  let result = s;
  for (const q of QUOTE_ASSETS) {
    const double = `${q}${q}`;
    while (result.endsWith(double)) result = result.slice(0, -q.length);
  }
  return result;
}

function getSymbolParts(s: string): { base: string; quote: string } {
  for (const q of QUOTE_ASSETS) {
    if (s.endsWith(q)) {
      return { base: s.slice(0, -q.length), quote: q };
    }
  }
  return { base: s, quote: "USDT" }; // Default to USDT
}

function applyRebrandingToBase(base: string): string {
  return REBRANDED_SYMBOLS[base] || base;
}

/**
 * Extracts the base asset from a symbol (e.g., "BTCUSDT" -> "BTC").
 */
export function extractBaseAsset(symbol: string): string {
  if (!symbol) return "";
  const clean = cleanSlashesAndSpaces(symbol);

  // Remove USDT or USDC from the end
  if (clean.endsWith("USDT")) return clean.slice(0, -4);
  if (clean.endsWith("USDC")) return clean.slice(0, -4);

  return clean;
}

/**
 * Ensures a symbol has a slash (e.g., "BTC/USDT").
 */
export function formatWithSlash(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  if (normalized.endsWith("USDT")) return normalized.slice(0, -4) + "/USDT";
  if (normalized.endsWith("USDC")) return normalized.slice(0, -4) + "/USDC";
  return normalized;
}
