import { MatrixV5Engine } from "../matrix-v5-engine";

export interface ShadowSignal {
  strategyName: string;
  signalType: "LONG" | "SHORT" | "EXIT_LONG" | "EXIT_SHORT" | "WAIT";
  price: number;
  meta: any;
}

/**
 * TSLStratejisi_v5.pine dosyasının TypeScript Adaptörü (Shadow Mode)
 * Pine Script'teki matematiksel operasyonların (BBands + TSL) bağımsız bir sınıfa aktarılmış halidir.
 */
export class ShadowPineExecutor {
  // Pine Script Parametreleri
  private tslRatio: number;
  private f4Thresh: number;
  private mtfProtection: boolean;
  private mult: number = 2.0;

  // Gölge Modu State'leri
  private currentPosition: "LONG" | "SHORT" | "NONE" = "NONE";
  private entryPrice: number = 0;

  constructor(tslRatio = 4, f4Thresh = 0.035, mtfProtection = true) {
    this.tslRatio = tslRatio;
    this.f4Thresh = f4Thresh;
    this.mtfProtection = mtfProtection;
  }

  private calculateSMA(source: number[], length: number): number {
    if (source.length < length || length <= 0) return 0;
    let sum = 0;
    for (let i = source.length - length; i < source.length; i++) {
        sum += source[i];
    }
    return sum / length;
  }

  private calculateStdDev(source: number[], length: number): number {
    if (source.length < length || length <= 0) return 0;
    const slice = source.slice(source.length - length);
    const mean = slice.reduce((a, b) => a + b, 0) / length;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / length;
    return Math.sqrt(variance);
  }

  public evaluate(closes: number[]): ShadowSignal {
    if (closes.length < 20) {
      return { strategyName: "TSLStratejisi_v5", signalType: "WAIT", price: closes[closes.length - 1] || 0, meta: {} };
    }

    const src = closes[closes.length - 1]; // Current Close (Anlık Kapanış)
    const basis = this.calculateSMA(closes, 20);
    const dev = this.mult * this.calculateStdDev(closes, 20);
    const upper = basis + dev;
    const lower = basis - dev;

    // TSL (Trailing Stop Loss / Basic Stop) Çıkış Kontrolü
    if (this.currentPosition === "LONG") {
      const stopPrice = this.entryPrice * (1 - this.tslRatio / 100);
      if (src <= stopPrice) {
        this.currentPosition = "NONE";
        return { strategyName: "TSLStratejisi_v5", signalType: "EXIT_LONG", price: src, meta: { reason: "TSL Hit", stopPrice, basis } };
      }
    }
    
    if (this.currentPosition === "SHORT") {
      const stopPrice = this.entryPrice * (1 + this.tslRatio / 100);
      if (src >= stopPrice) {
        this.currentPosition = "NONE";
        return { strategyName: "TSLStratejisi_v5", signalType: "EXIT_SHORT", price: src, meta: { reason: "TSL Hit", stopPrice, basis } };
      }
    }

    // Giriş Kontrolleri (Pine Script: src > upper and MTFKorunma)
    if (src > upper && this.mtfProtection && this.currentPosition !== "LONG") {
      this.currentPosition = "LONG";
      this.entryPrice = src;
      return { strategyName: "TSLStratejisi_v5", signalType: "LONG", price: src, meta: { upper, lower, basis } };
    }

    if (src < lower && this.mtfProtection && this.currentPosition !== "SHORT") {
      this.currentPosition = "SHORT";
      this.entryPrice = src;
      return { strategyName: "TSLStratejisi_v5", signalType: "SHORT", price: src, meta: { upper, lower, basis } };
    }

    return { strategyName: "TSLStratejisi_v5", signalType: "WAIT", price: src, meta: { upper, lower, basis, currentPosition: this.currentPosition } };
  }
}
