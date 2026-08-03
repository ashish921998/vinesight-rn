/**
 * Basis-fused spray unit chips + tank echo (issue #194).
 *
 * Each chip fuses the entry unit with its quantity basis so the farmer picks
 * one thing ("g/acre") instead of a unit dropdown plus a separate basis
 * toggle. Chips map onto the EXISTING storage vocabulary: the stored unit
 * spelling stays a ChemicalUnit and the basis stays in the quantityBasis
 * column, so records written before and after this feature share one shape
 * (no schema or migration work). The chip model and the dose guardrail are
 * shared with the fertigation form via product-dose.ts (#195); only the
 * spray vocabulary and the tank echo live here. All conversions route
 * through the quantity kernel — nothing here hand-rolls unit math.
 */

import type { ChemicalUnit } from '@/constants/calculator-models';
import type { QuantityBasis } from '@/types';
import { effectiveBasis, format, parseUnit, totalFor } from '@/lib/quantity';
import type { QuantityContext } from '@/lib/quantity';
import {
  asQuantityItem,
  chipForProductEntry,
  unitChipByKey,
  type ProductDoseEntry,
  type ProductUnitChip,
} from './product-dose';

export interface SprayUnitChip extends ProductUnitChip {
  /** Stored unit spelling (existing ChemicalUnit vocabulary, kernel-parseable). */
  unit: ChemicalUnit;
}

/** The main chip row — exactly these five, in this order (issue #194 contract). */
export const SPRAY_UNIT_CHIPS: readonly SprayUnitChip[] = [
  {
    key: 'g/L',
    unit: 'gm/L',
    basis: 'total',
    label: 'gm/L',
    hintKey: 'sprayForm.chemicals.unitHints.gPerL',
  },
  { key: 'mL/L', unit: 'ml/L', basis: 'total', hintKey: 'sprayForm.chemicals.unitHints.mlPerL' },
  {
    key: 'g/acre',
    unit: 'gram',
    basis: 'per_acre',
    label: 'gm/acre',
    hintKey: 'sprayForm.chemicals.unitHints.gPerAcre',
  },
  {
    key: 'mL/acre',
    unit: 'ml',
    basis: 'per_acre',
    hintKey: 'sprayForm.chemicals.unitHints.mlPerAcre',
  },
  { key: 'ppm', unit: 'ppm', basis: 'total', hintKey: 'sprayForm.chemicals.unitHints.ppm' },
];

/**
 * Rare shapes behind the "More" menu: absolute totals, plus kg/L per-acre —
 * plan-item prefills arrive as bare 'kg'/'liter' with basis per_acre, and the
 * row must be able to render the selection it was created with. The total
 * chips display a localized `labelKey` ("kg (total)") over their cryptic
 * persistence `key` ("kg total") plus a hint explaining what "total" means —
 * the key stays stable so existing last-used prefs and the vocabulary
 * contract are undisturbed.
 */
export const SPRAY_UNIT_OVERFLOW_CHIPS: readonly SprayUnitChip[] = [
  {
    key: 'g total',
    unit: 'gram',
    basis: 'total',
    labelKey: 'sprayForm.chemicals.unitLabels.gTotal',
    hintKey: 'sprayForm.chemicals.unitHints.gTotal',
  },
  {
    key: 'mL total',
    unit: 'ml',
    basis: 'total',
    labelKey: 'sprayForm.chemicals.unitLabels.mlTotal',
    hintKey: 'sprayForm.chemicals.unitHints.mlTotal',
  },
  {
    key: 'kg total',
    unit: 'kg',
    basis: 'total',
    labelKey: 'sprayForm.chemicals.unitLabels.kgTotal',
    hintKey: 'sprayForm.chemicals.unitHints.kgTotal',
  },
  {
    key: 'L total',
    unit: 'liter',
    basis: 'total',
    labelKey: 'sprayForm.chemicals.unitLabels.lTotal',
    hintKey: 'sprayForm.chemicals.unitHints.lTotal',
  },
  {
    key: 'kg/acre',
    unit: 'kg',
    basis: 'per_acre',
    hintKey: 'sprayForm.chemicals.unitHints.kgPerAcre',
  },
  {
    key: 'L/acre',
    unit: 'liter',
    basis: 'per_acre',
    hintKey: 'sprayForm.chemicals.unitHints.lPerAcre',
  },
];

export const ALL_SPRAY_UNIT_CHIPS: readonly SprayUnitChip[] = [
  ...SPRAY_UNIT_CHIPS,
  ...SPRAY_UNIT_OVERFLOW_CHIPS,
];

export function sprayUnitChipByKey(key: string | null | undefined): SprayUnitChip | null {
  return unitChipByKey(ALL_SPRAY_UNIT_CHIPS, key);
}

/** The chip a stored (unit, quantityBasis) pair renders as (shared resolution rules — see product-dose.ts). */
export function chipForEntry(
  unit: string,
  basis: QuantityBasis | null | undefined,
): SprayUnitChip | null {
  return chipForProductEntry(ALL_SPRAY_UNIT_CHIPS, unit, basis);
}

export interface TankEcho {
  /** Which context multiplied the dose into tank reality. */
  kind: 'water' | 'area';
  /** Liters of spray water ('water') or plot acres ('area'). */
  contextValue: number;
  /** Kernel-formatted canonical total, e.g. "800 g". */
  totalText: string;
}

/**
 * Live "tank echo": what the entered rate means for this spray, resolved by
 * the kernel ("2 g/L × 400 L = 800 g in tank"). Null when the entry is a
 * total (nothing to convert), the unit is unknown, or the needed context
 * (water for per-liter/ppm, area for per-acre) is missing.
 */
export function buildTankEcho(entry: ProductDoseEntry, ctx: QuantityContext): TankEcho | null {
  const item = asQuantityItem(entry);
  if (!item) return null;
  const parsed = parseUnit(item.unit);
  if (!parsed) return null;
  const basis = effectiveBasis(parsed, item);
  if (basis === 'total') return null;
  const total = totalFor(item, ctx);
  if (!total) return null;
  const totalText = format(total.value, total.measure);
  return basis === 'per_acre'
    ? { kind: 'area', contextValue: ctx.areaAcres as number, totalText }
    : { kind: 'water', contextValue: ctx.waterLiters as number, totalText };
}
