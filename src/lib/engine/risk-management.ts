// src/lib/engine/risk-management.ts

export interface RiskProfile {
  maxRiskPerTradePct: number; // e.g. 0.02 for 2%
  maxDailyDrawdownPct: number; // e.g. 0.05 for 5%
  winRate: number; // historical bayesian win rate
  profitFactor: number; // Avg Win / Avg Loss
}

export interface RiskDecision {
  positionSizePct: number; // The % of portfolio to risk
  isDefenseMode: boolean;
  reason: string | null;
}

export function evaluateRisk(
  profile: RiskProfile,
  aiConfidence: number, // 0 to 100
  currentDailyDrawdown: number, // positive value meaning % lost today
): RiskDecision {
  // 1. Drawdown Koruması (Defense Mode)
  if (currentDailyDrawdown >= profile.maxDailyDrawdownPct) {
    return {
      positionSizePct: 0,
      isDefenseMode: true,
      reason: `Daily Drawdown Limit Reached (${(currentDailyDrawdown * 100).toFixed(1)}%)`,
    };
  }

  // 2. Fractional Kelly Criterion
  // Kelly % = W - ((1 - W) / R)
  // W = Win Probability (Win Rate)
  // R = Reward to Risk Ratio (Profit Factor)
  let kellyPct = 0;
  if (profile.winRate > 0 && profile.profitFactor > 0) {
    kellyPct =
      profile.winRate - (1 - profile.winRate) / profile.profitFactor;
  }

  // Fractional Kelly (Half Kelly is standard for institutional risk)
  const fractionalKelly = Math.max(0, kellyPct * 0.5);

  // Blend Kelly with AI Confidence
  // If AI Confidence is 90%, we trust Kelly more.
  // If AI Confidence is 50%, we scale down.
  const confidenceMultiplier = Math.max(0.1, aiConfidence / 100);
  
  // Calculate final position size (cap at maxRiskPerTrade)
  let finalSize = fractionalKelly * confidenceMultiplier;
  
  // Fallback if Kelly is zero but winRate is acceptable
  if (finalSize === 0 && profile.winRate > 0.4) {
    finalSize = 0.005; // Base 0.5% risk
  }

  finalSize = Math.min(finalSize, profile.maxRiskPerTradePct);

  return {
    positionSizePct: Number(finalSize.toFixed(4)),
    isDefenseMode: false,
    reason: null,
  };
}
