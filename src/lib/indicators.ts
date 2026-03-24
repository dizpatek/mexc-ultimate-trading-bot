// Technical Indicators Implementation

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for SMA
 * @returns {number[]} Array of SMA values
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];

  const sma: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  return sma;
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for EMA
 * @returns {number[]} Array of EMA values
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];

  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(firstSMA);

  // Calculate subsequent EMAs
  for (let i = period; i < prices.length; i++) {
    const currentEMA =
      (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEMA);
  }

  return ema;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param {number[]} prices - Array of prices
 * @param {number} period - Period for RSI (typically 14)
 * @returns {number[]} Array of RSI values
 */
export function calculateRSI(prices: number[], period: number = 14): number[] {
  if (prices.length < period + 1) return [];

  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  const rsi: number[] = [];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < gains.length; i++) {
    if (i > period) {
      // Smoothed averages
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgGain / avgLoss;
    const rsiValue = 100 - 100 / (1 + rs);
    rsi.push(rsiValue);
  }

  return rsi;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices - Array of prices
 * @param {number} fastPeriod - Fast EMA period (default 12)
 * @param {number} slowPeriod - Slow EMA period (default 26)
 * @param {number} signalPeriod - Signal line EMA period (default 9)
 * @returns {object} Object with macdLine, signalLine, and histogram
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9,
) {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  if (fastEMA.length < slowEMA.length)
    return { macdLine: [], signalLine: [], histogram: [] };

  // MACD Line = Fast EMA - Slow EMA
  const macdLine: number[] = [];
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + (fastEMA.length - slowEMA.length)] - slowEMA[i]);
  }

  // Signal Line = EMA of MACD Line
  const signalLine = calculateEMA(macdLine, signalPeriod);

  // Histogram = MACD Line - Signal Line
  const histogram: number[] = [];
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(
      macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i],
    );
  }

  return {
    macdLine: macdLine.slice(-histogram.length),
    signalLine,
    histogram,
  };
}

/**
 * Get latest indicator values
 * @param {number[]} prices - Array of prices
 * @returns {object} Latest values of all indicators
 */
export function getLatestIndicators(prices: number[]) {
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const rsi = calculateRSI(prices, 14);
  const macd = calculateMACD(prices);

  return {
    sma20: sma20.length > 0 ? sma20[sma20.length - 1] : null,
    sma50: sma50.length > 0 ? sma50[sma50.length - 1] : null,
    ema12: ema12.length > 0 ? ema12[ema12.length - 1] : null,
    ema26: ema26.length > 0 ? ema26[ema26.length - 1] : null,
    rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
    macd: {
      macdLine:
        macd.macdLine.length > 0
          ? macd.macdLine[macd.macdLine.length - 1]
          : null,
      signalLine:
        macd.signalLine.length > 0
          ? macd.signalLine[macd.signalLine.length - 1]
          : null,
      histogram:
        macd.histogram.length > 0
          ? macd.histogram[macd.histogram.length - 1]
          : null,
    },
  };
}

/**
 * OHLCV veri tipi — klines verisi için
 */
export interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * MEXC kline dizisini OHLCV objesine dönüştür
 * Format: [timestamp, open, high, low, close, volume]
 */
export function parseKlinesToOHLCV(klines: any[]): OHLCVBar[] {
  return klines.map((k) => {
    if (Array.isArray(k)) {
      return {
        open:   parseFloat(String(k[1])),
        high:   parseFloat(String(k[2])),
        low:    parseFloat(String(k[3])),
        close:  parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
      };
    }
    return {
      open:   parseFloat(String(k.open   ?? 0)),
      high:   parseFloat(String(k.high   ?? k.close ?? 0)),
      low:    parseFloat(String(k.low    ?? k.close ?? 0)),
      close:  parseFloat(String(k.close  ?? 0)),
      volume: parseFloat(String(k.volume ?? 0)),
    };
  });
}

