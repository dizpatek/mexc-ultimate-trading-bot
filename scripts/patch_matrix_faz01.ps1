
# =============================================
# Matrix Horizon FAZ 0/1 Patch Script
# =============================================
# Çalıştırma: pwsh -File scripts/patch_matrix_faz01.ps1

$engineFile = "src/lib/matrix-v5-engine.ts"
$routeFile  = "src/app/api/indicators/f4/route.ts"
$uiFile     = "src/components/matrix-horizon/MatrixHorizon.tsx"

$content = Get-Content $engineFile -Raw -Encoding UTF8

# =============================================
# FAZ 0 PATCH 1: analyze() - sentimentScore, btcDominance, usdtDominance parametreleri
# =============================================
$old1 = @'
    fundingRate: number = 0,
    configOverrides: Partial<MatrixV5Config> = {},
    opens: number[] = [],
  ): MatrixV5Result {
'@

$new1 = @'
    fundingRate: number = 0,
    configOverrides: Partial<MatrixV5Config> = {},
    opens: number[] = [],
    // === MATRIX HORIZON FAZ 0: Makro & Sentiment Entegrasyonu ===
    sentimentScore: number = 0,  // -100 (Asiri Korku) -> +100 (Asiri Acgozluluk)
    btcDominance: number = 50,   // % BTC Dominance
    usdtDominance: number = 5,   // % USDT.D
  ): MatrixV5Result {
'@

$content = $content.Replace($old1, $new1)

# =============================================
# FAZ 0 PATCH 2: calculateConfluenceScore() - parametreler + makro carpan
# =============================================
$old2 = @'
    dynamicWeights: any,
    saeThreshold: number
  ): ConfluenceBreakdown {
'@

$new2 = @'
    dynamicWeights: any,
    saeThreshold: number,
    // === MATRIX HORIZON FAZ 1: Makro & Sentiment Carpanlari ===
    sentimentScore: number = 0,
    btcDominance: number = 50,
    usdtDominance: number = 5,
    fundingRate: number = 0
  ): ConfluenceBreakdown {
'@

$content = $content.Replace($old2, $new2)

# =============================================
# FAZ 0 PATCH 3: confluenceScore - makro carpan ekle
# =============================================
$old3 = @'
    const confluenceScore = Math.max(0, Math.min(100,
      (techScore / 40) * dynamicWeights.tech +
      (momentumScore / 30) * dynamicWeights.momentum +
      (volumeScore / 25) * activeConfig.confluenceWeightVol +
      (trendScore / 40) * dynamicWeights.trend +
      (mktScore / 25) * dynamicWeights.market +
      (timScore / 10) * activeConfig.confluenceWeightTiming +
      liquidityBonus));

    const confluenceStatus: ConfluenceStatus = confluenceScore >= saeThreshold ? "MUKEMMEL" : confluenceScore >= 65 ? "GUCLU" : confluenceScore >= 50 ? "ORTA" : confluenceScore >= saeThreshold - 20 ? "ZAYIF" : "YETERSIZ";

    return { techScore, momentumScore, volumeScore, trendScore, marketScore: mktScore, timingScore: timScore, totalScore: confluenceScore, status: confluenceStatus };
'@

$new3 = @'
    // === MATRIX HORIZON FAZ 1: Buyuk Bilesik Denklem - Makro Carpan (Phi_Makro) ===
    const sentimentMult  = 1 + (Math.max(-100, Math.min(100, sentimentScore)) * 0.001);
    const btcDomFactor   = btcDominance > 60 ? 0.92 : btcDominance < 45 ? 1.05 : 1.0;
    const usdtDomFactor  = usdtDominance > 8  ? 0.90 : usdtDominance < 4  ? 1.05 : 1.0;
    const fundingPenalty = fundingRate   > 0.05 ? 0.88 : fundingRate < -0.05 ? 1.06 : 1.0;
    const macroMult      = btcDomFactor * usdtDomFactor * fundingPenalty;

    const confluenceScore = Math.max(0, Math.min(100,
      (
        (techScore / 40) * dynamicWeights.tech +
        (momentumScore / 30) * dynamicWeights.momentum +
        (volumeScore / 25) * activeConfig.confluenceWeightVol +
        (trendScore / 40) * dynamicWeights.trend +
        (mktScore / 25) * dynamicWeights.market +
        (timScore / 10) * activeConfig.confluenceWeightTiming +
        liquidityBonus
      ) * sentimentMult * macroMult
    ));

    const confluenceStatus: ConfluenceStatus = confluenceScore >= saeThreshold ? "MUKEMMEL" : confluenceScore >= 65 ? "GUCLU" : confluenceScore >= 50 ? "ORTA" : confluenceScore >= saeThreshold - 20 ? "ZAYIF" : "YETERSIZ";

    return { techScore, momentumScore, volumeScore, trendScore, marketScore: mktScore, timingScore: timScore, totalScore: confluenceScore, status: confluenceStatus };
'@

$content = $content.Replace($old3, $new3)

# =============================================
# FAZ 0 PATCH 4: calculateConfluenceScore() cagrisina sentiment+dominance ekle
# =============================================
$old4 = @'
      { tech: 25, momentum: 25, market: 25, trend: 25 },
      saeThreshold
    );
