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
 *
 * The fertigation LOGGING path resolves unit strings through the quantity
 * kernel (`resolveFertigationUnit` / `resolveFertigationPrefill` below,
 * issue #192): known spellings resolve to their true measure + basis, unknown
 * strings stay verbatim and are flagged — never silently coerced to kg.
 */

import { parseUnit, type ParsedUnit } from '@/lib/quantity';
import type { QuantityBasis } from '@/types/database';

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
 * resolve back to it. Includes the canonical per-acre form, spelled-out /
 * case variants, AND the bare measure names (kg, liter, gram, ml, litre) so
 * non-plan callers that store bare units (fertilizer catalog, suggestions)
 * still resolve correctly. Resolvers compare case-insensitively.
 */
const UNIT_ALIASES: Record<FertilizerMeasure, readonly string[]> = {
  kg: ['kg/acre', 'kg'],
  gram: ['g/acre', 'gram/acre', 'gram'],
  liter: ['l/acre', 'liter/acre', 'litre/acre', 'liter', 'litre'],
  ml: ['ml/acre', 'ml'],
  ppm: ['ppm'],
};

/**
 * Resolve a stored unit string back to its measure. Returns the fallback when
 * the string isn't a recognized plan-item unit. Comparisons are case-insensitive
 * and accept the aliases above, so the canonical `'L/acre'` round-trips to
 * `'liter'` (not silently to the default) regardless of casing.
 *
 * LEGACY: the fertigation logging path resolves through the quantity kernel
 * now (`resolveFertigationUnit` below — issue #192); this stays as the
 * reference the parity suite asserts the kernel path against.
 */
export function resolveFertilizerMeasure(
  unit: string | null | undefined,
  fallback: FertilizerMeasure = 'kg',
): FertilizerMeasure {
  const lowered = unit?.trim().toLowerCase();
  if (!lowered) return fallback;
  for (const measure of Object.keys(UNIT_ALIASES) as FertilizerMeasure[]) {
    if (UNIT_ALIASES[measure].some((alias) => alias.toLowerCase() === lowered)) {
      return measure;
    }
  }
  return fallback;
}

// ============================================================
// MARK: - Kernel-backed resolution (fertigation logging path, issue #192)
// ============================================================

/**
 * Legacy spellings predating the kernel grammar write the denominator as a
 * word: `'kg per acre'`, `'litre per acre'`. Fold them into the kernel's
 * `<base>/<denominator>` shape before parsing. Requires whitespace around
 * `per` so product names ("copper") can never match.
 */
function toKernelSpelling(raw: string): string {
  return raw.replace(/\s+per\s+/gi, '/');
}

/**
 * Parse a fertigation unit string through the quantity kernel, tolerating the
 * legacy `'X per acre'` spellings. Returns null for anything the kernel does
 * not positively recognize — NEVER a silent kg fallback.
 */
export function parseFertigationUnit(raw: string | null | undefined): ParsedUnit | null {
  if (typeof raw !== 'string') return null;
  return parseUnit(toKernelSpelling(raw));
}

/**
 * True when the kernel positively recognizes the unit string. Items saved with
 * an unrecognized unit keep the string verbatim and are stamped
 * `unit_unrecognized: true` (see `FertilizerItem`).
 */
export function isFertigationUnitRecognized(raw: string | null | undefined): boolean {
  return parseFertigationUnit(raw) !== null;
}

export interface ResolvedFertigationUnit {
  /**
   * What the fertigation form row should carry: one of the picker's
   * `FERTILIZER_UNITS` when the string maps onto that vocabulary losslessly,
   * otherwise the original text verbatim (trimmed). Verbatim text is never
   * coerced — an unknown unit must not become kg.
   */
  unit: FertilizerUnit | string;
  /**
   * The basis the unit string itself pins down (`'kg/acre'` → per_acre, bare
   * `'kg'` → total). Only set when `unit` is a form unit; undefined for
   * verbatim strings, whose basis callers resolve by their existing rules.
   */
  basisFromUnit?: QuantityBasis;
}

/**
 * Map a kernel parse onto the fertigation form's picker vocabulary. Returns
 * null when no form unit can represent the parse without changing the
 * number's meaning: concentrations (ppm, g/L), counts, mg scale, and
 * per-hectare rates (factor ≠ 1 or 0.001 once ÷2.47105 is folded in) all
 * stay verbatim rather than being mislabeled.
 */
function toFormUnit(parsed: ParsedUnit): FertilizerUnit | null {
  if (parsed.basis === 'per_liter_water') return null;
  if (parsed.measure === 'mass' && parsed.factorToCanonical === 1) return 'kg';
  if (parsed.measure === 'mass' && parsed.factorToCanonical === 0.001) return 'gram';
  if (parsed.measure === 'volume' && parsed.factorToCanonical === 1) return 'liter';
  if (parsed.measure === 'volume' && parsed.factorToCanonical === 0.001) return 'ml';
  return null;
}

/**
 * Resolve a unit string arriving at the fertigation form (quick-add chips,
 * name suggestions, recents, warehouse/plan sources) via the quantity kernel.
 *
 * - Known spellings resolve to their true measure at form scale plus the basis
 *   the string carries (`'L/acre'` → liter + per_acre).
 * - Missing/blank input returns the fallback (nothing to preserve).
 * - Everything else — unknown strings AND kernel-known units the form cannot
 *   express (ppm, g/L, kg/ha) — is returned verbatim, never as kg.
 */
export function resolveFertigationUnit(
  raw: string | null | undefined,
  fallback: FertilizerUnit | string = 'kg',
): ResolvedFertigationUnit {
  const text = raw?.trim();
  if (!text) return { unit: fallback };
  const parsed = parseFertigationUnit(text);
  if (parsed) {
    const formUnit = toFormUnit(parsed);
    if (formUnit) {
      return { unit: formUnit, basisFromUnit: parsed.basis === 'per_acre' ? 'per_acre' : 'total' };
    }
  }
  return { unit: text };
}

/**
 * True when the unit TEXT itself testifies a per-acre rate, covering both the
 * kernel spelling (`'kg/acre'`) and the documented legacy word form
 * (`'kg per acre'`) — the same folding `parseFertigationUnit` applies. This is
 * the basis fallback for verbatim (kernel-unknown) units, so an unknown
 * `'banana per acre'` is never silently stored as a plot total.
 */
export function unitTextSaysPerAcre(unit: string | null | undefined): boolean {
  if (typeof unit !== 'string') return false;
  return toKernelSpelling(unit).toLowerCase().includes('/acre');
}

/**
 * Resolve a plan/voice fertigation item's unit for prefilling the form.
 * Plan doses are per-acre rates by contract, so form-representable units keep
 * the legacy per_acre basis even when spelled bare (`'kg'` ≡ `'kg/acre'` on a
 * plan item — parity with the previous prefill resolver). Unrepresentable or
 * unknown units stay verbatim; their basis falls back to the per-acre text
 * sniff (`/acre` AND legacy `per acre` spellings) so the quantity is never
 * silently rescaled.
 */
export function resolveFertigationPrefill(unit: string | null | undefined): {
  unit: FertilizerUnit | string;
  quantityBasis: QuantityBasis;
} {
  const text = unit?.trim();
  if (!text) return { unit: 'kg', quantityBasis: 'per_acre' };
  const resolved = resolveFertigationUnit(text);
  if (resolved.basisFromUnit !== undefined) {
    return { unit: resolved.unit, quantityBasis: 'per_acre' };
  }
  return {
    unit: resolved.unit,
    quantityBasis: unitTextSaysPerAcre(text) ? 'per_acre' : 'total',
  };
}