// ─── Ortak EMA yardımcı ─────────────────────────────────────────────────────
function _ema(src: number[], len: number): number[] {
  if (src.length < len) return [];
  const mult = 2 / (len + 1);
  const out: number[] = [];
  let prev = src.slice(0, len).reduce((a, b) => a + b, 0) / len;
  out.push(prev);
  for (let i = len; i < src.length; i++) {
    prev = (src[i] - prev) * mult + prev;
    out.push(prev);
  }
  return out;
}

/**
 * Pine Script F4 (Tillson T3) — orijinal formül
 * e1..e6 = Nested EMA zinciri, giriş = (H+L+2*C)/4
 * F4 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 * Boğa = F4 > F4[1] (pozitif eğim)
 * Pine Script: satır 1501–1514
 */
export function calculateF4Signal(
  bars: OHLCVBar[],
  length: number = 14,
  alpha: number = 0.7
): boolean[] {
  const src = bars.map(b => (b.high + b.low + 2 * b.close) / 4);

  const c1 =  -(alpha ** 3);
  const c2 =  3 * (alpha ** 2) + 3 * (alpha ** 3);
  const c3 = -6 * (alpha ** 2) - 3 * alpha - 3 * (alpha ** 3);
  const c4 =  1 + 3 * alpha + (alpha ** 3) + 3 * (alpha ** 2);

  const e1 = _ema(src, length);
  const e2 = _ema(e1,  length);
  const e3 = _ema(e2,  length);
  const e4 = _ema(e3,  length);
  const e5 = _ema(e4,  length);
  const e6 = _ema(e5,  length);

  const minLen = Math.min(e3.length, e4.length, e5.length, e6.length);
  const f4: number[] = [];
  for (let i = 0; i < minLen; i++) {
    f4.push(
      c1 * e6[e6.length - minLen + i] +
      c2 * e5[e5.length - minLen + i] +
      c3 * e4[e4.length - minLen + i] +
      c4 * e3[e3.length - minLen + i]
    );
  }

  const signals: boolean[] = [];
  for (let i = 1; i < f4.length; i++) signals.push(f4[i] > f4[i - 1]);
  return signals;
}

/**
 * Pine Script WaveTrend — orijinal formül
 * ap=(H+L+C)/3, esa=EMA(ap,n1), d=EMA(|ap-esa|,n1)
 * ci=(ap-esa)/(0.015*d), wt1=EMA(ci,n2), wt2=SMA(wt1,4)
 * Boğa = wt1 > wt2 AND wt1 < 60
 * Pine Script: satır 1517–1524
 */
export function calculateWaveTrendSignal(
  bars: OHLCVBar[],
  n1: number = 10,
  n2: number = 21
): boolean[] {
  const ap = bars.map(b => (b.high + b.low + b.close) / 3);
  const esa = _ema(ap, n1);

  const apTrimmed = ap.slice(ap.length - esa.length);
  const dInput    = apTrimmed.map((v, i) => Math.abs(v - esa[i]));
  const d         = _ema(dInput, n1);

  const minLen = Math.min(apTrimmed.length, d.length);
  const ci = apTrimmed.slice(apTrimmed.length - minLen).map((v, i) => {
    const esaV = esa[esa.length - minLen + i];
    const dV   = d[d.length - minLen + i];
    return dV > 0 ? (v - esaV) / (0.015 * dV) : 0;
  });

  const wt1 = _ema(ci, n2);

  // SMA-4 of wt1 = wt2
  const wt2: number[] = [];
  for (let i = 3; i < wt1.length; i++)
    wt2.push((wt1[i] + wt1[i-1] + wt1[i-2] + wt1[i-3]) / 4);

  const wt1a = wt1.slice(wt1.length - wt2.length);
  return wt2.map((w2, i) => wt1a[i] > w2 && wt1a[i] < 60);
}

