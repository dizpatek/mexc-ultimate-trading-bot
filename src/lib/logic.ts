import { calculateRSI, calculateBollingerBands } from "./light-indicators";

export type SignalType = "STRONG_BUY" | "STRONG_SELL" | "NEUTRAL";

export interface SignalResult {
  signal: SignalType;
  rsiValue: number | null;
  bbValue: { upper: number; middle: number; lower: number } | null;
  currentPrice: number | null;
}

/**
 * MEXC fiyat geçmişine bakarak 'Signal Engine' hesaplar.
 * Göreceli Güç Endeksi (RSI) ve Bollinger Bantları kullanır.
 * 
 * @param prices Kapanış fiyatları dizisi
 * @returns SignalResult
 */
export function calculateSignal(prices: number[]): SignalResult {
  if (prices.length < 20) {
    return { signal: "NEUTRAL", rsiValue: null, bbValue: null, currentPrice: null };
  }

  const currentPrice = prices[prices.length - 1];

  const rsi = calculateRSI(prices, 14);
  const bb = calculateBollingerBands(prices, 20, 2);

  let signal: SignalType = "NEUTRAL";

  if (rsi !== null && bb !== null) {
    // Güçlü Al Kuralı: Fiyat aşırı satımda (RSI < 30) ve Alt BB bandına dokunmuş/altına inmişse
    if (rsi < 30 && currentPrice <= bb.lower) {
      signal = "STRONG_BUY";
    }
    // Güçlü Sat Kuralı: Fiyat aşırı alımda (RSI > 70) ve Üst BB bandına dokunmuş/üzerine çıkmışsa
    else if (rsi > 70 && currentPrice >= bb.upper) {
      signal = "STRONG_SELL";
    }
  }

  return {
    signal,
    rsiValue: rsi,
    bbValue: bb,
    currentPrice
  };
}

/**
 * Wall-Aware Dynamic Stop Loss
 * Order Book duvar verisine göre stop seviyesini otomatik belirler.
 * Güçlü alım duvarı varsa → duvarın tam %0.1 altına çek (dar & akıllı stop).
 * 
 * @param currentPrice  Anlık piyasa fiyatı
 * @param buyWallWeight Fiyatın %2 altındaki toplam alım hacmi (USDT)
 * @param sellWallWeight Fiyatın %2 üstündeki toplam satış hacmi (USDT)
 * @returns Önerilen stop-loss fiyatı
 */
export function calculateDynamicStopLoss(
  currentPrice: number,
  buyWallWeight: number,
  sellWallWeight: number
): number {
  const dynamicRatio = buyWallWeight / (sellWallWeight || 1);

  if (dynamicRatio > 2.0) {
    // Güçlü alış duvarı: Fiyatın tam %0.1 altına stop çek.
    // Duvar kırılırsa zaten çıkış — dar ama akıllı.
    const wallFloor = currentPrice * 0.999; // duvar seviyesi tahmini (-%0.1)
    return wallFloor * 0.999;               // duvarın %0.1 altı
  } else if (dynamicRatio < 0.5) {
    // Satıcı baskısı çok güçlü → piyasa çöküşte, biraz geniş tut
    return currentPrice * 0.985;           // -%1.5 standart koruma
  } else {
    // Normal / Nötr → standart -%2
    return currentPrice * 0.98;
  }
}
