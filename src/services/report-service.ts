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
  getSectionsForReportType,
} from '../types/report';
import { formatDate, formatCurrency } from '@/i18n/format';
import { getDefaultCurrency } from '@/i18n/currency';
import { AreaUnitPreference, convertAreaFromAcres } from '@/utils/preferences';
import { getDaysAfterPruning } from '@/utils/date';
import {
  UNIT_ALIASES_TO_KG,
  UNIT_ALIASES_TO_LITER,
  UNIT_ALIASES_TO_COUNT,
} from '@/constants/units';
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
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private static normalizeUnit(value: string): {
    normalizedUnit: string;
    multiplier: number;
    perAcre: boolean;
  } {
    const compact = value.trim().toLowerCase().replace(/\s+/g, '');
    const perAcre = compact.includes('/acre');
    const base = compact.replace('/acre', '');

    if (UNIT_ALIASES_TO_KG.has(base)) {
      const multiplier =
        base === 'gram' || base === 'grams' || base === 'gm' || base === 'gms' || base === 'g'
          ? 0.001
          : 1;
      return { normalizedUnit: 'kg', multiplier, perAcre };
    }

    if (UNIT_ALIASES_TO_LITER.has(base)) {
      const multiplier =
        base === 'ml' ||
        base === 'milliliter' ||
        base === 'milliliters' ||
        base === 'millilitre' ||
        base === 'millilitres'
          ? 0.001
          : 1;
      return { normalizedUnit: 'liter', multiplier, perAcre };
    }

    if (UNIT_ALIASES_TO_COUNT.has(base)) {
      return { normalizedUnit: 'unit', multiplier: 1, perAcre };
    }

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

  private static parseWaterVolumeFromDose(dose: string | null | undefined): number | null {
    const match = dose?.match(/Water:\s*([0-9]+(?:\.[0-9]+)?)\s*L/i);
    if (!match?.[1]) return null;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private static resolveConcentrationBaseUnit(unit: string): string | null {
    const compact = unit.trim().toLowerCase().replace(/\s+/g, '');
    const concentrationMatch = /^(.*)\/(l|liter|litre)$/.exec(compact);
    if (!concentrationMatch?.[1]) return null;
    return concentrationMatch[1];
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
    }));
  }

  private static resolveFertigationUsageItems(record: FertigationRecord): Array<{
    name: string;
    quantity: number;
    unit: string;
    quantityBasis?: QuantityBasis;
    warehouseItemId?: number | null;
    catalogProductId?: number | null;
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

      const concentrationBaseUnit = this.resolveConcentrationBaseUnit(unit);
      let resolvedQuantity = quantity;
      let resolvedUnit = unit;
      let resolvedQuantityBasis = quantityBasis;
      if (concentrationBaseUnit) {
        if (!waterVolumeL || !Number.isFinite(waterVolumeL) || waterVolumeL <= 0) {
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
        resolvedQuantity = quantity * waterVolumeL;
        resolvedUnit = concentrationBaseUnit;
        // Preserve the original per-acre basis: if the water volume is specified per-acre,
        // the resolved quantity remains per-acre and will be multiplied by area downstream.
        if (resolvedQuantityBasis !== 'per_acre') {
          resolvedQuantityBasis = 'total';
        }
      }

      const resolved = this.resolveAppliedQuantity(
        resolvedQuantity,
        resolvedUnit,
        resolvedQuantityBasis,
        area,
      );
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

    filteredSprays.forEach((record) => {
      const waterVolumeL = this.parseWaterVolumeFromDose(record.dose);
      this.resolveSprayUsageItems(record).forEach((item) => {
        upsertUsage(
          'spray',
          item.name,
          item.quantity,
          item.unit,
          item.quantityBasis,
          record.area,
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
          record.area,
          item.warehouseItemId,
          item.catalogProductId,
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
    const { seasonContext, seasonNameById, seasonWindowById } = options;
    const stockUsage = this.calculateStockUsage(sprays, fertigations, dateRange, warehouseItems);
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
    };
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
    rows.push(`Area: ${convertAreaFromAcres(data.farmArea, areaUnit)} ${areaUnitLabel}`);
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
    }

    return rows.join('\n');
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
            Region: ${this.escapeHtml(data.farmRegion)} | Area: ${convertAreaFromAcres(data.farmArea, areaUnit)} ${areaUnitLabel}<br>
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
  ): Promise<void> {
    if (!cacheDirectory) {
      throw new Error('Cache directory is not available on this device');
    }
    const csv = this.generateCSV(data, reportType, areaUnit);
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
  ): Promise<string> {
    const csv = this.generateCSV(data, reportType, areaUnit);
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
  ): Promise<void> {
    const html = this.generatePDFHtml(data, summary, reportType, preferredCurrency, areaUnit);

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
  ): Promise<string> {
    const html = this.generatePDFHtml(data, summary, reportType, preferredCurrency, areaUnit);

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
