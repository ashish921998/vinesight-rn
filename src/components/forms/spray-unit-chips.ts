/**
 * Basis-fused spray unit chips + tank echo + dose guardrail (issue #194).
 *
 * Each chip fuses the entry unit with its quantity basis so the farmer picks
 * one thing ("g/acre") instead of a unit dropdown plus a separate basis
 * toggle. Chips map onto the EXISTING storage vocabulary: the stored unit
 * spelling stays a ChemicalUnit and the basis stays in the quantityBasis
 * column, so records written before and after this feature share one shape
 * (no schema or migration work). All conversions route through the quantity
 * kernel — nothing here hand-rolls unit math.
 */

import type { ChemicalUnit } from '@/constants/calculator-models';
import type { QuantityBasis } from '@/types';
import { effectiveBasis, format, parseUnit, totalFor } from '@/lib/quantity';
import type { Basis, Measure, QuantityContext, QuantityItem } from '@/lib/quantity';

export interface SprayUnitChip {
  /** Stable id — doubles as the display label and the last-used persistence key. */
  key: string;
  /** Stored unit spelling (existing ChemicalUnit vocabulary, kernel-parseable). */
  unit: ChemicalUnit;
  /** Stored quantityBasis. 'total' for per-liter units — their unit string carries the basis and the kernel ignores the column. */
  basis: QuantityBasis;
}

/** The main chip row — exactly these five, in this order (issue #194 contract). */
export const SPRAY_UNIT_CHIPS: readonly SprayUnitChip[] = [
  { key: 'g/L', unit: 'gm/L', basis: 'total' },
  { key: 'mL/L', unit: 'ml/L', basis: 'total' },
  { key: 'g/acre', unit: 'gram', basis: 'per_acre' },
  { key: 'mL/acre', unit: 'ml', basis: 'per_acre' },
  { key: 'ppm', unit: 'ppm', basis: 'total' },
];

/**
 * Rare shapes behind the "More" menu: absolute totals, plus kg/L per-acre —
 * plan-item prefills arrive as bare 'kg'/'liter' with basis per_acre, and the
 * row must be able to render the selection it was created with.
 */
export const SPRAY_UNIT_OVERFLOW_CHIPS: readonly SprayUnitChip[] = [
  { key: 'g total', unit: 'gram', basis: 'total' },
  { key: 'mL total', unit: 'ml', basis: 'total' },
  { key: 'kg total', unit: 'kg', basis: 'total' },
  { key: 'L total', unit: 'liter', basis: 'total' },
  { key: 'kg/acre', unit: 'kg', basis: 'per_acre' },
  { key: 'L/acre', unit: 'liter', basis: 'per_acre' },
];

export const ALL_SPRAY_UNIT_CHIPS: readonly SprayUnitChip[] = [
  ...SPRAY_UNIT_CHIPS,
  ...SPRAY_UNIT_OVERFLOW_CHIPS,
];

export function sprayUnitChipByKey(key: string | null | undefined): SprayUnitChip | null {
  if (!key) return null;
  return ALL_SPRAY_UNIT_CHIPS.find((chip) => chip.key === key) ?? null;
}

/**
 * The chip a stored (unit, quantityBasis) pair renders as. Units whose string
 * carries its own basis (gm/L, ml/L, ppm) match on unit alone — the kernel
 * ignores the basis column for them, so the chip must too. Bare units match
 * unit + basis, which is how existing total/per_acre records are stored.
 */
export function chipForEntry(
  unit: string,
  basis: QuantityBasis | null | undefined,
): SprayUnitChip | null {
  const parsed = parseUnit(unit);
  if (parsed && parsed.basis !== 'total') {
    return ALL_SPRAY_UNIT_CHIPS.find((chip) => chip.unit === unit) ?? null;
  }
  const effective: QuantityBasis = basis ?? 'total';
  return (
    ALL_SPRAY_UNIT_CHIPS.find((chip) => chip.unit === unit && chip.basis === effective) ?? null
  );
}

