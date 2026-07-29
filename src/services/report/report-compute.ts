import {
  ReportData,
  ReportSummary,
  ReportPreview,
  DateRange,
  ReportType,
  ReportStockUsageRecord,
  ReportPlanItemInput,
  ReportUsageLenses,
  FpcActivityDayRow,
  FpcActivityProductRow,
} from '../../types/report';
import {
  Farm,
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  ExpenseRecord,
  WarehouseItem,
  QuantityBasis,
} from '../../types/database';
import { formatDate } from '@/i18n/format';
import {
  AreaUnitPreference,
  convertAreaToAcres,
  resolveAreaUnitPreference,
} from '@/utils/preferences';
import { getDaysAfterPruning } from '@/utils/date';
import { format as formatQuantity, parseUnit, totalFor } from '@/lib/quantity';
import { computeUsageLenses, type UsageEvent } from '../report-usage-lenses';
import { calculateNutrientLedger } from '../nutrient-flow-service';
import {
  filterByDateRange,
  sortRecordsByDateDesc,
  getVisibleSections,
  resolveSeasonName,
  resolveSeasonWindow,
  resolveSprayChemicalLabel,
  resolveSprayDoseLabel,
  normalizeName,
  measureUnitLabel,
} from './report-format';
import {
  normalizeUnit,
  resolveAppliedQuantity,
  parseWaterVolumeFromDose,
  positiveOrNull,
  resolveSprayUsageItems,
  resolveFertigationUsageItems,
  toRounded,
} from './report-units';
import type { ReportGenerationOptions } from './report-types';

function matchWarehouseAndEstimateStock(
  rows: Array<
    ReportStockUsageRecord & {
      normalizedName: string;
      warehouseItemIds: Set<number>;
      catalogProductIds: Set<number>;
    }
  >,
  warehouseItems: WarehouseItem[],
): ReportStockUsageRecord[] {
  const byId = new Map<number, WarehouseItem>();
  const byCatalogProductId = new Map<string, WarehouseItem[]>();
  const byNameUnitType = new Map<string, WarehouseItem[]>();

  warehouseItems.forEach((item) => {
    const itemId = item.id;
    if (itemId == null) return;
    byId.set(itemId, item);

    const normalizedName = normalizeName(item.name);
    const normalizedUnit = normalizeUnit(item.unit).normalizedUnit;
    const type = item.type === 'fertilizer' ? 'fertilizer' : 'spray';
    const key = `${type}::${normalizedName}::${normalizedUnit}`;
    const existing = byNameUnitType.get(key) ?? [];
    byNameUnitType.set(key, [...existing, item]);

    if (item.catalog_product_id != null) {
      const catalogKey = `${type}::${item.catalog_product_id}`;
      const existingCatalog = byCatalogProductId.get(catalogKey) ?? [];
      byCatalogProductId.set(catalogKey, [...existingCatalog, item]);
    }
  });

  return rows
    .map((row) => {
      let matchedWarehouse: WarehouseItem | null = null;
      let matchStrategy: ReportStockUsageRecord['matchStrategy'] = 'unmatched';

      const sortedWarehouseIds = Array.from(row.warehouseItemIds).sort((a, b) => a - b);
      for (const id of sortedWarehouseIds) {
        const found = byId.get(id);
        if (found) {
          matchedWarehouse = found;
          matchStrategy = 'warehouse_item_id';
          break;
        }
      }

      if (!matchedWarehouse && row.catalogProductIds.size > 0) {
        const sortedCatalogProductIds = Array.from(row.catalogProductIds).sort((a, b) => a - b);
        for (const catalogProductId of sortedCatalogProductIds) {
          const candidates = byCatalogProductId.get(`${row.type}::${catalogProductId}`) ?? [];
          if (candidates.length === 1) {
            matchedWarehouse = candidates[0];
            matchStrategy = 'catalog_product_id';
            break;
          }
        }
      }

      if (!matchedWarehouse) {
        const key = `${row.type}::${row.normalizedName}::${row.unit}`;
        const candidates = byNameUnitType.get(key) ?? [];
        if (candidates.length === 1) {
          matchedWarehouse = candidates[0];
          matchStrategy = 'name_unit_fallback';
        }
      }

      if (!matchedWarehouse || matchedWarehouse.id == null) {
        return {
          itemName: row.itemName,
          type: row.type,
          quantityUsed: toRounded(row.quantityUsed, 4),
          unit: row.unit,
          areaTreated: toRounded(row.areaTreated, 2),
          usageCount: row.usageCount,
          warehouseItemId: null,
          catalogProductId: null,
          currentStockQuantity: null,
          estimatedOpeningStockQuantity: null,
          estimatedConsumedPercent: null,
          matchStrategy: 'unmatched',
        } satisfies ReportStockUsageRecord;
      }

      const warehouseUnit = normalizeUnit(matchedWarehouse.unit);
      const currentStockQuantity =
        warehouseUnit.normalizedUnit === row.unit
          ? matchedWarehouse.quantity * warehouseUnit.multiplier
          : null;

      // Note: This estimate assumes current stock is the result of applying all usages since opening.
      // It does not account for refills or adjustments outside this report's scope.
      const estimatedOpeningStockQuantity =
        currentStockQuantity != null ? currentStockQuantity + row.quantityUsed : null;
      const estimatedConsumedPercent =
        estimatedOpeningStockQuantity != null && estimatedOpeningStockQuantity > 0
          ? (row.quantityUsed / estimatedOpeningStockQuantity) * 100
          : null;

      return {
        itemName: row.itemName,
        type: row.type,
        quantityUsed: toRounded(row.quantityUsed, 4),
        unit: row.unit,
        areaTreated: toRounded(row.areaTreated, 2),
        usageCount: row.usageCount,
        warehouseItemId: matchedWarehouse.id,
        catalogProductId: matchedWarehouse.catalog_product_id ?? null,
        currentStockQuantity:
          currentStockQuantity != null ? toRounded(currentStockQuantity, 4) : null,
        estimatedOpeningStockQuantity:
          estimatedOpeningStockQuantity != null
            ? toRounded(estimatedOpeningStockQuantity, 4)
            : null,
        estimatedConsumedPercent:
          estimatedConsumedPercent != null ? toRounded(estimatedConsumedPercent, 2) : null,
        matchStrategy,
      } satisfies ReportStockUsageRecord;
    })
    .sort((a, b) => {
      const itemNameCmp = a.itemName.localeCompare(b.itemName);
      if (itemNameCmp !== 0) return itemNameCmp;
      return a.unit.localeCompare(b.unit);
    });
}

