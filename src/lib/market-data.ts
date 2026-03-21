import { api } from "@/services/api";
import axios from "axios";

export interface GlobalMarketData {
  btcd: { value: number; change: number; trend: "UP" | "DOWN" };
  ethd: { value: number; change: number; trend: "UP" | "DOWN" };
  usdtd: { value: number; change: number; trend: "UP" | "DOWN" };
  othersd: { value: number; change: number; trend: "UP" | "DOWN" };
  paxg: { price: number; change: number; trend: "UP" | "DOWN" };
  flow: string;
  flowColor: string;
}

let _lastKnownBtcDom = 55.4;
let _lastKnownEthDom = 18.2;
let _lastKnownUsdtDom = 4.2;
let _lastKnownOthersDom = 11.8;
let _lastKnownPaxgPrice = 2035;
let _cacheTimestamp = 0;
let _cachedResult: GlobalMarketData | null = null;
const CACHE_TTL_MS = 60_000;

export async function fetchGlobalMarketData(): Promise<GlobalMarketData> {
  if (_cachedResult && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedResult;
  }

  try {
    const [cgRes, paxgRes] = await Promise.all([
      api.get("/market/global", { timeout: 12000 }),
      axios.get("https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT", { timeout: 5000 }).catch(() => ({ data: { price: _lastKnownPaxgPrice } }))
    ]);

    const data = cgRes.data;
    if (!data?.market_cap_percentage) throw new Error("No dominance data");

    const btcDomVal = data.market_cap_percentage["btc"] ?? _lastKnownBtcDom;
    const ethDomVal = data.market_cap_percentage["eth"] ?? _lastKnownEthDom;
    const usdtDomVal = data.market_cap_percentage["usdt"] ?? _lastKnownUsdtDom;
    
    // Others.D (Others Dominance) computation: total excluding top coins provided by CG global
    const knownTotals = Object.values(data.market_cap_percentage as Record<string, number>).reduce((a, b) => a + b, 0);
    const othersDomVal = Math.max(0, 100 - knownTotals);
    
    const paxgPrice = parseFloat(paxgRes.data.price || _lastKnownPaxgPrice);

    const btcChange = btcDomVal - _lastKnownBtcDom;
    const ethChange = ethDomVal - _lastKnownEthDom;
    const usdtChange = usdtDomVal - _lastKnownUsdtDom;
    const othersChange = othersDomVal - _lastKnownOthersDom;
    const paxgChange = paxgPrice - _lastKnownPaxgPrice;

    _lastKnownBtcDom = btcDomVal;
    _lastKnownEthDom = ethDomVal;
    _lastKnownUsdtDom = usdtDomVal;
    _lastKnownOthersDom = othersDomVal;
    _lastKnownPaxgPrice = paxgPrice;

    const isAltSeason = btcDomVal < 48 && usdtDomVal < 5;
    const isBtcDominant = btcDomVal > 58;
    const flowLabel = isAltSeason ? "ALTCOIN SEZONU 🔥" : isBtcDominant ? "BTC HAKİMİYETİ ⚡" : "ROTASYON 🔄";
    const flowColor = isAltSeason ? "text-emerald-400" : isBtcDominant ? "text-amber-400" : "text-cyan-400";

    _cachedResult = {
      btcd: { value: parseFloat(btcDomVal.toFixed(2)), change: parseFloat(btcChange.toFixed(2)), trend: btcChange >= 0 ? "UP" : "DOWN" },
      ethd: { value: parseFloat(ethDomVal.toFixed(2)), change: parseFloat(ethChange.toFixed(2)), trend: ethChange >= 0 ? "UP" : "DOWN" },
      usdtd: { value: parseFloat(usdtDomVal.toFixed(2)), change: parseFloat(usdtChange.toFixed(2)), trend: usdtChange >= 0 ? "UP" : "DOWN" },
      othersd: { value: parseFloat(othersDomVal.toFixed(2)), change: parseFloat(othersChange.toFixed(2)), trend: othersChange >= 0 ? "UP" : "DOWN" },
      paxg: { price: parseFloat(paxgPrice.toFixed(1)), change: parseFloat(paxgChange.toFixed(2)), trend: paxgChange >= 0 ? "UP" : "DOWN" },
      flow: flowLabel,
      flowColor,
    };
    _cacheTimestamp = Date.now();
    return _cachedResult;
  } catch (error) {
    console.warn("[MarketData] Global fetch failed:", error instanceof Error ? error.message : String(error));
    if (_cachedResult) return _cachedResult;
    return {
      btcd: { value: _lastKnownBtcDom, change: 0, trend: "UP" },
      ethd: { value: _lastKnownEthDom, change: 0, trend: "UP" },
      usdtd: { value: _lastKnownUsdtDom, change: 0, trend: "DOWN" },
      othersd: { value: _lastKnownOthersDom, change: 0, trend: "UP" },
      paxg: { price: _lastKnownPaxgPrice, change: 0, trend: "UP" },
      flow: "LİKİDİTE GÖZLEMİ 🔍",
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
