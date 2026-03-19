// Global market data utility
import axios from "axios";

export interface GlobalMarketData {
  btcd: { value: number; change: number; trend: "UP" | "DOWN" };
  usdtd: { value: number; change: number; trend: "UP" | "DOWN" };
  othersd: { value: number; change: number; trend: "UP" | "DOWN" };
  flow: string;
  flowColor: string;
}

/**
 * Fetches real global market data.
 * Since we don't have direct access to TradingView's proprietary indexes easily,
 * we approximate or use alternative sources if available.
 * For now, we will use a fallback or mock with real-looking logic until a reliable provider is integrated.
 */
let _lastKnownBtcDom = 55.4;
let _lastKnownUsdtDom = 4.2;
let _lastKnownOthersDom = 11.8;
let _cacheTimestamp = 0;
let _cachedResult: GlobalMarketData | null = null;
const CACHE_TTL_MS = 60_000; // 60-second cache to avoid blocking on every poll

export async function fetchGlobalMarketData(): Promise<GlobalMarketData> {
  // Return cached result within TTL
  if (_cachedResult && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedResult;
  }

  try {
    // Use our internal proxy to avoid CORS and client-side rate limits
    const res = await axios.get("/api/market/global", { timeout: 5000 });
    const data = res.data;
    if (!data?.market_cap_percentage) throw new Error("No dominance data");

    const btcDomVal = data.market_cap_percentage["btc"] ?? _lastKnownBtcDom;
    const usdtDomVal = data.market_cap_percentage["usdt"] ?? _lastKnownUsdtDom;
    // Compute others dominance: sum all non-BTC/USDT entries from the response
    const knownDomSum = Object.entries(data.market_cap_percentage as Record<string, number>)
      .filter(([k]) => k !== "btc" && k !== "usdt")
      .reduce((acc, [, v]) => acc + v, 0);
    const othersDomVal = Math.max(0, Math.min(100 - btcDomVal - usdtDomVal, knownDomSum));

    const btcChange = btcDomVal - _lastKnownBtcDom;
    const usdtChange = usdtDomVal - _lastKnownUsdtDom;
    const othersChange = othersDomVal - _lastKnownOthersDom;

    _lastKnownBtcDom = btcDomVal;
    _lastKnownUsdtDom = usdtDomVal;
    _lastKnownOthersDom = othersDomVal;

    const isAltSeason = btcDomVal < 48 && usdtDomVal < 5;
    const isBtcDominant = btcDomVal > 58;
    const flowLabel = isAltSeason ? "ALTCOIN SEZONU 🔥" : isBtcDominant ? "BTC HAKİMİYETİ ⚡" : "ROTASYON 🔄";
    const flowColor = isAltSeason ? "text-emerald-400" : isBtcDominant ? "text-amber-400" : "text-cyan-400";

    _cachedResult = {
      btcd: { value: parseFloat(btcDomVal.toFixed(2)), change: parseFloat(btcChange.toFixed(2)), trend: btcChange >= 0 ? "UP" : "DOWN" },
      usdtd: { value: parseFloat(usdtDomVal.toFixed(2)), change: parseFloat(usdtChange.toFixed(2)), trend: usdtChange >= 0 ? "UP" : "DOWN" },
      othersd: { value: parseFloat(othersDomVal.toFixed(2)), change: parseFloat(othersChange.toFixed(2)), trend: othersChange >= 0 ? "UP" : "DOWN" },
      flow: flowLabel,
      flowColor,
    };
    _cacheTimestamp = Date.now();
    return _cachedResult;
  } catch (error) {
    console.warn("[MarketData] CoinGecko fetch failed, using last known values:", error instanceof Error ? error.message : String(error));
    // Return cached result only if it's reasonably fresh (within 5x TTL = 5 min)
    const cacheAge = Date.now() - _cacheTimestamp;
    if (_cachedResult && cacheAge < CACHE_TTL_MS * 5) {
      return _cachedResult;
    }
    return {
      btcd: { value: _lastKnownBtcDom, change: 0, trend: "UP" as const },
      usdtd: { value: _lastKnownUsdtDom, change: 0, trend: "DOWN" as const },
      othersd: { value: _lastKnownOthersDom, change: 0, trend: "UP" as const },
      flow: "VERİ YOK ⚠️",
      flowColor: "text-slate-400",
    };
  }
}

/**
 * Fetches the latest funding rate for a given symbol from Binance Futures public API.
 */
export async function fetchFundingRate(symbol: string): Promise<number | null> {
  try {
    const formattedSymbol = symbol.replace("/", "").toUpperCase();
    const response = await axios.get(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${formattedSymbol}`, { timeout: 3000 });
    if (response.data && response.data.lastFundingRate) {
      return parseFloat(response.data.lastFundingRate);
    }
    return null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      // Quietly return null for symbols not on Binance Futures (like WBT, etc.)
      return null;
    }
    console.warn(`[FundingRate] Failed to fetch for ${symbol}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}