'@

$new4 = @'
      { tech: 25, momentum: 25, market: 25, trend: 25 },
      saeThreshold,
      sentimentScore,
      btcDominance,
      usdtDominance,
      fundingRate
    );
'@

$content = $content.Replace($old4, $new4)

# =============================================
# FAZ 0 PATCH 5: F4 Power Loss - yonsel hesap
# =============================================
$old5 = @'
    const f4SlopeStrength = Math.abs(f4Slope);
    const slopeHistory: number[] = [];
    const lb = Math.min(autoParams.lookback, f4WholeSeries.length - 2);
    for (let i = 0; i < lb; i++) {
        const idx = f4WholeSeries.length - 1 - i;
        slopeHistory.push(Math.abs(f4WholeSeries[idx] - (f4WholeSeries[idx - 1] || f4WholeSeries[idx])));
    }
    const f4SlopeMax = slopeHistory.length > 0 ? Math.max(...slopeHistory, f4SlopeStrength) : f4SlopeStrength;
    const f4PowerLoss = f4SlopeMax > 0.00001 ? ((f4SlopeMax - f4SlopeStrength) / f4SlopeMax) * 100 : 0;
'@

$new5 = @'
    // === MATRIX HORIZON FAZ 0: Yonsel F4 Power Loss ===
    // Eski mutlak deger mantigi V-Turn'lerde gec tetikleniyordu.
    // Yeni: Sadece mevcut trend yonundeki slope zayiflamasini olcer.
    const slopeHistory: number[] = [];
    const lb = Math.min(autoParams.lookback, f4WholeSeries.length - 2);
    for (let i = 0; i < lb; i++) {
        const idx = f4WholeSeries.length - 1 - i;
        slopeHistory.push(f4WholeSeries[idx] - (f4WholeSeries[idx - 1] || f4WholeSeries[idx]));
    }
    let f4PowerLoss: number;
    if (f4Slope >= 0) {
        const peakSlope = slopeHistory.length > 0 ? Math.max(...slopeHistory, f4Slope) : f4Slope;
        f4PowerLoss = peakSlope > 0.00001 ? ((peakSlope - f4Slope) / peakSlope) * 100 : 0;
    } else {
        const troughSlope = slopeHistory.length > 0 ? Math.min(...slopeHistory, f4Slope) : f4Slope;
        f4PowerLoss = troughSlope < -0.00001 ? ((f4Slope - troughSlope) / Math.abs(troughSlope)) * 100 : 0;
    }
    f4PowerLoss = Math.max(0, Math.min(100, f4PowerLoss));
    const f4SlopeStrength = Math.abs(f4Slope);
'@

$content = $content.Replace($old5, $new5)

# =============================================
# FAZ 1 PATCH 6: Sahte MTF yerine 5-katmanli gercek MTF konsensus
# =============================================
$old6 = @'
    const bullIndicators = [slope > 0, macdBull, st.bull, rsi > 50, adx.diPlus > adx.diMinus].filter(Boolean).length;
    const mtfConsensusStr = `${bullIndicators}/5 ${bullIndicators >= 4 ? "GUCLU BOGA" : bullIndicators <= 1 ? "GUCLU AYI" : bullIndicators >= 3 ? "BOGA" : "KARISIK"}`;
'@

