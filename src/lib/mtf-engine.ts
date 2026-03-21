import { getKlines } from "./mexc";
import { getLatestIndicators } from "./indicators";

// Cache for MTF checks to avoid reaching API limits
const mtfResultsCache = new Map<string, { result: number | null; timestamp: number }>();
const pendingRequests = new Map<string, Promise<number | null>>();
const MTF_CACHE_TTL = 30000; // 30 seconds

export interface MtfConsensusResult {
  score: number;
  verdictText: string;
  bullCount: number;
}

/**
 * P4.2: Separating lite trend detection logic for better quality.
 * Optimized with request deduplication to prevent rate-limit flooding.
 */
export async function performLiteMtfCheck(symbol: string, tf: string): Promise<number | null> {
  const cacheKey = `${symbol}_${tf}`;
  
  // 1. Check Memory Cache
  const cached = mtfResultsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MTF_CACHE_TTL) {
    return cached.result;
  }

  // 2. Check for Pending Request (Deduplication)
  const existingPromise = pendingRequests.get(cacheKey);
  if (existingPromise) return existingPromise;

  // 3. Perform Fetch with Lock
  const fetchPromise = (async () => {
    try {
      const klines = await getKlines(symbol, tf, 100);
      if (klines && klines.length >= 80) {
        // Handle both Array of Arrays (MEXC raw) and Array of Objects
        const closes = klines.map((k: any) => {
          if (Array.isArray(k)) return parseFloat(String(k[4]));
          if (k.close) return parseFloat(String(k.close));
          return 0;
        });

        const inds = getLatestIndicators(closes);
        
        let bullWeight = 0;
        let totalChecks = 0;

        // 1. Price Context (EMA/SMA)
        if (inds.sma20 && inds.sma50) {
          totalChecks++;
          if (closes[closes.length - 1] > inds.sma20) bullWeight++;
          totalChecks++;
          if (inds.sma20 > inds.sma50) bullWeight++;
        }

        // 2. Momentum (RSI)
        if (inds.rsi !== null) {
          totalChecks++;
          if (inds.rsi > 50) bullWeight++;
        }

        // 3. Trend Intensity (MACD)
        if (inds.macd.histogram !== null && inds.macd.macdLine !== null) {
          totalChecks++;
          if (inds.macd.histogram > 0) bullWeight++;
          totalChecks++;
          if (inds.macd.macdLine > 0) bullWeight++;
        }
        
        let result = totalChecks > 0 ? bullWeight / totalChecks : 0.5;
        
        mtfResultsCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    } catch (e) {
      console.warn(`[MTF-Lite] Fetch error for ${symbol} on ${tf}:`, e);
    } finally {
      pendingRequests.delete(cacheKey);
    }
    return null;
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Calculates MTF Consensus score by scanning multiple timeframes.
 */
export async function getMtfConsensus(
  symbol: string, 
  currentTimeframe: string, 
  engineBullCountOnCurrentTf: number
): Promise<MtfConsensusResult> {
  const tfsToScan: string[] = ["15m", "1h", "4h", "1d"];
  const tfsToFetch = tfsToScan.filter((tf) => tf !== currentTimeframe);

  // Granular scoring: Convert 0-5 bull count to a base score (e.g. 1/5 = 0.2)
  let mtfBullScore = engineBullCountOnCurrentTf / 5;
  let mtfTotal = 1;

  try {
    const mtfResults = await Promise.all(
      tfsToFetch.map(async (tf) => {
        return await performLiteMtfCheck(symbol, tf);
      })
    );

    for (const res of mtfResults) {
      if (res !== null) {
        mtfBullScore += res;
        mtfTotal++;
      }
    }
  } catch (err) {
    console.error(`[MTF-Engine] Parallel check failed for ${symbol}:`, err);
  }

  const score = mtfTotal > 0 ? (mtfBullScore / mtfTotal) * 100 : 50;
  const verdictText = `${mtfBullScore.toFixed(1)}/${mtfTotal} TF Sinyal`;
  
  return { 
    score, 
    verdictText,
    bullCount: mtfBullScore
  };
}
