import { getKlines } from "./mexc";
import {
  parseKlinesToOHLCV,
  calculateF4Signal,
  calculateWaveTrendSignal,
  calculateSupertrendSignal,
  calculateEmaRibbonSignal,
  calculateIchimokuSignal,
} from "./indicators";

/**
 * MTF Engine v2 — Pine Script F4 V5 formülüne birebir hizalanmış
 */

/**
 * TF Üst Hiyerarkisi:
 * 1m grafikte işlem açıyorsan 15m, 1h, 4h, 1d'ye bakarsın.
 */
const MTF_UPPER_TF_MAP: Record<string, string[]> = {
  "1m":  ["15m", "1h", "4h", "1d"],
  "3m":  ["15m", "1h", "4h", "1d"],
  "5m":  ["15m", "1h", "4h", "1d"],
  "15m": ["1h",  "4h", "1d"],
  "30m": ["1h",  "4h", "1d"],
  "1h":  ["4h",  "1d", "1w"],
  "2h":  ["4h",  "1d", "1w"],
  "4h":  ["1d",  "1w"],
  "6h":  ["1d",  "1w"],
  "8h":  ["1d",  "1w"],
  "12h": ["1d",  "1w"],
  "1d":  ["1w"],
  "1w":  [],
  "1M":  [],
};

// Cache for MTF checks to avoid reaching API limits
const mtfResultsCache = new Map<string, { result: number | null; timestamp: number }>();
const pendingRequests = new Map<string, Promise<number | null>>();
const MTF_CACHE_TTL = 55_000; // 55 saniye (cron periyoduna yakın optimize edildi)

export interface MtfConsensusResult {
  score: number;       // 0-100 arası normalize boğa skoru (geriye dönük uyumluluk)
  mtfScore: number;    // [-100, +100] yeni standart: -100=5/5 SAT, +100=5/5 AL, 0=nötr
  verdictText: string;
  bullCount: number;   // ham boğa skoru (fraksiyonel, tüm TF'lerin ortalaması)
  nearestScore?: number; // [NEW] En yakın üst TF'nin skoru (-100,+100)
}

/**
 * Tek bir zaman diliminde Pine Script'teki ORIJINAL 5 indikatörü hesaplar.
 */
export async function performLiteMtfCheck(
  symbol: string,
  tf: string
): Promise<number | null> {
  const cacheKey = `${symbol}_${tf}`;

  const cached = mtfResultsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MTF_CACHE_TTL) {
    return cached.result;
  }

  const existingPromise = pendingRequests.get(cacheKey);
  if (existingPromise) return existingPromise;

  const fetchPromise = (async () => {
    try {
      const klines = await getKlines(symbol, tf, 200);
      if (!klines || klines.length < 80) return null;

      const bars = parseKlinesToOHLCV(klines);
      const closes = bars.map(b => b.close);

      const f4Signals = calculateF4Signal(bars);
      const f4Bull = f4Signals.length > 0 ? f4Signals[f4Signals.length - 1] : false;

      const wtSignals = calculateWaveTrendSignal(bars, 10, 21);
      const wtBull = wtSignals.length > 0 ? wtSignals[wtSignals.length - 1] : false;

      const stSignals = calculateSupertrendSignal(bars, 10, 3.0);
      const stBull = stSignals.length > 0 ? stSignals[stSignals.length - 1] : false;

      const ribbonSignals = calculateEmaRibbonSignal(closes);
      const ribbonBull = ribbonSignals.length > 0 ? ribbonSignals[ribbonSignals.length - 1] : false;

      const ichiSignals = calculateIchimokuSignal(bars, 9, 26, 52, 26);
      const ichiBull = ichiSignals.length > 0 ? ichiSignals[ichiSignals.length - 1] : false;

      const bullCount =
        (f4Bull ? 1 : 0) +
        (wtBull ? 1 : 0) +
        (stBull ? 1 : 0) +
        (ribbonBull ? 1 : 0) +
        (ichiBull ? 1 : 0);

      const result = bullCount / 5; 
      const mtfScoreSingle = ((bullCount - (5 - bullCount)) / 5) * 100;

      console.log(
        `[MTF-Pine] ${symbol} @ ${tf}: F4=${f4Bull?1:0} WT=${wtBull?1:0} ST=${stBull?1:0} Ribbon=${ribbonBull?1:0} Ichi=${ichiBull?1:0} | ${bullCount}/5 → MTF: ${mtfScoreSingle > 0 ? '+' : ''}${mtfScoreSingle.toFixed(0)}`
      );

      mtfResultsCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (e) {
      console.warn(`[MTF-Pine] Fetch error for ${symbol} @ ${tf}:`, e);
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Birden fazla zaman dilimi için WEIGHTED MTF Consensus hesaplar.
 */
export async function getMtfConsensus(
  symbol: string,
  currentTimeframe: string,
  engineBullCountOnCurrentTf: number
): Promise<MtfConsensusResult> {
  const tfsToScan: string[] = MTF_UPPER_TF_MAP[currentTimeframe] ?? ["15m", "1h", "4h", "1d"];
  
  let currentTfScore = Math.min(Math.max(engineBullCountOnCurrentTf, 0), 5) / 5;
  let upperTfResults: number[] = [];
  let nearestScore = 0;

  try {
    const results = await Promise.all(
      tfsToScan.map((tf) => performLiteMtfCheck(symbol, tf))
    );
    
    upperTfResults = results.filter((r): r is number => r !== null);
    if (upperTfResults.length > 0) {
      nearestScore = Math.round((upperTfResults[0] - 0.5) * 200); // [-100, +100]
    }
  } catch (err) {
    console.error(`[MTF-Engine] Parallel check failed for ${symbol}:`, err);
  }

  // --- WEIGHTED MTF SCORING (V6) ---
  // Nearest Upper TF has 50% weight. Others share the remaining 50%.
  let finalMtfScore = 0;
  if (upperTfResults.length > 0) {
    const nearestWeight = 0.5;
    const othersWeight = 0.5;
    
    const nearestUpper = upperTfResults[0];
    const otherTfs = [currentTfScore, ...upperTfResults.slice(1)];
    const otherAvg = otherTfs.reduce((a, b) => a + b, 0) / Math.max(otherTfs.length, 1);
    
    const weightedBullRatio = (nearestUpper * nearestWeight) + (otherAvg * othersWeight);
    finalMtfScore = Math.round((weightedBullRatio - 0.5) * 200);
  } else {
    finalMtfScore = Math.round((currentTfScore - 0.5) * 200);
  }

  // Backward compatibility average score (0-100)
  const allResults = [currentTfScore, ...upperTfResults];
  const avgBullRatio = allResults.reduce((a, b) => a + b, 0) / allResults.length;
  const score = avgBullRatio * 100;

  let verdictText: string;
  if (finalMtfScore >= 60) verdictText = "GÜÇLÜ BOĞA 🟢";
  else if (finalMtfScore >= 20) verdictText = "BOĞA 🟩";
  else if (finalMtfScore > -20) verdictText = "NÖTR ⬜";
  else if (finalMtfScore > -60) verdictText = "AYI 🟥";
  else verdictText = "GÜÇLÜ AYI 🔴";

  return {
    score,
    mtfScore: finalMtfScore,
    verdictText,
    bullCount: avgBullRatio * 5,
    nearestScore, 
  };
}
