/**
 * Quantity kernel — one module owns the meaning of every quantity in the app
 * (issue #189, docs/units-search-reports-plan.html §2).
 *
 * measure (mass | volume | count) × basis (total | per_acre | per_liter_water),
 * canonical units kg / L / count, display scales mg·g·ml layered on top,
 * ppm = mg per liter of spray water.
 *
 *   parseUnit(raw)        → { measure, basis, factorToCanonical } | null
 *   totalFor(item, ctx)   → canonical plot total | null (never guesses context)
 *   fold(items, ctx)      → per-measure totals + skipped buckets (never merges measures)
 *   format(value, measure)→ farmer-natural string ("750 g", not "0.75 kg")
 *   formatParts(...)      → { value, scale } for localized rendering
 *
 * Pure TypeScript, no side effects. Later issues swap the report/nutrient-flow
 * normalizers and form resolvers over to these calls — this module changes no
 * behavior anywhere by itself.
 */

export { ACRES_PER_HECTARE, isWaterConcentrationUnit, parseUnit } from './parse-unit';
export { effectiveBasis, totalFor } from './total-for';
export { fold } from './fold';
export { format, formatParts } from './format';
export type {
  Basis,
  CanonicalTotal,
  DisplayScale,
  FoldResult,
  FoldSkipReason,
  FoldSkippedItem,
  FormatOptions,
  FormatParts,
  Measure,
  MeasureTotals,
  ParsedUnit,
  QuantityContext,
  QuantityItem,
} from './types';