$new6 = @'
    // === MATRIX HORIZON FAZ 1: Gercek 5-Katmanli MTF Konsensus Motoru ===
    const mtfLayers = [
      { signal: slope > 0,                               weight: 25 }, // K1: F4 Trend Yonu
      { signal: macdBull && rsi > 50,                    weight: 20 }, // K2: Momentum Uzlasi
      { signal: isWhale || currentVolume > volSMA * 1.2, weight: 20 }, // K3: Hacim Gucu
      { signal: trendUp,                                 weight: 20 }, // K4: Yapisal EMA Trendi
      { signal: adx.diPlus > adx.diMinus,               weight: 15 }, // K5: ADX Yon
    ];
    const totalMtfW  = mtfLayers.reduce((s, l) => s + l.weight, 0);
    const mtfBullW   = mtfLayers.filter(l => l.signal).reduce((s, l) => s + l.weight, 0);
    const mtfBullPct = totalMtfW > 0 ? (mtfBullW / totalMtfW) * 100 : 0;
    const bullIndicators = mtfLayers.filter(l => l.signal).length;
    const mtfLabel   = mtfBullPct >= 80 ? "GUCLU BOGA" : mtfBullPct >= 60 ? "BOGA" :
                       mtfBullPct <= 20 ? "GUCLU AYI"  : mtfBullPct <= 40 ? "AYI" : "KARISIK";
    const mtfConsensusStr = `${bullIndicators}/5 ${mtfLabel} [${mtfBullPct.toFixed(0)}%]`;
'@

$content = $content.Replace($old6, $new6)

# Dosyaya yaz
Set-Content -Path $engineFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "Engine patch tamamlandi."

# =============================================
# ROUTE PATCH: sentimentScore, btcDominance, usdtDominance parametreleri
# =============================================
$routeContent = Get-Content $routeFile -Raw -Encoding UTF8

$routeOld1 = @'
  const riskMode =
    (searchParams.get("riskMode") as "safe" | "normal" | "aggressive") ||
    "normal";
  const symbolUpper = symbol.toUpperCase();
'@

$routeNew1 = @'
  const riskMode =
    (searchParams.get("riskMode") as "safe" | "normal" | "aggressive") ||
    "normal";
  // === MATRIX HORIZON: Makro & Sentiment Parametreleri ===
  const sentimentScore = parseFloat(searchParams.get("sentiment") || "0");
  const btcDominance = parseFloat(searchParams.get("btcDom") || "50");
  const usdtDominance = parseFloat(searchParams.get("usdtDom") || "5");
  const symbolUpper = symbol.toUpperCase();
'@

$routeContent = $routeContent.Replace($routeOld1, $routeNew1)

$routeOld2 = @'
      fundingRate || 0,
      {
        tradeMode: resolveTradeMode(botConfig),
      }
    );
'@

$routeNew2 = @'
      fundingRate || 0,
      {
        tradeMode: resolveTradeMode(botConfig),
      },
      [], // opens (Heikin Ashi opsiyonel)
      // === MATRIX HORIZON: Makro & Sentiment koprüsü ===
      isNaN(sentimentScore) ? 0 : sentimentScore,
      isNaN(btcDominance) ? 50 : btcDominance,
      isNaN(usdtDominance) ? 5 : usdtDominance
    );
'@

$routeContent = $routeContent.Replace($routeOld2, $routeNew2)
Set-Content -Path $routeFile -Value $routeContent -Encoding UTF8 -NoNewline
Write-Host "Route patch tamamlandi."

# =============================================
# UI PATCH: fetchSignal API URL'e sentiment+dominance ekle
# =============================================
$uiContent = Get-Content $uiFile -Raw -Encoding UTF8

$uiOld = @'
            `/indicators/f4?symbol=${activeSymbol}&interval=${interval}&riskMode=${riskMode}`,
'@

$uiNew = @'
            `/indicators/f4?symbol=${activeSymbol}&interval=${interval}&riskMode=${riskMode}${sentiment ? `&sentiment=${sentiment.score}` : ""}&btcDom=${btcDom}&usdtDom=${usdtDom}`,
'@

$uiContent = $uiContent.Replace($uiOld, $uiNew)

$uiOld2 = @'
    [interval, riskMode, activeSymbol],
'@

$uiNew2 = @'
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [interval, riskMode, activeSymbol, sentiment?.score, btcDom, usdtDom],
'@

$uiContent = $uiContent.Replace($uiOld2, $uiNew2)
Set-Content -Path $uiFile -Value $uiContent -Encoding UTF8 -NoNewline
Write-Host "UI patch tamamlandi."

Write-Host ""
Write-Host "=== MATRIX HORIZON FAZ 0/1 PATCH TAMAMLANDI ==="
