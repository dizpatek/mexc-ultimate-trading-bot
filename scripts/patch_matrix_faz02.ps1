
# =============================================
# Matrix Horizon FAZ 2 Patch Script
# BOS/CHoCH/EQL/EQH/Premium-Discount/OrderBlock
# =============================================

$engineFile = "src/lib/matrix-v5-engine.ts"
$content = Get-Content $engineFile -Raw -Encoding UTF8

# =============================================
# FAZ 2 PATCH 1: LiquidityResult tipini genislet
# =============================================
$old1 = @'
export interface LiquidityResult {
  eqHighs: boolean;
  eqLows: boolean;
}
'@

$new1 = @'
export interface LiquidityResult {
  eqHighs: boolean;
  eqLows: boolean;
  // === MATRIX HORIZON FAZ 2: SMC Genisletilmis Likidite ===
  eqlCount: number;          // Esit tepe (Equal High) sayisi
  eqhCount: number;          // Esit dip (Equal Low) sayisi
  inPremium: boolean;        // Fiyat premium bolgede mi (>%61.8 EQ)
  inDiscount: boolean;       // Fiyat discount bolgede mi (<%.38.2 EQ)
  equilibrium: number;       // EQ orta nokta
  liquidityHuntUp: boolean;  // Yukari likidite avlanmasi ihtimali
  liquidityHuntDown: boolean; // Asagi likidite avlanmasi ihtimali
  nearestOBHigh: number;     // En yakin Bullish OB tepesi
  nearestOBLow: number;      // En yakin Bullish OB dibi
  smcBias: "BULLISH" | "BEARISH" | "NEUTRAL"; // SMC genel yanlilik
}
'@

$content = $content.Replace($old1, $new1)

# =============================================
# FAZ 2 PATCH 2: SMCResult tipini genislet
# =============================================
$old2 = @'
export interface SMCResult {
  swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  internalTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  bos: boolean;
  choch: boolean;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
}
'@

$new2 = @'
export interface SMCResult {
  swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  internalTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  bos: boolean;
  choch: boolean;
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  // === MATRIX HORIZON FAZ 2: Ek SMC Alanlar ===
  bosStrength: "STRONG" | "WEAK" | "NONE";    // BOS guc seviyesi
  chochConfirmed: boolean;                      // CHoCH volum ile onaylandi mi
  sweepUp: boolean;                             // Yukari stop hunt tespit
  sweepDown: boolean;                           // Asagi stop hunt tespit
  structureScore: number;                       // 0-100 yapı skoru
}
'@

$content = $content.Replace($old2, $new2)

