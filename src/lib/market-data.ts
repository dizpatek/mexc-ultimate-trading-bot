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
export async function fetchGlobalMarketData(): Promise<GlobalMarketData> {
  try {
    // In a real scenario, we'd fetch these from an aggregator or TradingView API
    // For this implementation, we will simulate the fetch to OTHERS.D/BTC.D etc.
    // using real relative data if possible, or consistent high-quality approximations.

    // Mocking for now to match the Pine Script V3 logic structure
    return {
      btcd: { value: 55.4, change: 0.2, trend: "UP" },
      usdtd: { value: 4.2, change: -0.5, trend: "DOWN" },
      othersd: { value: 11.8, change: 1.5, trend: "UP" },
      flow: "ALTCOIN SEZONU 🔥",
      flowColor: "text-emerald-400",
    };
  } catch (error) {
    console.error("Error fetching global market data:", error);
    throw error;
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
    console.warn(`[FundingRate] Failed to fetch for ${symbol}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}
