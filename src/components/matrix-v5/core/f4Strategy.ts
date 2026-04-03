// F4 Strategy Implementation
// Port from Pine Script Matrix V5

import { TechnicalIndicators } from './indicators';

export interface F4Config {
  length: number;
  alpha: number;
  fiboLength: number;
  fiboAlpha: number;
  slopeThreshold: number;
  powerLossThreshold: number;
  lookbackBars: number;
  squeezeThreshold: number;
}

export interface F4Result {
  f4: number[];
  f4Fibo: number[];
  buySignals: boolean[];
  sellSignals: boolean[];
  earlyBuySignals: boolean[];
  earlySellSignals: boolean[];
  powerLoss: number[];
  slopeStrength: number[];
}

export class F4Strategy {
  static calculate(
    highs: number[],
    lows: number[],
    closes: number[],
    config: F4Config
  ): F4Result {
    const n = closes.length;
    
    // F4 Main Line hesaplama
    const f4 = this.calculateF4Line(highs, lows, closes, config.length, config.alpha);
    
    // F4 Fibonacci Line hesaplama
    const f4Fibo = this.calculateF4Line(highs, lows, closes, config.fiboLength, config.fiboAlpha);
    
    // Slope hesaplama
    const f4Slope: number[] = [];
    const fiboSlope: number[] = [];
    
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        f4Slope.push(0);
        fiboSlope.push(0);
      } else {
        f4Slope.push(f4[i] - f4[i - 1]);
        fiboSlope.push(f4Fibo[i] - f4Fibo[i - 1]);
      }
    }
    
    // Slope smoothing
    const f4SlopeMA = TechnicalIndicators.sma(f4Slope, 3);
    const fiboSlopeMA = TechnicalIndicators.sma(fiboSlope, 2);
    
    // Slope strength ve power loss hesaplama
    const slopeStrength: number[] = [];
    const powerLoss: number[] = [];
    
    for (let i = 0; i < n; i++) {
      slopeStrength.push(Math.abs(f4SlopeMA[i] || 0));
      
      if (i < config.lookbackBars) {
        powerLoss.push(0);
      } else {
        let maxSlope = 0;
        for (let j = 0; j < config.lookbackBars; j++) {
          maxSlope = Math.max(maxSlope, slopeStrength[i - j] || 0);
        }
        
        if (maxSlope > 0.00001) {
          const loss = ((maxSlope - slopeStrength[i]) / maxSlope) * 100;
          powerLoss.push(loss);
        } else {
          powerLoss.push(0);
        }
      }
    }
    
    // Volatility regime detection (Bollinger Band Width)
    const bb = TechnicalIndicators.bollingerBands(closes, 20, 2);
    const bbWidth: number[] = [];
    for (let i = 0; i < n; i++) {
      if (isNaN(bb.upper[i]) || isNaN(bb.lower[i]) || isNaN(bb.middle[i])) {
        bbWidth.push(NaN);
      } else {
        bbWidth.push((bb.upper[i] - bb.lower[i]) / bb.middle[i]);
      }
    }
    const bbWidthSMA = TechnicalIndicators.sma(bbWidth.filter(v => !isNaN(v)), 50);
    const bbWidthStdev = TechnicalIndicators.stdev(bbWidth.filter(v => !isNaN(v)), 50);
    
    // Signal generation
    const buySignals: boolean[] = [];
    const sellSignals: boolean[] = [];
    const earlyBuySignals: boolean[] = [];
    const earlySellSignals: boolean[] = [];
    
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        buySignals.push(false);
        sellSignals.push(false);
        earlyBuySignals.push(false);
        earlySellSignals.push(false);
        continue;
      }
      
      // Volatility adaptive threshold
      let dynThreshold = config.powerLossThreshold;
      
      // Squeeze detection
      let bbWidthIdx = 0;
      for (let j = 0; j <= i && j < bbWidth.length; j++) {
        if (!isNaN(bbWidth[j])) bbWidthIdx++;
      }
      bbWidthIdx = Math.max(0, bbWidthIdx - 1);
      
      if (bbWidthIdx < bbWidthSMA.length && bbWidthIdx < bbWidthStdev.length) {
        const bbwSMA = bbWidthSMA[bbWidthIdx];
        const bbwStd = bbWidthStdev[bbWidthIdx];
        const bbwCurrent = bbWidth[i];
        
        if (!isNaN(bbwSMA) && !isNaN(bbwStd) && !isNaN(bbwCurrent) && bbwStd > 0) {
          const zScore = (bbwCurrent - bbwSMA) / bbwStd;
          if (zScore < -1.0) {
            dynThreshold = config.squeezeThreshold;
          }
        }
      }
      
      // Fibo divergence detection
      const fiboDivergingBuy = (fiboSlopeMA[i] || 0) > 0 && (f4SlopeMA[i] || 0) < 0;
      const fiboDivergingSell = (fiboSlopeMA[i] || 0) < 0 && (f4SlopeMA[i] || 0) > 0;
      
      const halfThreshold = dynThreshold * 0.5;
      
      // Dynamic threshold check
      const atr = TechnicalIndicators.atr(highs, lows, closes, 14);
      const dynamicThreshold = (atr[i] || 0) * config.slopeThreshold;
      const notFlat = slopeStrength[i] > dynamicThreshold || Math.abs(fiboSlopeMA[i] || 0) > dynamicThreshold;
      
      // Early buy signals
      const earlyBuyFibo = fiboDivergingBuy && 
                           powerLoss[i] >= halfThreshold && 
                           powerLoss[i - 1] < halfThreshold && 
                           notFlat;
      
      const earlyBuyClassic = (f4SlopeMA[i] || 0) < 0 && 
                              powerLoss[i] >= dynThreshold && 
                              powerLoss[i - 1] < dynThreshold && 
                              notFlat;
      
      earlyBuySignals.push(earlyBuyFibo || earlyBuyClassic);
      
      // Early sell signals
      const earlySellFibo = fiboDivergingSell && 
                            powerLoss[i] >= halfThreshold && 
                            powerLoss[i - 1] < halfThreshold && 
                            notFlat;
      
      const earlySellClassic = (f4SlopeMA[i] || 0) > 0 && 
                               powerLoss[i] >= dynThreshold && 
                               powerLoss[i - 1] < dynThreshold && 
                               notFlat;
      
      earlySellSignals.push(earlySellFibo || earlySellClassic);
      
      // Confirmed signals (crossover/crossunder)
      const confirmedBuy = f4[i] > f4[i - 1] && f4[i - 1] <= f4[i - 2] && notFlat;
      const confirmedSell = f4[i] < f4[i - 1] && f4[i - 1] >= f4[i - 2] && notFlat;
      
      buySignals.push(confirmedBuy);
      sellSignals.push(confirmedSell);
    }
    
    return {
      f4,
      f4Fibo,
      buySignals,
      sellSignals,
      earlyBuySignals,
      earlySellSignals,
      powerLoss,
      slopeStrength
    };
  }
  
  private static calculateF4Line(
    highs: number[],
    lows: number[],
    closes: number[],
    length: number,
    alpha: number
  ): number[] {
    const n = closes.length;
    const hlc4: number[] = [];
    
    for (let i = 0; i < n; i++) {
      hlc4.push((highs[i] + lows[i] + 2 * closes[i]) / 4);
    }
    
    const e1 = TechnicalIndicators.ema(hlc4, length);
    const e2 = TechnicalIndicators.ema(e1, length);
    const e3 = TechnicalIndicators.ema(e2, length);
    const e4 = TechnicalIndicators.ema(e3, length);
    const e5 = TechnicalIndicators.ema(e4, length);
    const e6 = TechnicalIndicators.ema(e5, length);
    
    const c1 = -alpha * alpha * alpha;
    const c2 = 3 * alpha * alpha + 3 * alpha * alpha * alpha;
    const c3 = -6 * alpha * alpha - 3 * alpha - 3 * alpha * alpha * alpha;
    const c4 = 1 + 3 * alpha + alpha * alpha * alpha + 3 * alpha * alpha;
    
    const f4: number[] = [];
    for (let i = 0; i < n; i++) {
      if (isNaN(e6[i])) {
        f4.push(NaN);
      } else {
        f4.push(c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i]);
      }
    }
    
    return f4;
  }
}
