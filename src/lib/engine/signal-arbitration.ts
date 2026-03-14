import { SMCResult, VPAResult, VolatilityRegime } from "../matrix-v5-engine";

export interface SAEInput {
  smc: SMCResult;
  whaleStatus: string;
  zScore: number;
  vpa: VPAResult;
  f4Power: number; // [-100, 100]
  f4EarlyBuy?: boolean;
  f4EarlySell?: boolean;
  f4ConfirmedBuy?: boolean;
  f4ConfirmedSell?: boolean;
  ribbonState: string;
  volatilityRegime: VolatilityRegime;
  currentWinRate: number; // 0.0 to 1.0
  rawSystemDecision: "GO_LONG" | "GO_SHORT" | "WAIT";
  isF4Priority?: boolean;
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
    aiPenalty = -30; // Increased from -15 to -30 for poor winrates
  }

  // Target direction is set by the raw decision
  const isLong = input.rawSystemDecision === "GO_LONG";

  const hasF4BuySignal = input.f4EarlyBuy || input.f4ConfirmedBuy || (isLong && input.isF4Priority);
  const hasF4SellSignal = input.f4EarlySell || input.f4ConfirmedSell || (!isLong && input.isF4Priority);

  // 2. Validation (SMC Mantık İhlali Koruması)
  
  const hasStructureConfirmationBull = input.smc.swingTrend === "BULLISH" && (input.smc.bos || input.smc.choch);
  const hasStructureConfirmationBear = input.smc.swingTrend === "BEARISH" && (input.smc.bos || input.smc.choch);
  
  // SMC Bias check
  const isBullTrend = input.smc.swingTrend === "BULLISH";
  const isBearTrend = input.smc.swingTrend === "BEARISH";
  const isNeutralTrend = input.smc.swingTrend === "NEUTRAL";

  // P4.1: Allow trade in NEUTRAL trend if confluence indicators (F4/Ribbon) are very strong
  const highConfidenceBull = isNeutralTrend && input.f4Power > 50 && input.ribbonState.includes("↑");
  const highConfidenceBear = isNeutralTrend && input.f4Power < -50 && input.ribbonState.includes("↓");

  const smcValidForBull = isBullTrend || highConfidenceBull || hasF4BuySignal;
  const smcValidForBear = isBearTrend || highConfidenceBear || hasF4SellSignal;

  if (input.rawSystemDecision === "GO_LONG" && !smcValidForBull) {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore: 100,
      aiPenalty,
      deathRiskActive,
      rejectionReason: `SMC_VIOLATION: Trend ${input.smc.swingTrend} is not valid for BUY`,
      saeConfidence: 0
    };
  }

  if (input.rawSystemDecision === "GO_SHORT" && !smcValidForBear) {
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

  // 3. Signal Fusion & Weights (SMC 40%, Flow 30%, Trend 20%, Regime 10%)
  // Calculate agreements for the given direction
  let scoreSMC = 0;
  let scoreFlow = 0;
  let scoreTrend = 0;
  let scoreRegime = 0;
  let f4BonusScore = 0; // High-weight integration for F4 Engine
  
  // F4 Direct Bonus (High tactical advantage integrated into standard scoring)
  if (isLong && hasF4BuySignal) f4BonusScore = 50;
  if (!isLong && hasF4SellSignal) f4BonusScore = 50;
  if (isLong) {
    if (isBullTrend) scoreSMC = hasStructureConfirmationBull ? 40 : 20;
    else if (highConfidenceBull || hasF4BuySignal) scoreSMC = 20; // Allow counter-trend but don't give excessive SMC points
  } else {
    if (isBearTrend) scoreSMC = hasStructureConfirmationBear ? 40 : 20;
    else if (highConfidenceBear || hasF4SellSignal) scoreSMC = 20;
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
  
  // If we have an actionable F4 signal, we max out the trend score.
  if ((isLong && hasF4BuySignal) || (!isLong && hasF4SellSignal)) {
    trendAgreement = 1.0;
  } else {
    if ((isLong && input.f4Power > 0) || (!isLong && input.f4Power < 0)) {
      trendAgreement += 0.5;
    }
    if (isLong && (input.ribbonState === "TAM HIZALANMA ↑" || input.ribbonState === "BOĞA EĞİLİM" || input.ribbonState === "NÖTR EĞİLİM ↑")) {
      trendAgreement += 0.5;
    } else if (!isLong && (input.ribbonState === "TAM HIZALANMA ↓" || input.ribbonState === "AYI EĞİLİM" || input.ribbonState === "NÖTR EĞİLİM ↓")) {
      trendAgreement += 0.5;
    }
  }
  scoreTrend = Math.min(1.0, trendAgreement) * 20;

  // Regime (10%)
  // SQUEEZE = pre-explosion, direction unknown → partial
  // EXPLOSION in correct direction → full
  // HIGH_VOL → risky, penalize slightly
  let regimeAgreement = 0.7; // NORMAL baseline
  if (input.volatilityRegime === "SQUEEZE") {
    regimeAgreement = 0.5; // Uncertain, can go either way
  } else if (input.volatilityRegime === "EXPLOSION") {
    const explosionFavorsLong = input.vpa.netPressure >= 0;
    regimeAgreement = (isLong && explosionFavorsLong) || (!isLong && !explosionFavorsLong) ? 1.0 : 0.5;
  } else if (input.volatilityRegime === "HIGH_VOL") {
    regimeAgreement = 0.4; // High vol = risky entries, lower weight
  }
  scoreRegime = regimeAgreement * 10;

  const totalAgreementScore = Math.min(100, Math.max(0, scoreSMC + scoreFlow + scoreTrend + scoreRegime + f4BonusScore + aiPenalty));
  let signalConflictScore = 100 - totalAgreementScore;

  // 4. Conflict Limit Rule (Strict: Must be < 40 conflict, i.e., > 60 score)
  if (signalConflictScore > 40) {
    return {
      finalDecision: "NO_TRADE",
      signalConflictScore,
      aiPenalty,
      deathRiskActive,
      rejectionReason: `CONFLICT_LIMIT_EXCEEDED (${signalConflictScore.toFixed(0)} > 40)`,
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
