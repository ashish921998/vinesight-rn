/**
 * Report Service for Vinesight
 * Handles report generation for CSV and PDF exports
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  documentDirectory,
  writeAsStringAsync,
  copyAsync,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import {
  ReportData,
  ReportSummary,
  ReportPreview,
  DateRange,
  ReportType,
  ReportStockUsageRecord,
  ReportSectionKey,
  ReportSeasonContext,
  ReportPlanItemInput,
  ReportUsageLenses,
  NutrientLedger,
  FpcActivityDayRow,
  FpcActivityProductRow,
  FpcColumnOptions,
  FPC_LEAN_COLUMNS,
  getSectionsForReportType,
} from '../types/report';
import { formatDate, formatCurrency } from '@/i18n/format';
import { getDefaultCurrency } from '@/i18n/currency';
import {
  AreaUnitPreference,
  convertAreaToAcres,
  resolveAreaUnitPreference,
} from '@/utils/preferences';
import { getDaysAfterPruning } from '@/utils/date';
import { format as formatQuantity, parseUnit, totalFor } from '@/lib/quantity';
import type { Measure } from '@/lib/quantity';
import { computeUsageLenses, normalizeProductName, type UsageEvent } from './report-usage-lenses';
import { calculateNutrientLedger, parseSprayWaterVolumeL } from './nutrient-flow-service';
import {
  Farm,
  IrrigationRecord,
  SprayRecord,
  SprayChemicalItem,
  FertigationRecord,
  FertilizerItem,
  HarvestRecord,
  ExpenseRecord,
  WarehouseItem,
  QuantityBasis,
} from '../types/database';

interface ReportGenerationOptions {
  seasonContext?: ReportSeasonContext;
  seasonNameById?: Record<number, string>;
  seasonWindowById?: Record<number, string>;
  /** Current fertilizer-plan items — the join target for the compliance delta. */
  planItems?: ReportPlanItemInput[];
  /**
   * Unit `farm.area` was entered in (the user's area-unit preference).
   * `farm.area` is stored as the raw typed number, NOT canonical acres —
   * hectares-preference farms must be converted before any per-acre math.
   */
  areaUnit?: AreaUnitPreference;
  /**
   * FPC register lookups, keyed by catalog product id (chemical_products).
   * All optional — a missing map only blanks the corresponding column, it
   * never blocks the report.
   */
  fpcLookups?: FpcReportLookups;
}

export interface FpcReportLookups {
  /** Technical identity (active ingredient / composition name) per catalog product. */
  technicalNameByProductId?: Record<number, string>;
  /** Label-claim PHI days per catalog product (grape claims). */
  phiDaysByProductId?: Record<number, number>;
  /** Formatted MRL summary per catalog product (e.g. "EU: 0.5 mg/kg"). */
  mrlByProductId?: Record<number, string>;
}

export class ReportService {
  private static readonly EMPTY_SECTION_TEXT = 'No records in selected range';
  private static readonly REPORTS_DIR_NAME = 'reports';

  private static sanitizeFileNamePart(value: string, fallback: string = 'farm'): string {
    const sanitized = Array.from(value)
      .filter((char) => char.charCodeAt(0) >= 32)
      .join('')
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    return sanitized || fallback;
  }

  private static buildReportFileName(farmName: string, extension: 'csv' | 'pdf'): string {
    const safeFarmName = this.sanitizeFileNamePart(farmName);
    const timestamp = Date.now();
    return `${safeFarmName}_report_${new Date().toISOString().split('T')[0]}_${timestamp}.${extension}`;
  }

  private static joinUri(base: string, filename: string): string {
    return base.endsWith('/') ? `${base}${filename}` : `${base}/${filename}`;
  }

  private static async ensureReportsDirectory(): Promise<string> {
    const baseDir = documentDirectory ?? cacheDirectory;
    if (!baseDir) {
      throw new Error('No writable directory is available on this device');
    }

    const reportsDir = this.joinUri(baseDir, this.REPORTS_DIR_NAME);
    const info = await getInfoAsync(reportsDir);
    if (!info.exists) {
      await makeDirectoryAsync(reportsDir, { intermediates: true });
    }
    return reportsDir;
  }

