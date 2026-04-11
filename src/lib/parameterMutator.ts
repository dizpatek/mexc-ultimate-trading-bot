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
  ai_threshold:            { min: 45, max: 85, step: 5,    isInt: true  },
  f4_length:               { min: 6,  max: 20, step: 2,    isInt: true  },
  f4_multiplier:           { min: 0.5, max: 5.0, step: 0.5             },
  whale_multiplier:        { min: 1.0, max: 4.0, step: 0.5             },
  f4_power_loss_threshold: { min: 60, max: 98, step: 5,    isInt: true  },
  f4_lookback_bars:        { min: 15, max: 50, step: 5,    isInt: true  },
  f4_squeeze_threshold:    { min: 10, max: 35, step: 5,    isInt: true  },
  min_power_loss:          { min: 60, max: 98, step: 5,    isInt: true  },
  f4_slope_threshold:      { min: 0.001, max: 0.05, step: 0.005        },

  // Trade
  pilot_tp_percent:        { min: 1.0, max: 8.0, step: 0.5             },
  pilot_sl_percent:        { min: 0.5, max: 4.0, step: 0.25            },
  pilot_tp_trailing:       { min: 0, max: 1, step: 1, isBool: true     },
  pilot_tp_deviation:      { min: 0.1, max: 2.5, step: 0.2             },
  pilot_sl_trailing:       { min: 0, max: 1, step: 1, isBool: true     },
  pilot_sl_deviation:      { min: 0.1, max: 2.5, step: 0.2             },

  // MTF
  pilot_mtf_veto:           { min: 0, max: 1, step: 1, isBool: true    },
  pilot_mtf_threshold:      { min: 50, max: 90, step: 10, isInt: true  },
  pilot_mtf_long_threshold: { min: 10, max: 40, step: 5,  isInt: true  },
  pilot_mtf_short_threshold:{ min: 10, max: 40, step: 5,  isInt: true  },
};

// Baseline (current production-like defaults)
export const DEFAULT_PARAMS: BacktestParams = {
  ai_threshold: 65,
  f4_length: 10,
  f4_multiplier: 1.0,
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

  pilot_mtf_veto: true,
  pilot_mtf_threshold: 70,
  pilot_mtf_long_threshold: 20,
  pilot_mtf_short_threshold: 20,
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function snapToStep(value: number, range: ParamRange): number | boolean {
  if (range.isBool) return value >= 0.5;
  const snapped = Math.round((value - range.min) / range.step) * range.step + range.min;
  const clamped = Math.max(range.min, Math.min(range.max, snapped));
  return range.isInt ? Math.round(clamped) : Math.round(clamped / range.step) * range.step;
}

function randomInRange(range: ParamRange): number | boolean {
  if (range.isBool) return Math.random() > 0.5;
  const steps = Math.floor((range.max - range.min) / range.step);
  const chosen = Math.floor(Math.random() * (steps + 1)) * range.step + range.min;
  return range.isInt ? Math.round(chosen) : Math.round(chosen / range.step) * range.step;
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
    result[key as keyof BacktestParams] = randomInRange(range) as number | boolean;
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
  const clone = { ...base } as Record<string, unknown>;
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
    const spanSteps  = (range.max - range.min) / range.step;
    // Gaussian-like perturbation centered on current value
    const maxDelta   = Math.max(1, Math.round(spanSteps * temperature));
    const delta      = (Math.floor(Math.random() * (2 * maxDelta + 1)) - maxDelta) * range.step;
    const newVal     = snapToStep(currentVal + delta, range);
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

  let bestUCB   = -Infinity;
  let bestEntry = pool[0];
  const logTotal = Math.log(Math.max(totalVisits, 1));

  for (const entry of pool) {
    const meanScore = entry.totalScore / entry.visits;
    const ucb       = meanScore + explorationC * Math.sqrt(logTotal / entry.visits);
    if (ucb > bestUCB) {
      bestUCB   = ucb;
      bestEntry = entry;
    }
  }

  // Mutate around the UCB winner for exploitation
  return mutateParams(bestEntry.params, 2, 0.2);
}

// ────────────────────────────────────────────────
// Phase controller
// ────────────────────────────────────────────────

export type SearchPhase = "random" | "hillclimb" | "ucb";

export function getSearchPhase(experimentCount: number): SearchPhase {
  if (experimentCount < 20) return "random";
  if (experimentCount < 60) return "hillclimb";
  return "ucb";
}

/**
 * Main entry point: returns the next parameter set to test based on phase.
 */
export function nextParams(
  experimentCount: number,
  bestParams: BacktestParams | null,
  ucbPool: UCBEntry[],
  totalUCBVisits: number,
): BacktestParams {
  const phase = getSearchPhase(experimentCount);

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
  }
}
