import type {
  FertigationRecord,
  FertilizerItem,
  NutrientCompositionItem,
  QuantityBasis,
  SprayChemicalItem,
  SprayRecord,
} from '@/types';
import {
  CANONICAL_CODE_BY_NORMALIZED,
  DEFAULT_DENSITY_KG_PER_L,
  OXIDE_TO_ELEMENTAL_FACTORS,
  sanitizeComposition,
} from '@/constants/nutrient-definitions';
import { totalFor } from '@/lib/quantity';
import {
  type AreaUnitPreference,
  convertAreaToAcres,
  resolveAreaUnitPreference,
} from '@/utils/preferences';
import type { NutrientLedger, NutrientLedgerRow } from '@/types/report';

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

function resolveDensity(densityKgPerL?: number | null): number {
  if (typeof densityKgPerL === 'number' && Number.isFinite(densityKgPerL) && densityKgPerL > 0) {
    return densityKgPerL;
  }
  return DEFAULT_DENSITY_KG_PER_L;
}

/**
 * Convert a stored record.area (raw in the farm's preferred unit — acres OR
 * hectares) into canonical acres for the nutrient kernel's per-acre math.
 * Mirrors report-compute.ts: record.area is NEVER acres-by-contract when the
 * farm prefers hectares; feeding raw hectares inflates per-acre totals
 * ~2.47×. Hoisted to module scope so the save path, read path, and ledger
 * all share one conversion.
 */
function recordAreaAcres(
  area: number | null | undefined,
  areaUnit: AreaUnitPreference | string | null | undefined,
): number {
  if (typeof area !== 'number' || !Number.isFinite(area) || area <= 0) return 0;
  return convertAreaToAcres(area, resolveAreaUnitPreference(areaUnit ?? undefined));
}

/**
 * Resolve a stored line item into product mass (kg) using the quantity kernel.
 *
 * The kernel (totalFor) handles unit parsing, per-acre and per-liter-water
 * basis resolution, and every legacy unit spelling. The only thing left here is
 * the volume→mass conversion: when the kernel returns a volume result (L), we
 * multiply by density to get kg.
 *
 * Density defaults to DEFAULT_DENSITY_KG_PER_L (1 kg/L) when not supplied.
 * Unknown units and missing context (no water volume for concentration units,
 * no area for per-acre units) return null — never guessed, never padded.
 */
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
  const density = resolveDensity(densityKgPerL);

  const canonical = totalFor(
    { quantity, unit, quantityBasis: quantityBasis ?? null },
    {
      areaAcres: Number.isFinite(areaAcre) && areaAcre > 0 ? areaAcre : null,
      waterLiters:
        typeof waterVolumeL === 'number' && Number.isFinite(waterVolumeL) && waterVolumeL > 0
          ? waterVolumeL
          : null,
    },
  );

  if (canonical === null) return null;
  if (!Number.isFinite(canonical.value) || canonical.value <= 0) return null;

  // Mass result is already in kg — return directly.
  if (canonical.measure === 'mass') return canonical.value;

  // Volume result is in L — convert to kg via density.
  if (canonical.measure === 'volume') return canonical.value * density;

  // Count (pcs/bags) — no kg conversion meaningful; excluded from totals.
  return null;
}

