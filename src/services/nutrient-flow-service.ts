import type {
  FertigationRecord,
  FertilizerItem,
  NutrientCompositionItem,
  QuantityBasis,
  SprayChemicalItem,
  SprayRecord,
} from '@/types';
import {
  DEFAULT_DENSITY_KG_PER_L,
  OXIDE_TO_ELEMENTAL_FACTORS,
  sanitizeComposition,
} from '@/constants/nutrient-definitions';
import {
  normalizeUnitString,
  shouldApplyAreaMultiplier,
  stripPerAcreSuffix,
} from '@/utils/unit-conversion';

export type NutrientTotals = Record<string, number>;

type AppliedItem = {
  quantity: number;
  unit: string;
  quantity_basis?: QuantityBasis;
  composition_snapshot?: NutrientCompositionItem[] | null;
  density_kg_per_l?: number | null;
};

export interface LogNutrientResult {
  nutrientTotalsElemental: NutrientTotals;
  nutrientTotalsElementalPerAcre: NutrientTotals;
  coveragePercent: number;
  itemCount: number;
  composedItemCount: number;
}

export interface PetioleIntervalNutrientTotals {
  fromDate: string;
  toDate: string;
  totalsPerAcre: NutrientTotals;
  coveragePercent: number;
  totalLogCount: number;
}

interface ResolvedLogIntervalTotals {
  totalsPerAcre: NutrientTotals;
  coveragePercent: number;
}

function addToTotals(target: NutrientTotals, source: NutrientTotals): NutrientTotals {
  const next = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) continue;
    next[key] = (next[key] ?? 0) + parsedValue;
  }
  return next;
}

function roundTo(value: number, precision = 4): number {
  const scale = Math.pow(10, precision);
  return Math.round(value * scale) / scale;
}

function normalizeUnit(unit: string): string {
  return normalizeUnitString(unit).replace(/litres?/g, 'liter');
}

function resolveDensity(densityKgPerL?: number | null): number {
  if (typeof densityKgPerL === 'number' && Number.isFinite(densityKgPerL) && densityKgPerL > 0) {
    return densityKgPerL;
  }
  return DEFAULT_DENSITY_KG_PER_L;
}

function resolveTotalQuantity({
  quantity,
  unit,
  quantityBasis,
  areaAcre,
}: {
  quantity: number;
  unit: string;
  quantityBasis?: QuantityBasis;
  areaAcre: number;
}): number {
  const normalizedUnit = normalizeUnit(unit);
  const useAreaMultiplier = shouldApplyAreaMultiplier(normalizedUnit, quantityBasis);
  if (!useAreaMultiplier) return quantity;
  if (!Number.isFinite(areaAcre) || areaAcre <= 0) return quantity;
  return quantity * areaAcre;
}

function toProductMassKg({
  quantity,
  unit,
  quantityBasis,
  areaAcre,
  waterVolumeL,
  densityKgPerL,
}: {
  quantity: number;
  unit: string;
  quantityBasis?: QuantityBasis;
  areaAcre: number;
  waterVolumeL?: number | null;
  densityKgPerL?: number | null;
}): number | null {
  const normalizedUnit = normalizeUnit(unit);
  const totalQuantity = resolveTotalQuantity({
    quantity,
    unit: normalizedUnit,
    quantityBasis,
    areaAcre,
  });
  const density = resolveDensity(densityKgPerL);
  const unitToken = stripPerAcreSuffix(normalizedUnit);

  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) return null;

  switch (unitToken) {
    case 'kg':
      return totalQuantity;
    case 'gram':
    case 'gm':
      return totalQuantity / 1000;
    case 'liter':
    case 'l':
      return totalQuantity * density;
    case 'ml':
      return (totalQuantity / 1000) * density;
    case 'gm/l':
    case 'gm/liter': {
      if (!waterVolumeL || !Number.isFinite(waterVolumeL) || waterVolumeL <= 0) return null;
      return (totalQuantity * waterVolumeL) / 1000;
    }
    case 'ml/l':
    case 'ml/liter': {
      if (!waterVolumeL || !Number.isFinite(waterVolumeL) || waterVolumeL <= 0) return null;
      return ((totalQuantity * waterVolumeL) / 1000) * density;
    }
    case 'ppm': {
      // ppm ~= mg/L for water-based solution
      if (!waterVolumeL || !Number.isFinite(waterVolumeL) || waterVolumeL <= 0) return null;
      return (totalQuantity * waterVolumeL) / 1000000;
    }
    default:
      return null;
  }
}

