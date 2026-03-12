import { SMCResult, VPAResult, VolatilityRegime } from "../matrix-v5-engine";

export interface SAEInput {
  smc: SMCResult;
  whaleStatus: string;
  zScore: number;
  vpa: VPAResult;
  f4Power: number; // [-100, 100]
  ribbonState: string;
  volatilityRegime: VolatilityRegime;
  currentWinRate: number; // 0.0 to 1.0
  rawSystemDecision: "GO_LONG" | "GO_SHORT" | "WAIT";
}

export interface SAEResult {
  finalDecision: "GO_LONG" | "GO_SHORT" | "NO_TRADE";
  signalConflictScore: number; // Percentage 0-100
  aiPenalty: number;
  deathRiskActive: boolean;
  rejectionReason: string | null;
  saeConfidence: number;
}

export function evaluateSAE(input: SAEInput): SAEResult {
  let deathRiskActive = false;
  let aiPenalty = 0;

  // 1. Bayesian Trust / Death Risk
  if (input.currentWinRate < 0.40) {
    deathRiskActive = true;
    aiPenalty = -15; // -15 score penalty to AI
  }

  // 2. Hard-Coded Validation (SMC Mantık İhlali Koruması)
  
  // Actually, wait, CHOCH or BOS must be present OR the trend must be strongly established
  const hasStructureConfirmationBull = input.smc.swingTrend === "BULLISH" && (input.smc.bos || input.smc.choch);
  const hasStructureConfirmationBear = input.smc.swingTrend === "BEARISH" && (input.smc.bos || input.smc.choch);
  
  // SMC Bias check (Allows entry if trend is strong even without immediate break)
  const isBullTrend = input.smc.swingTrend === "BULLISH";
  const isBearTrend = input.smc.swingTrend === "BEARISH";
  const isNeutralTrend = input.smc.swingTrend === "NEUTRAL";

  // P4.1: Allow trade in NEUTRAL trend if confluence indicators (F4/Ribbon) are very strong
  const highConfidenceBull = isNeutralTrend && input.f4Power > 50 && input.ribbonState.includes("↑");
  const highConfidenceBear = isNeutralTrend && input.f4Power < -50 && input.ribbonState.includes("↓");

  if (input.rawSystemDecision === "GO_LONG" && !isBullTrend && !highConfidenceBull) {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore: 100,
      aiPenalty,
      deathRiskActive,
      rejectionReason: `SMC_VIOLATION: Trend ${input.smc.swingTrend} is not valid for BUY`,
      saeConfidence: 0
    };
  }

  if (input.rawSystemDecision === "GO_SHORT" && !isBearTrend && !highConfidenceBear) {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore: 100,
      aiPenalty,
      deathRiskActive,
      rejectionReason: `SMC_VIOLATION: Trend ${input.smc.swingTrend} is not valid for SELL`,
      saeConfidence: 0
    };
  }

  if (input.rawSystemDecision === "WAIT") {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore: 0,
      aiPenalty,
      deathRiskActive,
      rejectionReason: "Wait Mode",
      saeConfidence: 0
    };
  }

  // Target direction is set by the raw decision
  const isLong = input.rawSystemDecision === "GO_LONG";

  // 3. Signal Fusion & Weights (SMC 40%, Flow 30%, Trend 20%, Regime 10%)
  // Calculate agreements for the given direction
  let scoreSMC = 0;
  let scoreFlow = 0;
  let scoreTrend = 0;
  let scoreRegime = 0;
  
  // SMC (40%) - Award base 20 for trend alignment, full 40 if break confirmed
  if (isLong) {
    if (isBullTrend) scoreSMC = hasStructureConfirmationBull ? 40 : 20;
    else if (highConfidenceBull) scoreSMC = 30; // High reward for strong reversal even in neutral trend
  } else {
    if (isBearTrend) scoreSMC = hasStructureConfirmationBear ? 40 : 20;
    else if (highConfidenceBear) scoreSMC = 30;
  }

  // Flow (30%) - Whale/Volume Map
  let flowAgreement = 0;
  if (Math.abs(input.zScore) > 2.0 && Math.sign(input.zScore) === (isLong ? 1 : -1)) {
    flowAgreement += 0.5; // ZScore confirming direction
  }
  if (input.vpa.state === (isLong ? "ALIM BASKISI" : "SATIM BASKISI")) {
    flowAgreement += 0.5; // VPA confirming direction
  } else if (input.vpa.state === "NÖTR") {
    // Partial agreement for neutral but stable state
    if (isLong) flowAgreement += 0.1;
  }
  scoreFlow = flowAgreement * 30;

  // Trend (20%) - F4 Power & Ribbon
  let trendAgreement = 0;
  if ((isLong && input.f4Power > 0) || (!isLong && input.f4Power < 0)) {
    trendAgreement += 0.5;
  }
  if (isLong && (input.ribbonState === "TAM HIZALANMA ↑" || input.ribbonState === "BOĞA EĞİLİM" || input.ribbonState === "NÖTR EĞİLİM ↑")) {
    trendAgreement += 0.5;
  } else if (!isLong && (input.ribbonState === "TAM HIZALANMA ↓" || input.ribbonState === "AYI EĞİLİM" || input.ribbonState === "NÖTR EĞİLİM ↓")) {
    trendAgreement += 0.5;
  }
  scoreTrend = trendAgreement * 20;

  // Regime (10%)
  let regimeAgreement = 1.0; 
  if (input.volatilityRegime === "NORMAL" || input.volatilityRegime === "EXPLOSION" || input.volatilityRegime === "SQUEEZE") {
    regimeAgreement = 1.0;
  }
  scoreRegime = regimeAgreement * 10;

  const totalAgreementScore = scoreSMC + scoreFlow + scoreTrend + scoreRegime;
  const signalConflictScore = 100 - totalAgreementScore; // The lack of agreement is conflict

  // 4. Conflict Limit Rule (Increased from 60 to 70 for higher sensitivity)
  if (signalConflictScore > 70) {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore,
      aiPenalty,
      deathRiskActive,
      rejectionReason: "CONFLICT_LIMIT_EXCEEDED",
      saeConfidence: totalAgreementScore
    };
  }

  return {
    finalDecision: isLong ? "GO_LONG" : "GO_SHORT",
    signalConflictScore,
    aiPenalty,
    deathRiskActive,
    rejectionReason: null,
    saeConfidence: totalAgreementScore
  };
}
