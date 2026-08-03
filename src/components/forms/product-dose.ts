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
  /**
   * Stable id — the persistence key (spray-unit-store) and the value the
   * picker reports back via onSelect. Kept stable so existing AsyncStorage
   * prefs and the chip-vocabulary contract survive display rewording.
   */
  key: string;
  /** Stored unit spelling (the form's existing vocabulary, kernel-parseable). */
  unit: string;
  /** Stored quantityBasis. 'total' for units whose string carries its own basis — the kernel ignores the column for them. */
  basis: QuantityBasis;
  /**
   * Farmer-facing display label for NON-localized respellings of the key —
   * Latin-script unit symbols that read the same in every language ("g/L" →
   * "gm/L"). Falls back to `key` when absent, so a chip whose key is already
   * clear (mL/L, kg/acre) needs no label. For anything that should translate
   * (the "(total)" suffix), use `labelKey` instead — never both.
   */
  label?: string;
  /**
   * i18n key for the farmer-facing display label, resolved through t() so the
   * wording localizes ("kg (total)" → "kg (कुल)" in Hindi). When present,
   * takes precedence over `label`. The English source lives in en.ts like any
   * other copy (fallbackLng covers the other locales) — do NOT duplicate it
   * into `label`.
   */
  labelKey?: string;
  /**
   * i18n key for a one-line hint shown under the label in the unit picker
   * (e.g. "Total kilograms for the whole tank"). The chip carries only the
   * key — the form resolves it through t() so the hint localizes with the
   * rest of the UI. Absent → no subtitle.
   */
  hintKey?: string;
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

/** The chip with this persistence key, out of the given vocabulary. Null for unknown/empty keys. */
export function unitChipByKey<C extends ProductUnitChip>(
  chips: readonly C[],
  key: string | null | undefined,
): C | null {
  if (!key) return null;
  return chips.find((chip) => chip.key === key) ?? null;
}

/**
 * The farmer-facing display text for a chip: localized label (labelKey) over
 * plain respelling (label) over the bare persistence key. `fallbackUnit` is
 * the verbatim unit string rendered when there is no chip at all (a stored
 * unit outside the chip vocabulary). One resolution rule for every surface —
 * unit segment, collapsed receipt, echo lines, and the unit picker.
 */
