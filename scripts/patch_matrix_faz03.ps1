
# =============================================
# Matrix Horizon FAZ 3 Patch Script
# ATR-Regresyon Fiyat Projeksiyonu + AI NLP Ozet
# =============================================

$engineFile = "src/lib/matrix-v5-engine.ts"
$content = Get-Content $engineFile -Raw -Encoding UTF8

# =============================================
# FAZ 3 PATCH 1: MatrixV5Result'a aiSummary ve projection alanlari ekle
# =============================================
$old1 = @'
  // V5.3/V5.4 New Fields
  f4Power: number; // ATR Normalized F4 Momentum [-100, 100]
'@

$new1 = @'
  // === MATRIX HORIZON FAZ 3: Projeksiyon ve AI NLP ===
  aiSummary: string;           // Turkce AI karar ozeti
  projectionBias: "BULLISH" | "BEARISH" | "NEUTRAL"; // Projeksiyon yonu
  projectionConfidence: number;  // 0-100 projeksiyon guven skoru
  kellyFraction: number;         // Kelly Kriteri pozisyon orani (0-1)

  // V5.3/V5.4 New Fields
  f4Power: number; // ATR Normalized F4 Momentum [-100, 100]
'@

$content = $content.Replace($old1, $new1)

# =============================================
# FAZ 3 PATCH 2: calculateTargets - ATR + LinReg Regresyon gelismis projeksiyon
# =============================================
$old2 = @'
  private calculateTargets(highs: number[], lows: number[], closes: number[], adaptedAtrLen: number, currentPrice: number, systemDecision: string, predictionUpProb: number, predictionDownProb: number) {
    const atrTarget = this.calculateATR(highs, lows, closes, adaptedAtrLen);
    const direction = systemDecision === "GO_LONG" ? 1 : systemDecision === "GO_SHORT" ? -1 : predictionUpProb > predictionDownProb ? 1 : -1;
    const targets = { t1: currentPrice + direction * atrTarget * 1.5, t2: currentPrice + direction * atrTarget * 3.0, sl: currentPrice - direction * atrTarget * 1.2, buyDev: atrTarget * 0.6 };
    return { targets };
  }
'@

