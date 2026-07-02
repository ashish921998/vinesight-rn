/**
 * Quantity kernel — shared types (issue #189, plan §2).
 *
 * Every quantity in the app is a point on a measure × basis grid, plus a
 * display scale that is presentation-only. Canonical storage units are
 * kg (mass), L (volume) and count; mg/g/ml are display scales layered on top.
 *
 * ppm is sugar for { measure: 'mass', basis: 'per_liter_water' } at mg scale —
 * 1 ppm = 1 mg per liter of spray water. This holds for w/v spray/fertigation
 * solutions ONLY (soil/petiole lab ppm is mg/kg and must never route through
 * this kernel), and it is only computable when a water volume is known.
 */

/** What is being counted. `count` (pcs/packet/bag) is fold-only — it never converts into mass or volume. */
export type Measure = 'mass' | 'volume' | 'count';

/** How the stored number relates to the plot: an absolute total, a rate per acre, or a concentration per liter of spray water. */
export type Basis = 'total' | 'per_acre' | 'per_liter_water';

/** Display/entry scales. Presentation only — never identity, never storage. `count` carries no unit label (pcs/packet/bag is the item's own word). */
export type DisplayScale = 'mg' | 'g' | 'kg' | 'ml' | 'L' | 'count';

/**
 * Result of parsing a raw unit string.
 *
 * `factorToCanonical` converts a value expressed in the raw unit into the
 * canonical unit for its measure (kg / L / count) *at the returned basis*.
 * Per-hectare spellings are already folded into it: 'kg/ha' returns
 * basis 'per_acre' with factor 1 / 2.47105, so `value × factor` is kg per acre.
 */
export interface ParsedUnit {
  measure: Measure;
  basis: Basis;
  factorToCanonical: number;
}

/**
 * The minimal shape of a stored line item the kernel can total.
 * `quantityBasis` mirrors the DB column of the same name: it only applies
 * when the unit string itself is basis-neutral (bare 'kg', 'L', 'pcs' …).
 * When the unit string carries its own basis ('kg/acre', 'gm/L', 'ppm'),
 * the string wins — it is the farmer's testimony.
 */
export interface QuantityItem {
  quantity: number;
  unit: string;
  quantityBasis?: Basis | null;
}

/** Plot context needed to resolve rates into totals. */
export interface QuantityContext {
  areaAcres?: number | null;
  waterLiters?: number | null;
}

/** A resolved plot total in canonical units (kg for mass, L for volume, count for count). */
export interface CanonicalTotal {
  value: number;
  measure: Measure;
}

/** Why an item could not be folded into a total. Bucketed, never guessed. */
export type FoldSkipReason = 'unknown_unit' | 'invalid_quantity' | 'missing_area' | 'missing_water';

export interface FoldSkippedItem<T extends QuantityItem = QuantityItem> {
  item: T;
  reason: FoldSkipReason;
}

/**
 * Totals per measure in canonical units: kg, L, count. Measures never merge —
 * a key is present only when at least one item folded into it, so "no mass
 * items" (undefined) is distinguishable from "0 kg".
 */
export type MeasureTotals = Partial<Record<Measure, number>>;

export interface FoldResult<T extends QuantityItem = QuantityItem> {
  totals: MeasureTotals;
  skipped: FoldSkippedItem<T>[];
}

/** Farmer-natural rendering of a canonical value: the display-rounded number and the scale the UI should label (and localize) it with. */
export interface FormatParts {
  value: number;
  scale: DisplayScale;
}

export interface FormatOptions {
  /** Prefix "≈ " — for derived (multiplied) figures, never for values the farmer typed. */
  approx?: boolean;
}