export function unitChipLabel(
  chip: ProductUnitChip | null | undefined,
  t: (key: string) => string,
  fallbackUnit: string,
): string {
  if (!chip) return fallbackUnit;
  return chip.labelKey ? t(chip.labelKey) : (chip.label ?? chip.key);
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

// ============================================================
// MARK: - Recommended-dose range guardrail (issue #236)
// ============================================================

/**
 * An optional label-recommended range for a catalog product (one route). The
 * picker prefills the foliar midpoint; this guardrail warns when the entered
 * dose sits far OUTSIDE the range. Advisory only — never regulatory, never
 * blocks submission (testimony rule: an unlogged application is worse than an
 * off-label one). Mirrors CatalogDoseGuidance minus provenance fields.
 */
export interface DoseGuidanceReference {
  minValue: number;
  maxValue: number;
  unit: string;
}

export interface DoseGuidanceWarning {
  direction: 'high' | 'low';
  /** The recommendation range that was breached. */
  reference: DoseGuidanceReference;
  /** The entered value (kernel-normalized to the reference's measure), for the message. */
  entered: number;
  unit: string;
}

/**
 * The recommendation range fires at 2× outside the bound — looser than a flat
 * "any value off-range" (which would nag on a 7 g/L entry against a 3–6 g/L
 * label) but tighter than the 10× fat-finger rule (which would miss the issue's
 * own example: 30 g/L vs a 3–6 g/L label). Concretely: HIGH fires when
 * entered ≥ max × 2; LOW fires when entered ≤ min / 2.
 */
const DOSE_GUIDANCE_FACTOR = 2;

/**
 * Range guardrail against an optional recommended-dose label range. Compares
 * the entered dose against the range bounds, kernel-normalized (same
 * `comparableRate`/`totalFor` helpers as the plan/history guardrail): same
 * effective basis → canonical rates compare directly; different bases → both
 * resolve to plot totals under the same context. Measures never cross (a kg
 * entry cannot be judged against an L reference). No guidance or no context →
 * null (silent). Never blocks submission.
 */
export function evaluateDoseGuidanceGuard(
  entry: ProductDoseEntry,
  guidance: DoseGuidanceReference | null | undefined,
  ctx: QuantityContext,
): DoseGuidanceWarning | null {
  if (!guidance || guidance.minValue <= 0 || guidance.maxValue < guidance.minValue) return null;
  const enteredItem = asQuantityItem(entry);
  if (!enteredItem) return null;
  const entered = comparableRate(enteredItem);
  if (!entered) return null;

  const minItem: QuantityItem = {
    quantity: guidance.minValue,
    unit: guidance.unit,
    quantityBasis: null,
  };
  const maxItem: QuantityItem = {
    quantity: guidance.maxValue,
    unit: guidance.unit,
    quantityBasis: null,
  };
  const minRate = comparableRate(minItem);
  const maxRate = comparableRate(maxItem);
  if (!minRate || !maxRate || minRate.measure !== entered.measure) return null;

  // HIGH: entered vs the range's max bound; LOW: entered vs the range's min bound.
  // Same effective basis → canonical rates compare directly; different bases →
  // both resolve to plot totals under the same context (null when context is
  // missing — the check stays silent rather than guessing).
  const ratioHigh = ratioBetween(entered, maxRate, enteredItem, maxItem, ctx);
  const ratioLow = ratioBetween(entered, minRate, enteredItem, minItem, ctx);

  // The message reports the entered value in the GUIDANCE unit (e.g. "entered
  // 12 g/L"), not the kernel's canonical unit (kg). Derive it from the ratio,
  // NOT from a unit-scale division: ratioBetween already resolved any basis
  // difference (entered 8 kg total on 3.5 ac vs a 2.5 kg/ha bound is ratio
  // 2.26 → 5.65 kg/ha), whereas dividing entered.rate by the unit factor
  // ignores the area/water factor and would report 19.77 kg/ha for the same
  // entry. bound × ratio equals rate ÷ factor in the same-basis case, so one
  // formula serves both branches.
  if (ratioHigh !== null && ratioHigh >= DOSE_GUIDANCE_FACTOR) {
    return {
      direction: 'high',
      reference: guidance,
      entered: roundForMessage(guidance.maxValue * ratioHigh),
      unit: guidance.unit,
    };
  }
  if (ratioLow !== null && ratioLow <= 1 / DOSE_GUIDANCE_FACTOR) {
    return {
      direction: 'low',
      reference: guidance,
      entered: roundForMessage(guidance.minValue * ratioLow),
      unit: guidance.unit,
    };
  }
  return null;
}

/**
 * Entered ÷ reference canonical rate. Same effective basis → direct ratio;
 * different bases → both resolve to plot totals under the same context. Returns
 * null when the bases differ and the context can't resolve either side (the
 * check stays silent rather than guessing). Mirrors evaluateDoseGuard's branch.
 */
function ratioBetween(
  entered: ComparableRate,
  reference: ComparableRate,
  enteredItem: QuantityItem,
  referenceItem: QuantityItem,
  ctx: QuantityContext,
): number | null {
  if (entered.basis === reference.basis) {
    return reference.rate > 0 ? entered.rate / reference.rate : null;
  }
  const enteredTotal = totalFor(enteredItem, ctx);
  const referenceTotal = totalFor(referenceItem, ctx);
  if (enteredTotal && referenceTotal && referenceTotal.value > 0) {
    return enteredTotal.value / referenceTotal.value;
  }
  return null;
}

/** Round a canonical rate for a human-readable message (≤ 2 dp). */
function roundForMessage(value: number): number {
  return Math.round(value * 100) / 100;
}