$new2 = @'
  private calculateTargets(highs: number[], lows: number[], closes: number[], adaptedAtrLen: number, currentPrice: number, systemDecision: string, predictionUpProb: number, predictionDownProb: number) {
    // === MATRIX HORIZON FAZ 3: ATR + LinReg Gelismis Projeksiyon ===
    const atrTarget = this.calculateATR(highs, lows, closes, adaptedAtrLen);
    const direction = systemDecision === "GO_LONG" ? 1 : systemDecision === "GO_SHORT" ? -1 : predictionUpProb > predictionDownProb ? 1 : -1;

    // LinReg egim projeksiyon destegi: Mevcut egim 5 bar icin tahmin
    const lr0 = this.calculateLinReg(closes, 20, 0);
    const lr1 = this.calculateLinReg(closes, 20, 1);
    const lrSlope = lr0 - lr1; // Per-bar egim
    const lrProjection5 = currentPrice + lrSlope * 5; // 5 bar ilerisi linreg tahmini
    const lrProjection10 = currentPrice + lrSlope * 10;

    // Fibonacci ATR carpanlari ile hedefler
    const t1Fib   = currentPrice + direction * atrTarget * 1.618; // Fib 1.618
    const t2Fib   = currentPrice + direction * atrTarget * 2.618; // Fib 2.618
    const slFib   = currentPrice - direction * atrTarget * 1.0;   // 1x ATR stop
    const buyDev  = atrTarget * 0.5;

    // Projeksiyon guven skoru: LinReg yonu ile systemDecision uyumlu mu?
    const lrBull = lrSlope > 0;
    const decBull = direction > 0;
    const projectionConfidence = lrBull === decBull
      ? Math.min(100, 60 + Math.abs(lrSlope / Math.max(atrTarget, 0.0001)) * 20)
      : Math.max(20, 40 - Math.abs(lrSlope / Math.max(atrTarget, 0.0001)) * 10);

    const projectionBias: "BULLISH" | "BEARISH" | "NEUTRAL" = lrSlope > atrTarget * 0.05
      ? "BULLISH" : lrSlope < -atrTarget * 0.05 ? "BEARISH" : "NEUTRAL";

    const targets = { t1: t1Fib, t2: t2Fib, sl: slFib, buyDev, lrProjection5, lrProjection10 };
    return { targets, projectionConfidence, projectionBias };
  }

  // === MATRIX HORIZON FAZ 3: AI NLP Karar Ozeti Uretimi ===
  private generateAiSummary(
    trend: string,
    slope: number,
    confluenceScore: number,
    mtfConsensus: string,
    whaleStatus: string,
    systemDecision: string,
    f4PowerLoss: number,
    volatilityRegime: string,
    marketRegime: string,
    smcBias: string,
    sentimentScore: number,
    sweepUp: boolean,
    sweepDown: boolean,
    projectionBias: string,
    projectionConfidence: number
  ): string {
    const parts: string[] = [];

    // 1. Genel trend degerlendirmesi
    if (trend === "BULLISH" && slope > 0.05)
      parts.push("F4 guclu yukari trendi destekliyor");
    else if (trend === "BEARISH" && slope < -0.05)
      parts.push("F4 guclu asagi baski altinda");
    else if (trend === "BULLISH")
      parts.push("Zayif yukari egim mevcut");
    else if (trend === "BEARISH")
      parts.push("Zayif asagi egim mevcut");
    else
      parts.push("Yatay / kararsiz piyasa");

    // 2. Guc kaybi uyarisi
    if (f4PowerLoss > 70)
      parts.push("F4 guc kaybi kritik seviyede (" + f4PowerLoss.toFixed(0) + "%) — dikkat");
    else if (f4PowerLoss > 45)
      parts.push("F4 guc kaybediyor (" + f4PowerLoss.toFixed(0) + "%)");

    // 3. Konfluens degerlendirmesi
    if (confluenceScore >= 75)
      parts.push("Mukemmel konfluens (" + confluenceScore.toFixed(0) + ")");
    else if (confluenceScore >= 60)
      parts.push("Guclu konfluens (" + confluenceScore.toFixed(0) + ")");
    else if (confluenceScore < 45)
      parts.push("Zayif konfluens — islem onerilmez");

    // 4. Balina & Hacim
    if (whaleStatus === "BUY_ACTIVE") parts.push("Balina alim baskisi aktif");
    else if (whaleStatus === "SELL_ACTIVE") parts.push("Balina satim baskisi aktif");
    else if (whaleStatus === "DISTRIBUTION") parts.push("Dagitim fazindayiz — dikkat");

    // 5. SMC yapisi
    if (sweepUp) parts.push("Yukari stop-hunt tespit edildi — dikkatli al");
    else if (sweepDown) parts.push("Asagi stop-hunt tespit edildi — dikkatli sat");
    if (smcBias === "BULLISH") parts.push("SMC: Discount bolgesi / potansiyel alim noktasi");
    else if (smcBias === "BEARISH") parts.push("SMC: Premium bolgesi / potansiyel satim noktasi");

    // 6. Volatilite
    if (volatilityRegime === "SQUEEZE")
      parts.push("Bollinger Squeeze aktif — patlama bekleniyor");
    else if (volatilityRegime === "EXPLOSION")
      parts.push("Yuksek volatilite — risk yonetimi kritik");

    // 7. Makro / Sentiment
    if (sentimentScore < -50) parts.push("Piyasa asiri korkuda — kontrarian firsat olabilir");
    else if (sentimentScore > 70) parts.push("Asiri acgozluluk — tepe riski mevcut");

    // 8. Nihai karar
    const decisionText = systemDecision === "GO_LONG"
      ? "AL sinyali aktif"
      : systemDecision === "GO_SHORT"
        ? "SAT sinyali aktif"
        : "Bekleme modu onerilen";

    parts.push(decisionText + " | Projeksiyon: " + projectionBias + " (" + projectionConfidence.toFixed(0) + "% guven)");

    return parts.join(" • ");
  }

  // === MATRIX HORIZON FAZ 4: Kelly Kriteri Pozisyon Boyutlandirma ===
  private calculateKellyFraction(
    currentWinRate: number,
    confluenceScore: number,
    f4PowerLoss: number,
    volatilityRegime: string
  ): number {
    // Temel Kelly: f = (bp - q) / b, b = risk/reward = 1.5
    const b = 1.5; // Ortalama R:R
    const p = Math.min(0.85, Math.max(0.30, currentWinRate));
    const q = 1 - p;
    const rawKelly = (b * p - q) / b;

    // Confluence ve F4 Power Loss ile dinamik ayarlama
    const confMult = confluenceScore >= 75 ? 1.0 : confluenceScore >= 60 ? 0.75 : 0.5;
    const plMult   = f4PowerLoss > 70 ? 0.3 : f4PowerLoss > 45 ? 0.6 : 1.0;
    const volMult  = volatilityRegime === "EXPLOSION" ? 0.5 : volatilityRegime === "HIGH_VOL" ? 0.7 : 1.0;

    // Yarisik Kelly (Half-Kelly) — risk azaltma standardi
    const kelly = (rawKelly * confMult * plMult * volMult) / 2;
    return Math.max(0.01, Math.min(0.25, kelly)); // Max %25 pozisyon
  }
