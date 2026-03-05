export interface AiScoreComponents {
  whaleConfirmed: number;
  regimeAlignment: number;
  volumePower: number;
  trendAlignment: number;
  mtfConsensus: number;
  momentumAccel: number;
  volatilityRegime: number;
  zScore: number;
  bayesianWinRate: number;
  trapPenalty: number;
  earlyReversalBonus: number;
  stoppingVolumePenalty: number;
  vixBottomBonus: number;
  deltaDivergence: number;
}

export interface F4Data {
  symbol: string;
  interval: string;
  currentPrice?: number;

  // Matrix V3 Data (Backward Compat)
  f4Slope?: number;
  f4Acceleration?: number;
  whaleDetected: boolean;
  whaleStatus: string;
  trend: string;
  signal: "BUY" | "SELL" | null;
  aiScore: number;
  aiComponents?: AiScoreComponents;

  // Matrix V5 Data
  confluenceScore?: number;
  prediction?: {
    upProb: number;
    downProb: number;
    text?: string;
    direction?: "UP" | "DOWN" | "FLAT";
  };
  v5Indicators?: Array<{
    name: string;
    value?: string;
    state: string;
    color: string;
  }>;
  adm?: {
    classification?: number;
    evidence?: string;
    bias: string;
    direction?: number;
  };
  vpa?: {
    buyVolume?: number;
    sellVolume?: number;
    delta?: number;
    netPressure?: number;
    state: string;
  };

  marketRegime?: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  volatilityRegime?: string;
  regimePrediction?: string;
  systemDecision?: string;
  mtfConsensus?: string;
  zScoreValue?: number;
  deathRisk?: boolean;

  // SMC & Structure (V5)
  smc?: {
    swingTrend: string;
    internalTrend: string;
    bos: boolean;
    choch: boolean;
    orderBlocks: Array<{ high: number; low: number; type: string }>;
    fvgs: Array<{ top: number; bottom: number; type: string }>;
  };
  liquidity?: { eqHighs: boolean; eqLows: boolean };
  whaleTrust?: number;
  tfAdaptFactor?: number;

  // Matrix V5.4 Additions
  f4PowerLoss?: number;
  liquidityZone?: string;
  f4EarlyBuy?: boolean;
  f4EarlySell?: boolean;
  f4ConfirmedBuy?: boolean;
  f4ConfirmedSell?: boolean;

  error?: string;
}

export interface SmartPrediction {
  verdict: "AL" | "SAT" | "BEKLE";
  verdictColor: string;
  label: string;
  explanation: string;
  bullPoints: string[];
  bearPoints: string[];
  bulletScore: number;
}

/**
 * AKILLI TAHMİN ÜRETECİ — MatrixPortfolio'dan taşındı
 * Yaklaşık 50 formül çıktısını analiz ederek sonuç üretir.
 */