function toElementalTotals(
  composition: NutrientCompositionItem[] | null | undefined,
  productMassKg: number,
): NutrientTotals {
  const cleanComposition = sanitizeComposition(composition);
  const totals: NutrientTotals = {};

  cleanComposition.forEach((entry) => {
    const declaredKg = productMassKg * (entry.percent / 100);
    const conversion = OXIDE_TO_ELEMENTAL_FACTORS[entry.nutrient_code] ?? {
      elemental: entry.nutrient_code,
      factor: 1,
    };
    const elementalKg = declaredKg * conversion.factor;
    totals[conversion.elemental] = (totals[conversion.elemental] ?? 0) + elementalKg;
  });

  const rounded: NutrientTotals = {};
  for (const [key, value] of Object.entries(totals)) {
    rounded[key] = roundTo(value, 6);
  }
  return rounded;
}

export function calculateNutrientTotalsForLog({
  items,
  areaAcre,
  waterVolumeL,
}: {
  items: AppliedItem[];
  areaAcre: number;
  waterVolumeL?: number | null;
}): LogNutrientResult {
  let totals: NutrientTotals = {};
  let itemCount = 0;
  let composedItemCount = 0;

  items.forEach((item) => {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    itemCount += 1;

    const composition = sanitizeComposition(item.composition_snapshot);
    if (composition.length === 0) return;

    const productMassKg = toProductMassKg({
      quantity,
      unit: item.unit,
      quantityBasis: item.quantity_basis,
      areaAcre,
      waterVolumeL,
      densityKgPerL: item.density_kg_per_l,
    });

    if (!productMassKg || productMassKg <= 0) return;
    composedItemCount += 1;
    totals = addToTotals(totals, toElementalTotals(composition, productMassKg));
  });

  const perAcreTotals: NutrientTotals = {};
  for (const [key, value] of Object.entries(totals)) {
    const perAcreValue = areaAcre > 0 ? value / areaAcre : value;
    perAcreTotals[key] = roundTo(perAcreValue, 6);
    totals[key] = roundTo(value, 6);
  }

  const coveragePercent = itemCount > 0 ? roundTo((composedItemCount / itemCount) * 100, 2) : 0;

  return {
    nutrientTotalsElemental: totals,
    nutrientTotalsElementalPerAcre: perAcreTotals,
    coveragePercent,
    itemCount,
    composedItemCount,
  };
}

function parseNutrientTotals(value: unknown): NutrientTotals | null {
  if (!value || typeof value !== 'object') return null;
  const parsed: NutrientTotals = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      parsed[key] = numeric;
    }
  });
  return Object.keys(parsed).length > 0 ? parsed : null;
}