export interface SprayEntryLike {
  quantity: number | null | undefined;
  unit: string;
  quantityBasis?: QuantityBasis | null;
}

function asQuantityItem(entry: SprayEntryLike): QuantityItem | null {
  if (
    typeof entry.quantity !== 'number' ||
    !Number.isFinite(entry.quantity) ||
    entry.quantity <= 0
  ) {
    return null;
  }
  return { quantity: entry.quantity, unit: entry.unit, quantityBasis: entry.quantityBasis ?? null };
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
export function buildTankEcho(entry: SprayEntryLike, ctx: QuantityContext): TankEcho | null {
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

export interface DoseReference {
  quantity: number;
  unit: string;
  quantityBasis?: QuantityBasis | null;
}

export interface DoseGuardWarning {
  source: 'plan' | 'history';
  direction: 'high' | 'low';
  /** Rounded fold factor, always ≥ 10: entered ÷ reference for 'high', reference ÷ entered for 'low'. */
  ratio: number;
  reference: DoseReference;
}

const DOSE_GUARD_FACTOR = 10;

interface ComparableRate {
  rate: number;
  measure: Measure;
  basis: Basis;
}

function comparableRate(item: QuantityItem): ComparableRate | null {
  const parsed = parseUnit(item.unit);
  if (!parsed) return null;
  return {
    rate: item.quantity * parsed.factorToCanonical,
    measure: parsed.measure,
    basis: effectiveBasis(parsed, item),
  };
}

/**
 * 10×/1000× dose guardrail. Compares the entered dose ONLY against
 * independent references — the linked plan item's dose, else the farmer's
 * most recent prior log of the same product. The tank echo is derived from
 * the same entry and is never a trigger. No reference → null (silent).
 *
 * Normalization is kernel-only: same effective basis → canonical rates
 * compare directly (context-free); different bases → both resolve to
 * canonical plot totals under the same context, or the check stays silent.
 * Measures never cross (a mL/L entry cannot be judged against a g/L
 * reference). Warns when entered ≥ 10× or ≤ 1/10 of the reference — the
 * 1000× case falls out of the same check. Never blocks submission.
 */
export function evaluateDoseGuard(
  entry: SprayEntryLike,
  references: { plan?: DoseReference | null; history?: DoseReference | null },
  ctx: QuantityContext,
): DoseGuardWarning | null {
  const enteredItem = asQuantityItem(entry);
  if (!enteredItem) return null;
  const entered = comparableRate(enteredItem);
  if (!entered) return null;

  const candidates: { source: DoseGuardWarning['source']; reference: DoseReference | null }[] = [
    { source: 'plan', reference: references.plan ?? null },
    { source: 'history', reference: references.history ?? null },
  ];

  for (const { source, reference } of candidates) {
    if (!reference) continue;
    const referenceItem = asQuantityItem(reference);
    if (!referenceItem) continue;
    const ref = comparableRate(referenceItem);
    if (!ref || ref.measure !== entered.measure || ref.rate <= 0) continue;

    let ratio: number | null = null;
    if (ref.basis === entered.basis) {
      ratio = entered.rate / ref.rate;
    } else {
      const enteredTotal = totalFor(enteredItem, ctx);
      const referenceTotal = totalFor(referenceItem, ctx);
      if (enteredTotal && referenceTotal && referenceTotal.value > 0) {
        ratio = enteredTotal.value / referenceTotal.value;
      }
    }
    if (ratio === null) continue;

    if (ratio >= DOSE_GUARD_FACTOR) {
      return { source, direction: 'high', ratio: Math.round(ratio), reference };
    }
    if (ratio <= 1 / DOSE_GUARD_FACTOR) {
      return { source, direction: 'low', ratio: Math.round(1 / ratio), reference };
    }
    // Authority decision, not a fall-through: a comparable reference was found
    // and the dose sits inside the sane band. This early exit ends the loop — a
    // sane plan dose renders the history reference moot, and a sane history dose
    // warrants no warning. (Test-locked: "a sane linked plan dose is
    // authoritative — history never second-guesses it".)
    return null;
  }

  return null;
}
