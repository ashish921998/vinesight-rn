/**
 * fold — sum many line items into per-measure canonical totals (plan §5).
 *
 * Mass (kg), volume (L) and count each keep their own bucket and never merge
 * into one number. Items that cannot be resolved are returned in `skipped`
 * with the reason — a ppm row without a water volume lands in the
 * "concentration-only" bucket (reason 'missing_water'), never guessed into a
 * total. Sums run at full precision; rounding is format()'s job.
 */

import { parseUnit } from './parse-unit';
import { effectiveBasis, totalFor } from './total-for';
import type {
  FoldResult,
  FoldSkippedItem,
  MeasureTotals,
  QuantityContext,
  QuantityItem,
} from './types';

export function fold<T extends QuantityItem>(
  items: readonly T[],
  ctx: QuantityContext = {},
): FoldResult<T> {
  const totals: MeasureTotals = {};
  const skipped: FoldSkippedItem<T>[] = [];

  for (const item of items) {
    const parsed = parseUnit(item.unit);
    if (!parsed) {
      skipped.push({ item, reason: 'unknown_unit' });
      continue;
    }
    if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) {
      skipped.push({ item, reason: 'invalid_quantity' });
      continue;
    }

    const total = totalFor(item, ctx);
    if (total === null) {
      // totalFor only returns null here because context was missing.
      const basis = effectiveBasis(parsed, item);
      skipped.push({ item, reason: basis === 'per_acre' ? 'missing_area' : 'missing_water' });
      continue;
    }

    totals[total.measure] = (totals[total.measure] ?? 0) + total.value;
  }

  return { totals, skipped };
}