function resolveSprayTotalsPerAcre(record: SprayRecord): ResolvedLogIntervalTotals {
  const items = (record.chemical_items ?? []) as SprayChemicalItem[];
  if (items.length > 0) {
    const computed = calculateNutrientTotalsForLog({
      items,
      areaAcre: record.area ?? 0,
      waterVolumeL: record.dose?.match(/Water:\s*(\d+(?:\.\d+)?)/i)
        ? Number.parseFloat(record.dose.match(/Water:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? '')
        : null,
    });
    return {
      totalsPerAcre: computed.nutrientTotalsElementalPerAcre,
      coveragePercent: resolveLogCoveragePercent(
        record.nutrient_calc_coverage,
        computed.nutrientTotalsElementalPerAcre,
        computed.coveragePercent,
      ),
    };
  }

  const persisted = parseNutrientTotals(record.nutrient_totals_elemental_per_acre) ?? {};
  return {
    totalsPerAcre: persisted,
    coveragePercent: resolveLogCoveragePercent(record.nutrient_calc_coverage, persisted),
  };
}

function resolveFertigationTotalsPerAcre(record: FertigationRecord): ResolvedLogIntervalTotals {
  const items = (record.fertilizers ?? []) as FertilizerItem[];
  if (items.length > 0) {
    const computed = calculateNutrientTotalsForLog({
      items,
      areaAcre: record.area ?? 0,
      waterVolumeL: record.water_volume ?? null,
    });
    return {
      totalsPerAcre: computed.nutrientTotalsElementalPerAcre,
      coveragePercent: resolveLogCoveragePercent(
        record.nutrient_calc_coverage,
        computed.nutrientTotalsElementalPerAcre,
        computed.coveragePercent,
      ),
    };
  }

  const persisted = parseNutrientTotals(record.nutrient_totals_elemental_per_acre) ?? {};
  return {
    totalsPerAcre: persisted,
    coveragePercent: resolveLogCoveragePercent(record.nutrient_calc_coverage, persisted),
  };
}

function resolveLogCoveragePercent(
  coverage: number | null | undefined,
  fallbackTotals: NutrientTotals,
  fallbackCoverage?: number,
): number {
  if (typeof coverage === 'number' && Number.isFinite(coverage) && coverage >= 0) {
    return coverage;
  }
  if (
    typeof fallbackCoverage === 'number' &&
    Number.isFinite(fallbackCoverage) &&
    fallbackCoverage >= 0
  ) {
    return fallbackCoverage;
  }
  return Object.keys(fallbackTotals).length > 0 ? 100 : 0;
}

export function aggregateNutrientsBetweenPetioleTests({
  testDates,
  sprayRecords,
  fertigationRecords,
}: {
  testDates: string[];
  sprayRecords: SprayRecord[];
  fertigationRecords: FertigationRecord[];
}): PetioleIntervalNutrientTotals[] {
  if (testDates.length < 2) return [];
  const sortedDates = [...testDates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const intervals: PetioleIntervalNutrientTotals[] = [];
  for (let i = 1; i < sortedDates.length; i += 1) {
    const fromDate = sortedDates[i - 1];
    const toDate = sortedDates[i];
    const fromTs = new Date(fromDate).getTime();
    const toTs = new Date(toDate).getTime();

    let totalsPerAcre: NutrientTotals = {};
    let totalLogCount = 0;
    let coveredLogCount = 0;

    sprayRecords.forEach((record) => {
      const recordTs = new Date(record.date).getTime();
      if (!(recordTs > fromTs && recordTs <= toTs)) return;
      const resolved = resolveSprayTotalsPerAcre(record);
      totalsPerAcre = addToTotals(totalsPerAcre, resolved.totalsPerAcre);
      totalLogCount += 1;
      if (resolved.coveragePercent >= 100) {
        coveredLogCount += 1;
      }
    });

    fertigationRecords.forEach((record) => {
      const recordTs = new Date(record.date).getTime();
      if (!(recordTs > fromTs && recordTs <= toTs)) return;
      const resolved = resolveFertigationTotalsPerAcre(record);
      totalsPerAcre = addToTotals(totalsPerAcre, resolved.totalsPerAcre);
      totalLogCount += 1;
      if (resolved.coveragePercent >= 100) {
        coveredLogCount += 1;
      }
    });

    const roundedTotals: NutrientTotals = {};
    for (const [key, value] of Object.entries(totalsPerAcre)) {
      roundedTotals[key] = roundTo(value, 4);
    }

    intervals.push({
      fromDate,
      toDate,
      totalsPerAcre: roundedTotals,
      coveragePercent:
        totalLogCount > 0 ? roundTo((coveredLogCount / totalLogCount) * 100, 2) : 100,
      totalLogCount,
    });
  }

  return intervals;
}