/**
 * Pine Script Supertrend — ATR tabanlı orijinal formül
 * Boğa = fiyat supertrend üzerinde
 * Pine Script: parametreler satır 224–225 (period=10, factor=3.0)
 */
export function calculateSupertrendSignal(
  bars: OHLCVBar[],
  period: number  = 10,
  multiplier: number = 3.0
): boolean[] {
  if (bars.length < period + 2) return [];

  // True Range
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low  - bars[i - 1].close)
    ));
  }

  // Wilder RMA (Rolling MA) for ATR
  const atr: number[] = [];
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atr.push(prev);
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    atr.push(prev);
  }

  const barsA = bars.slice(bars.length - atr.length);
  const isBull: boolean[] = [];
  let prevUp = 0, prevDn = 0, prevBull = true;

  for (let i = 0; i < atr.length; i++) {
    const hl2   = (barsA[i].high + barsA[i].low) / 2;
    const rawUp = hl2 + multiplier * atr[i];
    const rawDn = hl2 - multiplier * atr[i];

    const prevClose = i > 0 ? barsA[i - 1].close : barsA[i].close;
    const up = (rawUp < prevUp || prevClose > prevUp) ? rawUp : prevUp;
    const dn = (rawDn > prevDn || prevClose < prevDn) ? rawDn : prevDn;

    const bull: boolean = barsA[i].close > (prevBull ? up : dn)
      ? true
      : barsA[i].close < (prevBull ? up : dn)
      ? false
      : prevBull;

    isBull.push(bull);
    prevUp = up; prevDn = dn; prevBull = bull;
  }
  return isBull;
}

/**
 * EMA Ribbon Sinyali
 * Boğa = EMA8 > EMA21 > EMA55 (tam hizalanma)
 * Pine Script: satır 1777
 */
export function calculateEmaRibbonSignal(closes: number[]): boolean[] {
  if (closes.length < 56) return [];
  const e8  = _ema(closes,  8);
  const e21 = _ema(closes, 21);
  const e55 = _ema(closes, 55);
  const minLen = Math.min(e8.length, e21.length, e55.length);
  const signals: boolean[] = [];
  for (let i = 0; i < minLen; i++) {
    signals.push(
      e8[e8.length   - minLen + i] > e21[e21.length - minLen + i] &&
      e21[e21.length - minLen + i] > e55[e55.length - minLen + i]
    );
  }
  return signals;
}

/**
 * Ichimoku Kumo (Bulut) Sinyali
 * Boğa = fiyat hem Senkou A hem Senkou B üzerinde
 * Pine Script: satır 1778 (v5_ichi_above_kumo)
 */
export function calculateIchimokuSignal(
  bars: OHLCVBar[],
  tenkan: number = 9,
  kijun:  number = 26,
  senkouB: number = 52,
  disp:   number = 26
): boolean[] {
  const needed = Math.max(kijun, senkouB) + disp;
  if (bars.length < needed + 1) return [];

  const mid = (start: number, len: number): number => {
    let maxH = -Infinity, minL = Infinity;
    for (let i = start; i < start + len; i++) {
      if (bars[i].high > maxH) maxH = bars[i].high;
      if (bars[i].low  < minL) minL = bars[i].low;
    }
    return (maxH + minL) / 2;
  };

  const signals: boolean[] = [];
  for (let i = needed; i < bars.length; i++) {
    // Senkou lines hesaplama geçmişte disp kadar (cloud 26 bar ileriye taşınır,
    // yani bugünkü fiyat için bulut disp bar önceki Tenkan/Kijun'dan türetilir)
    const sIdx = i - disp;
    if (sIdx < Math.max(tenkan, kijun, senkouB) - 1) { signals.push(false); continue; }

    const senA = (mid(sIdx - tenkan + 1,  tenkan)  + mid(sIdx - kijun + 1, kijun)) / 2;
    const senB = mid(sIdx - senkouB + 1, senkouB);

    const price = bars[i].close;
    signals.push(price > senA && price > senB);
  }
  return signals;
}
