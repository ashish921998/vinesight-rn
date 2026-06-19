import type { QuantityBasis } from '@/types';

/**
 * Pure unit-string primitives shared by the report and nutrient-flow domain
 * calculations. These are the parts that were genuinely duplicated between
 * `report-service` and `nutrient-flow-service`: string normalization, the
 * `/acre` per-area suffix handling, the area-multiplier *decision*, and the
 * "Water: N L" dose parser.
 *
 * Deliberately NOT shared here: each service's divergent edge behavior — report
 * collapses units to kg/liter/unit with a multiplier and *rejects* when area is
 * missing; nutrient-flow converts to product mass via a density/concentration
 * switch and *falls back* to the raw quantity. Folding those together would be
 * false coupling, so callers keep their own apply/normalize logic and only lean
 * on the primitives below.
 */

/** Lowercase, trim, and strip all internal whitespace from a unit string. */
export function normalizeUnitString(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, '');
}

/** True when an already-normalized unit carries the `/acre` per-area suffix. */
export function hasPerAcreSuffix(normalizedUnit: string): boolean {
  return normalizedUnit.includes('/acre');
}

/** Remove the `/acre` suffix from an already-normalized unit. */
export function stripPerAcreSuffix(normalizedUnit: string): string {
  return normalizedUnit.replace('/acre', '');
}

/**
 * Whether an applied quantity must be multiplied by farm area to get an absolute
 * total. True when the quantity is declared per-acre (explicit basis) or the
 * unit carries `/acre`.
 *
 * Callers decide what to do when the area itself is invalid/missing — that part
 * intentionally differs between consumers and stays in the caller.
 */
export function shouldApplyAreaMultiplier(
  normalizedUnit: string,
  quantityBasis: QuantityBasis | null | undefined,
): boolean {
  return quantityBasis === 'per_acre' || hasPerAcreSuffix(normalizedUnit);
}

/** Parse the `Water: <n> L` token out of a spray/fertigation dose string. */
export function parseWaterVolumeLitersFromDose(dose: string | null | undefined): number | null {
  const match = dose?.match(/Water:\s*([0-9]+(?:\.[0-9]+)?)\s*L/i);
  if (!match?.[1]) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
