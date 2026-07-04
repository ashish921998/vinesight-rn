/**
 * Report usage lenses — kernel-backed quantity math for reports (issue #198,
 * plan §5). Three lenses over spray/fertigation line items:
 *
 *   per plot   Σ totalFor(item, ctx) per product per MEASURE — mass, volume
 *              and count never merge into one number.
 *   per acre   plot totals ÷ farm area (acres). Hidden when the area is
 *              missing/zero/non-finite — never divided by a guess. Includes
 *              the compliance delta against plan items: contributions stamped
 *              with plan_item_id are 'verified'; name-only matches are
 *              'approximate', never presented as verified.
 *   per liter  spray concentration = Σ chemical canonical ÷ Σ water volume,
 *              weighted by water volume — never a plain average of per-event
 *              concentrations. ppm folds natively as mg/L.
 *
 * Items the kernel cannot resolve stay visible in verbatim buckets (Other /
 * concentration-only / rate-only) — shown as logged, never converted, never
 * silently dropped. All sums run at full precision; rounding happens only in
 * the display strings produced by format().
 */

import { fold, format, parseUnit } from '@/lib/quantity';
import type { Measure } from '@/lib/quantity';
import type { QuantityBasis } from '@/types/database';
import type {
  ReportPlanItemInput,
  ReportUsageLenses,
  UsageComplianceRow,
  UsageLensFigure,
  UsagePerAcreRow,
  UsagePerLiterRow,
  UsagePerPlotRow,
  UsageVerbatimRow,
} from '@/types/report';

export interface UsageEventItem {
  name: string;
  quantity: number;
  unit: string;
  quantityBasis?: QuantityBasis | null;
  planItemId?: string | null;
}

export interface UsageEvent {
  type: 'spray' | 'fertilizer';
  waterLiters: number | null;
  items: UsageEventItem[];
}

export function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function displayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

const MEASURE_ORDER: Measure[] = ['mass', 'volume', 'count'];

function toFigures(
  totals: Partial<Record<Measure, number>>,
  transform: (value: number) => number,
  suffix: string,
): UsageLensFigure[] {
  return MEASURE_ORDER.filter((measure) => totals[measure] != null).map((measure) => {
    const value = transform(totals[measure]!);
    return {
      measure,
      value,
      display: `${format(value, measure, { approx: true })}${suffix}`,
    };
  });
}

interface ProductAccumulator {
  name: string;
  type: 'spray' | 'fertilizer';
  usageCount: number;
  totals: Partial<Record<Measure, number>>;
}

function upsertVerbatim(
  map: Map<string, UsageVerbatimRow>,
  item: UsageEventItem,
  type: 'spray' | 'fertilizer',
): void {
  const unit = item.unit.trim();
  const key = `${type}::${normalizeProductName(item.name)}::${unit.toLowerCase()}`;
  const existing = map.get(key);
  if (existing) {
    existing.quantity += item.quantity;
    existing.usageCount += 1;
    return;
  }
  map.set(key, {
    key,
    name: displayName(item.name),
    type,
    unit,
    quantity: item.quantity,
    usageCount: 1,
  });
}

