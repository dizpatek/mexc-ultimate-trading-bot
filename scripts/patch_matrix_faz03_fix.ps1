
# =============================================
# Matrix Horizon FAZ 3 Fix: Payload + evaluateLiquidity
# =============================================

$engineFile = "src/lib/matrix-v5-engine.ts"
$content = Get-Content $engineFile -Raw -Encoding UTF8

# =============================================
# FIX 1: payload nesnesine FAZ 3 alanlari ekle
# =============================================
$old1 = @'
      mtfWeightedScore: 0,
      dynamicWeights: { tech: 25, momentum: 25, market: 25, trend: 25 },
      mtfBullCount: bullIndicators,
      indicatorBullCount: bullIndicators,
    };
    return payload;
  }
'@

$new1 = @'
      mtfWeightedScore: 0,
      dynamicWeights: { tech: 25, momentum: 25, market: 25, trend: 25 },
      mtfBullCount: bullIndicators,
      indicatorBullCount: bullIndicators,
      // === MATRIX HORIZON FAZ 3: Projeksiyon ve AI NLP alanlari ===
      aiSummary: "",
      projectionBias: "NEUTRAL" as const,
      projectionConfidence: 50,
      kellyFraction: 0.05,
    };
    return payload;
  }
'@

$content = $content.Replace($old1, $new1)

# =============================================
# FIX 2: payload.f4Power sonrasina FAZ 3 degerleri set et
# =============================================
$old2 = @'
    payload.f4Power = f4Power;
    payload.aiSummary = aiSummary;
    payload.projectionBias = projectionBias;
    payload.projectionConfidence = projectionConfidence;
    payload.kellyFraction = kellyFraction;
'@

# Bu zaten mevcut — sadece dogrulama icin; eger yukarda patch calisti ise bunu atla
# Eger calismadiysa asagidaki FIX 2b ile yakala

$check2 = $content.Contains("payload.aiSummary = aiSummary")
if (-not $check2) {
    $old2b = @'
    payload.f4Power = f4Power;
'@
    $new2b = @'
    payload.f4Power = f4Power;
    payload.aiSummary = aiSummary;
    payload.projectionBias = projectionBias;
    payload.projectionConfidence = projectionConfidence;
    payload.kellyFraction = kellyFraction;
'@
    $content = $content.Replace($old2b, $new2b)
    Write-Host "FIX 2b uygulandı: payload FAZ 3 degerleri eklendi."
}
else {
    Write-Host "FIX 2: zaten mevcut, atlandı."
}

# =============================================
# FIX 3: evaluateLiquidity hala eski ise guncelle
# =============================================
$hasNewEval = $content.Contains("Gelismis Likidite Degerlendirmesi")
if (-not $hasNewEval) {
    $old3 = @'
  private evaluateLiquidity(currentPrice: number, smc: any) {
    let inBullishOB = false, inBearishOB = false;
    let inBullishFVG = false, inBearishFVG = false;

    for (const ob of smc.orderBlocks.slice(0, 5)) {
      if (ob.type === "BULLISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
      if (ob.type === "BEARISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
    }
    for (const fvg of smc.fvgs.slice(0, 5)) {
      if (fvg.type === "BULLISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
      if (fvg.type === "BEARISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
    }

    const liquidityBonus = inBullishOB || inBullishFVG || inBearishOB || inBearishFVG ? 10 : 0;
    const liquidityZone = inBullishOB ? "OB BOGA" : inBearishOB ? "OB AYI" : inBullishFVG ? "FVG BOGA" : inBearishFVG ? "FVG AYI" : "YOK";
    return { liquidityBonus, liquidityZone };
  }
'@

    # Turkce karakter olmayan hale bak
    $evalOld = $content | Select-String -Pattern "private evaluateLiquidity" -SimpleMatch
    if ($evalOld) {
        Write-Host "evaluateLiquidity bulundu. FAZ 2 guncellemesi uygulanacak."
        # Dogrudan metni bul (TR karakter ile)
        $startMarker = "  private evaluateLiquidity(currentPrice: number, smc: any) {"
        $endMarker = "    return { liquidityBonus, liquidityZone };"
        $startIdx = $content.IndexOf($startMarker)
        if ($startIdx -ge 0) {
            $endIdx = $content.IndexOf($endMarker, $startIdx) + $endMarker.Length + 2 # +2 for CRLF
            $blockToReplace = $content.Substring($startIdx, $endIdx - $startIdx)
            $newBlock = @'
  private evaluateLiquidity(currentPrice: number, smc: any) {
    let inBullishOB = false, inBearishOB = false;
    let inBullishFVG = false, inBearishFVG = false;
    let nearOBDist = Infinity;

    // === MATRIX HORIZON FAZ 2: Gelismis Likidite Degerlendirmesi ===
    for (const ob of smc.orderBlocks.slice(0, 8)) {
      if (ob.type === "BULLISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
      if (ob.type === "BEARISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
      const obMid = (ob.high + ob.low) / 2;
      const dist  = Math.abs(currentPrice - obMid) / Math.max(currentPrice, 1);
      if (dist < nearOBDist) nearOBDist = dist;
    }
    for (const fvg of smc.fvgs.slice(0, 8)) {
      if (fvg.type === "BULLISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
      if (fvg.type === "BEARISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
    }

    let liquidityBonus = 0;
    if (inBullishOB || inBearishOB) liquidityBonus += 15;
    if (inBullishFVG || inBearishFVG) liquidityBonus += 10;
    if (smc.sweepUp || smc.sweepDown) liquidityBonus += 5;
    if (nearOBDist < 0.01) liquidityBonus += 5;
    liquidityBonus = Math.min(25, liquidityBonus);
    if (smc.bos && smc.bosStrength === "STRONG") liquidityBonus = Math.min(25, liquidityBonus + 5);

    const liquidityZone = inBullishOB ? "OB BOGA (" + (smc.bosStrength || "-") + ")"
      : inBearishOB  ? "OB AYI (" + (smc.bosStrength || "-") + ")"
      : inBullishFVG ? "FVG BOGA"
      : inBearishFVG ? "FVG AYI"
      : smc.sweepUp  ? "SWEEP YUKARI"
      : smc.sweepDown ? "SWEEP ASAGI"
      : "YOK";

    return { liquidityBonus, liquidityZone };
  }
'@
            $content = $content.Replace($blockToReplace, $newBlock)
            Write-Host "evaluateLiquidity FAZ 2 guncellendi."
        }
    }
}
else {
    Write-Host "FAZ 2 evaluateLiquidity zaten guncel, atlandı."
}

# Dosyaya yaz
Set-Content -Path $engineFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "FAZ 3 Fix tamamlandi."
