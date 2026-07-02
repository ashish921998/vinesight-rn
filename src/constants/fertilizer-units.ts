/**
 * Single source of truth for the relationship between a fertilizer "measure"
 * (what you count) and the canonical unit string persisted on a plan item
 * (e.g. `kg/acre`, `L/acre`, `ppm`).
 *
 * Two sides of the app need this mapping and previously kept their own tables,
 * which drifted: the consultant lab form emits a unit string, and the farmer
 * fertigation quick-add resolves it back to a measure. Co-locating the mapping
 * here makes the round-trip provable instead of hoped-for.
 *
 * - `FertilizerMeasure` is the superset used when building a plan (adds `ppm`,
 *   a concentration with no per-acre basis). The app's fertigation form never
 *   needs ppm, so it consumes `FertilizerUnit` (calculator-models) directly.
 * - `MEASURE_TO_UNIT` is the canonical spelling stored in the DB. Aliases a
 *   reader must also accept (`g/acre` vs `gram/acre`, case variants) are listed
 *   in `PER_ACRE_UNIT_ALIASES` so resolvers normalize consistently.
 */

import type { FertilizerUnit } from './calculator-models';

/** Measures available when authoring a plan item (fertigation form + ppm). */
export type FertilizerMeasure = FertilizerUnit | 'ppm';

/** Canonical per-acre / concentration unit string stored on each plan item. */
export const MEASURE_TO_UNIT: Record<FertilizerMeasure, string> = {
  kg: 'kg/acre',
  gram: 'g/acre',
  liter: 'L/acre',
  ml: 'ml/acre',
  ppm: 'ppm',
};

/**
 * The full set of unit strings the DB can hold, in canonical spelling. The
 * consultant form only ever emits these. Kept as a tuple so it stays a literal
 * type (`PlanItemUnit`) for callers that index option lists off it.
 */
export const PLAN_ITEM_UNIT_OPTIONS = ['kg/acre', 'g/acre', 'L/acre', 'ml/acre', 'ppm'] as const;
export type PlanItemUnit = (typeof PLAN_ITEM_UNIT_OPTIONS)[number];

/** Options for a unit picker on the plan-authoring form (label === value). */
export const MEASURE_OPTIONS: { value: FertilizerMeasure; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'gram', label: 'g' },
  { value: 'liter', label: 'L' },
  { value: 'ml', label: 'mL' },
  { value: 'ppm', label: 'ppm' },
];

/**
 * For each measure, every spelling a stored unit string may take that should
 * resolve back to it. Includes the canonical form plus common aliases
 * (spelled-out numerator, case variants). Resolvers compare case-insensitively.
 */
const PER_ACRE_UNIT_ALIASES: Record<FertilizerMeasure, readonly string[]> = {
  kg: ['kg/acre'],
  gram: ['g/acre', 'gram/acre'],
  liter: ['l/acre', 'liter/acre', 'litre/acre'],
  ml: ['ml/acre'],
  ppm: ['ppm'],
};

/**
 * Resolve a stored unit string back to its measure. Returns the fallback when
 * the string isn't a recognized plan-item unit. Comparisons are case-insensitive
 * and accept the aliases above, so the canonical `'L/acre'` round-trips to
 * `'liter'` (not silently to the default) regardless of casing.
 */
export function resolveFertilizerMeasure(
  unit: string | null | undefined,
  fallback: FertilizerMeasure = 'kg',
): FertilizerMeasure {
  const lowered = unit?.trim().toLowerCase();
  if (!lowered) return fallback;
  for (const measure of Object.keys(PER_ACRE_UNIT_ALIASES) as FertilizerMeasure[]) {
    if (PER_ACRE_UNIT_ALIASES[measure].some((alias) => alias.toLowerCase() === lowered)) {
      return measure;
    }
  }
  return fallback;
}