function sortByName<T extends { name: string; key: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function computeUsageLenses(params: {
  events: UsageEvent[];
  areaAcres: number | null | undefined;
  planItems?: ReportPlanItemInput[];
}): ReportUsageLenses {
  const { events, planItems = [] } = params;
  const areaAcres = isPositiveFinite(params.areaAcres) ? params.areaAcres : null;

  const products = new Map<string, ProductAccumulator>();
  const other = new Map<string, UsageVerbatimRow>();
  const concentrationOnly = new Map<string, UsageVerbatimRow>();
  const rateOnly = new Map<string, UsageVerbatimRow>();

  // Per-liter accumulation: Σ canonical and Σ water per (product, measure).
  // Water is added once per event a product appears in, so the resulting
  // concentration is the water-volume-weighted mean across events.
  const perLiterAcc = new Map<
    string,
    { name: string; measure: 'mass' | 'volume'; sum: number; water: number; events: number }
  >();

  // Compliance accumulation keyed by plan item id / normalized plan name.
  const verifiedByPlanItem = new Map<string, Partial<Record<Measure, number>>>();
  const approxByName = new Map<string, Partial<Record<Measure, number>>>();

  for (const event of events) {
    const ctx = { areaAcres, waterLiters: event.waterLiters };
    const perLiterSeen = new Set<string>();

    for (const item of event.items) {
      if (!item.name.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;

      const { totals, skipped } = fold(
        [{ quantity: item.quantity, unit: item.unit, quantityBasis: item.quantityBasis }],
        ctx,
      );

      const skipReason = skipped[0]?.reason;
      if (skipReason === 'unknown_unit') {
        upsertVerbatim(other, item, event.type);
        continue;
      }
      if (skipReason === 'missing_water') {
        upsertVerbatim(concentrationOnly, item, event.type);
        continue;
      }
      if (skipReason === 'missing_area') {
        upsertVerbatim(rateOnly, item, event.type);
        continue;
      }
      if (skipReason) continue; // invalid_quantity — already filtered above

      const measure = MEASURE_ORDER.find((m) => totals[m] != null);
      if (!measure) continue;
      const value = totals[measure]!;

      const productKey = `${event.type}::${normalizeProductName(item.name)}`;
      const acc = products.get(productKey) ?? {
        name: displayName(item.name),
        type: event.type,
        usageCount: 0,
        totals: {},
      };
      acc.usageCount += 1;
      acc.totals[measure] = (acc.totals[measure] ?? 0) + value;
      products.set(productKey, acc);

      if (
        event.type === 'spray' &&
        isPositiveFinite(event.waterLiters) &&
        (measure === 'mass' || measure === 'volume')
      ) {
        const plKey = `${normalizeProductName(item.name)}::${measure}`;
        const pl = perLiterAcc.get(plKey) ?? {
          name: displayName(item.name),
          measure,
          sum: 0,
          water: 0,
          events: 0,
        };
        pl.sum += value;
        if (!perLiterSeen.has(plKey)) {
          perLiterSeen.add(plKey);
          pl.water += event.waterLiters;
          pl.events += 1;
        }
        perLiterAcc.set(plKey, pl);
      }

      if (item.planItemId) {
        const byMeasure = verifiedByPlanItem.get(item.planItemId) ?? {};
        byMeasure[measure] = (byMeasure[measure] ?? 0) + value;
        verifiedByPlanItem.set(item.planItemId, byMeasure);
      } else {
        const nameKey = normalizeProductName(item.name);
        const byMeasure = approxByName.get(nameKey) ?? {};
        byMeasure[measure] = (byMeasure[measure] ?? 0) + value;
        approxByName.set(nameKey, byMeasure);
      }
    }
  }

  const perPlotRows: UsagePerPlotRow[] = sortByName(
    Array.from(products.entries()).map(([key, acc]) => ({
      key,
      name: acc.name,
      type: acc.type,
      usageCount: acc.usageCount,
      totals: toFigures(acc.totals, (v) => v, ''),
    })),
  );

  const perAcreRows: UsagePerAcreRow[] =
    areaAcres != null
      ? sortByName(
          Array.from(products.entries()).map(([key, acc]) => ({
            key,
            name: acc.name,
            type: acc.type,
            perAcre: toFigures(acc.totals, (v) => v / areaAcres, '/acre'),
          })),
        )
      : [];

  const compliance: UsageComplianceRow[] =
    areaAcres != null ? computeCompliance(planItems, verifiedByPlanItem, approxByName, areaAcres) : [];

  const sprayEvents = events.filter((event) => event.type === 'spray');
  const perLiterRows: UsagePerLiterRow[] = sortByName(
    Array.from(perLiterAcc.entries())
      .filter(([, acc]) => acc.water > 0)
      .map(([key, acc]) => {
        const concentration = acc.sum / acc.water;
        return {
          key,
          name: acc.name,
          measure: acc.measure,
          concentration,
          display: `${format(concentration, acc.measure, { approx: true })}/L`,
          eventCount: acc.events,
        };
      }),
  );

  return {
    perPlot: {
      rows: perPlotRows,
      other: sortByName(Array.from(other.values())),
      concentrationOnly: sortByName(Array.from(concentrationOnly.values())),
      rateOnly: sortByName(Array.from(rateOnly.values())),
    },
    perAcre: {
      available: areaAcres != null,
      areaAcres,
      rows: perAcreRows,
      compliance,
    },
    perLiter: {
      rows: perLiterRows,
      sprayEventsWithWater: sprayEvents.filter((event) => isPositiveFinite(event.waterLiters))
        .length,
      sprayEventsTotal: sprayEvents.length,
    },
  };
}

function computeCompliance(
  planItems: ReportPlanItemInput[],
  verifiedByPlanItem: Map<string, Partial<Record<Measure, number>>>,
  approxByName: Map<string, Partial<Record<Measure, number>>>,
  areaAcres: number,
): UsageComplianceRow[] {
  const rows: UsageComplianceRow[] = [];

  for (const planItem of planItems) {
    if (!planItem.unit || !isPositiveFinite(planItem.quantity)) continue;
    const parsed = parseUnit(planItem.unit);
    if (!parsed) continue;
    // Concentration prescriptions (ppm, g/L) have no per-acre reading — they
    // belong to the per-liter lens, not this delta.
    if (parsed.basis === 'per_liter_water') continue;

    const canonical = planItem.quantity * parsed.factorToCanonical;
    const prescribedPerAcre = parsed.basis === 'per_acre' ? canonical : canonical / areaAcres;

    const verified = verifiedByPlanItem.get(planItem.id)?.[parsed.measure] ?? 0;
    const approx = approxByName.get(normalizeProductName(planItem.name))?.[parsed.measure] ?? 0;
    const hasVerified = verified > 0;
    const hasApprox = approx > 0;

    const appliedPerAcre = hasVerified || hasApprox ? (verified + approx) / areaAcres : null;

    rows.push({
      planItemId: planItem.id,
      name: displayName(planItem.name),
      measure: parsed.measure,
      prescribedPerAcre,
      prescribedDisplay: `${format(prescribedPerAcre, parsed.measure, { approx: true })}/acre`,
      appliedPerAcre,
      appliedDisplay:
        appliedPerAcre != null
          ? `${format(appliedPerAcre, parsed.measure, { approx: true })}/acre`
          : null,
      matchLevel: hasApprox ? 'approximate' : hasVerified ? 'verified' : null,
    });
  }

  return rows.sort(
    (a, b) => a.name.localeCompare(b.name) || a.planItemId.localeCompare(b.planItemId),
  );
}
