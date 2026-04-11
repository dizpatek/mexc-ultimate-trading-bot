/**
 * RAM Dostu (Lightweight) İndikatör Hesaplayıcıları
 * Ağır kütüphaneler (ör: pandas-ta veya ta-math) kullanmadan,
 * O(n) zaman karmaşıklığında ve minimum memory tahsisi ile hesaplama.
 */

/**
 * Göreceli Güç Endeksi (RSI) Hesaplama
 * Gelen kline/price dizisini alıp standart 14 periyotluk (varsayılan) RSI döndürür.
 * @param prices Kapanış fiyatları dizisi
 * @param period RSI Periyodu (Genelde 14)
 * @returns Son fiyatın RSI değeri (0-100)
 */
export function calculateRSI(prices: number[], period: number = 14): number | null {
  if (prices.length <= period) return null;

  let gains = 0;
  let losses = 0;

  // İlk periyot için basit ortalama al (Wilder'in orijinal yöntemi)
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Sonraki periyotlar için Yumuşatılmış (Smoothed) Hareketli Ortalama devam eder
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    let currentGain = 0;
    let currentLoss = 0;

    if (change > 0) currentGain = change;
    else currentLoss = -change;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Bollinger Bands (BB) Hesaplama
 * Standart Sapma ve Basit Hareketli Ortalama bazlı.
 * @param prices Kapanış fiyatları dizisi
 * @param period BB Periyodu (Genelde 20)
 * @param stdDev Standart Sapma Çarpanı (Genelde 2)
 * @returns Upper Band, SMA (Orta Band), ve Lower Band değerleri
 */
export function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
  if (prices.length < period) return null;

  // Sadece son "period" kadar veriyi değerlendiriyoruz ki bellek şişmesin
  const slice = prices.slice(-period);
  
  // Basit Hareketli Ortalama (SMA)
  const sum = slice.reduce((a, b) => a + b, 0);
  const sma = sum / period;

  // Varyans ve Standart Sapma
  const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const standardDeviation = Math.sqrt(variance);

  return {
    upper: sma + (standardDeviation * stdDev),
    middle: sma,
    lower: sma - (standardDeviation * stdDev),
  };
}
