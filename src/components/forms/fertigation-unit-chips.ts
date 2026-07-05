/**
 * Basis-fused fertigation unit chips + bidirectional area echo (issue #195).
 *
 * Each chip fuses the entry unit with its quantity basis so the farmer picks
 * one thing ("kg/acre") instead of a unit dropdown plus a separate
 * per-acre/total toggle. A BARE chip (kg, L) means total for the plot and its
 * wording stays bare — no "total" label text; disambiguation comes from
 * defaults and the echo line, never chip text. Chips map onto the EXISTING
 * storage vocabulary: the stored unit spelling stays a FertilizerUnit and the
 * basis stays in the quantityBasis column, so records written before and
 * after this feature share one shape (no schema or migration work). Verbatim
 * units (ppm, kg/ha, unknown strings — the #192 testimony rule) are outside
 * the vocabulary: chipForEntry returns null and the form renders their raw
 * text where the chip row would be. The chip model and the dose guardrail
 * are shared with the spray form via product-dose.ts; all conversions route
 * through the quantity kernel — nothing here hand-rolls unit math.
 */

import type { FertilizerUnit } from '@/constants/calculator-models';
import type { QuantityBasis } from '@/types';
import { effectiveBasis, format, parseUnit, totalFor } from '@/lib/quantity';
import {
  asQuantityItem,
  chipForProductEntry,
  type ProductDoseEntry,
  type ProductUnitChip,
} from './product-dose';

export interface FertigationUnitChip extends ProductUnitChip {
  /** Stored unit spelling (existing FertilizerUnit vocabulary, kernel-parseable). */
  unit: FertilizerUnit;
}

/** The main chip row — exactly these four, in this order (issue #195 contract). */
export const FERTIGATION_UNIT_CHIPS: readonly FertigationUnitChip[] = [
  { key: 'kg/acre', unit: 'kg', basis: 'per_acre' },
  { key: 'L/acre', unit: 'liter', basis: 'per_acre' },
  { key: 'kg', unit: 'kg', basis: 'total' },
  { key: 'L', unit: 'liter', basis: 'total' },
];

/**
 * The gram/mL family behind the "More" menu — the rest of the picker's
 * FERTILIZER_UNITS vocabulary, mirroring how spray shelves its rare shapes.
 * Bare g/mL are totals, same rule as the main row.
 */
export const FERTIGATION_UNIT_OVERFLOW_CHIPS: readonly FertigationUnitChip[] = [
  { key: 'g/acre', unit: 'gram', basis: 'per_acre' },
  { key: 'mL/acre', unit: 'ml', basis: 'per_acre' },
  { key: 'g', unit: 'gram', basis: 'total' },
  { key: 'mL', unit: 'ml', basis: 'total' },
];

export const ALL_FERTIGATION_UNIT_CHIPS: readonly FertigationUnitChip[] = [
  ...FERTIGATION_UNIT_CHIPS,
  ...FERTIGATION_UNIT_OVERFLOW_CHIPS,
];

/**
 * The chip a stored (unit, quantityBasis) pair renders as (shared resolution
 * rules — see product-dose.ts). Null for verbatim units — the whole
 * FertilizerUnit × basis grid is covered, so null means "outside the
 * representable vocabulary".
 */
export function fertigationChipForEntry(
  unit: string,
  basis: QuantityBasis | null | undefined,
): FertigationUnitChip | null {
  return chipForProductEntry(ALL_FERTIGATION_UNIT_CHIPS, unit, basis);
}

export interface FertigationAreaEcho {
  /** Which way the farm's area translated the entry. */
  direction: 'to_total' | 'to_per_acre';
  areaAcres: number;
  /**
   * Kernel-formatted derived figure, "≈ "-prefixed ("≈ 10.5 kg", "≈ 2.9 kg").
   * Derived (multiplied) values only — the entered figure never gets "≈".
   */
  approxText: string;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Live area echo, BOTH directions: a per-acre entry resolves into the plot
 * total ("3 kg/acre → ≈ 10.5 kg total" on 3.5 acres) and a total entry into
 * the per-acre rate ("10 kg → ≈ 2.9 kg/acre"). Per-acre → total goes through
 * totalFor; total → per-acre is the one derived step the kernel has no verb
 * for — the canonical total divided by the area, full precision, rounded
 * only by format() at render. Null when the unit is unknown to the kernel,
 * the area is missing, or the basis is a water concentration (ppm/g-per-L
 * verbatim rows — area cannot translate those).
 */
export function buildFertigationAreaEcho(
  entry: ProductDoseEntry,
  areaAcres: number | null | undefined,
): FertigationAreaEcho | null {
  if (!isPositiveFinite(areaAcres)) return null;
  const item = asQuantityItem(entry);
  if (!item) return null;
  const parsed = parseUnit(item.unit);
  if (!parsed) return null;
  const basis = effectiveBasis(parsed, item);
  if (basis === 'per_liter_water') return null;
  if (basis === 'per_acre') {
    const total = totalFor(item, { areaAcres });
    if (!total) return null;
    return {
      direction: 'to_total',
      areaAcres,
      approxText: format(total.value, total.measure, { approx: true }),
    };
  }
  const total = totalFor(item, {});
  if (!total) return null;
  return {
    direction: 'to_per_acre',
    areaAcres,
    approxText: format(total.value / areaAcres, total.measure, { approx: true }),
  };
}
