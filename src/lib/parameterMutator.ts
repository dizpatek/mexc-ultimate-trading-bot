/**
 * parameterMutator.ts — MexC AutoResearch Parameter Search Engine
 *
 * Üç arama stratejisi:
 * 1. Random Search  — hızlı uzay keşfi
 * 2. Hill Climbing  — en iyi komşuya doğru ilerle
 * 3. Bayesian-lite  — Gaussian process benzeri basit upper confidence bound
 */

import type { BacktestParams } from "./backtester";

// ────────────────────────────────────────────────
// Parameter Space Definition
// ────────────────────────────────────────────────

export interface ParamRange {
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
  isBool?: boolean;
}

export const PARAM_SPACE: Record<keyof BacktestParams, ParamRange> = {
  // Engine
  ai_threshold: { min: 40, max: 95, step: 5, isInt: true },
  f4_length: { min: 5, max: 30, step: 1, isInt: true },
  f4_multiplier: { min: 0.5, max: 8.0, step: 0.1 },
  whale_multiplier: { min: 1.0, max: 6.0, step: 0.1 },
  f4_power_loss_threshold: { min: 50, max: 99, step: 1, isInt: true },
  f4_lookback_bars: { min: 10, max: 60, step: 5, isInt: true },
  f4_squeeze_threshold: { min: 5, max: 45, step: 1, isInt: true },
  min_power_loss: { min: 50, max: 99, step: 1, isInt: true },
  f4_slope_threshold: { min: 0.0001, max: 0.05, step: 0.0005 },

  // Trade (LONG)
  pilot_tp_percent: { min: 0.5, max: 15.0, step: 0.1 },
  pilot_sl_percent: { min: 0.8, max: 8.0, step: 0.1 }, // MIN raised to 0.8% to prevent premature stops
  pilot_tp_trailing: { min: 0, max: 1, step: 1, isBool: true },
  pilot_tp_deviation: { min: 0.05, max: 5.0, step: 0.05 },
  pilot_sl_trailing: { min: 0, max: 1, step: 1, isBool: true },
  pilot_sl_deviation: { min: 0.05, max: 5.0, step: 0.05 },

  // Cover (SHORT)
  cover_tp_percent: { min: 0.3, max: 12.0, step: 0.1 },
  cover_sl_percent: { min: 0.8, max: 6.0, step: 0.1 }, // MIN raised to 0.8% to prevent premature stops
  cover_tp_trailing: { min: 0, max: 1, step: 1, isBool: true },
  cover_tp_deviation: { min: 0.05, max: 4.0, step: 0.05 },
  cover_sl_trailing: { min: 0, max: 1, step: 1, isBool: true },
  cover_sl_deviation: { min: 0.05, max: 4.0, step: 0.05 },

  // Pilot Control
  pilot_trailing_buy: { min: 0, max: 1, step: 1, isBool: true },
  pilot_trade_allocation: { min: 3, max: 30, step: 1, isInt: true },

  // MTF
  pilot_mtf_veto: { min: 0, max: 1, step: 1, isBool: true },
  pilot_mtf_threshold: { min: 40, max: 95, step: 5, isInt: true },
  pilot_mtf_long_threshold: { min: -100, max: 100, step: 5, isInt: true },
  pilot_mtf_short_threshold: { min: -100, max: 100, step: 5, isInt: true },

  // Signal Freshness
  trade_freshness_bars: { min: 1, max: 20, step: 1, isInt: true },

  // Expanded Engine Overrides (V2.1)
  rsi_period: { min: 7, max: 21, step: 1, isInt: true },
  rsi_ob: { min: 60, max: 85, step: 1, isInt: true },
  rsi_os: { min: 15, max: 40, step: 1, isInt: true },
  adx_threshold: { min: 15, max: 45, step: 1, isInt: true },
  macd_fast: { min: 8, max: 16, step: 1, isInt: true },
  macd_slow: { min: 21, max: 34, step: 1, isInt: true },
  macd_signal: { min: 5, max: 13, step: 1, isInt: true },
  stoch_rsi_len: { min: 10, max: 20, step: 1, isInt: true },
};

// Baseline (current production-like defaults)
export const DEFAULT_PARAMS: BacktestParams = {
  ai_threshold: 70,
  f4_length: 10,
  f4_multiplier: 1.2,
  whale_multiplier: 1.8,
  f4_power_loss_threshold: 90,
  f4_lookback_bars: 30,
  f4_squeeze_threshold: 20,
  min_power_loss: 90,
  f4_slope_threshold: 0.01,

  pilot_tp_percent: 3.0,
  pilot_sl_percent: 1.5,
  pilot_tp_trailing: true,
  pilot_tp_deviation: 0.5,
  pilot_sl_trailing: true,
  pilot_sl_deviation: 0.5,

  cover_tp_percent: 1.1,
  cover_sl_percent: 0.8,
  cover_tp_trailing: true,
  cover_tp_deviation: 0.11,
  cover_sl_trailing: true,
  cover_sl_deviation: 0.2,

  pilot_trailing_buy: true,
  pilot_trade_allocation: 10,

  pilot_mtf_veto: true,
  pilot_mtf_threshold: 75,
  pilot_mtf_long_threshold: 20,
  pilot_mtf_short_threshold: 20,

  trade_freshness_bars: 5,

  // V2.1 Defaults
  rsi_period: 14,
  rsi_ob: 70,
  rsi_os: 30,
  adx_threshold: 25,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  stoch_rsi_len: 14,
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

/**
 * step büyüklüğüne göre yuvarlanacak ondalık basamak sayısını hesaplar.
 * Örn: step=0.1 → 1, step=0.05 → 2, step=0.0005 → 4
 */
function stepDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.max(0, -Math.floor(Math.log10(step)));
}

