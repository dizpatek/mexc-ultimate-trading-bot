import { calculateSignal } from "./logic";

export interface BacktestResult {
  totalTrades: number;
  profitableTrades: number;
  lossTrades: number;
  winRate: number;
  totalPnL: number;
  finalCapital: number;
}

/**
 * Worker Thread / Promise sarmalayıcısı ile hafif simülasyon.
 * Ana döngüyü (Event Loop) dondurmamak için Async çalışır.
 * 
 * @param historicalClosePrices Geriye dönük fiyat datası
 * @param initialCapital Başlangıç Bakiyesi
 */
export async function runBacktestSim(
  historicalClosePrices: number[],
  initialCapital = 1000
): Promise<BacktestResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let capital = initialCapital;
      let position = 0;
      let buyPrice = 0;
      let totalTrades = 0;
      let profitableTrades = 0;
      let lossTrades = 0;

      // En az 20 mumluk (Bollinger periyodu) data gerekir.
      for (let i = 21; i < historicalClosePrices.length; i++) {
        // Geçmiş o ana kadarki slice (RAM dostu array ref)
        const windowSlice = historicalClosePrices.slice(0, i + 1);
        const { signal, currentPrice } = calculateSignal(windowSlice);
        
        if (!currentPrice) continue;

        if (signal === "STRONG_BUY" && position === 0) {
          // Satın Al
          buyPrice = currentPrice;
          position = capital / currentPrice; // All in
          capital = 0;
        } 
        else if (signal === "STRONG_SELL" && position > 0) {
          // Sat
          const revenue = position * currentPrice;
          const pnl = revenue - (position * buyPrice);
          
          if (pnl > 0) profitableTrades++;
          else lossTrades++;

          totalTrades++;
          capital = revenue;
          position = 0;
        }
      }

      // Döngü bitince hala pozisyondaysa varsayımsal sat
      if (position > 0) {
        capital = position * historicalClosePrices[historicalClosePrices.length - 1];
      }

      resolve({
        totalTrades,
        profitableTrades,
        lossTrades,
        winRate: totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0,
        totalPnL: capital - initialCapital,
        finalCapital: capital,
      });
    });
  });
}
