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
 *
 * Orijinal Pine Script (satır 1764–1780) şu 5 bileşeni kullanır:
 *   techF4Dir    — F4 > F4[1] ise boğa (10 puan)
 *   techWTScore  — wt1 > wt2 AND wt1 < 60 ise boğa (10 puan)
 *   trendST      — Supertrend boğa ise 10 puan
 *   trendRibbon  — EMA8 > EMA21 > EMA55 ise 10 puan
 *   trendIchimoku— fiyat kumo üstünde ise 10 puan
 *
 * Bu motordaki hesaplama EXACTELY bu 5 boolean ile yapılır.
 * Sonuç: 0-5 tamsayı veya 0.0-1.0 normalize skor.
 */

// Cache for MTF checks to avoid reaching API limits
const mtfResultsCache = new Map<string, { result: number | null; timestamp: number }>();
const pendingRequests = new Map<string, Promise<number | null>>();
const MTF_CACHE_TTL = 30_000; // 30 saniye

export interface MtfConsensusResult {
  score: number;       // 0-100 arası normalize boğa skoru
  verdictText: string;
  bullCount: number;   // ham boğa skoru (fraksiyonel, tüm TF'lerin ortalaması)
}

/**
 * Tek bir zaman diliminde Pine Script'teki ORIJINAL 5 indikatörü hesaplar.
 * Dönen değer: 0.0 (tam ayı) – 1.0 (tam boğa)
 *
 * Pine Script karşılığı:
 *   techScore = techF4Dir + techWTScore + techSMCScore + techTrendScore
 *   (SMC ve diğerleri TF bazlı hesaplanamayacağı için sadece 5 indikatör)
 */
export async function performLiteMtfCheck(
  symbol: string,
  tf: string
): Promise<number | null> {
  const cacheKey = `${symbol}_${tf}`;

  // 1. Memory Cache
  const cached = mtfResultsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MTF_CACHE_TTL) {
    return cached.result;
  }

  // 2. Deduplication — aynı istek zaten bekletiliyorsa
  const existingPromise = pendingRequests.get(cacheKey);
  if (existingPromise) return existingPromise;

  const fetchPromise = (async () => {
    try {
      // 200 bar: F4 (14 * 6 derin EMA zinciri), Ichimoku (52+26 bar) için yeterli
      const klines = await getKlines(symbol, tf, 200);
      if (!klines || klines.length < 80) return null;

      const bars = parseKlinesToOHLCV(klines);
      const closes = bars.map(b => b.close);

      // ── 5 Pine Script Bileşeni ────────────────────────────────────────────
      // 1. F4 yönü: F4 > F4[1] → boğa (Pine Script satır 1764)
      const f4Signals = calculateF4Signal(bars);
      const f4Bull = f4Signals.length > 0 ? f4Signals[f4Signals.length - 1] : false;

      // 2. WaveTrend: wt1 > wt2 AND wt1 < 60 → boğa (Pine Script satır 1765)
      const wtSignals = calculateWaveTrendSignal(bars, 10, 21);
      const wtBull = wtSignals.length > 0 ? wtSignals[wtSignals.length - 1] : false;

      // 3. Supertrend: fiyat yukarıda → boğa (Pine Script satır 1779)
      const stSignals = calculateSupertrendSignal(bars, 10, 3.0);
      const stBull = stSignals.length > 0 ? stSignals[stSignals.length - 1] : false;

      // 4. EMA Ribbon: EMA8 > EMA21 > EMA55 → boğa (Pine Script satır 1777)
      const ribbonSignals = calculateEmaRibbonSignal(closes);
      const ribbonBull = ribbonSignals.length > 0 ? ribbonSignals[ribbonSignals.length - 1] : false;

      // 5. Ichimoku: fiyat kumo üstünde → boğa (Pine Script satır 1778)
      const ichiSignals = calculateIchimokuSignal(bars, 9, 26, 52, 26);
      const ichiBull = ichiSignals.length > 0 ? ichiSignals[ichiSignals.length - 1] : false;

      // ── Normalize skor: her bileşen 0 veya 1, toplam / 5 ─────────────────
      const bullCount =
        (f4Bull ? 1 : 0) +
        (wtBull ? 1 : 0) +
        (stBull ? 1 : 0) +
        (ribbonBull ? 1 : 0) +
        (ichiBull ? 1 : 0);

      const result = bullCount / 5; // 0.0 – 1.0

      console.log(
        `[MTF-Pine] ${symbol} @ ${tf}: F4=${f4Bull?1:0} WT=${wtBull?1:0} ST=${stBull?1:0} Ribbon=${ribbonBull?1:0} Ichi=${ichiBull?1:0} → ${bullCount}/5 (${(result*100).toFixed(0)}%)`
      );

      mtfResultsCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (e) {
      console.warn(`[MTF-Pine] Fetch/calc error for ${symbol} @ ${tf}:`, e);
      return null;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Birden fazla zaman dilimi için MTF Consensus hesaplar.
 *
 * @param symbol         - İşlem çifti (örn. "TAOUSDT")
 * @param currentTimeframe - Mevcut grafik zaman dilimi (örn. "1m")
 * @param engineBullCountOnCurrentTf - Mevcut TF'deki 0-5 arası boğa sayısı (matrix-v5-engine'den)
 */
export async function getMtfConsensus(
  symbol: string,
  currentTimeframe: string,
  engineBullCountOnCurrentTf: number
): Promise<MtfConsensusResult> {
  // Üst zaman dilimleri: Pine Script genellikle 15m, 1h, 4h, 1d kullanır
  const tfsToScan: string[] = ["15m", "1h", "4h", "1d"];
  const tfsToFetch = tfsToScan.filter((tf) => tf !== currentTimeframe);

  // Mevcut TF'yi 5 bileşenlik sisteme normalize et (0-5 → 0.0-1.0)
  let mtfBullScore = Math.min(Math.max(engineBullCountOnCurrentTf, 0), 5) / 5;
  let mtfTotal = 1;

  try {
    const results = await Promise.all(
      tfsToFetch.map((tf) => performLiteMtfCheck(symbol, tf))
    );

    for (const res of results) {
      if (res !== null) {
        mtfBullScore += res;
        mtfTotal++;
      }
    }
  } catch (err) {
    console.error(`[MTF-Engine] Parallel check failed for ${symbol}:`, err);
  }

  const score = mtfTotal > 0 ? (mtfBullScore / mtfTotal) * 100 : 50;

  // Metin: Pine Script techTrendScore mantığına paralel
  let verdictText: string;
  if (score >= 80) verdictText = "GÜÇLÜ BOĞA 🟢";
  else if (score >= 60) verdictText = "BOĞA 🟩";
  else if (score >= 40) verdictText = "NÖTR ⬜";
  else if (score >= 20) verdictText = "AYI 🟥";
  else verdictText = "GÜÇLÜ AYI 🔴";

  return {
    score,
    verdictText,
    bullCount: mtfBullScore,
  };
}