/**
 * Calculate stock usage from records
 */
function calculateStockUsage(
  sprays: SprayRecord[],
  fertigations: FertigationRecord[],
  dateRange: DateRange,
  warehouseItems: WarehouseItem[],
  areaUnit?: AreaUnitPreference,
): ReportStockUsageRecord[] {
  const usageMap = new Map<
    string,
    ReportStockUsageRecord & {
      normalizedName: string;
      warehouseItemIds: Set<number>;
      catalogProductIds: Set<number>;
    }
  >();
  const unmatchedUsageMap = new Map<string, ReportStockUsageRecord>();
  const filteredSprays = filterByDateRange(sprays, dateRange);
  const filteredFertigations = filterByDateRange(fertigations, dateRange);

  const upsertUsage = (
    type: 'spray' | 'fertilizer',
    name: string,
    quantity: number,
    unit: string,
    quantityBasis: QuantityBasis | null | undefined,
    area: number,
    warehouseItemId?: number | null,
    catalogProductId?: number | null,
    waterVolumeL?: number | null,
  ) => {
    const normalizedName = normalizeName(name);
    if (!normalizedName) return;

    let resolved: { quantity: number; normalizedUnit: string } | null;
    const parsedUnit = parseUnit(unit);
    if (parsedUnit?.basis === 'per_liter_water') {
      // Kernel contract: the unit string's basis wins over the stored
      // quantity_basis column — a 'gm/L' or 'ppm' item is a concentration
      // and resolves through the record's water volume, never through area.
      if (!positiveOrNull(waterVolumeL)) {
        console.warn(
          `Item "${name}" added to unmatched usage: missing water volume required for concentration-based unit "${unit}"`,
        );
        const unmatchedKey = `${type}::${normalizedName}::${unit.trim().toLowerCase()}`;
        const existingUnmatched = unmatchedUsageMap.get(unmatchedKey);
        if (existingUnmatched) {
          existingUnmatched.quantityUsed += quantity;
          existingUnmatched.areaTreated += area;
          existingUnmatched.usageCount += 1;
        } else {
          unmatchedUsageMap.set(unmatchedKey, {
            itemName: name.trim().replace(/\s+/g, ' '),
            type,
            quantityUsed: quantity,
            unit: unit.trim().toLowerCase(),
            areaTreated: area,
            usageCount: 1,
            warehouseItemId: null,
            catalogProductId: null,
            currentStockQuantity: null,
            estimatedOpeningStockQuantity: null,
            estimatedConsumedPercent: null,
            matchStrategy: 'unmatched',
          });
        }
        return;
      }
      const total = totalFor({ quantity, unit }, { waterLiters: waterVolumeL });
      resolved = total
        ? { quantity: total.value, normalizedUnit: measureUnitLabel(total.measure) }
        : null;
    } else {
      resolved = resolveAppliedQuantity(quantity, unit, quantityBasis, area);
    }
    if (!resolved) return;

    const key = `${type}::${normalizedName}::${resolved.normalizedUnit}`;
    const existing = usageMap.get(key);
    if (existing) {
      existing.quantityUsed += resolved.quantity;
      existing.areaTreated += area;
      existing.usageCount += 1;
      if (warehouseItemId != null) {
        existing.warehouseItemIds.add(warehouseItemId);
      }
      if (catalogProductId != null) {
        existing.catalogProductIds.add(catalogProductId);
      }
      return;
    }

    usageMap.set(key, {
      itemName: name.trim().replace(/\s+/g, ' '),
      type,
      quantityUsed: resolved.quantity,
      unit: resolved.normalizedUnit,
      areaTreated: area,
      usageCount: 1,
      normalizedName,
      warehouseItemIds: warehouseItemId != null ? new Set([warehouseItemId]) : new Set<number>(),
      catalogProductIds: catalogProductId != null ? new Set([catalogProductId]) : new Set<number>(),
    });
  };

  // record.area is stored raw in the user's preferred unit (see
  // entry-log-submission.ts) — convert to acres before per-acre math so
  // Stock Usage and the per-acre lens can never contradict each other on
  // a hectare-preference farm. (Caveat: this applies the CURRENT
  // preference; a preference change after logging shifts both sections
  // together rather than silently splitting them.)
  const recordAreaAcres = (area: number) =>
    convertAreaToAcres(area, resolveAreaUnitPreference(areaUnit));

  filteredSprays.forEach((record) => {
    const waterVolumeL = parseWaterVolumeFromDose(record.dose);
    resolveSprayUsageItems(record).forEach((item) => {
      upsertUsage(
        'spray',
        item.name,
        item.quantity,
        item.unit,
        item.quantityBasis,
        recordAreaAcres(record.area),
        item.warehouseItemId,
        item.catalogProductId,
        waterVolumeL,
      );
    });
  });

  filteredFertigations.forEach((record) => {
    resolveFertigationUsageItems(record).forEach((item) => {
      upsertUsage(
        'fertilizer',
        item.name,
        item.quantity,
        item.unit,
        item.quantityBasis,
        recordAreaAcres(record.area),
        item.warehouseItemId,
        item.catalogProductId,
        positiveOrNull(record.water_volume),
      );
    });
  });

  const matchedAndUnmatchedFromWarehouse = matchWarehouseAndEstimateStock(
    Array.from(usageMap.values()),
    warehouseItems,
  );
  const missingWaterRows = Array.from(unmatchedUsageMap.values()).map((row) => ({
    ...row,
    quantityUsed: toRounded(row.quantityUsed, 4),
    areaTreated: toRounded(row.areaTreated, 2),
  }));

  return [...matchedAndUnmatchedFromWarehouse, ...missingWaterRows];
}