  /**
   * Escape a value for CSV output.
   * Guards against formula injection by prefixing cells that start with
   * characters Excel/Google Sheets would interpret as formulas.
   */
  private static escapeCSV(value: string): string {
    let safe = value;
    if (safe.length > 0 && /^[=+\-@\t\r]/.test(safe)) {
      safe = `'${safe}`;
      return `"${safe.replace(/"/g, '""')}"`;
    }
    if (safe.includes('"') || safe.includes(',') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }

  /**
   * Escape a value for safe HTML interpolation.
   */
  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Filter records by date range.
   * Uses ISO string comparison (YYYY-MM-DD) to avoid timezone drift
   * that occurs when parsing date-only strings as UTC Date objects.
   */
  static filterByDateRange<T extends { date: string }>(records: T[], dateRange: DateRange): T[] {
    const from = dateRange.from; // YYYY-MM-DD
    const to = dateRange.to; // YYYY-MM-DD

    return records.filter((record) => {
      const recordDate = record.date.slice(0, 10); // normalize timestamps to YYYY-MM-DD
      return recordDate >= from && recordDate <= to;
    });
  }

  private static sortRecordsByDateDesc<T extends { date: string }>(records: T[]): T[] {
    return [...records].sort((a, b) => {
      const aTs = new Date(a.date).getTime();
      const bTs = new Date(b.date).getTime();
      return bTs - aTs;
    });
  }

  private static getVisibleSections(reportType: ReportType): Set<ReportSectionKey> {
    return new Set(getSectionsForReportType(reportType));
  }

  private static formatReportType(reportType: ReportType): string {
    switch (reportType) {
      case 'operations':
        return 'Operations';
      case 'financial':
        return 'Financial';
      case 'stock-usage':
        return 'Stock Usage';
      case 'fpc-activity':
        return 'FPC Activity Register';
      case 'comprehensive':
      default:
        return 'Comprehensive';
    }
  }

  private static resolveSeasonName(
    seasonId: number | null | undefined,
    seasonNameById?: Record<number, string>,
  ): string | null {
    if (seasonId == null) return null;
    return seasonNameById?.[seasonId] ?? `Season ${seasonId}`;
  }

  private static resolveSeasonWindow(
    seasonId: number | null | undefined,
    seasonWindowById?: Record<number, string>,
  ): string | null {
    if (seasonId == null) return null;
    return seasonWindowById?.[seasonId] ?? null;
  }

  private static formatSeasonContextLabel(seasonContext?: ReportSeasonContext): string {
    if (!seasonContext || seasonContext.mode === 'all') {
      return 'All seasons';
    }
    if (seasonContext.seasonName && seasonContext.seasonName.trim().length > 0) {
      return seasonContext.seasonName;
    }
    if (seasonContext.seasonId != null) {
      return `Season ${seasonContext.seasonId}`;
    }
    return 'Selected season';
  }

  private static formatSeasonCell(
    seasonContext: ReportSeasonContext | undefined,
    seasonId: number | null | undefined,
    seasonName: string | null | undefined,
    seasonWindow: string | null | undefined,
  ): string {
    if (seasonContext?.mode === 'all') {
      if (seasonWindow && seasonWindow.trim().length > 0) return seasonWindow;
      return '-';
    }
    if (seasonName && seasonName.trim().length > 0) return seasonName;
    if (seasonId != null) return `Season ${seasonId}`;
    return '-';
  }

  private static formatDaysAfterPruningValue(daysAfterPruning: number | null | undefined): string {
    if (daysAfterPruning == null || !Number.isFinite(daysAfterPruning)) return '-';
    return String(daysAfterPruning);
  }

  private static formatDaysAfterPruningTag(daysAfterPruning: number | null | undefined): string {
    if (daysAfterPruning == null || !Number.isFinite(daysAfterPruning)) return '-';
    return `${daysAfterPruning}d`;
  }

  private static resolveSprayChemicalLabel(record: SprayRecord): string {
    const chemicalItems = (record.chemical_items ?? []) as SprayChemicalItem[];
    const names = chemicalItems.map((item) => item.name?.trim()).filter(Boolean);
    if (names.length > 0) return names.join(', ');
    return record.chemical?.trim() || 'N/A';
  }

  private static resolveSprayDoseLabel(record: SprayRecord): string {
    const chemicalItems = (record.chemical_items ?? []) as SprayChemicalItem[];
    const dosageItems = chemicalItems
      .filter(
        (item) =>
          item.name?.trim() &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0 &&
          item.unit?.trim(),
      )
      .map((item) => {
        const quantityBasis = item.quantity_basis ?? 'total';
        const normalizedUnit = item.unit.trim();
        const needsPerAcreSuffix =
          quantityBasis === 'per_acre' && !normalizedUnit.toLowerCase().includes('/acre');
        return `${item.quantity} ${normalizedUnit}${needsPerAcreSuffix ? '/acre' : ''}`;
      });

    const waterMatch = record.dose?.match(/Water:\s*([0-9]+(?:\.[0-9]+)?)\s*L/i);
    const waterLabel = waterMatch?.[1] ? `Water: ${waterMatch[1]}L` : null;

    if (dosageItems.length > 0 && waterLabel) {
      return `${dosageItems.join(', ')}; ${waterLabel}`;
    }
    if (dosageItems.length > 0) {
      return dosageItems.join(', ');
    }
    return record.dose?.trim() || 'N/A';
  }

  private static normalizeName(value: string): string {
    // One normalization rule, shared with the lens compliance matcher —
    // divergence here would split stock rows from compliance rows.
    return normalizeProductName(value);
  }

  /**
   * Area for section headings. Hectare-preference farms convert to a long
   * float (2 ha → 4.942108…) — round at render like every other lens figure.
   */
  private static formatAreaAcres(area: number | null): string {
    return area == null ? '-' : String(Number(area.toFixed(2)));
  }

  /** Stock-usage row label for a kernel measure (kept from the pre-kernel vocabulary). */
  private static measureUnitLabel(measure: Measure): string {
    return measure === 'mass' ? 'kg' : measure === 'volume' ? 'liter' : 'unit';
  }

  private static normalizeUnit(value: string): {
    normalizedUnit: string;
    multiplier: number;
    perAcre: boolean;
  } {
    const parsed = parseUnit(value);
    // Concentration units (gm/L, ppm) are not stock quantities on their own —
    // they resolve through the record's water volume upstream, so they take
    // the verbatim path here just like unknown units.
    if (parsed && parsed.basis !== 'per_liter_water') {
      return {
        normalizedUnit: this.measureUnitLabel(parsed.measure),
        multiplier: parsed.factorToCanonical,
        perAcre: parsed.basis === 'per_acre',
      };
    }

    // Verbatim fallback (farmer testimony): unknown units are never converted
    // or coerced — the compact string becomes its own bucket. A '/acre'
    // suffix still marks the quantity as a rate so the area multiply below
    // stays arithmetically sound at the verbatim scale.
    const compact = value.trim().toLowerCase().replace(/\s+/g, '');
    const perAcre = compact.includes('/acre');
    const base = compact.replace('/acre', '');
    return { normalizedUnit: base || 'unit', multiplier: 1, perAcre };
  }

  private static resolveAppliedQuantity(
    quantity: number,
    unit: string,
    quantityBasis: QuantityBasis | null | undefined,
    area: number,
  ): { quantity: number; normalizedUnit: string } | null {
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const normalized = this.normalizeUnit(unit);
    let totalQuantity = quantity * normalized.multiplier;
    const needsAreaMultiplier = quantityBasis === 'per_acre' || normalized.perAcre;
    if (needsAreaMultiplier) {
      if (!Number.isFinite(area) || area <= 0) return null;
      totalQuantity *= area;
    }

    return {
      quantity: totalQuantity,
      normalizedUnit: normalized.normalizedUnit,
    };
  }

  // Single canonical dose-string parser (nutrient-flow-service) — a second
  // regex here once drifted (no L suffix) and read "Water: 200mL" as liters.
  private static parseWaterVolumeFromDose(dose: string | null | undefined): number | null {
    return parseSprayWaterVolumeL(dose);
  }

  private static positiveOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * Parse legacy spray string format: "Name (Quantity Unit), Name2 (Quantity Unit)"
   */
  private static parseStockItems(
    itemStr: string,
  ): Array<{ name: string; quantity: number; unit: string }> {
    const items: Array<{ name: string; quantity: number; unit: string }> = [];
    const matches = [
      ...itemStr.matchAll(/(?:^|,\s*)(.+?)\s+\((\d+(?:\.\d+)?)\s+([^)]+)\)(?=\s*(?:,|$))/g),
    ];
    matches.forEach((match) => {
      const quantity = Number.parseFloat(match[2] ?? '');
      const name = match[1]?.trim() ?? '';
      const unit = match[3]?.trim() ?? '';
      if (!name || !unit || !Number.isFinite(quantity) || quantity <= 0) return;
      items.push({ name, quantity, unit });
    });
    return items;
  }

  private static resolveSprayUsageItems(record: SprayRecord): Array<{
    name: string;
    quantity: number;
    unit: string;
    quantityBasis?: QuantityBasis;
    warehouseItemId?: number | null;
    catalogProductId?: number | null;
    planItemId?: string | null;
  }> {
    const chemicalItems = (record.chemical_items ?? []) as SprayChemicalItem[];
    if (chemicalItems.length > 0) {
      return chemicalItems
        .map((item) => ({
          name: item.name?.trim() ?? '',
          quantity: Number(item.quantity),
          unit: item.unit?.trim() ?? '',
          quantityBasis: item.quantity_basis,
          warehouseItemId: item.warehouse_item_id ?? null,
          catalogProductId: item.catalog_product_id ?? null,
          planItemId: item.plan_item_id ?? null,
        }))
        .filter(
          (item) => item.name && item.unit && Number.isFinite(item.quantity) && item.quantity > 0,
        );
    }

    return this.parseStockItems(record.chemical).map((item) => ({
      ...item,
      quantityBasis: 'total' as const,
      warehouseItemId: null,
      catalogProductId: null,
      planItemId: null,
    }));
  }

  private static resolveFertigationUsageItems(record: FertigationRecord): Array<{
    name: string;
    quantity: number;
    unit: string;
    quantityBasis?: QuantityBasis;
    warehouseItemId?: number | null;
    catalogProductId?: number | null;
    planItemId?: string | null;
  }> {
    const fertilizerItems = (record.fertilizers ?? []) as FertilizerItem[];
    return fertilizerItems
      .map((item) => ({
        name: item.name?.trim() ?? '',
        quantity: Number(item.quantity),
        unit: item.unit?.trim() ?? '',
        quantityBasis: item.quantity_basis,
        warehouseItemId: item.warehouse_item_id ?? null,
        catalogProductId: item.catalog_product_id ?? null,
        planItemId: item.plan_item_id ?? null,
      }))
      .filter(
        (item) => item.name && item.unit && Number.isFinite(item.quantity) && item.quantity > 0,
      );
  }

  private static toRounded(value: number, precision: number = 4): number {
    const scale = Math.pow(10, precision);
    return Math.round(value * scale) / scale;
  }

