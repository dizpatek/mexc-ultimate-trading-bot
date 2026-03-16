
# =============================================
# Matrix Horizon FAZ 4 — Bayesian Learning Rate Adaptasyonu
# =============================================

$engineFile = "src/lib/matrix-v5-engine.ts"
$content = Get-Content $engineFile -Raw -Encoding UTF8

# =============================================
# PATCH 1: bayesianMetrics yapısını genişlet
# =============================================
$old1 = @'
  private bayesianMetrics = {
    totalSignals: 0,
    winSignals: 0,
    currentWinRate: 0.5,
  };
'@

$new1 = @'
  private bayesianMetrics = {
    totalSignals: 0,
    winSignals: 0,
    currentWinRate: 0.5,
    // === MATRIX HORIZON FAZ 4: Adaptif Öğrenme Rate ===
    emaWinRate: 0.5,      // Exponential Moving Average bazlı win rate
    learningRate: 0.15,   // Başlangıç öğrenme oranı (λ)
    recentStreak: 0,      // Art arda kazanç/kayıp serisi (+pozitif, -negatif)
    signalQualitySum: 0,  // Sinyal kalite ağırlıkları kümülatif
    regimeShiftCount: 0,  // Piyasa rejim değişim sayısı
    lastRegime: "NEUTRAL" as string,
  };
'@

$content = $content.Replace($old1, $new1)

# =============================================
# PATCH 2: updateBayesianTrust - Adaptif EMA + Quality Weight
# =============================================
$old2 = @'
  private updateBayesianTrust(isCorrect: boolean) {
    this.bayesianMetrics.totalSignals++;
    if (isCorrect) this.bayesianMetrics.winSignals++;
    this.bayesianMetrics.currentWinRate =
      this.bayesianMetrics.winSignals / this.bayesianMetrics.totalSignals;
  }
'@

$new2 = @'
  private updateBayesianTrust(
    isCorrect: boolean,
    signalQuality: number = 0.5, // 0-1 sinyal kalitesi (confluenceScore / 100)
    currentRegime: string = "NEUTRAL"
  ) {
    // === MATRIX HORIZON FAZ 4: Adaptif Bayes Öğrenme Motoru ===

    const m = this.bayesianMetrics;
    m.totalSignals++;
    if (isCorrect) m.winSignals++;

    // 1. Geleneksel kümülatif WinRate (referans)
    m.currentWinRate = m.winSignals / m.totalSignals;

    // 2. Streak takibi (art arda sonuçlar)
    if (isCorrect) {
      m.recentStreak = Math.max(0, m.recentStreak) + 1;
    } else {
      m.recentStreak = Math.min(0, m.recentStreak) - 1;
    }

    // 3. Rejim değişimi tespiti — öğrenme hızını sıfırla
    if (currentRegime !== m.lastRegime) {
      m.regimeShiftCount++;
      // Rejim degisince gecmis bilgiyi eskitmeye bas
      m.emaWinRate = (m.emaWinRate + 0.5) / 2; // Prior'a doğru çek
      m.learningRate = Math.min(0.30, m.learningRate * 1.5); // Daha hızlı adapte ol
      m.lastRegime = currentRegime;
    }

    // 4. Dinamik öğrenme oranı (λ):
    //    - Az sinyal varsa: hızlı öğren (yüksek λ)
    //    - Çok sinyal varsa: yavaş öğren, deneyime güven (düşük λ)
    //    - Kaliteli sinyal: daha güçlü güncelleme
    //    - Streak: trend varsa momentum ekle
    const baseLambda = Math.max(0.04, 0.25 / Math.sqrt(Math.max(1, m.totalSignals)));
    const qualityMult = 0.5 + signalQuality; // 0.5 - 1.5 arası
    const streakMult  = Math.abs(m.recentStreak) >= 3
      ? (isCorrect ? 1.2 : 0.8)  // Uzun kazanç serisi → güven arttır
      : 1.0;

    m.learningRate = Math.max(0.03, Math.min(0.35, baseLambda * qualityMult * streakMult));

    // 5. EMA WinRate hesabı (kaliteli, adaptif tahmin)
    const observation = isCorrect ? 1.0 : 0.0;
    m.emaWinRate = m.learningRate * (observation * qualityMult) + (1 - m.learningRate) * m.emaWinRate;
    m.emaWinRate = Math.max(0.20, Math.min(0.90, m.emaWinRate)); // Aşırı uçlara sürüklenme önlemi

    // 6. Kümülatif kalite skoru
    m.signalQualitySum += signalQuality;
  }

  // EMA WinRate'i disen bileşenler için public accessor
  public getBayesianWinRate(): number {
    return this.bayesianMetrics.emaWinRate;
  }

  public getBayesianLearningRate(): number {
    return this.bayesianMetrics.learningRate;
  }
'@

$content = $content.Replace($old2, $new2)

# =============================================
# PATCH 3: calculateWhaleTrust - emaWinRate kullan
# =============================================
$old3 = @'
  private calculateWhaleTrust(zScore: number, whaleStatus: string): number {
    let whaleTrust = this.bayesianMetrics.currentWinRate;
'@

$new3 = @'
  private calculateWhaleTrust(zScore: number, whaleStatus: string): number {
    // === MATRIX HORIZON FAZ 4: emaWinRate (adaptif) kullan ===
    let whaleTrust = this.bayesianMetrics.emaWinRate;
'@

$content = $content.Replace($old3, $new3)

# =============================================
# PATCH 4: aiComponents.bayesianWinRate - emaWinRate kullan
# =============================================
$old4 = @'
      bayesianWinRate: Math.round(this.bayesianMetrics.currentWinRate * 10),
'@

$new4 = @'
      bayesianWinRate: Math.round(this.bayesianMetrics.emaWinRate * 10),
'@

$content = $content.Replace($old4, $new4)

# =============================================
# PATCH 5: deathRisk koşulu - emaWinRate kullan
# =============================================
$old5 = @'
      deathRisk: this.bayesianMetrics.currentWinRate < 0.4 && this.bayesianMetrics.totalSignals > 5,
'@

$new5 = @'
      deathRisk: this.bayesianMetrics.emaWinRate < 0.4 && this.bayesianMetrics.totalSignals > 5,
'@

$content = $content.Replace($old5, $new5)

# =============================================
# PATCH 6: calculateKellyFraction - emaWinRate kullan (eğer mevcut currentWinRate kullanıyorsa)
# =============================================
$old6 = @'
    const kellyFraction = this.calculateKellyFraction(
      this.bayesianMetrics.currentWinRate,
'@

$new6 = @'
    const kellyFraction = this.calculateKellyFraction(
      this.bayesianMetrics.emaWinRate, // FAZ 4: adaptif EMA winrate
'@

$content = $content.Replace($old6, $new6)

# Dosyaya yaz
Set-Content -Path $engineFile -Value $content -Encoding UTF8 -NoNewline
Write-Host "FAZ 4 Bayesian Learning Rate patch tamamlandi."