/**
 * FPC activity register (Fratelli format): one chronological table, one row
 * per product applied, grouped under each date. Day-level columns come from
 * irrigation records (hours, mm, growth stage); product rows come from
 * spray chemical items and fertigation fertilizers.
 *
 * Water mm = Σ(duration × system discharge). The discharge stored on
 * records comes from the System Discharge calculator, whose output is
 * L/m²/hr — i.e. mm/hr — so hours × discharge is depth in mm.
 */
function buildFpcActivity(
  farm: Farm,
  irrigations: IrrigationRecord[],
  sprays: SprayRecord[],
  fertigations: FertigationRecord[],
  options: ReportGenerationOptions,
): FpcActivityDayRow[] {
  const lookups = options.fpcLookups ?? {};
  const recordAreaAcres = (area: number | null | undefined): number | null => {
    const positive = positiveOrNull(area ?? null) ?? positiveOrNull(farm.area);
    return positive == null
      ? null
      : convertAreaToAcres(positive, resolveAreaUnitPreference(options.areaUnit));
  };

  const isoDateOf = (record: { date: string }) => record.date.slice(0, 10);
  const dayKeys = new Set<string>([
    ...irrigations.map(isoDateOf),
    ...sprays.map(isoDateOf),
    ...fertigations.map(isoDateOf),
  ]);

  const asLoggedLabel = (item: {
    quantity: number;
    unit: string;
    quantityBasis?: QuantityBasis;
  }) => {
    const unit = item.unit.trim();
    const needsPerAcreSuffix =
      item.quantityBasis === 'per_acre' && !unit.toLowerCase().includes('/acre');
    return `${item.quantity} ${unit}${needsPerAcreSuffix ? '/acre' : ''}`;
  };

  const buildProductRows = (
    source: 'spray' | 'fertigation',
    keyPrefix: string,
    items: ReturnType<typeof resolveSprayUsageItems>,
    areaAcres: number | null,
    waterLiters: number | null,
    sprayRecord?: SprayRecord,
  ): FpcActivityProductRow[] =>
    items.map((item, index) => {
      const total = totalFor(
        { quantity: item.quantity, unit: item.unit, quantityBasis: item.quantityBasis },
        { areaAcres, waterLiters },
      );
      const perAcreValue = total && areaAcres != null ? total.value / areaAcres : null;

      const productId = item.catalogProductId ?? null;
      const technicalName =
        productId != null ? (lookups.technicalNameByProductId?.[productId] ?? null) : null;
      const mrl = productId != null ? (lookups.mrlByProductId?.[productId] ?? null) : null;

      // Per-product PHI: label claim first; else the spray record's
      // governing PHI, but only when it is attributable to this item
      // (single-item mix, or this item is the blocking component) —
      // stamping the governing PHI on every co-mixed product would
      // overstate what the label says about each of them.
      const claimPhi = productId != null ? (lookups.phiDaysByProductId?.[productId] ?? null) : null;
      const normalizedItemName = normalizeName(item.name);
      const governingAttributable =
        sprayRecord != null &&
        sprayRecord.governing_phi_days != null &&
        (items.length === 1 ||
          (sprayRecord.phi_blocking_component != null &&
            normalizeName(sprayRecord.phi_blocking_component) === normalizedItemName));
      const phiDays = claimPhi ?? (governingAttributable ? sprayRecord!.governing_phi_days! : null);

      return {
        key: `${keyPrefix}-${index}`,
        source,
        marketName: item.name,
        technicalName,
        qtyPerAcreDisplay:
          perAcreValue != null ? formatQuantity(perAcreValue, total!.measure) : null,
        totalQtyDisplay: total ? formatQuantity(total.value, total.measure) : null,
        asLogged: asLoggedLabel(item),
        phiDays,
        // Safe harvest is record-level (governed by the mix's strictest
        // component), so it rides the SAME attribution gate as the fallback
        // PHI: show it only where the governing PHI is attributable to this
        // item. Otherwise a co-mixed, non-blocking product would show a blank
        // PHI beside a filled Safe Harvest — implying a PHI outcome we
        // intentionally withheld. A per-product label claim (claimPhi) also
        // qualifies the row, since then the product carries its own PHI.
        safeHarvestDate:
          (claimPhi != null || governingAttributable) && sprayRecord?.safe_harvest_date
            ? formatDate(sprayRecord.safe_harvest_date)
            : null,
        mrl,
      } satisfies FpcActivityProductRow;
    });

  const rows: FpcActivityDayRow[] = [...dayKeys].sort().map((isoDate) => {
    const dayIrrigations = irrigations.filter((r) => isoDateOf(r) === isoDate);
    const daySprays = sprays.filter((r) => isoDateOf(r) === isoDate);
    const dayFertigations = fertigations.filter((r) => isoDateOf(r) === isoDate);

    const anyRecord = dayIrrigations[0] ?? daySprays[0] ?? dayFertigations[0];
    const pruningDate = anyRecord?.date_of_pruning ?? farm.date_of_pruning;

    const irrigationHours = dayIrrigations.reduce((sum, r) => sum + (r.duration || 0), 0);
    const mmContributions = dayIrrigations.filter(
      (r) => positiveOrNull(r.duration) && positiveOrNull(r.system_discharge),
    );
    const waterMm = mmContributions.reduce((sum, r) => sum + r.duration * r.system_discharge, 0);
    const growthStage =
      dayIrrigations.map((r) => r.growth_stage?.trim()).find((stage) => stage) ?? null;

    const products: FpcActivityProductRow[] = [
      ...daySprays.flatMap((record, recordIndex) =>
        buildProductRows(
          'spray',
          `${isoDate}-spr${recordIndex}`,
          resolveSprayUsageItems(record),
          recordAreaAcres(record.area),
          parseWaterVolumeFromDose(record.dose),
          record,
        ),
      ),
      ...dayFertigations.flatMap((record, recordIndex) =>
        buildProductRows(
          'fertigation',
          `${isoDate}-fert${recordIndex}`,
          resolveFertigationUsageItems(record),
          recordAreaAcres(record.area),
          positiveOrNull(record.water_volume),
        ),
      ),
    ];

    const notes = [
      ...new Set(
        [...dayIrrigations, ...daySprays, ...dayFertigations]
          .map((r) => r.notes?.trim())
          .filter((note): note is string => !!note),
      ),
    ].join('; ');

    return {
      date: formatDate(isoDate),
      isoDate,
      daysAfterPruning: getDaysAfterPruning(isoDate, pruningDate),
      irrigationHours: dayIrrigations.length > 0 ? toRounded(irrigationHours, 2) : null,
      waterMm: mmContributions.length > 0 ? toRounded(waterMm, 1) : null,
      growthStage,
      products,
      notes: notes || null,
    } satisfies FpcActivityDayRow;
  });

  return rows;
}