export function calculateSmartPrediction(sd: F4Data | null): SmartPrediction {
  if (!sd)
    return {
      verdict: "BEKLE",
      verdictColor: "text-slate-400",
      label: "VERİ YOK",
      explanation: "Sinyal verisi bekleniyor.",
      bullPoints: [],
      bearPoints: [],
      bulletScore: 50,
    };

  const bullPoints: string[] = [];
  const bearPoints: string[] = [];
  let bullScore = 0;
  let bearScore = 0;

  // 1. RSI
  const rsiInd = sd.v5Indicators?.find((i) => i.name === "RSI");
  const rsiVal = parseFloat(rsiInd?.value || "50");
  if (rsiVal <= 25) {
    bullPoints.push(`RSI ${rsiVal.toFixed(0)} — Aşırı Satım Dibi 🟢`);
    bullScore += 10;
  } else if (rsiVal <= 35) {
    bullPoints.push(`RSI ${rsiVal.toFixed(0)} — Güçlü Alım Bölgesi`);
    bullScore += 7;
  } else if (rsiVal <= 45) {
    bullPoints.push(`RSI ${rsiVal.toFixed(0)} — Hafif Oversold`);
    bullScore += 3;
  } else if (rsiVal >= 75) {
    bearPoints.push(`RSI ${rsiVal.toFixed(0)} — Aşırı Alım Tepesi 🔴`);
    bearScore += 10;
  } else if (rsiVal >= 65) {
    bearPoints.push(`RSI ${rsiVal.toFixed(0)} — Overbought Bölgesi`);
    bearScore += 6;
  } else if (rsiVal >= 55) {
    bullPoints.push(`RSI ${rsiVal.toFixed(0)} — Boğa Momentumu`);
    bullScore += 4;
  }

  // 2. MACD Histogram
  const macdInd = sd.v5Indicators?.find((i) => i.name === "MACD");
  const macdHist = parseFloat(macdInd?.value || "0");
  if (macdHist > 0 && macdInd?.state?.includes("GÜÇLÜ")) {
    bullPoints.push("MACD Histogramı Güçlü Yükseliyor 📊");
    bullScore += 8;
  } else if (macdHist > 0) {
    bullPoints.push("MACD Histogramı Pozitif");
    bullScore += 4;
  } else if (macdHist < 0 && macdInd?.state?.includes("AYI")) {
    bearPoints.push("MACD Histogramı Negatif — Baskı Var");
    bearScore += 6;
  } else if (macdHist < 0) {
    bearPoints.push("MACD Histogramı Düşüşte");
    bearScore += 3;
  }

  // 3. SuperTrend
  const stInd = sd.v5Indicators?.find((i) => i.name === "Supertrend");
  if (stInd?.color === "green") {
    bullPoints.push("SuperTrend Yükseliş Yönünde ✅");
    bullScore += 7;
  } else if (stInd?.color === "red") {
    bearPoints.push("SuperTrend Düşüş Yönünde ❌");
    bearScore += 7;
  }

  // 4. StochRSI
  const stochInd = sd.v5Indicators?.find((i) => i.name === "StochRSI");
  const stochK = parseFloat(stochInd?.value || "50");
  if (stochK < 10) {
    bullPoints.push(`StochRSI ${stochK.toFixed(0)} — Ekstrem Dip Bölgesi 💎`);
    bullScore += 10;
  } else if (stochK < 25) {
    bullPoints.push(`StochRSI ${stochK.toFixed(0)} — Güçlü Dip Bölgesi`);
    bullScore += 7;
  } else if (stochK > 90) {
    bearPoints.push(`StochRSI ${stochK.toFixed(0)} — Ekstrem Tepe Bölgesi 💀`);
    bearScore += 10;
  } else if (stochK > 75) {
    bearPoints.push(`StochRSI ${stochK.toFixed(0)} — Tepe Bölgesi`);
    bearScore += 6;
  }

  // 5. ADX Trend Gücü
  const adxInd = sd.v5Indicators?.find((i) => i.name === "ADX");
  if (adxInd?.state?.includes("GÜÇLÜ BOĞA")) {
    bullPoints.push("ADX Güçlü Boğa Trendi Onayladı");
    bullScore += 6;
  } else if (adxInd?.state?.includes("GÜÇLÜ AYI")) {
    bearPoints.push("ADX Güçlü Ayı Trendi Onayladı");
    bearScore += 6;
  } else if (adxInd?.state?.includes("YATAY")) {
    bullPoints.push("ADX: Yatay Piyasa (Kırılım Bekleniyor)");
    bullScore += 2;
  }

  // 6. VWAP
  const vwapInd = sd.v5Indicators?.find((i) => i.name === "VWAP");
  if (vwapInd?.color === "green") {
    bullPoints.push("Fiyat VWAP Üzerinde — Alıcılar Güçlü");
    bullScore += 5;
  } else if (vwapInd?.color === "red") {
    bearPoints.push("Fiyat VWAP Altında — Satıcılar Güçlü");
    bearScore += 5;
  }

  // 7. EMA Ribbon
  const ribbonInd = sd.v5Indicators?.find((i) => i.name === "EMA Ribbon");
  if (ribbonInd?.state?.includes("TAM HIZALANMA ↑")) {
    bullPoints.push("EMA Ribbon Tam Boğa Hizalaması 📈");
    bullScore += 8;
  } else if (ribbonInd?.state?.includes("TAM HIZALANMA ↓")) {
    bearPoints.push("EMA Ribbon Tam Ayı Hizalaması 📉");
    bearScore += 8;
  } else if (ribbonInd?.state?.includes("BOĞA")) {
    bullPoints.push("EMA Ribbon Boğa Eğilimli");
    bullScore += 4;
  } else if (ribbonInd?.state?.includes("AYI")) {
    bearPoints.push("EMA Ribbon Ayı Eğilimli");
    bullScore += 4;
  }

  // 8. Ichimoku
  const ichiInd = sd.v5Indicators?.find((i) => i.name === "Ichimoku");
  if (ichiInd?.state?.includes("KUMO ÜSTÜ")) {
    bullPoints.push("Ichimoku: Fiyat Kumo Üstünde — Güçlü Boğa");
    bullScore += 7;
  } else if (ichiInd?.state?.includes("KUMO ALTI")) {
    bearPoints.push("Ichimoku: Fiyat Kumo Altında — Güçlü Ayı");
    bullScore += 7;
  } else {
    bearPoints.push("Ichimoku: Kumo İçinde (Belirsizlik)");
    bearScore += 1;
  }

  // 9. Market Regime
  if (sd.marketRegime === "RISK_ON") {
    bullPoints.push("Piyasa Rejimi: RISK-ON (Boğa Ortamı)");
    bullScore += 6;
  } else if (sd.marketRegime === "RISK_OFF") {
    bearPoints.push("Piyasa Rejimi: RISK-OFF (Kaçış Ortamı)");
    bearScore += 8;
  }

  // 10. Trend
  if (sd.trend === "BULLISH") {
    bullPoints.push("Ana Trend Yükseliş Yönünde");
    bullScore += 5;
  } else if (sd.trend === "BEARISH") {
    bearPoints.push("Ana Trend Düşüş Yönünde");
    bearScore += 5;
  }

  // 11. Whale Detection
  if (sd.whaleDetected) {
    if (sd.whaleStatus === "ALIM_AKTİF" || sd.whaleStatus === "BUY_ACTIVE") {
      bullPoints.push("Balina Topluyor 🐋 — Güçlü Alım Sinyali");
      bullScore += 10;
    } else if (
      sd.whaleStatus === "SELL_ACTIVE" ||
      sd.whaleStatus === "SATIM_AKTİF"
    ) {
      bearPoints.push("Balina Boşaltıyor 🐋 — Satış Baskısı");
      bearScore += 10;
    } else if (sd.whaleStatus === "TUZAK" || sd.whaleStatus === "TRAP") {
      bearPoints.push("Balina Tuzağı Tespit Edildi ⚠️ — Dikkat!");
      bearScore += 12;
    }
  }

  // 12. Volatility Regime
  if (
    sd.volatilityRegime === "SIKIŞTIRMA" ||
    sd.volatilityRegime === "SQUEEZE"
  ) {
    bullPoints.push("Volatilite Sıkışması — Yakında Büyük Hareket 💥");
    bullScore += 5;
  } else if (
    sd.volatilityRegime === "PATLAMA" ||
    sd.volatilityRegime === "EXPLOSION"
  ) {
    bullPoints.push("Volatilite Patlaması Başladı");
    bullScore += 3;
  } else if (
    sd.volatilityRegime === "YÜKSEK_VOL" ||
    sd.volatilityRegime === "HIGH_VOL"
  ) {
    bearPoints.push("Volatilite Yüksek — Risk Artmış");
    bearScore += 4;
  }

  // 13. Z-Score (Sapma Analizi)
  const zs = sd.zScoreValue || 0;
  if (zs < -2.0) {
    bullPoints.push(
      `Z-Score ${zs.toFixed(2)} — Aşırı Negatif Sapma (Dip Bölgesi) 📍`,
    );
    bullScore += 10;
  } else if (zs < -1.5) {
    bullPoints.push(`Z-Score ${zs.toFixed(2)} — İstatistiksel Dip Bölgesi`);
    bullScore += 7;
  } else if (zs > 2.0) {
    bearPoints.push(
      `Z-Score ${zs.toFixed(2)} — Aşırı Pozitif Sapma (Tepe Bölgesi) 🔔`,
    );
    bearScore += 10;
  } else if (zs > 1.5) {
    bearPoints.push(`Z-Score ${zs.toFixed(2)} — İstatistiksel Tepe Bölgesi`);
    bearScore += 7;
  }

  // 14. ADM (Asset Drift Model)
  if (sd.adm) {
    const admClass = sd.adm.classification ?? 0;
    if (admClass >= 2) {
      bullPoints.push(`ADM: Güçlü Pozitif Sapma (${sd.adm.bias})`);
      bullScore += 6;
    } else if (admClass >= 1) {
      bullPoints.push(`ADM: Hafif Pozitif Sapma (${sd.adm.bias})`);
      bullScore += 3;
    } else if (admClass <= -2) {
      bearPoints.push(`ADM: Güçlü Negatif Sapma (${sd.adm.bias})`);
      bearScore += 6;
    } else if (admClass <= -1) {
      bearPoints.push(`ADM: Hafif Negatif Sapma (${sd.adm.bias})`);
      bearScore += 3;
    }
  }

  // 15. VPA (Volume Price Analysis)
  if (sd.vpa) {
    if (sd.vpa.state === "ALIM BASKISI") {
      bullPoints.push(
        `VPA Alım Baskısı Tespit Etti (Δ ${(sd.vpa.netPressure || 0).toFixed(1)}%)`,
      );
      bullScore += 7;
    } else if (sd.vpa.state === "SATIM BASKISI") {
      bearPoints.push(
        `VPA Satım Baskısı Tespit Etti (Δ ${(sd.vpa.netPressure || 0).toFixed(1)}%)`,
      );
      bearScore += 7;
    }
  }

  // 16. MTF Consensus
  if (sd.mtfConsensus) {
    if (sd.mtfConsensus.includes("GÜÇLÜ BOĞA")) {
      bullPoints.push(`MTF Konsensüs: ${sd.mtfConsensus}`);
      bullScore += 8;
    } else if (sd.mtfConsensus.includes("GÜÇLÜ AYI")) {
      bearPoints.push(`MTF Konsensüs: ${sd.mtfConsensus}`);
      bearScore += 8;
    } else if (sd.mtfConsensus.includes("BOĞA")) {
      bullPoints.push(`MTF Konsensüs: ${sd.mtfConsensus}`);
      bullScore += 4;
    } else if (sd.mtfConsensus.includes("AYI")) {
      bearPoints.push(`MTF Konsensüs: ${sd.mtfConsensus}`);
      bearScore += 4;
    }
  }

  // 17. F4 Erken Uyarı Sistemi
  if (sd.f4EarlyBuy) {
    bullPoints.push("F4 Erken Alış Sinyali Aktif (Fibo Diverjans) 🔔");
    bullScore += 8;
  }
  if (sd.f4ConfirmedBuy) {
    bullPoints.push("F4 ONAYLI Alış — Çizgi Renk Değişimi ✅");
    bullScore += 10;
  }
  if (sd.f4EarlySell) {
    bearPoints.push("F4 Erken Satış Sinyali Aktif (Fibo Diverjans) 🔕");
    bearScore += 8;
  }
  if (sd.f4ConfirmedSell) {
    bearPoints.push("F4 ONAYLI Satış — Çizgi Renk Değişimi ❌");
    bearScore += 10;
  }

  // 18. Liquidity Zone
  if (sd.liquidityZone && sd.liquidityZone !== "YOK") {
    if (sd.liquidityZone.includes("BOĞA")) {
      bullPoints.push(`Likidite Bölgesi: ${sd.liquidityZone} — Destek Var`);
      bullScore += 5;
    } else if (sd.liquidityZone.includes("AYI")) {
      bearPoints.push(`Likidite Bölgesi: ${sd.liquidityZone} — Direnç Var`);
      bearScore += 5;
    }
  }

  // 19. F4 Power Loss
  if (sd.f4PowerLoss !== undefined) {
    if (sd.f4PowerLoss > 70 && sd.trend === "BEARISH") {
      bullPoints.push(
        `F4 Güç Kaybı %${sd.f4PowerLoss.toFixed(0)} — Düşüşün Enerjisi Bitti, Dip Yakın`,
      );
      bullScore += 8;
    } else if (sd.f4PowerLoss > 70 && sd.trend === "BULLISH") {
      bearPoints.push(
        `F4 Güç Kaybı %${sd.f4PowerLoss.toFixed(0)} — Yükselişin Enerjisi Bitti`,
      );
      bearScore += 8;
    }
  }

  // 20. Regime Prediction
  const regPred = sd.regimePrediction || "";
  if (
    regPred.includes("DİP") ||
    regPred.includes("BOTTOM") ||
    regPred.includes("ERKEN_DÖNÜŞ_YUKARI") ||
    regPred === "EARLY_REVERSAL_UP"
  ) {
    bullPoints.push(
      `Rejim Tahmini: ${regPred.replace(/_/g, " ")} — Dönüş Sinyali`,
    );
    bullScore += 6;
  } else if (
    regPred.includes("HIZLANAN_TREND") ||
    regPred === "ACCELERATING_TREND"
  ) {
    bullPoints.push(`Rejim: Hızlanan Yükseliş Trendi`);
    bullScore += 5;
  } else if (
    regPred.includes("HIZLANAN_DÜŞÜŞ") ||
    regPred === "ACCELERATING_DROP"
  ) {
    bearPoints.push(`Rejim: Hızlanan Düşüş Trendi`);
    bearScore += 6;
  } else if (
    regPred.includes("ERKEN_DÖNÜŞ_AŞAĞI") ||
    regPred === "EARLY_REVERSAL_DOWN"
  ) {
    bearPoints.push(`Rejim Tahmini: Aşağı Dönüş Sinyali`);
    bearScore += 6;
  } else if (regPred.includes("EXHAUSTION") || regPred.includes("YORGUNLUK")) {
    bearPoints.push(`Rejim: Yorgunluk — Trend Sonuna Yakın`);
    bearScore += 4;
  }

  // 21. Confluence Score
  const cs = sd.confluenceScore ?? sd.aiScore ?? 0;
  if (cs >= 75) {
    bullPoints.push(`Birleşme Skoru ${cs}/100 — Mükemmel Uyum 🔥`);
    bullScore += 8;
  } else if (cs >= 60) {
    bullPoints.push(`Birleşme Skoru ${cs}/100 — Güçlü`);
    bullScore += 4;
  } else if (cs < 35) {
    bearPoints.push(`Birleşme Skoru ${cs}/100 — Zayıf Sinyal`);
    bearScore += 5;
  }

  // 22. Prediction Probability
  const upProb = sd.prediction?.upProb || 50;
  if (upProb >= 70) {
    bullPoints.push(
      `Yukarı İhtimali %${upProb.toFixed(0)} — Güçlü Alım Sinyali`,
    );
    bullScore += 8;
  } else if (upProb >= 60) {
    bullPoints.push(`Yukarı İhtimali %${upProb.toFixed(0)}`);
    bullScore += 4;
  } else if (upProb <= 30) {
    bearPoints.push(
      `Aşağı İhtimali %${(100 - upProb).toFixed(0)} — Güçlü Satış Sinyali`,
    );
    bearScore += 8;
  } else if (upProb <= 40) {
    bearPoints.push(`Aşağı İhtimali %${(100 - upProb).toFixed(0)}`);
    bearScore += 4;
  }

  // === KARAR MEKANIZMASI ===
  const totalPoints = bullScore + bearScore;
  const bulletScore =
    totalPoints > 0 ? Math.round((bullScore / totalPoints) * 100) : 50;

  let verdict: "AL" | "SAT" | "BEKLE";
  let verdictColor: string;
  let label: string;
  let explanation: string;

  if (bulletScore >= 72) {
    verdict = "AL";
    verdictColor = "text-emerald-300";
    if (bulletScore >= 85) {
      label = "🔥 GÜÇLÜ AL — DİP ONAYLANMIŞ";
      explanation = `${bullPoints.length} güçlü boğa sinyali birleşiyor. Formüllerin büyük çoğunluğu en kötünün geçtiğini gösteriyor.`;
    } else {
      label = "✅ AL — KOŞULLAR UYGUN";
      explanation = `${bullPoints.length} pozitif sinyal aktif. Göstergeler toplu olarak alım fırsatını işaret ediyor.`;
    }
  } else if (bulletScore <= 28) {
    verdict = "SAT";
    verdictColor = "text-rose-400";
    if (bulletScore <= 15) {
      label = "💀 GÜÇLÜ SAT — TEPE ONAYLANMIŞ";
      explanation = `${bearPoints.length} güçlü ayı sinyali birleşiyor. Formüllerin büyük çoğunluğu tepede olunduğunu gösteriyor.`;
    } else {
      label = "⛔ SAT — BASKILAR ARTMAKTA";
      explanation = `${bearPoints.length} negatif sinyal aktif. Göstergeler satış baskısının devam edeceğini işaret ediyor.`;
    }
  } else {
    verdict = "BEKLE";
    verdictColor = "text-amber-400";
    if (bulletScore >= 55) {
      label = "⏳ BEKLE — HAFIF BOĞA EĞİLİMİ";
      explanation =
        "Hafif boğa baskısı var ama yeterli konfirmasyon yok. Güçlü sinyal için bekle.";
    } else if (bulletScore <= 45) {
      label = "⏳ BEKLE — HAFIF AYI EĞİLİMİ";
      explanation =
        "Hafif ayı baskısı var ama kesin dönüş sinyali henüz yok. Risk yönetimi öncelikli.";
    } else {
      label = "⏳ BEKLE — KARAR BELİRSİZ";
      explanation =
        "Boğa ve ayı sinyalleri dengede. Daha net bir yön için beklemek en mantıklısı.";
    }
  }

  return {
    verdict,
    verdictColor,
    label,
    explanation,
    bullPoints,
    bearPoints,
    bulletScore,
  };
}