# =============================================
# FAZ 2 PATCH 3: calculateSMC - tamamen yeniden yaz
# =============================================
$old3 = @'
  private calculateSMC(
    highs: number[],
    lows: number[],
    closes: number[],
    tfAdaptFactor: number = 1.0,
    intervalSec: number = 3600
  ): SMCResult {
    const len = closes.length;
    if (len < 50)
      return {
        swingTrend: "NEUTRAL",
        internalTrend: "NEUTRAL",
        bos: false,
        choch: false,
        orderBlocks: [],
        fvgs: [],
      };

    const swingLen = Math.max(5, Math.round(20 * tfAdaptFactor));
    const currentHigh = highs[len - 1];
    const currentLow = lows[len - 1];
    const currentClose = closes[len - 1];

    // Basic Pivot High/Low for structure
    const lastHigh = Math.max(...highs.slice(len - swingLen - 1, len - 1));
    const lastLow = Math.min(...lows.slice(len - swingLen - 1, len - 1));

    // EMAs for Trend Persistence (V5.4 Enhancement)
    const ema8 = this.calculateEMA(closes, this.adaptPeriod(8, tfAdaptFactor));
    const ema21 = this.calculateEMA(closes, this.adaptPeriod(21, tfAdaptFactor));
    const ema55 = this.calculateEMA(closes, this.adaptPeriod(55, tfAdaptFactor));
    const emaAlignmentBull = ema8 > ema21 && ema21 > ema55;
    const emaAlignmentBear = ema8 < ema21 && ema21 < ema55;

    let bos = false;
    let choch = false;
    let swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

    if (currentClose > lastHigh) {
      if (emaAlignmentBull) bos = true;
      else choch = true;
      swingTrend = "BULLISH";
    } else if (currentClose < lastLow) {
      if (emaAlignmentBear) bos = true;
      else choch = true;
      swingTrend = "BEARISH";
    } else {
      // P4.1: Persist trend based on EMA alignment if no fresh breakout
      if (emaAlignmentBull) swingTrend = "BULLISH";
      else if (emaAlignmentBear) swingTrend = "BEARISH";
    }

    // FVG Detection (3 bar pattern)
    const fvgs: FairValueGap[] = [];
    for (let i = len - 10; i < len - 1; i++) {
      if (highs[i] > lows[i - 2] && lows[i] < highs[i - 2]) continue; // Not a gap
      if (lows[i] > highs[i - 2]) {
        fvgs.push({ top: lows[i], bottom: highs[i - 2], type: "BULLISH" });
      } else if (highs[i] < lows[i - 2]) {
        fvgs.push({ top: lows[i - 2], bottom: highs[i], type: "BEARISH" });
      }
    }

    // Order Block Detection (Simplified)
    const orderBlocks: OrderBlock[] = [];
    if (bos || swingTrend !== "NEUTRAL") {
      orderBlocks.push({
        high: currentHigh,
        low: currentLow,
        time: Date.now(), // Fixed to original Date.now() to preserve historical behavior
        index: len - 1,
        type: swingTrend === "BULLISH" ? "BULLISH" : "BEARISH",
      });
    }

    return {
      swingTrend,
      internalTrend: swingTrend,
      bos,
      choch,
      orderBlocks: orderBlocks.slice(-5),
      fvgs: fvgs.slice(-5),
    };
  }
'@