/**
 * Generate report data from farm records
 */
export function generateReportData(
  farm: Farm,
  irrigations: IrrigationRecord[],
  sprays: SprayRecord[],
  fertigations: FertigationRecord[],
  harvests: HarvestRecord[],
  expenses: ExpenseRecord[],
  dateRange: DateRange,
  warehouseItems: WarehouseItem[],
  options: ReportGenerationOptions = {},
): ReportData {
  const { seasonContext, seasonNameById, seasonWindowById, planItems } = options;
  const stockUsage = calculateStockUsage(
    sprays,
    fertigations,
    dateRange,
    warehouseItems,
    options.areaUnit,
  );
  const usage = calculateUsageLenses(
    farm,
    sprays,
    fertigations,
    dateRange,
    planItems,
    options.areaUnit,
  );
  const irrigationRecords = sortRecordsByDateDesc(filterByDateRange(irrigations, dateRange));
  const sprayRecords = sortRecordsByDateDesc(filterByDateRange(sprays, dateRange));
  const fertigationRecords = sortRecordsByDateDesc(filterByDateRange(fertigations, dateRange));
  const harvestRecords = sortRecordsByDateDesc(filterByDateRange(harvests, dateRange));
  const expenseRecords = sortRecordsByDateDesc(filterByDateRange(expenses, dateRange));

  return {
    farmName: farm.name,
    farmVariety: farm.crop_variety?.trim() || farm.crop?.trim() || null,
    pruningDate:
      seasonContext?.mode === 'season'
        ? (seasonContext.seasonStart ?? farm.date_of_pruning ?? null)
        : (farm.date_of_pruning ?? null),
    farmArea: farm.area,
    farmRegion: farm.region,
    dateRange,
    seasonContext,
    irrigation: irrigationRecords.map((r) => ({
      date: formatDate(r.date),
      daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
      seasonId: r.season_id ?? null,
      seasonName: resolveSeasonName(r.season_id, seasonNameById),
      seasonWindow: resolveSeasonWindow(r.season_id, seasonWindowById),
      duration: r.duration,
      area: r.area,
      growthStage: r.growth_stage,
      moistureStatus: r.moisture_status,
      systemDischarge: r.system_discharge,
      notes: r.notes || undefined,
    })),
    spray: sprayRecords.map((r) => ({
      date: formatDate(r.date),
      daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
      seasonId: r.season_id ?? null,
      seasonName: resolveSeasonName(r.season_id, seasonNameById),
      seasonWindow: resolveSeasonWindow(r.season_id, seasonWindowById),
      chemical: resolveSprayChemicalLabel(r),
      dose: resolveSprayDoseLabel(r),
      area: r.area,
      weather: r.weather,
      operator: r.operator,
      notes: r.notes || undefined,
    })),
    fertigation: fertigationRecords.map((r) => ({
      date: formatDate(r.date),
      daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
      seasonId: r.season_id ?? null,
      seasonName: resolveSeasonName(r.season_id, seasonNameById),
      seasonWindow: resolveSeasonWindow(r.season_id, seasonWindowById),
      fertilizers: r.fertilizers
        ? r.fertilizers.map((f) => `${f.name} (${f.quantity} ${f.unit})`).join(', ')
        : 'N/A',
      area: r.area,
      notes: r.notes || undefined,
    })),
    harvest: harvestRecords.map((r) => ({
      date: formatDate(r.date),
      daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
      seasonId: r.season_id ?? null,
      seasonName: resolveSeasonName(r.season_id, seasonNameById),
      seasonWindow: resolveSeasonWindow(r.season_id, seasonWindowById),
      quantity: r.quantity,
      grade: r.grade,
      price: r.price ?? undefined,
      buyer: r.buyer || undefined,
      notes: r.notes || undefined,
    })),
    expense: expenseRecords.map((r) => ({
      date: formatDate(r.date),
      daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
      seasonId: r.season_id ?? null,
      seasonName: resolveSeasonName(r.season_id, seasonNameById),
      seasonWindow: resolveSeasonWindow(r.season_id, seasonWindowById),
      type: r.type,
      cost: r.cost,
      remarks: r.remarks || undefined,
    })),
    stock: stockUsage,
    usage,
    nutrientLedger: calculateNutrientLedger({
      sprayRecords: sprays,
      fertigationRecords: fertigations,
      fromDate: dateRange.from,
      toDate: dateRange.to,
      areaAcres: positiveOrNull(farm.area)
        ? convertAreaToAcres(
            positiveOrNull(farm.area)!,
            resolveAreaUnitPreference(options.areaUnit),
          )
        : null,
      // record.area is raw in this unit too — the ledger converts per record.
      areaUnit: options.areaUnit,
    }),
    fpcActivity: buildFpcActivity(
      farm,
      irrigationRecords,
      sprayRecords,
      fertigationRecords,
      options,
    ),
  };
}

