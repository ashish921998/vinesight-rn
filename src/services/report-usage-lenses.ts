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
  /**
   * Area the record was actually applied over (acres), snapshotted at logging
   * time. Per-acre rates resolve against THIS, not the farm's current area —
   * editing the farm later must not rewrite what was applied. Falls back to
   * the farm-level area when absent.
   */
  areaAcres?: number | null;
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
  // These buckets promise "shown as logged" — and their quantities may be
  // intensive (30 gm/L + 40 gm/L is NOT 70 gm/L), so values are never summed:
  // each distinct logged value is its own row and repeats bump usageCount.
  const key = `${type}::${normalizeProductName(item.name)}::${unit.toLowerCase()}::${item.quantity}`;
  const existing = map.get(key);
  if (existing) {
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
  // Compliance joins against the CURRENT plan only. A record stamped from a
  // superseded plan carries a plan_item_id no current item will ever match —
  // routing it into the verified map would make it vanish from the delta
  // ("not logged"), so stale-stamped contributions degrade to name matching.
  const currentPlanItemIds = new Set(planItems.map((item) => item.id));

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
  // Every current-plan stamp we saw at all — even when the item's quantity
  // could not be resolved into the plan's measure. Distinguishes "logged but
  // not comparable" from "not logged" (a false non-application claim is the
  // worst output a compliance table can produce).
  const stampedSeen = new Set<string>();

  for (const event of events) {
    const eventAreaAcres = isPositiveFinite(event.areaAcres) ? event.areaAcres : areaAcres;
    const ctx = { areaAcres: eventAreaAcres, waterLiters: event.waterLiters };
    const perLiterSeen = new Set<string>();

    for (const item of event.items) {
      if (!item.name.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0) continue;
      if (item.planItemId && currentPlanItemIds.has(item.planItemId)) {
        stampedSeen.add(item.planItemId);
      }

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

      if (item.planItemId && currentPlanItemIds.has(item.planItemId)) {
        const byMeasure = verifiedByPlanItem.get(item.planItemId) ?? {};
        byMeasure[measure] = (byMeasure[measure] ?? 0) + value;
        verifiedByPlanItem.set(item.planItemId, byMeasure);
      } else if (event.type === 'fertilizer') {
        // Name matching joins FERTILIZER-plan items, so only fertigation
        // contributions qualify — a spray chemical that happens to share a
        // name must not inflate plan compliance. (Stamped items above are
        // trusted regardless of surface: the linkage is explicit.)
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
    areaAcres != null
      ? computeCompliance(planItems, verifiedByPlanItem, approxByName, areaAcres, stampedSeen)
      : [];

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
  stampedSeen: Set<string>,
): UsageComplianceRow[] {
  // Plans repeat the same product across application dates by design, but a
  // name-matched (unstamped) contribution cannot be attributed to one of
  // those rows — adding it to EACH would multiply the applied figure by the
  // row count. So the delta is per (product name, measure): prescriptions
  // for the same product sum into one row and the name match counts once.
  interface ComplianceGroup {
    name: string;
    nameKey: string;
    measure: Measure;
    planItemIds: string[];
    prescribedPerAcre: number;
  }
  const groups = new Map<string, ComplianceGroup>();

  for (const planItem of planItems) {
    if (!planItem.unit || !isPositiveFinite(planItem.quantity)) continue;
    const parsed = parseUnit(planItem.unit);
    if (!parsed) continue;
    // Concentration prescriptions (ppm, g/L) have no per-acre reading — they
    // belong to the per-liter lens, not this delta.
    if (parsed.basis === 'per_liter_water') continue;

    const canonical = planItem.quantity * parsed.factorToCanonical;
    const prescribedPerAcre = parsed.basis === 'per_acre' ? canonical : canonical / areaAcres;

    const nameKey = normalizeProductName(planItem.name);
    const groupKey = `${nameKey}::${parsed.measure}`;
    const group = groups.get(groupKey) ?? {
      name: displayName(planItem.name),
      nameKey,
      measure: parsed.measure,
      planItemIds: [],
      prescribedPerAcre: 0,
    };
    group.planItemIds.push(planItem.id);
    group.prescribedPerAcre += prescribedPerAcre;
    groups.set(groupKey, group);
  }

  const rows: UsageComplianceRow[] = [];
  for (const group of groups.values()) {
    const verified = group.planItemIds.reduce(
      (sum, id) => sum + (verifiedByPlanItem.get(id)?.[group.measure] ?? 0),
      0,
    );
    const approxMeasures = approxByName.get(group.nameKey);
    const approx = approxMeasures?.[group.measure] ?? 0;
    const hasVerified = verified > 0;
    const hasApprox = approx > 0;

    const appliedPerAcre = hasVerified || hasApprox ? (verified + approx) / areaAcres : null;

    // Contributions exist but could not be expressed in the plan's measure
    // (stamped record with an unresolvable unit, or a name match folded into
    // a different measure): that is "unresolved", never "not logged".
    const hasUnresolvedEvidence =
      appliedPerAcre == null &&
      (group.planItemIds.some((id) => stampedSeen.has(id)) ||
        Object.values(approxMeasures ?? {}).some((value) => (value ?? 0) > 0));

    rows.push({
      planItemId: group.planItemIds.join('+'),
      name: group.name,
      measure: group.measure,
      prescribedPerAcre: group.prescribedPerAcre,
      prescribedDisplay: `${format(group.prescribedPerAcre, group.measure, { approx: true })}/acre`,
      appliedPerAcre,
      appliedDisplay:
        appliedPerAcre != null
          ? `${format(appliedPerAcre, group.measure, { approx: true })}/acre`
          : null,
      matchLevel: hasApprox
        ? 'approximate'
        : hasVerified
          ? 'verified'
          : hasUnresolvedEvidence
            ? 'unresolved'
            : null,
    });
  }

  return rows.sort(
    (a, b) => a.name.localeCompare(b.name) || a.planItemId.localeCompare(b.planItemId),
  );
}