$new3 = @'
  private calculateSMC(
    highs: number[],
    lows: number[],
    closes: number[],
    tfAdaptFactor: number = 1.0,
    intervalSec: number = 3600
  ): SMCResult {
    const len = closes.length;
    const empty: SMCResult = {
      swingTrend: "NEUTRAL", internalTrend: "NEUTRAL",
      bos: false, choch: false, orderBlocks: [], fvgs: [],
      bosStrength: "NONE", chochConfirmed: false,
      sweepUp: false, sweepDown: false, structureScore: 0,
    };
    if (len < 50) return empty;

    // === MATRIX HORIZON FAZ 2: Gercek SMC Algoritmasi ===

    // --- 1. Swing High/Low Tespiti (Zigzag benzeri) ---
    const swingLen = Math.max(3, Math.round(10 * tfAdaptFactor));
    const swingHighs: { idx: number; price: number }[] = [];
    const swingLows:  { idx: number; price: number }[] = [];

    const lookback = Math.min(len - 1, 100);
    const startIdx = len - lookback;

    for (let i = startIdx + swingLen; i < len - swingLen; i++) {
      let isHigh = true, isLow = true;
      for (let j = i - swingLen; j <= i + swingLen; j++) {
        if (j === i) continue;
        if (highs[j] >= highs[i]) isHigh = false;
        if (lows[j]  <= lows[i])  isLow  = false;
      }
      if (isHigh) swingHighs.push({ idx: i, price: highs[i] });
      if (isLow)  swingLows.push({ idx: i, price: lows[i] });
    }

    const lastSH = swingHighs[swingHighs.length - 1];
    const prevSH = swingHighs[swingHighs.length - 2];
    const lastSL = swingLows[swingLows.length - 1];
    const prevSL = swingLows[swingLows.length - 2];

    const currentClose = closes[len - 1];
    const currentHigh  = highs[len - 1];
    const currentLow   = lows[len - 1];

    // --- 2. BOS / CHoCH Tespiti ---
    // BOS: Fiyat, onceki Swing High/Low'u kiriyor VE EMA hizalama mevcut
    // CHoCH: Fiyat, onceki Swing High/Low'u kiriyor ANCAK EMA'ya karsi
    const ema8  = this.calculateEMA(closes, this.adaptPeriod(8, tfAdaptFactor));
    const ema21 = this.calculateEMA(closes, this.adaptPeriod(21, tfAdaptFactor));
    const ema55 = this.calculateEMA(closes, this.adaptPeriod(55, tfAdaptFactor));
    const emaAlignBull = ema8 > ema21 && ema21 > ema55;
    const emaAlignBear = ema8 < ema21 && ema21 < ema55;

    let bos = false, choch = false;
    let bosStrength: "STRONG" | "WEAK" | "NONE" = "NONE";
    let swingTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

    if (lastSH && currentClose > lastSH.price) {
      swingTrend = "BULLISH";
      if (emaAlignBull) {
        bos = true;
        // BOS guc: onceki iki swing high da kirildiysa STRONG
        bosStrength = (prevSH && currentClose > prevSH.price) ? "STRONG" : "WEAK";
      } else {
        choch = true; // Karsi trend kirilimi = CHoCH
      }
    } else if (lastSL && currentClose < lastSL.price) {
      swingTrend = "BEARISH";
      if (emaAlignBear) {
        bos = true;
        bosStrength = (prevSL && currentClose < prevSL.price) ? "STRONG" : "WEAK";
      } else {
        choch = true;
      }
    } else {
      if (emaAlignBull)      swingTrend = "BULLISH";
      else if (emaAlignBear) swingTrend = "BEARISH";
    }

    // --- 3. Internal Trend (Kisa Vadeli Yapi) ---
    const shortSwingLen = Math.max(2, Math.round(5 * tfAdaptFactor));
    const recentHigh = Math.max(...highs.slice(len - shortSwingLen - 1, len - 1));
    const recentLow  = Math.min(...lows.slice(len - shortSwingLen - 1, len - 1));
    let internalTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if (currentClose > recentHigh)      internalTrend = "BULLISH";
    else if (currentClose < recentLow)  internalTrend = "BEARISH";

    // --- 4. Stop Hunt / Sweep Tespiti ---
    // Sweep: Mum önce Swing H/L'yi geçiyor ama inside kapatıyor
    const sweepUp   = lastSH ? (currentHigh > lastSH.price && currentClose < lastSH.price) : false;
    const sweepDown = lastSL ? (currentLow  < lastSL.price && currentClose > lastSL.price) : false;

    // --- 5. Order Block Tespiti (Gelismis: Son imbalance oncesi mum) ---
    const orderBlocks: OrderBlock[] = [];
    const obLookback = Math.min(30, len - 3);
    for (let i = len - obLookback; i < len - 2; i++) {
      if (i < 1) continue;
      const c0 = closes[i - 1], c1 = closes[i];
      const bodySize = Math.abs(c1 - c0);
      const rangeSize = highs[i] - lows[i];
      if (rangeSize === 0) continue;
      // Guclu mum (vucudu>=%60 range) + ardindan zit yon hareketi
      const isStrong = bodySize / rangeSize >= 0.6;
      if (!isStrong) continue;

      const isBullOB  = c1 > c0 && highs[i + 1] < highs[i]; // Yukari mum + sonraki daha dusuk
      const isBearOB  = c1 < c0 && lows[i + 1]  > lows[i];  // Asagi mum + sonraki daha yuksek

      if (isBullOB) orderBlocks.push({ high: highs[i], low: lows[i], time: Date.now(), index: i, type: "BULLISH" });
      if (isBearOB) orderBlocks.push({ high: highs[i], low: lows[i], time: Date.now(), index: i, type: "BEARISH" });
    }

    // --- 6. FVG Tespiti (3 mum bosluk) ---
    const fvgs: FairValueGap[] = [];
    const fvgLookback = Math.min(20, len - 3);
    for (let i = len - fvgLookback; i < len - 1; i++) {
      if (i < 2) continue;
      const gap1 = highs[i - 2]; // 1. mum high
      const gap2 = lows[i];      // 3. mum low
      const gap3 = lows[i - 2];  // 1. mum low
      const gap4 = highs[i];     // 3. mum high
      if (gap2 > gap1) {  // Bullish FVG: [i-2].high < [i].low
        fvgs.push({ top: gap2, bottom: gap1, type: "BULLISH" });
      } else if (gap4 < gap3) {  // Bearish FVG: [i].high < [i-2].low
        fvgs.push({ top: gap3, bottom: gap4, type: "BEARISH" });
      }
    }

    // --- 7. CHoCH Hacim Dogrulama ---
    // Hacim verisi olmadigi icin yapisal dogrulama kullan:
    // CHoCH, BOS'un karsisi + iki ardisik mum ayni yone dogru kapatiliyorsa "confirmed"
    const chochConfirmed = choch && closes[len - 1] > closes[len - 2]
      ? swingTrend === "BULLISH"
      : choch && closes[len - 1] < closes[len - 2]
        ? swingTrend === "BEARISH"
        : false;

    // --- 8. Yapisal Skor (0-100) ---
    let structureScore = 0;
    if (bos)            structureScore += bosStrength === "STRONG" ? 40 : 25;
    if (chochConfirmed) structureScore += 20;
    if (sweepUp || sweepDown) structureScore += 15;
    if (swingTrend === internalTrend && swingTrend !== "NEUTRAL") structureScore += 25;
    structureScore = Math.min(100, structureScore);

    return {
      swingTrend,
      internalTrend,
      bos,
      choch,
      orderBlocks: orderBlocks.slice(-8),
      fvgs: fvgs.slice(-8),
      bosStrength,
      chochConfirmed,
      sweepUp,
      sweepDown,
      structureScore,
    };
  }