/**
 * Kernel-backed quantity lenses (issue #198): per plot / per acre /
 * per liter of water, plus the plan-compliance delta. `farm.area` is
 * stored in the user's preferred unit (see entry-log-submission.ts), so
 * hectares-preference farms convert ×2.47105 here before any per-acre
 * division; computeUsageLenses hides the lens when area is missing/invalid.
 */
function calculateUsageLenses(
  farm: Farm,
  sprays: SprayRecord[],
  fertigations: FertigationRecord[],
  dateRange: DateRange,
  planItems?: ReportPlanItemInput[],
  areaUnit?: AreaUnitPreference,
): ReportUsageLenses {
  // Per-acre rates resolve against the area snapshotted on the record at
  // logging time (converted from the preferred unit) — editing the farm's
  // area later must not rewrite what was applied. The farm-level area is
  // only the fallback for records without one.
  const recordAreaAcres = (area: number | null | undefined) => {
    const positive = positiveOrNull(area ?? null);
    return positive == null
      ? null
      : convertAreaToAcres(positive, resolveAreaUnitPreference(areaUnit));
  };

  const events: UsageEvent[] = [
    ...filterByDateRange(sprays, dateRange).map((record) => ({
      type: 'spray' as const,
      waterLiters: parseWaterVolumeFromDose(record.dose),
      items: resolveSprayUsageItems(record),
      areaAcres: recordAreaAcres(record.area),
    })),
    ...filterByDateRange(fertigations, dateRange).map((record) => ({
      type: 'fertilizer' as const,
      waterLiters: positiveOrNull(record.water_volume),
      items: resolveFertigationUsageItems(record),
      areaAcres: recordAreaAcres(record.area),
    })),
  ];

  const areaInPreferredUnit = positiveOrNull(farm.area);
  return computeUsageLenses({
    events,
    areaAcres:
      areaInPreferredUnit == null
        ? null
        : convertAreaToAcres(areaInPreferredUnit, resolveAreaUnitPreference(areaUnit)),
    planItems,
  });
}