function snapToStep(value: number, range: ParamRange): number {
  if (range.isBool) return value >= 0.5;
  const decimals = stepDecimals(range.step);
  const factor = Math.pow(10, decimals);

  // Önce tam sayı uzayında yuvarla (hassasiyeti korumak için)
  const snapped =
    Math.round((value - range.min) / range.step) * range.step + range.min;
  const clamped = Math.max(range.min, Math.min(range.max, snapped));

  if (range.isInt) return Math.round(clamped);

  // IEEE-754 precision fix: toFixed + parseFloat ile tam temizlik
  return parseFloat(clamped.toFixed(decimals));
}

function randomInRange(range: ParamRange): number | boolean {
  if (range.isBool) return Math.random() > 0.5;
  const decimals = stepDecimals(range.step);

  const steps = Math.floor((range.max - range.min) / range.step);
  const chosen =
    Math.floor(Math.random() * (steps + 1)) * range.step + range.min;

  if (range.isInt) return Math.round(chosen);

  // IEEE-754 precision fix
  return parseFloat(chosen.toFixed(decimals));
}

// ────────────────────────────────────────────────
// Strategy 1: Random Search
// ────────────────────────────────────────────────

/**
 * Generates a fully random parameter set within the space.
 * Use this for broad exploration at the start.
 */
export function randomParams(): BacktestParams {
  const result = {} as Record<keyof BacktestParams, number | boolean>;
  for (const [key, range] of Object.entries(PARAM_SPACE)) {
    result[key as keyof BacktestParams] = randomInRange(range) as
      | number
      | boolean;
  }
  return result as unknown as BacktestParams;
}

// ────────────────────────────────────────────────
// Strategy 2: Hill Climbing — neighbour mutation
// ────────────────────────────────────────────────

/**
 * Creates a neighbour of the given params by perturbing a random subset.
 * @param base       - current best params
 * @param numMutations - how many fields to change (default: 3)
 * @param temperature  - perturbation scale 0–1 (higher = wilder jumps)
 */
export function mutateParams(
  base: BacktestParams,
  numMutations = 3,
  temperature = 0.3,
): BacktestParams {
  const clone: Record<string, number | boolean> = {};
  (Object.keys(PARAM_SPACE) as Array<keyof BacktestParams>).forEach((key) => {
    clone[key as string] = base[key];
  });
  const keys = Object.keys(PARAM_SPACE) as Array<keyof BacktestParams>;

  // Randomly pick which keys to mutate
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const toMutate = shuffled.slice(0, numMutations);

  for (const key of toMutate) {
    const range = PARAM_SPACE[key];
    if (range.isBool) {
      // Flip boolean with probability proportional to temperature
      if (Math.random() < temperature) {
        clone[key as string] = !(clone[key as string] as boolean);
      }
      continue;
    }

    const currentVal = clone[key as string] as number;
    const spanSteps = (range.max - range.min) / range.step;
    // Gaussian-like perturbation centered on current value
    const maxDelta = Math.max(1, Math.round(spanSteps * temperature));
    const delta =
      (Math.floor(Math.random() * (2 * maxDelta + 1)) - maxDelta) * range.step;
    const newVal = snapToStep(currentVal + delta, range);
    clone[key as string] = newVal;
  }

  return clone as unknown as BacktestParams;
}

// ────────────────────────────────────────────────
// Strategy 3: Bayesian-Lite UCB
// ────────────────────────────────────────────────

export interface UCBEntry {
  params: BacktestParams;
  score: number;
  visits: number;
  totalScore: number;
}

/**
 * Upper Confidence Bound selection.
 * Pick the candidate with highest: mean_score + c * sqrt(ln(total_visits) / visits)
 * Or add a new random candidate if pool is small.
 */