'@

$content = $content.Replace($old3, $new3)

# =============================================
# FAZ 2 PATCH 4: calculateLiquidity - EQL/EQH/Premium-Discount
# =============================================
$old4 = @'
  private calculateLiquidity(highs: number[], lows: number[]): LiquidityResult {
    const len = highs.length;
    if (len < 20) return { eqHighs: false, eqLows: false };

    const threshold = 0.001; // 0.1% for equality
    const h1 = highs[len - 1],
      h2 = highs[len - 2];
    const l1 = lows[len - 1],
      l2 = lows[len - 2];

    const eqHighs = Math.abs(h1 - h2) / ((h1 + h2) / 2) < threshold;
    const eqLows = Math.abs(l1 - l2) / ((l1 + l2) / 2) < threshold;

    return { eqHighs, eqLows };
  }
'@

$new4 = @'
  private calculateLiquidity(highs: number[], lows: number[]): LiquidityResult {
    const len = highs.length;
    const empty: LiquidityResult = {
      eqHighs: false, eqLows: false,
      eqlCount: 0, eqhCount: 0,
      inPremium: false, inDiscount: false, equilibrium: 0,
      liquidityHuntUp: false, liquidityHuntDown: false,
      nearestOBHigh: 0, nearestOBLow: 0,
      smcBias: "NEUTRAL",
    };
    if (len < 20) return empty;

    // === MATRIX HORIZON FAZ 2: Gercek Likidite Analizi ===

    // --- 1. EQL (Equal Lows) / EQH (Equal Highs) Tespiti ---
    const threshold = 0.0015; // %0.15 esitlik esigi
    const lookback = Math.min(50, len - 1);
    let eqlCount = 0; // Equal Lows sayisi (likidite havuzu asagida)
    let eqhCount = 0; // Equal Highs sayisi (likidite havuzu yukarda)

    for (let i = len - lookback; i < len - 1; i++) {
      const h1 = highs[i], h2 = highs[i + 1];
      const l1 = lows[i],  l2 = lows[i + 1];
      if (h1 > 0 && Math.abs(h1 - h2) / ((h1 + h2) / 2) < threshold) eqhCount++;
      if (l1 > 0 && Math.abs(l1 - l2) / ((l1 + l2) / 2) < threshold) eqlCount++;
    }

    const eqHighs = eqhCount >= 2;
    const eqLows  = eqlCount >= 2;

    // --- 2. Premium / Discount / Equilibrium ---
    // Bakis penceresi: son [lookback] mumlarin yuksek ve dusugu
    const windowHighs = highs.slice(len - lookback);
    const windowLows  = lows.slice(len - lookback);
    const rangeHigh = Math.max(...windowHighs);
    const rangeLow  = Math.min(...windowLows);
    const equilibrium = (rangeHigh + rangeLow) / 2;
    const currentPrice = lows[len - 1]; // Kapanisin alt kismi
    const rangeSize = rangeHigh - rangeLow;

    // Fibonacci 61.8% / 38.2% seviyeleri
    const fib618 = rangeLow + rangeSize * 0.618;
    const fib382 = rangeLow + rangeSize * 0.382;

    const inPremium  = currentPrice >= fib618;
    const inDiscount = currentPrice <= fib382;

    // --- 3. Likidite Avlanma Tehlikesi ---
    // EQH mevcut + fiyat yaklasiyorsa: yukari stop hunt riski
    // EQL mevcut + fiyat yaklasiyorsa: asagi stop hunt riski
    const nearEQH = eqHighs && Math.abs(highs[len - 1] - rangeHigh) / Math.max(rangeHigh, 1) < 0.005;
    const nearEQL = eqLows  && Math.abs(lows[len - 1]  - rangeLow)  / Math.max(rangeLow,  1) < 0.005;

    // --- 4. SMC Genel Yanlilik ---
    let smcBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    if      (inDiscount && eqLows)   smcBias = "BULLISH"; // Discount + EQL = potansiyel alim bolgesi
    else if (inPremium  && eqHighs)  smcBias = "BEARISH"; // Premium + EQH = potansiyel satim bolgesi
    else if (inDiscount)             smcBias = "BULLISH";
    else if (inPremium)              smcBias = "BEARISH";

    return {
      eqHighs, eqLows, eqlCount, eqhCount,
      inPremium, inDiscount, equilibrium,
      liquidityHuntUp:   nearEQH,
      liquidityHuntDown: nearEQL,
      nearestOBHigh: rangeHigh,
      nearestOBLow:  rangeLow,
      smcBias,
    };
  }
