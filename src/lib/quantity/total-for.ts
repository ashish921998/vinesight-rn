/**
 * totalFor — resolve one stored line item into a canonical plot total (plan §2/§5).
 *
 * per_acre × ctx.areaAcres · per_liter_water × ctx.waterLiters · total passes
 * through. When the needed context is missing the answer is null — callers
 * fall back to showing the rate; the kernel never guesses. Full precision
 * throughout: rounding happens only in format(), at render.
 */

import { parseUnit } from './parse-unit';
import type { Basis, CanonicalTotal, ParsedUnit, QuantityContext, QuantityItem } from './types';

/**
 * Deliberate: zero is treated as MISSING context, not as a provided value.
 * A 0-acre farm or a 0-liter spray is invalid data; resolving a rate against
 * it would silently report "0 applied" and hide the problem, whereas null
 * lands the row in fold()'s skipped bucket with an explicit reason the UI can
 * surface. (Adjudicated review decision on #201 — keep, do not "fix".)
 */
function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * The basis an item is actually stored against. The unit string wins when it
 * carries its own basis ('kg/acre', 'gm/L', 'ppm' — the farmer's testimony);
 * the explicit `quantityBasis` column applies only to basis-neutral units
 * (bare 'kg' + quantityBasis 'per_acre' is how quick-add stores rates today).
 */
export function effectiveBasis(parsed: ParsedUnit, item: QuantityItem): Basis {
  if (parsed.basis !== 'total') return parsed.basis;
  return item.quantityBasis ?? 'total';
}

/**
 * Canonical total (kg / L / count) for the plot, or null when the unit is
 * unknown, the quantity is not a finite number, or the required context
 * (areaAcres for per_acre, waterLiters for per_liter_water and ppm) is absent.
 */
export function totalFor(item: QuantityItem, ctx: QuantityContext = {}): CanonicalTotal | null {
  const parsed = parseUnit(item.unit);
  if (!parsed) return null;
  if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity)) return null;

  const canonicalRate = item.quantity * parsed.factorToCanonical;

  switch (effectiveBasis(parsed, item)) {
    case 'total':
      return { value: canonicalRate, measure: parsed.measure };
    case 'per_acre': {
      if (!isPositiveFinite(ctx.areaAcres)) return null;
      return { value: canonicalRate * ctx.areaAcres, measure: parsed.measure };
    }
    case 'per_liter_water': {
      if (!isPositiveFinite(ctx.waterLiters)) return null;
      return { value: canonicalRate * ctx.waterLiters, measure: parsed.measure };
    }
  }
}