function toElementalTotals(
  composition: NutrientCompositionItem[] | null | undefined,
  productMassKg: number,
): NutrientTotals {
  const cleanComposition = sanitizeComposition(composition);
  const totals: NutrientTotals = {};

  cleanComposition.forEach((entry) => {
    const declaredKg = productMassKg * (entry.percent / 100);
    // Canonicalize the fallback key: sanitize uppercased the code, but every
    // downstream consumer (ledger macro/oxide maps, petiole element rows)
    // speaks mixed case — 'CA' here with 'Ca' from CaO would split one
    // element into two rows and drop its bag-grade values.
    const conversion = OXIDE_TO_ELEMENTAL_FACTORS[entry.nutrient_code] ?? {
      elemental: CANONICAL_CODE_BY_NORMALIZED[entry.nutrient_code] ?? entry.nutrient_code,
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

/**
 * Spray records carry water volume only inside the free-text dose string —
 * always written as "Water: <n>L" by the submission paths. One parser for
 * every consumer in this module, and the same L-suffix requirement as
 * report-service's parseWaterVolumeFromDose: a number in another unit
 * ("Water: 200mL") must not be read as liters and inflate nutrient mass.
 */
export function parseSprayWaterVolumeL(dose: string | null | undefined): number | null {
  const match = dose?.match(/Water:\s*(\d+(?:\.\d+)?)\s*L/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1] ?? '');
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveSprayTotalsPerAcre(
  record: SprayRecord,
  areaUnit: AreaUnitPreference,
): ResolvedLogIntervalTotals {
  const items = (record.chemical_items ?? []) as SprayChemicalItem[];
  if (items.length > 0) {
    const computed = calculateNutrientTotalsForLog({
      items,
      areaAcre: recordAreaAcres(record.area, areaUnit),
      waterVolumeL: parseSprayWaterVolumeL(record.dose),
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

function resolveFertigationTotalsPerAcre(
  record: FertigationRecord,
  areaUnit: AreaUnitPreference,
): ResolvedLogIntervalTotals {
  const items = (record.fertilizers ?? []) as FertilizerItem[];
  if (items.length > 0) {
    const computed = calculateNutrientTotalsForLog({
      items,
      areaAcre: recordAreaAcres(record.area, areaUnit),
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
  areaUnit,
}: {
  testDates: string[];
  sprayRecords: SprayRecord[];
  fertigationRecords: FertigationRecord[];
  /** The farm's preferred area unit — record.area is RAW in this unit, not acres.
   *  Required so future omitted-unit regressions surface as compile errors, not
   *  silent ~2.47× per-acre inflation on hectares farms. */
  areaUnit: AreaUnitPreference;
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
      const resolved = resolveSprayTotalsPerAcre(record, areaUnit);
      totalsPerAcre = addToTotals(totalsPerAcre, resolved.totalsPerAcre);
      totalLogCount += 1;
      if (resolved.coveragePercent >= 100) {
        coveredLogCount += 1;
      }
    });

    fertigationRecords.forEach((record) => {
      const recordTs = new Date(record.date).getTime();
      if (!(recordTs > fromTs && recordTs <= toTs)) return;
      const resolved = resolveFertigationTotalsPerAcre(record, areaUnit);
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

// ─── Nutrient Ledger (issue #200) ──────────────────────────────────────────

/**
 * Elemental → oxide conversion for dual-basis display.
 *
 * Keys are elemental symbols; each entry names its display symbol and the
 * OXIDE_TO_ELEMENTAL_FACTORS key it inverts (elemental ÷ factor = oxide kg) —
 * ONE canonical factor source, so a factor update can never leave the ledger
 * display disagreeing with nutrient normalization. Only macros with a
 * bag-grade convention are listed; micros stay elemental-only.
 */
const ELEMENTAL_TO_OXIDE: Record<string, { symbol: string; inverseFactor: number }> =
  Object.fromEntries(
    (
      [
        ['P', 'P₂O₅', 'P2O5'],
        ['K', 'K₂O', 'K2O'],
        ['Ca', 'CaO', 'CAO'],
        ['Mg', 'MgO', 'MGO'],
        ['S', 'SO₃', 'SO3'],
      ] as const
    ).map(([element, symbol, factorKey]) => [
      element,
      { symbol, inverseFactor: OXIDE_TO_ELEMENTAL_FACTORS[factorKey].factor },
    ]),
  );

/** Macro display order — N first, then primary oxides, then secondary. */
const MACRO_ORDER = ['N', 'P', 'K', 'Ca', 'Mg', 'S'];

/**
 * Micronutrient display order (issue #235) — agronomic convention for the
 * grape belt (Fe chlorosis first, Zn, then the rest), not alphabetical.
 * Elements outside both orders (Na, Cl, free-form codes) sort after these.
 */
const MICRO_ORDER = ['Fe', 'Zn', 'Mn', 'Cu', 'B', 'Mo'];

/**
 * Build a sorted NutrientLedgerRow[] from an elemental totals map, with
 * optional per-acre figures and oxide equivalents for macros.
 */
function buildLedgerRows(
  elementalTotals: NutrientTotals,
  elementalTotalsPerAcre: NutrientTotals | null,
): NutrientLedgerRow[] {
  const elements = Object.keys(elementalTotals);
  if (elements.length === 0) return [];

  // Sort: MACRO_ORDER first (in sequence), then MICRO_ORDER (in sequence),
  // then anything else alphabetically.
  const macroSet = new Set(MACRO_ORDER);
  const microSet = new Set(MICRO_ORDER);
  const macros = MACRO_ORDER.filter((el) => elementalTotals[el] != null);
  const micros = MICRO_ORDER.filter(
    (el) => elementalTotals[el] != null && Number.isFinite(elementalTotals[el]),
  );
  const others = elements
    .filter((el) => !macroSet.has(el) && !microSet.has(el) && Number.isFinite(elementalTotals[el]))
    .sort();

  return [...macros, ...micros, ...others].map((element) => {
    const elementalKg = roundTo(elementalTotals[element] ?? 0, 6);
    const perAcreRaw = elementalTotalsPerAcre?.[element];
    const elementalKgPerAcre =
      perAcreRaw != null && Number.isFinite(perAcreRaw) ? roundTo(perAcreRaw, 6) : null;

    const oxide = Object.hasOwn(ELEMENTAL_TO_OXIDE, element)
      ? ELEMENTAL_TO_OXIDE[element]
      : undefined;

    if (!oxide) {
      return { element, elementalKg, elementalKgPerAcre };
    }

    const oxideKg = roundTo(elementalKg / oxide.inverseFactor, 6);
    const oxideKgPerAcre =
      elementalKgPerAcre != null ? roundTo(elementalKgPerAcre / oxide.inverseFactor, 6) : undefined;

    return {
      element,
      elementalKg,
      elementalKgPerAcre,
      oxideSymbol: oxide.symbol,
      oxideKg,
      oxideKgPerAcre,
    };
  });
}

/**
 * Calculate a nutrient ledger for a given date range by aggregating spray
 * and fertigation records, following the same coverage-honesty rules as
 * calculateNutrientTotalsForLog: items without a composition_snapshot are
 * excluded from totals but counted in the coverage denominator.
 *
 * Per-plot and per-acre totals are both provided. Per-acre is null when
 * areaAcres is not a valid positive number.
 */
export function calculateNutrientLedger({
  sprayRecords,
  fertigationRecords,
  fromDate,
  toDate,
  areaAcres,
  areaUnit,
}: {
  sprayRecords: SprayRecord[];
  fertigationRecords: FertigationRecord[];
  fromDate: string;
  toDate: string;
  areaAcres: number | null | undefined;
  /** The user's stored-area unit — record.area is RAW in this unit, not acres. */
  areaUnit?: AreaUnitPreference | string | null;
}): NutrientLedger {
  const validArea =
    typeof areaAcres === 'number' && Number.isFinite(areaAcres) && areaAcres > 0 ? areaAcres : null;

  // Filter records by date range (inclusive on both ends)
  const inRange = <T extends { date: string }>(records: T[]): T[] =>
    records.filter((r) => {
      const d = r.date.slice(0, 10);
      return d >= fromDate && d <= toDate;
    });

  let totals: NutrientTotals = {};
  let itemCount = 0;
  let composedItemCount = 0;

  const processItems = (
    items: Array<{
      quantity: number | string;
      unit: string;
      quantity_basis?: QuantityBasis;
      composition_snapshot?: NutrientCompositionItem[] | null;
      density_kg_per_l?: number | null;
    }>,
    recordAreaAcre: number,
    waterVolumeL: number | null,
  ) => {
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
        areaAcre: recordAreaAcre,
        waterVolumeL,
        densityKgPerL: item.density_kg_per_l,
      });

      if (!productMassKg || productMassKg <= 0) return;
      composedItemCount += 1;
      totals = addToTotals(totals, toElementalTotals(composition, productMassKg));
    });
  };

  // record.area is stored RAW in the user's preferred unit (acres or
  // hectares) — same contract as report generation, which converts before any
  // per-acre math. Feeding hectares into the kernel's per_acre context would
  // under-report every per-acre item 2.47105× on hectare-preference farms.
  // Uses the module-scope recordAreaAcres helper.

  // Spray records
  inRange(sprayRecords).forEach((record) => {
    const items = (record.chemical_items ?? []) as SprayChemicalItem[];
    if (items.length === 0) return;
    processItems(
      items,
      recordAreaAcres(record.area, areaUnit),
      parseSprayWaterVolumeL(record.dose),
    );
  });

  // Fertigation records
  inRange(fertigationRecords).forEach((record) => {
    const items = (record.fertilizers ?? []) as FertilizerItem[];
    if (items.length === 0) return;
    processItems(items, recordAreaAcres(record.area, areaUnit), record.water_volume ?? null);
  });

  // Build per-acre totals
  const elementalPerAcre: NutrientTotals | null = validArea
    ? Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [key, roundTo(value / validArea, 6)]),
      )
    : null;

  // Round plot totals
  const roundedTotals: NutrientTotals = {};
  for (const [key, value] of Object.entries(totals)) {
    roundedTotals[key] = roundTo(value, 6);
  }

  // Floor at 0.01 when anything composed: 1 item among tens of thousands
  // rounds to 0.00, and every surface treats exactly-0 as "nothing computable".
  const rawCoveragePercent = itemCount > 0 ? roundTo((composedItemCount / itemCount) * 100, 2) : 0;
  const coveragePercent =
    composedItemCount > 0 ? Math.max(rawCoveragePercent, 0.01) : rawCoveragePercent;

  return {
    rows: buildLedgerRows(roundedTotals, elementalPerAcre),
    coveragePercent,
    itemCount,
    composedItemCount,
    areaAcres: validArea,
    fromDate,
    toDate,
  };
}