'@

$content = $content.Replace($old2, $new2)

# =============================================
# FAZ 3 PATCH 3: analyze() metodundaki calculateTargets cagrisi guncelleme
# ve aiSummary + Kelly entegrasyonu
# =============================================
$old3 = @'
    const { targets } = this.calculateTargets(finalHighs, finalLows, finalCloses, adaptedAtrLen, currentPrice, saeResult.finalDecision, predictionData.upProb, predictionData.downProb);
'@

$new3 = @'
    const { targets, projectionConfidence, projectionBias } = this.calculateTargets(finalHighs, finalLows, finalCloses, adaptedAtrLen, currentPrice, saeResult.finalDecision, predictionData.upProb, predictionData.downProb);

    // === MATRIX HORIZON FAZ 3: AI NLP Ozet ve Kelly Kriteri ===
    const aiSummary = this.generateAiSummary(
      trend,
      slope,
      confluenceBreakdown.totalScore,
      mtfConsensus,
      whaleStatus,
      saeResult.finalDecision,
      f4Data.f4PowerLoss,
      volatilityRegime,
      marketRegime,
      liqResult.liquidityZone,
      sentimentScore,
      smc.sweepUp,
      smc.sweepDown,
      projectionBias,
      projectionConfidence
    );

    const kellyFraction = this.calculateKellyFraction(
      this.bayesianMetrics.currentWinRate,
      confluenceBreakdown.totalScore,
      f4Data.f4PowerLoss,
      volatilityRegime
    );
'@

$content = $content.Replace($old3, $new3)

# =============================================
# FAZ 3 PATCH 4: return payload'una yeni alanlar ekle
# =============================================
$old4 = @'
    payload.f4Power = f4Power;
'@

$new4 = @'
    payload.f4Power = f4Power;
    payload.aiSummary = aiSummary;
    payload.projectionBias = projectionBias;
    payload.projectionConfidence = projectionConfidence;
    payload.kellyFraction = kellyFraction;
'@

$content = $content.Replace($old4, $new4)

# Dosyaya yaz
Set-Content -Path $engineFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "FAZ 3 Engine patch tamamlandi."