export function ucbSelect(
  pool: UCBEntry[],
  totalVisits: number,
  explorationC = 2,
  poolSize = 20,
): BacktestParams {
  // Ensure minimum pool diversity
  if (pool.length < poolSize) {
    return randomParams();
  }

  let bestUCB = -Infinity;
  let bestEntry = pool[0];
  const logTotal = Math.log(Math.max(totalVisits, 1));

  for (const entry of pool) {
    const meanScore = entry.totalScore / entry.visits;
    const ucb = meanScore + explorationC * Math.sqrt(logTotal / entry.visits);
    if (ucb > bestUCB) {
      bestUCB = ucb;
      bestEntry = entry;
    }
  }

  // Mutate around the UCB winner for exploitation
  return mutateParams(bestEntry.params, 2, 0.2);
}

// ────────────────────────────────────────────────
// Phase controller
// ────────────────────────────────────────────────

export type SearchPhase = "random" | "hillclimb" | "ucb" | "ai_guided";

export function getSearchPhase(experimentCount: number): SearchPhase {
  if (experimentCount < 20) return "random";
  if (experimentCount < 60) return "hillclimb";
  return "ucb";
}

// ────────────────────────────────────────────────
// AI-Guided Search (Karpathy Loop)
// ────────────────────────────────────────────────

/** Son AI Insight metni burada tutulur (autoResearch.ts tarafından set edilir) */
let _latestAiHint: string | null = null;

/** AI'dan gelen hipotez metnini kaydeder */
export function setAiSearchHint(hint: string) {
  _latestAiHint = hint.toLowerCase();
}

/**
 * AI Insight metnini parse ederek parametre arama aralığını daraltır.
 * Örn: "TSL" → stop loss parametrelerine odaklan
 *      "slope" → f4_slope_threshold aralığını sıkılaştır
 *      "TP" → take profit parametrelerine odaklan
 */
export function aiGuidedParams(bestParams: BacktestParams): BacktestParams {
  const hint = _latestAiHint || "";
  const clone = { ...bestParams } as Record<string, any>;

  // --- Keyword → parametre mapping ---
  if (
    hint.includes("tsl") ||
    hint.includes("stop loss") ||
    hint.includes("trailing stop")
  ) {
    // Stop loss aralığını sıkılaştır
    const slRange = PARAM_SPACE["pilot_sl_percent"];
    const current = clone["pilot_sl_percent"] as number;
    const tighter = Math.max(slRange.min, current - slRange.step * 2);
    clone["pilot_sl_percent"] = snapToStep(tighter, slRange) as number;
    clone["pilot_sl_trailing"] = true;
  }

  if (
    hint.includes("ttp") ||
    hint.includes("take profit") ||
    hint.includes("tp oran")
  ) {
    // Take profit aralığını genişlet
    const tpRange = PARAM_SPACE["pilot_tp_percent"];
    const current = clone["pilot_tp_percent"] as number;
    const wider = Math.min(tpRange.max, current + tpRange.step * 2);
    clone["pilot_tp_percent"] = snapToStep(wider, tpRange) as number;
    clone["pilot_tp_trailing"] = true;
  }

  if (hint.includes("slope") || hint.includes("eğim")) {
    const range = PARAM_SPACE["f4_slope_threshold"];
    const current = clone["f4_slope_threshold"] as number;
    clone["f4_slope_threshold"] = snapToStep(
      current + range.step,
      range,
    ) as number;
  }

  if (
    hint.includes("mtf") ||
    hint.includes("multi timeframe") ||
    hint.includes("zaman dilimi")
  ) {
    clone["pilot_mtf_veto"] = true;
    const range = PARAM_SPACE["pilot_mtf_threshold"];
    const current = clone["pilot_mtf_threshold"] as number;
    clone["pilot_mtf_threshold"] = snapToStep(
      current + range.step,
      range,
    ) as number;
  }

  if (hint.includes("whale") || hint.includes("balina")) {
    const range = PARAM_SPACE["whale_multiplier"];
    const current = clone["whale_multiplier"] as number;
    clone["whale_multiplier"] = snapToStep(
      current + range.step,
      range,
    ) as number;
  }

  // Eğer hiçbir keyword eşleşmediyse küçük bir mutation yap
  const hasChanged = JSON.stringify(clone) !== JSON.stringify(bestParams);
  if (!hasChanged) {
    return mutateParams(bestParams, 2, 0.15);
  }

  return clone as unknown as BacktestParams;
}

/**
 * Main entry point: returns the next parameter set to test based on phase.
 */
export function nextParams(
  experimentCount: number,
  bestParams: BacktestParams | null,
  ucbPool: UCBEntry[],
  totalUCBVisits: number,
  forcePhase?: SearchPhase,
): BacktestParams {
  const phase = forcePhase || getSearchPhase(experimentCount);

  switch (phase) {
    case "random":
      return randomParams();

    case "hillclimb":
      if (!bestParams) return randomParams();
      // Temperature decreases as experiments increase
      const temp = Math.max(0.1, 0.5 - (experimentCount - 20) / 200);
      return mutateParams(bestParams, 3, temp);

    case "ucb":
      return ucbSelect(ucbPool, totalUCBVisits);

    case "ai_guided":
      if (!bestParams) return randomParams();
      return aiGuidedParams(bestParams);
  }
}