/**
 * Calculate report summary statistics
 */
export function calculateSummary(data: ReportData, reportType?: ReportType): ReportSummary {
  const visibleSections = reportType ? getVisibleSections(reportType) : null;
  const totalIrrigationHours = data.irrigation.reduce((sum, r) => sum + r.duration, 0);
  const totalWaterUsage = data.irrigation.reduce(
    (sum, r) => sum + r.duration * r.systemDischarge,
    0,
  );
  const totalHarvest = data.harvest.reduce((sum, r) => sum + r.quantity, 0);

  const hasHarvestSection = !visibleSections || visibleSections.has('harvest');
  const hasExpenseSection = !visibleSections || visibleSections.has('expense');
  const totalRevenue = hasHarvestSection
    ? data.harvest.reduce((sum, r) => sum + r.quantity * (r.price ?? 0), 0)
    : 0;
  const totalExpenses = hasExpenseSection ? data.expense.reduce((sum, r) => sum + r.cost, 0) : 0;
  const showNetProfit = hasHarvestSection && hasExpenseSection;

  return {
    totalRecords:
      data.irrigation.length +
      data.spray.length +
      data.fertigation.length +
      data.harvest.length +
      data.expense.length +
      data.stock.length,
    dateRange: `${data.dateRange.from} to ${data.dateRange.to}`,
    totalIrrigationHours: Math.round(totalIrrigationHours * 10) / 10,
    totalWaterUsage: Math.round(totalWaterUsage),
    totalHarvest: Math.round(totalHarvest * 10) / 10,
    totalRevenue: Math.round(totalRevenue),
    totalExpenses: Math.round(totalExpenses),
    netProfit: showNetProfit ? Math.round(totalRevenue - totalExpenses) : 0,
    irrigationCount: data.irrigation.length,
    sprayCount: data.spray.length,
    fertigationCount: data.fertigation.length,
    harvestCount: data.harvest.length,
    expenseCount: data.expense.length,
    stockUsageCount: data.stock.length,
  };
}

/**
 * Generate report preview
 */
export function generatePreview(
  farm: Farm,
  irrigations: IrrigationRecord[],
  sprays: SprayRecord[],
  fertigations: FertigationRecord[],
  harvests: HarvestRecord[],
  expenses: ExpenseRecord[],
  dateRange: DateRange,
  warehouseItems: WarehouseItem[],
  options: ReportGenerationOptions = {},
): ReportPreview {
  const data = generateReportData(
    farm,
    irrigations,
    sprays,
    fertigations,
    harvests,
    expenses,
    dateRange,
    warehouseItems,
    options,
  );
  const summary = calculateSummary(data);
  return { data, summary };
}