  private static matchWarehouseAndEstimateStock(
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

      const normalizedName = this.normalizeName(item.name);
      const normalizedUnit = this.normalizeUnit(item.unit).normalizedUnit;
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
            quantityUsed: this.toRounded(row.quantityUsed, 4),
            unit: row.unit,
            areaTreated: this.toRounded(row.areaTreated, 2),
            usageCount: row.usageCount,
            warehouseItemId: null,
            catalogProductId: null,
            currentStockQuantity: null,
            estimatedOpeningStockQuantity: null,
            estimatedConsumedPercent: null,
            matchStrategy: 'unmatched',
          } satisfies ReportStockUsageRecord;
        }

        const warehouseUnit = this.normalizeUnit(matchedWarehouse.unit);
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
          quantityUsed: this.toRounded(row.quantityUsed, 4),
          unit: row.unit,
          areaTreated: this.toRounded(row.areaTreated, 2),
          usageCount: row.usageCount,
          warehouseItemId: matchedWarehouse.id,
          catalogProductId: matchedWarehouse.catalog_product_id ?? null,
          currentStockQuantity:
            currentStockQuantity != null ? this.toRounded(currentStockQuantity, 4) : null,
          estimatedOpeningStockQuantity:
            estimatedOpeningStockQuantity != null
              ? this.toRounded(estimatedOpeningStockQuantity, 4)
              : null,
          estimatedConsumedPercent:
            estimatedConsumedPercent != null ? this.toRounded(estimatedConsumedPercent, 2) : null,
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
  private static calculateStockUsage(
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
    const filteredSprays = this.filterByDateRange(sprays, dateRange);
    const filteredFertigations = this.filterByDateRange(fertigations, dateRange);

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
      const normalizedName = this.normalizeName(name);
      if (!normalizedName) return;

      let resolved: { quantity: number; normalizedUnit: string } | null;
      const parsedUnit = parseUnit(unit);
      if (parsedUnit?.basis === 'per_liter_water') {
        // Kernel contract: the unit string's basis wins over the stored
        // quantity_basis column — a 'gm/L' or 'ppm' item is a concentration
        // and resolves through the record's water volume, never through area.
        if (!this.positiveOrNull(waterVolumeL)) {
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
          ? { quantity: total.value, normalizedUnit: this.measureUnitLabel(total.measure) }
          : null;
      } else {
        resolved = this.resolveAppliedQuantity(quantity, unit, quantityBasis, area);
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
        catalogProductIds:
          catalogProductId != null ? new Set([catalogProductId]) : new Set<number>(),
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
      const waterVolumeL = this.parseWaterVolumeFromDose(record.dose);
      this.resolveSprayUsageItems(record).forEach((item) => {
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
      this.resolveFertigationUsageItems(record).forEach((item) => {
        upsertUsage(
          'fertilizer',
          item.name,
          item.quantity,
          item.unit,
          item.quantityBasis,
          recordAreaAcres(record.area),
          item.warehouseItemId,
          item.catalogProductId,
          this.positiveOrNull(record.water_volume),
        );
      });
    });

    const matchedAndUnmatchedFromWarehouse = this.matchWarehouseAndEstimateStock(
      Array.from(usageMap.values()),
      warehouseItems,
    );
    const missingWaterRows = Array.from(unmatchedUsageMap.values()).map((row) => ({
      ...row,
      quantityUsed: this.toRounded(row.quantityUsed, 4),
      areaTreated: this.toRounded(row.areaTreated, 2),
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
  private static buildFpcActivity(
    farm: Farm,
    irrigations: IrrigationRecord[],
    sprays: SprayRecord[],
    fertigations: FertigationRecord[],
    options: ReportGenerationOptions,
  ): FpcActivityDayRow[] {
    const lookups = options.fpcLookups ?? {};
    const recordAreaAcres = (area: number | null | undefined): number | null => {
      const positive = this.positiveOrNull(area ?? null) ?? this.positiveOrNull(farm.area);
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
      items: ReturnType<typeof ReportService.resolveSprayUsageItems>,
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
        const claimPhi =
          productId != null ? (lookups.phiDaysByProductId?.[productId] ?? null) : null;
        const normalizedItemName = this.normalizeName(item.name);
        const governingAttributable =
          sprayRecord != null &&
          sprayRecord.governing_phi_days != null &&
          (items.length === 1 ||
            (sprayRecord.phi_blocking_component != null &&
              this.normalizeName(sprayRecord.phi_blocking_component) === normalizedItemName));
        const phiDays =
          claimPhi ?? (governingAttributable ? sprayRecord!.governing_phi_days! : null);

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
        (r) => this.positiveOrNull(r.duration) && this.positiveOrNull(r.system_discharge),
      );
      const waterMm = mmContributions.reduce((sum, r) => sum + r.duration * r.system_discharge, 0);
      const growthStage =
        dayIrrigations.map((r) => r.growth_stage?.trim()).find((stage) => stage) ?? null;

      const products: FpcActivityProductRow[] = [
        ...daySprays.flatMap((record, recordIndex) =>
          buildProductRows(
            'spray',
            `${isoDate}-spr${recordIndex}`,
            this.resolveSprayUsageItems(record),
            recordAreaAcres(record.area),
            this.parseWaterVolumeFromDose(record.dose),
            record,
          ),
        ),
        ...dayFertigations.flatMap((record, recordIndex) =>
          buildProductRows(
            'fertigation',
            `${isoDate}-fert${recordIndex}`,
            this.resolveFertigationUsageItems(record),
            recordAreaAcres(record.area),
            this.positiveOrNull(record.water_volume),
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
        irrigationHours: dayIrrigations.length > 0 ? this.toRounded(irrigationHours, 2) : null,
        waterMm: mmContributions.length > 0 ? this.toRounded(waterMm, 1) : null,
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
  static generateReportData(
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
    const stockUsage = this.calculateStockUsage(
      sprays,
      fertigations,
      dateRange,
      warehouseItems,
      options.areaUnit,
    );
    const usage = this.calculateUsageLenses(
      farm,
      sprays,
      fertigations,
      dateRange,
      planItems,
      options.areaUnit,
    );
    const irrigationRecords = this.sortRecordsByDateDesc(
      this.filterByDateRange(irrigations, dateRange),
    );
    const sprayRecords = this.sortRecordsByDateDesc(this.filterByDateRange(sprays, dateRange));
    const fertigationRecords = this.sortRecordsByDateDesc(
      this.filterByDateRange(fertigations, dateRange),
    );
    const harvestRecords = this.sortRecordsByDateDesc(this.filterByDateRange(harvests, dateRange));
    const expenseRecords = this.sortRecordsByDateDesc(this.filterByDateRange(expenses, dateRange));

    return {
      farmName: farm.name,
      farmArea: farm.area,
      farmRegion: farm.region,
      dateRange,
      seasonContext,
      irrigation: irrigationRecords.map((r) => ({
        date: formatDate(r.date),
        daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        seasonWindow: this.resolveSeasonWindow(r.season_id, seasonWindowById),
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
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        seasonWindow: this.resolveSeasonWindow(r.season_id, seasonWindowById),
        chemical: this.resolveSprayChemicalLabel(r),
        dose: this.resolveSprayDoseLabel(r),
        area: r.area,
        weather: r.weather,
        operator: r.operator,
        notes: r.notes || undefined,
      })),
      fertigation: fertigationRecords.map((r) => ({
        date: formatDate(r.date),
        daysAfterPruning: getDaysAfterPruning(r.date, r.date_of_pruning ?? farm.date_of_pruning),
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        seasonWindow: this.resolveSeasonWindow(r.season_id, seasonWindowById),
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
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        seasonWindow: this.resolveSeasonWindow(r.season_id, seasonWindowById),
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
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        seasonWindow: this.resolveSeasonWindow(r.season_id, seasonWindowById),
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
        areaAcres: this.positiveOrNull(farm.area)
          ? convertAreaToAcres(
              this.positiveOrNull(farm.area)!,
              resolveAreaUnitPreference(options.areaUnit),
            )
          : null,
        // record.area is raw in this unit too — the ledger converts per record.
        areaUnit: options.areaUnit,
      }),
      fpcActivity: this.buildFpcActivity(
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
  private static calculateUsageLenses(
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
      const positive = this.positiveOrNull(area ?? null);
      return positive == null
        ? null
        : convertAreaToAcres(positive, resolveAreaUnitPreference(areaUnit));
    };

    const events: UsageEvent[] = [
      ...this.filterByDateRange(sprays, dateRange).map((record) => ({
        type: 'spray' as const,
        waterLiters: this.parseWaterVolumeFromDose(record.dose),
        items: this.resolveSprayUsageItems(record),
        areaAcres: recordAreaAcres(record.area),
      })),
      ...this.filterByDateRange(fertigations, dateRange).map((record) => ({
        type: 'fertilizer' as const,
        waterLiters: this.positiveOrNull(record.water_volume),
        items: this.resolveFertigationUsageItems(record),
        areaAcres: recordAreaAcres(record.area),
      })),
    ];

    const areaInPreferredUnit = this.positiveOrNull(farm.area);
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
  static calculateSummary(data: ReportData, reportType?: ReportType): ReportSummary {
    const visibleSections = reportType ? this.getVisibleSections(reportType) : null;
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
  static generatePreview(
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
    const data = this.generateReportData(
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
    const summary = this.calculateSummary(data);
    return { data, summary };
  }

  /**
   * Generate CSV content from report data
   */
  static generateCSV(
    data: ReportData,
    reportType: ReportType,
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): string {
    const rows: string[] = [];
    const visibleSections = this.getVisibleSections(reportType);
    const areaUnitLabel = areaUnit === 'hectares' ? 'hectares' : 'acres';
    const pushEmptySection = (title: string) => {
      rows.push(title);
      rows.push(this.EMPTY_SECTION_TEXT);
      rows.push('');
    };
    const matchedStockRows = data.stock.filter((row) => row.matchStrategy !== 'unmatched');
    const unmatchedStockRows = data.stock.filter((row) => row.matchStrategy === 'unmatched');

    // Header
    rows.push(`Farm Report - ${data.farmName}`);
    rows.push(`Report Type: ${this.formatReportType(reportType)}`);
    rows.push(`Region: ${data.farmRegion}`);
    // farm.area is stored as the raw number typed under the user's area-unit
    // preference — print it verbatim with its label. Converting "from acres"
    // here contradicted the per-acre lens heading on hectare farms.
    rows.push(`Area: ${data.farmArea} ${areaUnitLabel}`);
    rows.push(`Date Range: ${formatDate(data.dateRange.from)} to ${formatDate(data.dateRange.to)}`);
    rows.push(`Season: ${this.formatSeasonContextLabel(data.seasonContext)}`);
    if (data.seasonContext?.mode === 'season') {
      rows.push(
        `Season Window: ${data.seasonContext.seasonStart ? formatDate(data.seasonContext.seasonStart) : '-'} to ${data.seasonContext.seasonEnd ? formatDate(data.seasonContext.seasonEnd) : 'Active'}`,
      );
    }
    rows.push(
      `Generated: ${formatDate(new Date(), { year: 'numeric', month: 'short', day: 'numeric' })}`,
    );
    rows.push('');

    if (visibleSections.has('fpc-activity')) {
      this.appendFpcActivityCSV(rows, data.fpcActivity ?? [], fpcColumns);
    }

    if (visibleSections.has('irrigation')) {
      if (data.irrigation.length === 0) {
        pushEmptySection('IRRIGATION RECORDS');
      } else {
        rows.push(`IRRIGATION RECORDS (${data.irrigation.length})`);
        rows.push(
          `Date,Days After Pruning,Season,Duration (hrs),Growth Stage,Moisture Status,Notes`,
        );
        data.irrigation.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${this.formatDaysAfterPruningValue(r.daysAfterPruning)},${this.escapeCSV(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${r.duration},${this.escapeCSV(r.growthStage)},${this.escapeCSV(r.moistureStatus)},${this.escapeCSV(r.notes || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('spray')) {
      if (data.spray.length === 0) {
        pushEmptySection('SPRAY RECORDS');
      } else {
        rows.push(`SPRAY RECORDS (${data.spray.length})`);
        rows.push(`Date,Days After Pruning,Season,Chemical,Dose,Operator,Notes`);
        data.spray.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${this.formatDaysAfterPruningValue(r.daysAfterPruning)},${this.escapeCSV(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${this.escapeCSV(r.chemical)},${this.escapeCSV(r.dose)},${this.escapeCSV(r.operator)},${this.escapeCSV(r.notes || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('fertigation')) {
      if (data.fertigation.length === 0) {
        pushEmptySection('FERTIGATION RECORDS');
      } else {
        rows.push(`FERTIGATION RECORDS (${data.fertigation.length})`);
        rows.push(`Date,Days After Pruning,Season,Fertilizers,Notes`);
        data.fertigation.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${this.formatDaysAfterPruningValue(r.daysAfterPruning)},${this.escapeCSV(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${this.escapeCSV(r.fertilizers)},${this.escapeCSV(r.notes || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('harvest')) {
      if (data.harvest.length === 0) {
        pushEmptySection('HARVEST RECORDS');
      } else {
        rows.push(`HARVEST RECORDS (${data.harvest.length})`);
        rows.push('Date,Days After Pruning,Season,Quantity (kg),Grade,Price,Buyer,Notes');
        data.harvest.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${this.formatDaysAfterPruningValue(r.daysAfterPruning)},${this.escapeCSV(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${r.quantity},${this.escapeCSV(r.grade)},${r.price ?? ''},${this.escapeCSV(r.buyer || '')},${this.escapeCSV(r.notes || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('expense')) {
      if (data.expense.length === 0) {
        pushEmptySection('EXPENSE RECORDS');
      } else {
        rows.push(`EXPENSE RECORDS (${data.expense.length})`);
        rows.push('Date,Days After Pruning,Season,Type,Cost,Remarks');
        data.expense.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${this.formatDaysAfterPruningValue(r.daysAfterPruning)},${this.escapeCSV(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))},${this.escapeCSV(r.type)},${r.cost},${this.escapeCSV(r.remarks || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('stock')) {
      if (matchedStockRows.length === 0) {
        pushEmptySection('STOCK USAGE SUMMARY');
      } else {
        rows.push(
          `STOCK USAGE SUMMARY (Matched ${matchedStockRows.length} of ${data.stock.length})`,
        );
        rows.push(
          'Item,Type,Total Quantity Used,Unit,Total Area Treated,Usage Count,Current Stock,Estimated Opening Stock,Estimated Consumed %,Match',
        );
        matchedStockRows.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.itemName)},${r.type},${r.quantityUsed},${r.unit},${r.areaTreated},${r.usageCount},${r.currentStockQuantity ?? ''},${r.estimatedOpeningStockQuantity ?? ''},${r.estimatedConsumedPercent ?? ''},${r.matchStrategy ?? ''}`,
          );
        });
        rows.push('');
      }
      if (unmatchedStockRows.length > 0) {
        rows.push(`UNMATCHED LOG ITEMS (${unmatchedStockRows.length})`);
        rows.push('Item,Type,Total Quantity Used,Unit,Total Area Treated,Usage Count,Reason');
        unmatchedStockRows.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.itemName)},${r.type},${r.quantityUsed},${r.unit},${r.areaTreated},${r.usageCount},No warehouse match or missing water volume`,
          );
        });
        rows.push('');
      }

      if (data.usage) {
        this.appendUsageLensesCSV(rows, data.usage);
      }
    }

    if (visibleSections.has('nutrient-ledger') && data.nutrientLedger) {
      this.appendNutrientLedgerCSV(rows, data.nutrientLedger);
    }

    return rows.join('\n');
  }

  /**
   * FPC activity register CSV: date columns written once per day block,
   * one row per product under them — the shape FPC field officers keep in
   * their own Excel registers. No row cap: a buyer audit needs the full
   * season, not the first 20 rows.
   */
  private static appendFpcActivityCSV(
    rows: string[],
    days: FpcActivityDayRow[],
    cols: FpcColumnOptions,
  ): void {
    const productCount = days.reduce((sum, day) => sum + day.products.length, 0);
    if (days.length === 0) {
      rows.push('FPC ACTIVITY REGISTER');
      rows.push(this.EMPTY_SECTION_TEXT);
      rows.push('');
      return;
    }

    rows.push(`FPC ACTIVITY REGISTER (${days.length} days, ${productCount} product applications)`);
    rows.push(
      [
        'Date',
        'Day',
        ...(cols.irrigation ? ['Irrigation (hrs)', 'Water (mm)'] : []),
        'Stage',
        'Market Name',
        ...(cols.technicalName ? ['Technical Name'] : []),
        'Qty/Acre',
        'Total Qty/Plot',
        'As Logged',
        ...(cols.phi ? ['PHI (days)'] : []),
        ...(cols.safeHarvest ? ['Safe Harvest'] : []),
        ...(cols.mrl ? ['MRL'] : []),
        'Details',
      ].join(','),
    );

    // Product-level column count (used to blank a no-product day's row):
    // Market + Qty/Acre + Total + As Logged, plus any enabled optionals.
    const productColCount =
      4 +
      (cols.technicalName ? 1 : 0) +
      (cols.phi ? 1 : 0) +
      (cols.safeHarvest ? 1 : 0) +
      (cols.mrl ? 1 : 0);

    const productCells = (product: FpcActivityProductRow): string[] => [
      this.escapeCSV(product.marketName),
      ...(cols.technicalName ? [this.escapeCSV(product.technicalName ?? '')] : []),
      this.escapeCSV(product.qtyPerAcreDisplay ?? ''),
      this.escapeCSV(product.totalQtyDisplay ?? ''),
      this.escapeCSV(product.asLogged),
      ...(cols.phi ? [product.phiDays != null ? String(product.phiDays) : ''] : []),
      ...(cols.safeHarvest ? [this.escapeCSV(product.safeHarvestDate ?? '')] : []),
      ...(cols.mrl ? [this.escapeCSV(product.mrl ?? '')] : []),
    ];

    days.forEach((day) => {
      const dayCells = [
        this.escapeCSV(day.date),
        this.formatDaysAfterPruningValue(day.daysAfterPruning),
        ...(cols.irrigation
          ? [
              day.irrigationHours != null ? String(day.irrigationHours) : '',
              day.waterMm != null ? String(day.waterMm) : '',
            ]
          : []),
        this.escapeCSV(day.growthStage ?? ''),
      ];
      const blankDayCells = dayCells.map(() => '');
      const notesCell = this.escapeCSV(day.notes ?? '');

      if (day.products.length === 0) {
        rows.push([...dayCells, ...Array(productColCount).fill(''), notesCell].join(','));
        return;
      }

      day.products.forEach((product, index) => {
        rows.push(
          [
            ...(index === 0 ? dayCells : blankDayCells),
            ...productCells(product),
            index === 0 ? notesCell : '',
          ].join(','),
        );
      });
    });
    rows.push('');
  }

  /**
   * Nutrient ledger (issue #200). Elemental figures match petiole/soil lab
   * reports; bag-grade oxide (P₂O₅/K₂O …) matches fertilizer bags. Coverage
   * is stated on every export — 0% renders the empty text, never zeros
   * presented as truth.
   */
  private static appendNutrientLedgerCSV(rows: string[], ledger: NutrientLedger): void {
    rows.push('NUTRIENT LEDGER - NUTRIENTS APPLIED');
    rows.push(
      this.escapeCSV(
        `Nutrients from ${ledger.coveragePercent}% of applied quantity (${ledger.composedItemCount} of ${ledger.itemCount} items with composition)`,
      ),
    );
    if (ledger.rows.length === 0) {
      // itemCount === 0 means no applications logged; itemCount > 0 with 0%
      // coverage means applications exist but none carried a composition —
      // the coverage line above already states "0 of N", so calling it "no
      // records" would contradict it and misreport missing composition as
      // missing applications.
      rows.push(
        ledger.itemCount === 0
          ? this.EMPTY_SECTION_TEXT
          : 'No composition data — nutrients cannot be calculated',
      );
      rows.push('');
      return;
    }
    rows.push(
      'Element,Elemental (kg),Elemental (kg/acre),Bag-grade,Bag-grade (kg),Bag-grade (kg/acre)',
    );
    ledger.rows.forEach((row) => {
      rows.push(
        `${row.element},${row.elementalKg},${row.elementalKgPerAcre ?? ''},${this.escapeCSV(
          row.oxideSymbol ?? '',
        )},${row.oxideKg ?? ''},${row.oxideKgPerAcre ?? ''}`,
      );
    });
    rows.push('');
  }

  /**
   * Applied-quantity lenses (issue #198). Every figure is derived (folded /
   * divided) and carries the "≈" prefix; verbatim buckets show quantities
   * exactly as logged, never converted.
   */
  private static appendUsageLensesCSV(rows: string[], usage: ReportUsageLenses): void {
    const { perPlot, perAcre, perLiter } = usage;

    if (perPlot.rows.length > 0) {
      rows.push(this.escapeCSV('APPLIED QUANTITIES - PER PLOT (per product, per measure)'));
      rows.push('Product,Type,Total Applied,Uses');
      perPlot.rows.forEach((row) => {
        rows.push(
          `${this.escapeCSV(row.name)},${row.type},${this.escapeCSV(
            row.totals.map((figure) => figure.display).join(' | '),
          )},${row.usageCount}`,
        );
      });
      rows.push('');
    }

    if (perPlot.other.length > 0) {
      rows.push(
        this.escapeCSV('OTHER PRODUCTS (unit not recognized - shown as logged, no conversion)'),
      );
      rows.push('Product,Type,Quantity As Logged,Uses');
      perPlot.other.forEach((row) => {
        rows.push(
          `${this.escapeCSV(row.name)},${row.type},${this.escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
        );
      });
      rows.push('');
    }

    if (perPlot.concentrationOnly.length > 0) {
      rows.push('CONCENTRATION-ONLY (water volume not logged - cannot resolve to a total)');
      rows.push('Product,Type,Concentration As Logged,Uses');
      perPlot.concentrationOnly.forEach((row) => {
        rows.push(
          `${this.escapeCSV(row.name)},${row.type},${this.escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
        );
      });
      rows.push('');
    }

    if (perPlot.rateOnly.length > 0) {
      rows.push('RATE-ONLY (farm area unavailable - cannot resolve to a total)');
      rows.push('Product,Type,Rate As Logged,Uses');
      perPlot.rateOnly.forEach((row) => {
        rows.push(
          `${this.escapeCSV(row.name)},${row.type},${this.escapeCSV(`${row.quantity} ${row.unit}`)},${row.usageCount}`,
        );
      });
      rows.push('');
    }

    if (perAcre.available) {
      if (perAcre.rows.length > 0) {
        rows.push(
          `APPLIED QUANTITIES - PER ACRE (farm area: ${this.formatAreaAcres(perAcre.areaAcres)} acres)`,
        );
        rows.push('Product,Type,Per Acre');
        perAcre.rows.forEach((row) => {
          rows.push(
            `${this.escapeCSV(row.name)},${row.type},${this.escapeCSV(
              row.perAcre.map((figure) => figure.display).join(' | '),
            )}`,
          );
        });
        rows.push('');
      }
      if (perAcre.compliance.length > 0) {
        rows.push(this.escapeCSV('PLAN COMPLIANCE (prescribed vs applied, per acre)'));
        rows.push('Product,Prescribed,Applied,Match');
        perAcre.compliance.forEach((row) => {
          rows.push(
            `${this.escapeCSV(row.name)},${this.escapeCSV(row.prescribedDisplay)},${this.escapeCSV(
              row.appliedDisplay ??
                (row.matchLevel === 'unresolved' ? 'logged - unit not comparable' : 'not logged'),
            )},${row.matchLevel ?? '-'}`,
          );
        });
        rows.push(
          'Note: verified = applied records logged from this plan item; approximate = matched by product name only - never presented as verified.',
        );
        rows.push('');
      }
    } else if (perPlot.rows.length > 0 || perPlot.rateOnly.length > 0) {
      rows.push('APPLIED QUANTITIES - PER ACRE');
      rows.push('Unavailable: farm area is missing or invalid - never divided by a guess.');
      rows.push('');
    }

    if (perLiter.rows.length > 0) {
      rows.push(
        `PER LITER OF WATER (spray concentration, weighted by water volume; based on ${perLiter.sprayEventsWithWater} of ${perLiter.sprayEventsTotal} spray events with logged water)`,
      );
      rows.push('Product,Concentration,Events');
      perLiter.rows.forEach((row) => {
        rows.push(`${this.escapeCSV(row.name)},${this.escapeCSV(row.display)},${row.eventCount}`);
      });
      rows.push('');
    }
  }

  /**
   * Generate PDF HTML content
   */
  static generatePDFHtml(
    data: ReportData,
    summary: ReportSummary,
    reportType: ReportType,
    preferredCurrency: string = getDefaultCurrency(),
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): string {
    const visibleSections = this.getVisibleSections(reportType);
    const maxRowsPerSection = 20;
    const areaUnitLabel = areaUnit === 'hectares' ? 'hectares' : 'acres';
    const matchedStockRows = data.stock.filter((row) => row.matchStrategy !== 'unmatched');
    const unmatchedStockRows = data.stock.filter((row) => row.matchStrategy === 'unmatched');

    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h1 { color: #1a5d1a; margin-bottom: 10px; }
        h2 { color: #333; margin-top: 25px; border-bottom: 2px solid #1a5d1a; padding-bottom: 5px; }
        .header { margin-bottom: 20px; }
        .meta { color: #666; font-size: 14px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .summary-item { padding: 10px; background: white; border-radius: 4px; }
        .summary-value { font-size: 20px; font-weight: bold; color: #1a5d1a; }
        .summary-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background: #1a5d1a; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        .profit { color: #16a34a; }
        .loss { color: #dc2626; }
        .empty-section { color: #666; font-style: italic; margin: 10px 0 0; }
        tr.fpc-day-start td { border-top: 2px solid #1a5d1a; }
        .more-records { color: #666; font-size: 12px; margin-top: 6px; }
        .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
      </style>
    `;

    const summaryItems = [
      {
        label: 'Total Records',
        value: String(summary.totalRecords),
        className: '',
      },
      ...(visibleSections.has('stock')
        ? [
            {
              label: 'Unique Stock Items Used',
              value: String(summary.stockUsageCount),
              className: '',
            },
          ]
        : []),
      ...(visibleSections.has('irrigation') ||
      visibleSections.has('spray') ||
      visibleSections.has('fertigation') ||
      visibleSections.has('harvest')
        ? [
            {
              label: 'Total Harvest',
              value: `${summary.totalHarvest} kg`,
              className: '',
            },
          ]
        : []),
      ...(visibleSections.has('harvest') && visibleSections.has('expense')
        ? [
            {
              label: 'Revenue',
              value: formatCurrency(summary.totalRevenue, preferredCurrency, {
                minimumFractionDigits: 0,
              }),
              className: '',
            },
          ]
        : []),
      ...(visibleSections.has('expense')
        ? [
            {
              label: 'Expenses',
              value: formatCurrency(summary.totalExpenses, preferredCurrency, {
                minimumFractionDigits: 0,
              }),
              className: '',
            },
          ]
        : []),
      ...(visibleSections.has('harvest') && visibleSections.has('expense')
        ? [
            {
              label: 'Net Profit',
              value: formatCurrency(summary.netProfit, preferredCurrency, {
                minimumFractionDigits: 0,
              }),
              className: summary.netProfit >= 0 ? 'profit' : 'loss',
            },
          ]
        : []),
    ];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>${styles}</head>
      <body>
        <div class="header">
          <h1>🍇 ${this.escapeHtml(data.farmName)}</h1>
          <p class="meta">
            Report Type: ${this.escapeHtml(this.formatReportType(reportType))}<br>
            Region: ${this.escapeHtml(data.farmRegion)} | Area: ${data.farmArea} ${areaUnitLabel}<br>
            Report Period: ${formatDate(data.dateRange.from)} to ${formatDate(data.dateRange.to)}<br>
            Season: ${this.escapeHtml(this.formatSeasonContextLabel(data.seasonContext))}
            ${
              data.seasonContext?.mode === 'season'
                ? `<br>Season Window: ${data.seasonContext.seasonStart ? formatDate(data.seasonContext.seasonStart) : '-'} to ${data.seasonContext.seasonEnd ? formatDate(data.seasonContext.seasonEnd) : 'Active'}`
                : ''
            }
          </p>
        </div>
        
        <div class="summary">
          <h3 style="margin-top: 0;">Summary</h3>
          <div class="summary-grid">
            ${summaryItems
              .map(
                (item) =>
                  `<div class="summary-item"><div class="summary-value ${item.className}">${item.value}</div><div class="summary-label">${item.label}</div></div>`,
              )
              .join('')}
          </div>
        </div>
    `;

    const appendSectionTable = (
      title: string,
      headers: string[],
      rowMarkup: string[],
      hiddenCount: number = 0,
    ) => {
      html += `<h2>${title}</h2>`;
      if (rowMarkup.length === 0) {
        html += `<p class="empty-section">${this.EMPTY_SECTION_TEXT}</p>`;
        return;
      }
      html += `
        <table>
          <tr>${headers.map((header) => `<th>${this.escapeHtml(header)}</th>`).join('')}</tr>
          ${rowMarkup.join('')}
        </table>
        ${hiddenCount > 0 ? `<p class="more-records">... and ${hiddenCount} more records</p>` : ''}
      `;
    };

    if (visibleSections.has('fpc-activity')) {
      // No row cap: the register exists for buyer/FPC audits, which need the
      // full window — truncation would silently misrepresent the season.
      const days = data.fpcActivity ?? [];
      const productCount = days.reduce((sum, day) => sum + day.products.length, 0);
      html += `<h2>📋 FPC Activity Register (${days.length} days, ${productCount} product applications)</h2>`;
      if (days.length === 0) {
        html += `<p class="empty-section">${this.EMPTY_SECTION_TEXT}</p>`;
      } else {
        const cols = fpcColumns;
        const headers = [
          'Date',
          'Day',
          ...(cols.irrigation ? ['Irrigation (hrs)', 'Water (mm)'] : []),
          'Stage',
          'Market Name',
          ...(cols.technicalName ? ['Technical Name'] : []),
          'Qty/Acre',
          'Total Qty/Plot',
          ...(cols.phi ? ['PHI (days)'] : []),
          ...(cols.safeHarvest ? ['Safe Harvest'] : []),
          ...(cols.mrl ? ['MRL'] : []),
          'Details',
        ];
        // Product-level column count (Market + Qty/Acre + Total, plus enabled
        // optionals) — used to fill a day that logged no products.
        const productColCount =
          3 +
          (cols.technicalName ? 1 : 0) +
          (cols.phi ? 1 : 0) +
          (cols.safeHarvest ? 1 : 0) +
          (cols.mrl ? 1 : 0);
        const cell = (value: string | null | undefined) =>
          `<td>${this.escapeHtml(value ?? '') || '-'}</td>`;
        const bodyRows = days
          .map((day) => {
            const span = Math.max(1, day.products.length);
            const dayCells =
              `<td rowspan="${span}">${this.escapeHtml(day.date)}</td>` +
              `<td rowspan="${span}">${this.formatDaysAfterPruningValue(day.daysAfterPruning)}</td>` +
              (cols.irrigation
                ? `<td rowspan="${span}">${day.irrigationHours ?? '-'}</td>` +
                  `<td rowspan="${span}">${day.waterMm ?? '-'}</td>`
                : '') +
              `<td rowspan="${span}">${this.escapeHtml(day.growthStage ?? '') || '-'}</td>`;
            const notesCell = `<td rowspan="${span}">${this.escapeHtml(day.notes ?? '') || '-'}</td>`;
            if (day.products.length === 0) {
              return `<tr class="fpc-day-start">${dayCells}${'<td>-</td>'.repeat(productColCount)}${notesCell}</tr>`;
            }
            return day.products
              .map((product, index) => {
                const productCells =
                  cell(product.marketName) +
                  (cols.technicalName ? cell(product.technicalName) : '') +
                  // Qty/Acre and Total fall back to the verbatim entry so an
                  // unresolvable unit is still visible, marked as-logged.
                  cell(product.qtyPerAcreDisplay ?? `${product.asLogged} (as logged)`) +
                  cell(product.totalQtyDisplay ?? `${product.asLogged} (as logged)`) +
                  (cols.phi ? `<td>${product.phiDays != null ? product.phiDays : '-'}</td>` : '') +
                  (cols.safeHarvest ? cell(product.safeHarvestDate) : '') +
                  (cols.mrl ? cell(product.mrl) : '');
                return index === 0
                  ? `<tr class="fpc-day-start">${dayCells}${productCells}${notesCell}</tr>`
                  : `<tr>${productCells}</tr>`;
              })
              .join('');
          })
          .join('');
        html += `
          <table>
            <tr>${headers.map((header) => `<th>${this.escapeHtml(header)}</th>`).join('')}</tr>
            ${bodyRows}
          </table>
        `;
      }
    }

    if (visibleSections.has('irrigation')) {
      const visibleRows = data.irrigation.slice(0, maxRowsPerSection);
      appendSectionTable(
        `💧 Irrigation Records (${data.irrigation.length})`,
        ['Date', 'DAP', 'Season', 'Duration', 'Growth Stage'],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.date)}</td><td>${this.formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${this.escapeHtml(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${r.duration}h</td><td>${this.escapeHtml(r.growthStage)}</td></tr>`,
        ),
        Math.max(0, data.irrigation.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('spray')) {
      const visibleRows = data.spray.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🧪 Spray Records (${data.spray.length})`,
        ['Date', 'DAP', 'Season', 'Chemical', 'Dose'],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.date)}</td><td>${this.formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${this.escapeHtml(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${this.escapeHtml(r.chemical)}</td><td>${this.escapeHtml(r.dose)}</td></tr>`,
        ),
        Math.max(0, data.spray.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('fertigation')) {
      const visibleRows = data.fertigation.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🧴 Fertigation Records (${data.fertigation.length})`,
        ['Date', 'DAP', 'Season', 'Fertilizers'],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.date)}</td><td>${this.formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${this.escapeHtml(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${this.escapeHtml(r.fertilizers)}</td></tr>`,
        ),
        Math.max(0, data.fertigation.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('harvest')) {
      const visibleRows = data.harvest.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🍇 Harvest Records (${data.harvest.length})`,
        ['Date', 'DAP', 'Season', 'Quantity', 'Grade', 'Price', 'Buyer'],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.date)}</td><td>${this.formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${this.escapeHtml(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${r.quantity} kg</td><td>${this.escapeHtml(r.grade)}</td><td>${r.price ? formatCurrency(r.price, preferredCurrency, { minimumFractionDigits: 0 }) : '-'}</td><td>${this.escapeHtml(r.buyer || '-')}</td></tr>`,
        ),
        Math.max(0, data.harvest.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('expense')) {
      const visibleRows = data.expense.slice(0, maxRowsPerSection);
      appendSectionTable(
        `💰 Expense Records (${data.expense.length})`,
        ['Date', 'DAP', 'Season', 'Type', 'Cost', 'Remarks'],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.date)}</td><td>${this.formatDaysAfterPruningTag(r.daysAfterPruning)}</td><td>${this.escapeHtml(this.formatSeasonCell(data.seasonContext, r.seasonId, r.seasonName, r.seasonWindow))}</td><td>${this.escapeHtml(r.type)}</td><td>${formatCurrency(r.cost, preferredCurrency, { minimumFractionDigits: 0 })}</td><td>${this.escapeHtml(r.remarks || '-')}</td></tr>`,
        ),
        Math.max(0, data.expense.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('stock')) {
      const visibleRows = matchedStockRows.slice(0, maxRowsPerSection);
      appendSectionTable(
        `📦 Stock Usage Summary (Matched ${matchedStockRows.length} of ${data.stock.length})`,
        [
          'Item',
          'Type',
          'Total Qty',
          'Unit',
          'Area Treated',
          'Count',
          'Current Stock',
          'Estimated Opening',
          'Estimated Consumed %',
          'Match',
        ],
        visibleRows.map(
          (r) =>
            `<tr><td>${this.escapeHtml(r.itemName)}</td><td>${this.escapeHtml(r.type)}</td><td>${r.quantityUsed}</td><td>${this.escapeHtml(r.unit)}</td><td>${r.areaTreated}</td><td>${r.usageCount}</td><td>${r.currentStockQuantity ?? '-'}</td><td>${r.estimatedOpeningStockQuantity ?? '-'}</td><td>${r.estimatedConsumedPercent != null ? `${r.estimatedConsumedPercent}%` : '-'}</td><td>${this.escapeHtml(r.matchStrategy ?? '-')}</td></tr>`,
        ),
        Math.max(0, matchedStockRows.length - maxRowsPerSection),
      );
      if (unmatchedStockRows.length > 0) {
        const visibleUnmatchedRows = unmatchedStockRows.slice(0, maxRowsPerSection);
        appendSectionTable(
          `⚠️ Unmatched Log Items (${unmatchedStockRows.length})`,
          ['Item', 'Type', 'Total Qty', 'Unit', 'Area Treated', 'Count', 'Reason'],
          visibleUnmatchedRows.map(
            (r) =>
              `<tr><td>${this.escapeHtml(r.itemName)}</td><td>${this.escapeHtml(r.type)}</td><td>${r.quantityUsed}</td><td>${this.escapeHtml(r.unit)}</td><td>${r.areaTreated}</td><td>${r.usageCount}</td><td>No warehouse match or missing water volume</td></tr>`,
          ),
          Math.max(0, unmatchedStockRows.length - maxRowsPerSection),
        );
      }

      if (data.usage) {
        const { perPlot, perAcre, perLiter } = data.usage;

        if (perPlot.rows.length > 0) {
          appendSectionTable(
            '⚖️ Applied Quantities — Per Plot',
            ['Product', 'Type', 'Total Applied', 'Uses'],
            perPlot.rows.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.type)}</td><td>${this.escapeHtml(r.totals.map((figure) => figure.display).join(' · '))}</td><td>${r.usageCount}</td></tr>`,
            ),
          );
        }

        if (perPlot.other.length > 0) {
          appendSectionTable(
            'Other Products (unit not recognized — shown as logged)',
            ['Product', 'Type', 'Quantity As Logged', 'Uses'],
            perPlot.other.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.type)}</td><td>${this.escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
            ),
          );
        }

        if (perPlot.concentrationOnly.length > 0) {
          appendSectionTable(
            'Concentration-Only (water volume not logged)',
            ['Product', 'Type', 'Concentration As Logged', 'Uses'],
            perPlot.concentrationOnly.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.type)}</td><td>${this.escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
            ),
          );
        }

        if (perPlot.rateOnly.length > 0) {
          appendSectionTable(
            'Rate-Only (farm area unavailable)',
            ['Product', 'Type', 'Rate As Logged', 'Uses'],
            perPlot.rateOnly.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.type)}</td><td>${this.escapeHtml(`${r.quantity} ${r.unit}`)}</td><td>${r.usageCount}</td></tr>`,
            ),
          );
        }

        if (perAcre.available && perAcre.rows.length > 0) {
          appendSectionTable(
            `⚖️ Applied Quantities — Per Acre (farm area: ${this.formatAreaAcres(perAcre.areaAcres)} acres)`,
            ['Product', 'Type', 'Per Acre'],
            perAcre.rows.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.type)}</td><td>${this.escapeHtml(r.perAcre.map((figure) => figure.display).join(' · '))}</td></tr>`,
            ),
          );
        } else if (!perAcre.available && (perPlot.rows.length > 0 || perPlot.rateOnly.length > 0)) {
          html += `<h2>⚖️ Applied Quantities — Per Acre</h2><p class="empty-section">Unavailable: farm area is missing or invalid — never divided by a guess.</p>`;
        }

        if (perAcre.available && perAcre.compliance.length > 0) {
          appendSectionTable(
            '📋 Plan Compliance (prescribed vs applied, per acre)',
            ['Product', 'Prescribed', 'Applied', 'Match'],
            perAcre.compliance.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.prescribedDisplay)}</td><td>${this.escapeHtml(r.appliedDisplay ?? (r.matchLevel === 'unresolved' ? 'logged — unit not comparable' : 'not logged'))}</td><td>${this.escapeHtml(r.matchLevel ?? '-')}</td></tr>`,
            ),
          );
          html += `<p class="more-records">verified = applied records logged from this plan item; approximate = matched by product name only — never presented as verified.</p>`;
        }

        if (perLiter.rows.length > 0) {
          appendSectionTable(
            `💦 Per Liter of Water (spray concentration, weighted by water volume; based on ${perLiter.sprayEventsWithWater} of ${perLiter.sprayEventsTotal} spray events with logged water)`,
            ['Product', 'Concentration', 'Events'],
            perLiter.rows.map(
              (r) =>
                `<tr><td>${this.escapeHtml(r.name)}</td><td>${this.escapeHtml(r.display)}</td><td>${r.eventCount}</td></tr>`,
            ),
          );
        }
      }
    }

    if (visibleSections.has('nutrient-ledger') && data.nutrientLedger) {
      const ledger = data.nutrientLedger;
      if (ledger.rows.length > 0) {
        // Human-facing masses go through the kernel's scale picker (issue
        // #235): micronutrient totals are gram/milligram scale, and a raw
        // "0.0004" under a kg header reads as zero.
        const massCell = (kg: number | null | undefined): string =>
          kg != null && Number.isFinite(kg) ? formatQuantity(kg, 'mass') : '-';
        appendSectionTable(
          `🌱 Nutrient Ledger — Nutrients Applied (nutrients from ${ledger.coveragePercent}% of applied quantity)`,
          [
            'Element',
            'Elemental',
            'Elemental /acre',
            'Bag-grade',
            'Bag-grade qty',
            'Bag-grade /acre',
          ],
          ledger.rows.map(
            (r) =>
              `<tr><td>${this.escapeHtml(r.element)}</td><td>${massCell(r.elementalKg)}</td><td>${massCell(r.elementalKgPerAcre)}</td><td>${this.escapeHtml(r.oxideSymbol ?? '-')}</td><td>${massCell(r.oxideKg)}</td><td>${massCell(r.oxideKgPerAcre)}</td></tr>`,
          ),
        );
        html += `<p class="more-records">Elemental values match petiole/soil lab reports. Bag-grade (N-P₂O₅-K₂O) matches what is printed on fertilizer bags.</p>`;
      } else {
        // Same split as the CSV: no applications at all is a different truth
        // than applications whose composition is missing.
        html += `<h2>🌱 Nutrient Ledger — Nutrients Applied</h2><p class="empty-section">${
          ledger.itemCount === 0
            ? this.EMPTY_SECTION_TEXT
            : 'No composition data — nutrients cannot be calculated (coverage 0%).'
        }</p>`;
      }
    }

    html += `
        <div class="footer">
          Generated by Vinesight on ${formatDate(new Date(), {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Export report as CSV file
   */
  static async exportCSV(
    data: ReportData,
    reportType: ReportType,
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): Promise<void> {
    if (!cacheDirectory) {
      throw new Error('Cache directory is not available on this device');
    }
    const csv = this.generateCSV(data, reportType, areaUnit, fpcColumns);
    const filename = this.buildReportFileName(data.farmName, 'csv');
    const fileUri = this.joinUri(cacheDirectory, filename);
    try {
      await writeAsStringAsync(fileUri, csv);
    } catch (error) {
      const safeFarmName = this.sanitizeFileNamePart(data.farmName);
      throw new Error(
        `Failed to write report file (${filename}) for farm: ${safeFarmName}. ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Report',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }

  /**
   * Download report as CSV file
   */
  static async downloadCSV(
    data: ReportData,
    reportType: ReportType,
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): Promise<string> {
    const csv = this.generateCSV(data, reportType, areaUnit, fpcColumns);
    const filename = this.buildReportFileName(data.farmName, 'csv');
    const reportsDirectory = await this.ensureReportsDirectory();
    const fileUri = this.joinUri(reportsDirectory, filename);

    try {
      await writeAsStringAsync(fileUri, csv);
    } catch (error) {
      const safeFarmName = this.sanitizeFileNamePart(data.farmName);
      throw new Error(
        `Failed to write report file (${filename}) for farm: ${safeFarmName}. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return fileUri;
  }

  /**
   * Export report as PDF file
   */
  static async exportPDF(
    data: ReportData,
    summary: ReportSummary,
    reportType: ReportType,
    preferredCurrency: string = getDefaultCurrency(),
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): Promise<void> {
    const html = this.generatePDFHtml(
      data,
      summary,
      reportType,
      preferredCurrency,
      areaUnit,
      fpcColumns,
    );

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Report',
        UTI: 'com.adobe.pdf',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  }

  /**
   * Download report as PDF file
   */
  static async downloadPDF(
    data: ReportData,
    summary: ReportSummary,
    reportType: ReportType,
    preferredCurrency: string = getDefaultCurrency(),
    areaUnit: AreaUnitPreference = 'acres',
    fpcColumns: FpcColumnOptions = FPC_LEAN_COLUMNS,
  ): Promise<string> {
    const html = this.generatePDFHtml(
      data,
      summary,
      reportType,
      preferredCurrency,
      areaUnit,
      fpcColumns,
    );

    const { uri: tempUri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const filename = this.buildReportFileName(data.farmName, 'pdf');
    const reportsDirectory = await this.ensureReportsDirectory();
    const destinationUri = this.joinUri(reportsDirectory, filename);

    try {
      await copyAsync({ from: tempUri, to: destinationUri });
    } finally {
      deleteAsync(tempUri, { idempotent: true }).catch(() => {});
    }
    return destinationUri;
  }
}
