/**
 * Shared product-dose core for the basis-fused unit-chip forms (spray #194,
 * fertigation #195), following the #210 shared-core precedent: the chip model,
 * the stored-pair → chip resolution, and the 10×/1000× dose guardrail live
 * here once — each form supplies only its own chip vocabulary and echo
 * builder. All conversions route through the quantity kernel; nothing here
 * hand-rolls unit math.
 */

import type { QuantityBasis } from '@/types';
import { effectiveBasis, parseUnit, totalFor } from '@/lib/quantity';
import type { Basis, Measure, QuantityContext, QuantityItem } from '@/lib/quantity';

/**
 * A basis-fused unit chip: the entry unit and its quantity basis picked as
 * one thing ("kg/acre") instead of a unit dropdown plus a separate basis
 * toggle. Chips map onto the EXISTING storage vocabulary — the stored unit
 * spelling stays in the form's own unit type and the basis stays in the
 * quantityBasis column, so records written before and after the chip forms
 * share one shape (no schema or migration work).
 */
export interface ProductUnitChip {
  /** Stable id — doubles as the display label (and any persistence key). */
  key: string;
  /** Stored unit spelling (the form's existing vocabulary, kernel-parseable). */
  unit: string;
  /** Stored quantityBasis. 'total' for units whose string carries its own basis — the kernel ignores the column for them. */
  basis: QuantityBasis;
}

/**
 * The chip a stored (unit, quantityBasis) pair renders as, out of the given
 * vocabulary. Units whose string carries its own basis (gm/L, ml/L, ppm)
 * match on unit alone — the kernel ignores the basis column for them, so the
 * chip must too. Bare units match unit + basis, which is how existing
 * total/per_acre records are stored. Null for anything outside the
 * vocabulary (verbatim units render their raw text instead).
 */
export function chipForProductEntry<C extends ProductUnitChip>(
  chips: readonly C[],
  unit: string,
  basis: QuantityBasis | null | undefined,
): C | null {
  const parsed = parseUnit(unit);
  if (parsed && parsed.basis !== 'total') {
    return chips.find((chip) => chip.unit === unit) ?? null;
  }
  const effective: QuantityBasis = basis ?? 'total';
  return chips.find((chip) => chip.unit === unit && chip.basis === effective) ?? null;
}

/** The minimal slice of a form's product row the dose helpers read. */
export interface ProductDoseEntry {
  quantity?: number | null;
  unit: string;
  quantityBasis?: QuantityBasis | null;
}

export function asQuantityItem(entry: ProductDoseEntry): QuantityItem | null {
  if (
    typeof entry.quantity !== 'number' ||
    !Number.isFinite(entry.quantity) ||
    entry.quantity <= 0
  ) {
    return null;
  }
  return { quantity: entry.quantity, unit: entry.unit, quantityBasis: entry.quantityBasis ?? null };
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
 * most recent prior log of the same product. The live echo is derived from
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
  entry: ProductDoseEntry,
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