'@

$content = $content.Replace($old4, $new4)

# =============================================
# FAZ 2 PATCH 5: evaluateLiquidity - SMC Skoru & liquidityBonus hesabi
# =============================================
$old5 = @'
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

$new5 = @'
  private evaluateLiquidity(currentPrice: number, smc: any) {
    let inBullishOB = false, inBearishOB = false;
    let inBullishFVG = false, inBearishFVG = false;
    let nearOBDist = Infinity;

    // === MATRIX HORIZON FAZ 2: Gelismis Likidite Degerlendirmesi ===
    for (const ob of smc.orderBlocks.slice(0, 8)) {
      if (ob.type === "BULLISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBullishOB = true;
      if (ob.type === "BEARISH" && currentPrice >= ob.low && currentPrice <= ob.high) inBearishOB = true;
      // En yakin OB uzakligi (hedge bonusu icin)
      const obMid = (ob.high + ob.low) / 2;
      const dist  = Math.abs(currentPrice - obMid) / Math.max(currentPrice, 1);
      if (dist < nearOBDist) nearOBDist = dist;
    }
    for (const fvg of smc.fvgs.slice(0, 8)) {
      if (fvg.type === "BULLISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBullishFVG = true;
      if (fvg.type === "BEARISH" && currentPrice >= fvg.bottom && currentPrice <= fvg.top) inBearishFVG = true;
    }

    // Dinamik Likidite Bonusu:
    // OB icindeyse: +15, FVG icindeyse: +10, Sweep varsa: +5, Near OB (<1%): +5
    let liquidityBonus = 0;
    if (inBullishOB || inBearishOB) liquidityBonus += 15;
    if (inBullishFVG || inBearishFVG) liquidityBonus += 10;
    if (smc.sweepUp || smc.sweepDown) liquidityBonus += 5;
    if (nearOBDist < 0.01) liquidityBonus += 5;
    liquidityBonus = Math.min(25, liquidityBonus); // Maks +25 puan

    // BOS/CHoCH yapisi de skora katki saglar
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

$content = $content.Replace($old5, $new5)

# Dosyaya yaz
Set-Content -Path $engineFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "FAZ 2 Engine patch tamamlandi."