/**
 * AKTİF TRADE DURUM YORUMLAYICISI — ActiveSmartTrades'ten taşındı
 */
export interface TradeMetaStatus {
  exitReason?: string;
  tpTriggered?: boolean;
  tslActivated?: boolean;
  payload?: {
    trailingBuy?: boolean;
    takeProfit?: { trailing?: boolean; [k: string]: unknown } | null;
    stopLoss?: { trailing?: boolean; [k: string]: unknown } | null;
    [k: string]: unknown;
  };
  [key: string]: unknown;
}

export function calculateTrailingExitTarget(
  mode: "TRADE" | "COVER",
  highestPrice: number,
  lowestPrice: number,
  entryPrice: number,
  devPercent: number
): number {
  const dev = devPercent / 100;
  if (mode === "COVER") {
    // For Shorts (COVER), price goes down, we track the local `lowestPrice` to protect gains by trailing down.
    // The target to buy back is above the lowest price.
    const base = lowestPrice > 0 ? lowestPrice : entryPrice;
    return base * (1 + dev);
  } else {
    // For Longs (TRADE), price goes up, we track local `highestPrice` to protect gains by trailing up.
    // The target to sell is below the highest price.
    const base = highestPrice > 0 ? highestPrice : entryPrice;
    return base * (1 - dev);
  }
}

