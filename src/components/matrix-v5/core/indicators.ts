// Technical Indicators Library
// Port of Pine Script indicators to TypeScript

export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

export class TechnicalIndicators {
  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  static sma(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
        continue;
      }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      result.push(sum / period);
    }
    return result;
  }

  static ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // İlk değer SMA
    let sum = 0;
    for (let i = 0; i < period && i < data.length; i++) {
      sum += data[i];
      result.push(NaN);
    }
    
    if (data.length >= period) {
      result[period - 1] = sum / period;
      
      for (let i = period; i < data.length; i++) {
        const emaVal = (data[i] - result[i - 1]) * multiplier + result[i - 1];
        result.push(emaVal);
      }
    }
    
    return result;
  }

  static stdev(data: number[], period: number): number[] {
    const result: number[] = [];
    const means = this.sma(data, period);
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1 || isNaN(means[i])) {
        result.push(NaN);
        continue;
      }
      
      let sumSquares = 0;
      for (let j = 0; j < period; j++) {
        const diff = data[i - j] - means[i];
        sumSquares += diff * diff;
      }
      result.push(Math.sqrt(sumSquares / period));
    }
    
    return result;
  }

  static atr(highs: number[], lows: number[], closes: number[], period: number): number[] {
    const tr: number[] = [];
    
    // True Range hesapla
    for (let i = 0; i < highs.length; i++) {
      if (i === 0) {
        tr.push(highs[i] - lows[i]);
      } else {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }
    
    // ATR = EMA of TR
    return this.ema(tr, period);
  }

  static highest(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
        continue;
      }
      let max = -Infinity;
      for (let j = 0; j < period; j++) {
        max = Math.max(max, data[i - j]);
      }
      result.push(max);
    }
    return result;
  }

  static lowest(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
        continue;
      }
      let min = Infinity;
      for (let j = 0; j < period; j++) {
        min = Math.min(min, data[i - j]);
      }
      result.push(min);
    }
    return result;
  }

  // ============================================
  // RSI
  // ============================================
  
  static rsi(data: number[], period: number): number[] {
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // İlk değişimleri hesapla
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        gains.push(0);
        losses.push(0);
        result.push(NaN);
      } else {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
        result.push(NaN);
      }
    }
    
    // Wilder's smoothing (RMA)
    if (data.length >= period + 1) {
      let avgGain = 0;
      let avgLoss = 0;
      
      for (let i = 1; i <= period; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
      }
      avgGain /= period;
      avgLoss /= period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result[period] = 100 - (100 / (1 + rs));
      
      for (let i = period + 1; i < data.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result[i] = 100 - (100 / (1 + rs));
      }
    }
    
    return result;
  }

  // ============================================
  // MACD
  // ============================================
  
  static macd(data: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const fastEMA = this.ema(data, fastPeriod);
    const slowEMA = this.ema(data, slowPeriod);
    
    const macdLine: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
        macdLine.push(NaN);
      } else {
        macdLine.push(fastEMA[i] - slowEMA[i]);
      }
    }
    
    const signalLine = this.ema(macdLine.filter(v => !isNaN(v)), signalPeriod);
    
    // Pad signal line
    const paddedSignal: number[] = [];
    let signalIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (isNaN(macdLine[i])) {
        paddedSignal.push(NaN);
      } else {
        paddedSignal.push(signalLine[signalIdx] || NaN);
        signalIdx++;
      }
    }
    
    const histogram: number[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (isNaN(macdLine[i]) || isNaN(paddedSignal[i])) {
        histogram.push(NaN);
      } else {
        histogram.push(macdLine[i] - paddedSignal[i]);
      }
    }
    
    return {
      macd: macdLine,
      signal: paddedSignal,
      histogram
    };
  }

  // ============================================
  // SUPERTREND
  // ============================================
  
  static supertrend(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number,
    multiplier: number
  ): { trend: number[]; direction: number[] } {
    const atr = this.atr(highs, lows, closes, period);
    const trend: number[] = [];
    const direction: number[] = [];
    
    for (let i = 0; i < closes.length; i++) {
      if (i === 0 || isNaN(atr[i])) {
        trend.push(closes[i]);
        direction.push(1);
        continue;
      }
      
      const hl2 = (highs[i] + lows[i]) / 2;
      const upperBand = hl2 + multiplier * atr[i];
      const lowerBand = hl2 - multiplier * atr[i];
      
      let newTrend = trend[i - 1];
      let newDir = direction[i - 1];
      
      if (closes[i] > trend[i - 1]) {
        newDir = 1;
        newTrend = lowerBand;
      } else if (closes[i] < trend[i - 1]) {
        newDir = -1;
        newTrend = upperBand;
      }
      
      trend.push(newTrend);
      direction.push(newDir);
    }
    
    return { trend, direction };
  }

  // ============================================
  // STOCHASTIC RSI
  // ============================================
  
  static stochRSI(data: number[], rsiPeriod: number, stochPeriod: number, kPeriod: number, dPeriod: number): {
    k: number[];
    d: number[];
  } {
    const rsiValues = this.rsi(data, rsiPeriod);
    const k: number[] = [];
    
    for (let i = 0; i < rsiValues.length; i++) {
      if (i < stochPeriod - 1 || isNaN(rsiValues[i])) {
        k.push(NaN);
        continue;
      }
      
      let minRSI = Infinity;
      let maxRSI = -Infinity;
      
      for (let j = 0; j < stochPeriod; j++) {
        const val = rsiValues[i - j];
        if (!isNaN(val)) {
          minRSI = Math.min(minRSI, val);
          maxRSI = Math.max(maxRSI, val);
        }
      }
      
      if (maxRSI === minRSI) {
        k.push(0);
      } else {
        k.push(((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100);
      }
    }
    
    const kSmooth = this.sma(k, kPeriod);
    const d = this.sma(kSmooth, dPeriod);
    
    return { k: kSmooth, d };
  }

  // ============================================
  // ADX (Average Directional Index)
  // ============================================
  
  static adx(highs: number[], lows: number[], closes: number[], period: number): {
    adx: number[];
    plusDI: number[];
    minusDI: number[];
  } {
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];
    
    for (let i = 0; i < highs.length; i++) {
      if (i === 0) {
        plusDM.push(0);
        minusDM.push(0);
        tr.push(highs[i] - lows[i]);
      } else {
        const highDiff = highs[i] - highs[i - 1];
        const lowDiff = lows[i - 1] - lows[i];
        
        plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
        minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
        
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        tr.push(Math.max(hl, hc, lc));
      }
    }
    
    const smoothPlusDM = this.ema(plusDM, period);
    const smoothMinusDM = this.ema(minusDM, period);
    const smoothTR = this.ema(tr, period);
    
    const plusDI: number[] = [];
    const minusDI: number[] = [];
    const dx: number[] = [];
    
    for (let i = 0; i < highs.length; i++) {
      if (isNaN(smoothTR[i]) || smoothTR[i] === 0) {
        plusDI.push(NaN);
        minusDI.push(NaN);
        dx.push(NaN);
      } else {
        const pdi = (smoothPlusDM[i] / smoothTR[i]) * 100;
        const mdi = (smoothMinusDM[i] / smoothTR[i]) * 100;
        plusDI.push(pdi);
        minusDI.push(mdi);
        
        const sum = pdi + mdi;
        if (sum === 0) {
          dx.push(0);
        } else {
          dx.push((Math.abs(pdi - mdi) / sum) * 100);
        }
      }
    }
    
    const adxValues = this.ema(dx, period);
    
    return { adx: adxValues, plusDI, minusDI };
  }

  // ============================================
  // VWAP (Volume Weighted Average Price)
  // ============================================
  
  static vwap(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
    const result: number[] = [];
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += typicalPrice * volumes[i];
      cumulativeVolume += volumes[i];
      
      result.push(cumulativeVolume === 0 ? closes[i] : cumulativeTPV / cumulativeVolume);
    }
    
    return result;
  }

  // ============================================
  // ICHIMOKU
  // ============================================
  
  static ichimoku(highs: number[], lows: number[], tenkanPeriod: number, kijunPeriod: number, senkouPeriod: number): {
    tenkan: number[];
    kijun: number[];
    senkouA: number[];
    senkouB: number[];
  } {
    const tenkan: number[] = [];
    const kijun: number[] = [];
    const senkouA: number[] = [];
    const senkouB: number[] = [];
    
    const highestTenkan = this.highest(highs, tenkanPeriod);
    const lowestTenkan = this.lowest(lows, tenkanPeriod);
    const highestKijun = this.highest(highs, kijunPeriod);
    const lowestKijun = this.lowest(lows, kijunPeriod);
    const highestSenkou = this.highest(highs, senkouPeriod);
    const lowestSenkou = this.lowest(lows, senkouPeriod);
    
    for (let i = 0; i < highs.length; i++) {
      tenkan.push((highestTenkan[i] + lowestTenkan[i]) / 2);
      kijun.push((highestKijun[i] + lowestKijun[i]) / 2);
      senkouA.push((tenkan[i] + kijun[i]) / 2);
      senkouB.push((highestSenkou[i] + lowestSenkou[i]) / 2);
    }
    
    return { tenkan, kijun, senkouA, senkouB };
  }

  // ============================================
  // BOLLINGER BANDS
  // ============================================
  
  static bollingerBands(data: number[], period: number, multiplier: number): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.sma(data, period);
    const stdDev = this.stdev(data, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (isNaN(middle[i]) || isNaN(stdDev[i])) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        upper.push(middle[i] + multiplier * stdDev[i]);
        lower.push(middle[i] - multiplier * stdDev[i]);
      }
    }
    
    return { upper, middle, lower };
  }

  // ============================================
  // LINEAR REGRESSION
  // ============================================
  
  static linreg(data: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(NaN);
        continue;
      }
      
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;
      
      for (let j = 0; j < period; j++) {
        const x = j;
        const y = data[i - period + 1 + j];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
      
      const slope = (period * sumXY - sumX * sumY) / (period * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / period;
      
      result.push(slope * (period - 1) + intercept);
    }
    
    return result;
  }
}
