/**
 * parseUnit — the one place a raw unit string becomes meaning (plan §2).
 *
 * Resolves every legacy spelling found in the three drifting vocabularies it
 * replaces, plus the ad-hoc parsers' input space:
 *   - src/constants/units.ts               UNIT_ALIASES_TO_KG / _TO_LITER / _TO_COUNT
 *   - src/constants/fertilizer-units.ts    UNIT_ALIASES + PLAN_ITEM_UNIT_OPTIONS
 *   - src/constants/calculator-models.ts   CHEMICAL_UNITS / FERTILIZER_UNITS
 *   - src/services/report-service.ts       normalizeUnit (any alias × optional '/acre')
 *   - src/services/nutrient-flow-service.ts  toProductMassKg switch (gm/l, ml/liter, ppm …)
 *   - src/components/forms/spray-form.tsx  resolveChemicalUnit ('g/l', 'gm/litre' …)
 *
 * Grammar: `<base>[/<denominator>]`, case-insensitive, all whitespace ignored.
 * `ppm` is a special whole token (mass per liter of spray water, mg scale).
 * Per-hectare denominators normalize to per-acre by folding ÷ 2.47105 into the
 * factor — the whole app runs on acres; '/ha' is never stored or shown.
 *
 * Unknown input returns null — NEVER a silent kg fallback. The 'L/acre' →
 * fallback-kg corruption this replaces is the kernel's reason to exist.
 */

import type { Basis, Measure, ParsedUnit } from './types';

/** Acres in one hectare. Per-hectare rates divide by this to become per-acre. */
export const ACRES_PER_HECTARE = 2.47105;

interface BaseUnit {
  measure: Measure;
  /** Multiplier into the canonical unit for the measure: kg / L / count. */
  factor: number;
}

/**
 * Base-unit spellings (numerator or whole token). Keys are lowercase and
 * whitespace-free. Sources: units.ts alias sets, fertilizer-units.ts aliases,
 * calculator-models.ts unit tuples, spray-form/nutrient-flow/report-service
 * parsers. mg/milligram(s) are included because ppm renders as mg/L (plan §5)
 * and the mg display scale must round-trip; they add no ambiguity.
 */
const BASE_UNITS: Record<string, BaseUnit> = {
  // mass → kg
  kg: { measure: 'mass', factor: 1 },
  kgs: { measure: 'mass', factor: 1 },
  kilogram: { measure: 'mass', factor: 1 },
  kilograms: { measure: 'mass', factor: 1 },
  gram: { measure: 'mass', factor: 0.001 },
  grams: { measure: 'mass', factor: 0.001 },
  gm: { measure: 'mass', factor: 0.001 },
  gms: { measure: 'mass', factor: 0.001 },
  g: { measure: 'mass', factor: 0.001 },
  mg: { measure: 'mass', factor: 0.000001 },
  milligram: { measure: 'mass', factor: 0.000001 },
  milligrams: { measure: 'mass', factor: 0.000001 },
  // volume → L
  liter: { measure: 'volume', factor: 1 },
  liters: { measure: 'volume', factor: 1 },
  litre: { measure: 'volume', factor: 1 },
  litres: { measure: 'volume', factor: 1 },
  l: { measure: 'volume', factor: 1 },
  ml: { measure: 'volume', factor: 0.001 },
  milliliter: { measure: 'volume', factor: 0.001 },
  milliliters: { measure: 'volume', factor: 0.001 },
  millilitre: { measure: 'volume', factor: 0.001 },
  millilitres: { measure: 'volume', factor: 0.001 },
  // count → count (fold-only; never converts into mass/volume)
  unit: { measure: 'count', factor: 1 },
  units: { measure: 'count', factor: 1 },
  pcs: { measure: 'count', factor: 1 },
  pc: { measure: 'count', factor: 1 },
  piece: { measure: 'count', factor: 1 },
  pieces: { measure: 'count', factor: 1 },
  packet: { measure: 'count', factor: 1 },
  packets: { measure: 'count', factor: 1 },
  bag: { measure: 'count', factor: 1 },
  bags: { measure: 'count', factor: 1 },
};

interface Denominator {
  basis: Basis;
  /** Extra multiplier folded into factorToCanonical ('/ha' → ÷ 2.47105). */
  factor: number;
}

const DENOMINATORS: Record<string, Denominator> = {
  // per acre — the app's only rate basis
  acre: { basis: 'per_acre', factor: 1 },
  acres: { basis: 'per_acre', factor: 1 },
  // per hectare — source-only spelling (annexure label claims, web-written
  // data); normalizes to per-acre. Never stored, never shown.
  ha: { basis: 'per_acre', factor: 1 / ACRES_PER_HECTARE },
  hectare: { basis: 'per_acre', factor: 1 / ACRES_PER_HECTARE },
  hectares: { basis: 'per_acre', factor: 1 / ACRES_PER_HECTARE },
  // per liter of spray water — concentration
  l: { basis: 'per_liter_water', factor: 1 },
  liter: { basis: 'per_liter_water', factor: 1 },
  liters: { basis: 'per_liter_water', factor: 1 },
  litre: { basis: 'per_liter_water', factor: 1 },
  litres: { basis: 'per_liter_water', factor: 1 },
};

/** 1 ppm = 1 mg per liter of spray water = 1e-6 kg per liter of spray water. */
const PPM: ParsedUnit = Object.freeze({
  measure: 'mass' as const,
  basis: 'per_liter_water' as const,
  factorToCanonical: 0.000001,
});

/**
 * Parse a raw unit string into { measure, basis, factorToCanonical }.
 * Returns null for anything it does not positively recognize.
 */
export function parseUnit(raw: string): ParsedUnit | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  if (!compact) return null;

  if (compact === 'ppm') return { ...PPM };

  const slash = compact.indexOf('/');
  const baseToken = slash === -1 ? compact : compact.slice(0, slash);
  const denomToken = slash === -1 ? null : compact.slice(slash + 1);
  if (slash !== -1 && (baseToken === '' || denomToken === '' || denomToken?.includes('/'))) {
    return null;
  }

  const base = BASE_UNITS[baseToken];
  if (!base) return null;

  if (denomToken === null) {
    return { measure: base.measure, basis: 'total', factorToCanonical: base.factor };
  }

  const denominator = DENOMINATORS[denomToken];
  if (!denominator) return null;
  // 'pcs/L' etc. is meaningless — a count cannot be a water concentration.
  // (count per acre stays allowed: report-service accepts e.g. 'packet/acre'.)
  if (denominator.basis === 'per_liter_water' && base.measure === 'count') return null;

  return {
    measure: base.measure,
    basis: denominator.basis,
    factorToCanonical: base.factor * denominator.factor,
  };
}