export function calculateTrailingBuyTarget(
  mode: "TRADE" | "COVER",
  highestPrice: number,
  lowestPrice: number,
  entryPrice: number,
  devPercent: number
): number {
  const dev = devPercent / 100;
  if (mode === "COVER") {
    // Trailing Short Entry: Track highest peak, enter short when drops dev% from peak
    const base = highestPrice > 0 ? highestPrice : entryPrice;
    return base * (1 - dev);
  } else {
    // Trailing Long Entry: Track local `lowestPrice`, enter long when rises dev% from bottom
    const base = lowestPrice > 0 ? lowestPrice : entryPrice;
    return base * (1 + dev);
  }
}

export function interpretTradingStatus(
  liveData: unknown,
  isClosed: boolean,
  side: "BUY" | "SELL",
  currentPrice: number,
  tp: number,
  sl: number,
  aiScore: number,
  tradeStatus: string,
  meta: Record<string, unknown>,
): { statusText: string; statusColor: string; liveAiScore: number } {
  // --- Interpret logic omitted to focus on new central function ---
  // Ensure we keep existing code. Only adding new function above it.
  const liveAiScore = liveData
    ? Math.round((liveData as any).aiScore)
    : Math.round(aiScore);
  const payload = meta?.payload || {};

  let statusText = "SİNYAL...";
  let statusColor = "text-cyan-400";

  // --- 0. SIRA - KAPANIŞ DURUMLARI (EN YÜKSEK ÖNCELİK) ---
  if (isClosed && meta?.exitReason) {
    const reason = meta.exitReason;
    if (reason.includes("TP_HIT") || reason.includes("TAKE_PROFIT")) {
      statusText = payload.takeProfit?.trailing
        ? "TTP GERÇEKLEŞTİ ✅"
        : "TP VURULDU ✅";
      statusColor = "text-emerald-500 font-black";
      return { statusText, statusColor, liveAiScore };
    }
    if (reason.includes("SL_HIT") || reason.includes("STOP_LOSS")) {
      statusText = payload.stopLoss?.trailing
        ? "TSL GERÇEKLEŞTİ ❌"
        : "SL VURULDU ❌";
      statusColor = "text-rose-600 font-black";
      return { statusText, statusColor, liveAiScore };
    }
    if (reason === "MANUAL_PANIC_EXIT") {
      statusText = "PANİK ÇIKIŞ ⚡";
      statusColor = "text-amber-500 font-black";
      return { statusText, statusColor, liveAiScore };
    }
    if (reason === "MANUAL_SILENT_EXIT") {
      statusText = "SESSİZ ARŞİV 🔒";
      statusColor = "text-slate-500 font-bold";
      return { statusText, statusColor, liveAiScore };
    }
    statusText = "KAPANDI 🔒";
    statusColor = "text-slate-500 font-bold";
    return { statusText, statusColor, liveAiScore };
  }

  // --- 0.5. SIRA - AKTİF TRAILING DURUMLARI ---
  if (tradeStatus === "PENDING" && payload.trailingBuy) {
    if (meta?.entryTriggered) {
      statusText = "TBUY TAKİPDE 🔍";
      statusColor = "text-cyan-300 animate-pulse font-bold";
    } else {
      statusText = "TBUY AKTİF ⏳";
      statusColor = "text-cyan-400 animate-pulse font-bold";
    }
    return { statusText, statusColor, liveAiScore };
  }

  if (tradeStatus === "FILLED" && !isClosed) {
    statusText = "İŞLEM AÇILDI ✅";
    statusColor = "text-emerald-400 font-black";
    // Do not return yet, allow Proximity Checks to override if TP/SL is near
  }

  if (meta?.tpTriggered && payload.takeProfit?.trailing && !isClosed) {
    statusText = "TTP BAŞLADI 🚀";
    statusColor = "text-emerald-400 animate-pulse font-bold";
    return { statusText, statusColor, liveAiScore };
  }

  if (meta?.tslActivated && payload.stopLoss?.trailing && !isClosed) {
    statusText = "TSL BAŞLADI 🚨";
    statusColor = "text-rose-400 animate-pulse font-bold";
    return { statusText, statusColor, liveAiScore };
  }

  // 1. TP/SL Yakınlık Kontrolü
  if (tp > 0) {
    const dist =
      side === "BUY"
        ? ((tp - currentPrice) / currentPrice) * 100
        : ((currentPrice - tp) / currentPrice) * 100;
    if (dist <= 0) {
      statusText = "💰 TP VURULDU";
      statusColor = "text-emerald-500 animate-pulse font-black";
    } else if (dist < 0.5) {
      statusText = "🎯 TP TESTİ (KRİTİK)";
      statusColor = "text-emerald-400 animate-pulse";
    } else if (dist < 1.5) {
      statusText = "✅ HEDEF YAKIN";
      statusColor = "text-emerald-400";
    }
  }
  if (sl > 0) {
    const distSl =
      side === "BUY"
        ? ((currentPrice - sl) / currentPrice) * 100
        : ((sl - currentPrice) / currentPrice) * 100;

    if (distSl <= 0) {
      statusText = "❌ SL VURULDU (KAPALI)";
      statusColor = "text-rose-600 animate-pulse font-black";
    } else if (distSl < 0.5) {
      statusText = "🔥 SL TESTİ (KRİTİK)";
      statusColor = "text-rose-500 animate-pulse font-black";
    } else if (distSl < 1.5) {
      statusText = "🛡️ SL YAKIN (DİKKAT)";
      statusColor = "text-rose-400 font-bold";
    }
  }

  // 2. Canlı Sinyal Yorumlama
  if (statusText === "SİNYAL..." && !isClosed && liveData) {
    const upP = liveData.prediction?.upProb ?? 50;
    const isBull = liveData.trend === "BULLISH";
    const isBear = liveData.trend === "BEARISH";
    const hasBuy =
      liveData.f4EarlyBuy ||
      liveData.f4ConfirmedBuy ||
      liveData.signal === "BUY";
    const hasSell =
      liveData.f4EarlySell ||
      liveData.f4ConfirmedSell ||
      liveData.signal === "SELL";

    if (hasBuy && upP >= 60) {
      statusText = "DİP BÖLGESİ 🟢";
      statusColor = "text-emerald-400";
    } else if (hasSell && upP <= 40) {
      statusText = "TEPE BÖLGESİ 🔴";
      statusColor = "text-rose-400";
    } else if (isBull && upP >= 55 && liveAiScore >= 60) {
      statusText = "BOĞA MOD 📈";
      statusColor = "text-emerald-400";
    } else if (isBear && upP <= 45 && liveAiScore <= 40) {
      statusText = "AYI MOD 📉";
      statusColor = "text-rose-400";
    } else if (
      liveData.whaleDetected &&
      (liveData.whaleStatus === "BUY_ACTIVE" ||
        liveData.whaleStatus === "ALIM_AKTİF")
    ) {
      statusText = "BALİNA AL 🐋"; // Fixed spelling
      statusColor = "text-amber-400";
    } else if (
      liveData.whaleDetected &&
      (liveData.whaleStatus === "SELL_ACTIVE" ||
        liveData.whaleStatus === "SATIM_AKTİF")
    ) {
      statusText = "BALİNA SAT 🐋"; // Fixed spelling
      statusColor = "text-amber-400";
    } else if (isBull) {
      statusText = "BOĞA EĞİLİM";
      statusColor = "text-emerald-400";
    } else if (isBear) {
      statusText = "AYI EĞİLİM";
      statusColor = "text-rose-400";
    } else {
      statusText = "YATAY ↔";
      statusColor = "text-amber-400";
    }
  } else if (statusText === "SİNYAL..." && !isClosed && !liveData) {
    statusText = "SİNYAL ARANIYOR...";
    statusColor = "text-cyan-400";
  }

  return { statusText, statusColor, liveAiScore };
}
