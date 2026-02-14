/**
 * Report Service for Vinesight
 * Handles report generation for CSV and PDF exports
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
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
}

export class ReportService {
  private static readonly EMPTY_SECTION_TEXT = 'No records in selected range';

  private static sanitizeFileNamePart(value: string, fallback: string = 'farm'): string {
    const sanitized = Array.from(value)
      .filter((char) => char.charCodeAt(0) >= 32)
      .join('')
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    return sanitized || fallback;
  }

  /**
   * Escape a value for CSV output
   */
  private static escapeCSV(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Filter records by date range
   */
  static filterByDateRange<T extends { date: string }>(records: T[], dateRange: DateRange): T[] {
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999); // Include entire end day

    return records.filter((record) => {
      const recordDate = new Date(record.date);
      return recordDate >= fromDate && recordDate <= toDate;
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
    seasonId: number | null | undefined,
    seasonName: string | null | undefined,
  ): string {
    if (seasonName && seasonName.trim().length > 0) return seasonName;
    if (seasonId != null) return `Season ${seasonId}`;
    return '-';
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
    if (needsAreaMultiplier && Number.isFinite(area) && area > 0) {
      totalQuantity *= area;
    }

    return {
      quantity: totalQuantity,
      normalizedUnit: normalized.normalizedUnit,
    };
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
        }))
        .filter(
          (item) => item.name && item.unit && Number.isFinite(item.quantity) && item.quantity > 0,
        );
    }

    return this.parseStockItems(record.chemical).map((item) => ({
      ...item,
      quantityBasis: 'total' as const,
      warehouseItemId: null,
    }));
  }

  private static resolveFertigationUsageItems(record: FertigationRecord): Array<{
    name: string;
    quantity: number;
    unit: string;
    quantityBasis?: QuantityBasis;
    warehouseItemId?: number | null;
  }> {
    const fertilizerItems = (record.fertilizers ?? []) as FertilizerItem[];
    return fertilizerItems
      .map((item) => ({
        name: item.name?.trim() ?? '',
        quantity: Number(item.quantity),
        unit: item.unit?.trim() ?? '',
        quantityBasis: item.quantity_basis,
        warehouseItemId: item.warehouse_item_id ?? null,
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
      }
    >,
    warehouseItems: WarehouseItem[],
  ): ReportStockUsageRecord[] {
    const byId = new Map<number, WarehouseItem>();
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
      }
    >();
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
    ) => {
      const normalizedName = this.normalizeName(name);
      if (!normalizedName) return;

      const resolved = this.resolveAppliedQuantity(quantity, unit, quantityBasis, area);
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
      });
    };

    filteredSprays.forEach((record) => {
      this.resolveSprayUsageItems(record).forEach((item) => {
        upsertUsage(
          'spray',
          item.name,
          item.quantity,
          item.unit,
          item.quantityBasis,
          record.area,
          item.warehouseItemId,
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
        );
      });
    });

    return this.matchWarehouseAndEstimateStock(Array.from(usageMap.values()), warehouseItems);
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
    const { seasonContext, seasonNameById } = options;
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
        date: r.date,
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        duration: r.duration,
        area: r.area,
        growthStage: r.growth_stage,
        moistureStatus: r.moisture_status,
        systemDischarge: r.system_discharge,
        notes: r.notes || undefined,
      })),
      spray: sprayRecords.map((r) => ({
        date: r.date,
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        chemical: r.chemical,
        dose: r.dose,
        area: r.area,
        weather: r.weather,
        operator: r.operator,
        notes: r.notes || undefined,
      })),
      fertigation: fertigationRecords.map((r) => ({
        date: r.date,
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        fertilizers: r.fertilizers
          ? r.fertilizers.map((f) => `${f.name} (${f.quantity} ${f.unit})`).join(', ')
          : 'N/A',
        area: r.area,
        notes: r.notes || undefined,
      })),
      harvest: harvestRecords.map((r) => ({
        date: r.date,
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
        quantity: r.quantity,
        grade: r.grade,
        price: r.price || undefined,
        buyer: r.buyer || undefined,
        notes: r.notes || undefined,
      })),
      expense: expenseRecords.map((r) => ({
        date: r.date,
        seasonId: r.season_id ?? null,
        seasonName: this.resolveSeasonName(r.season_id, seasonNameById),
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
  static calculateSummary(data: ReportData): ReportSummary {
    const totalIrrigationHours = data.irrigation.reduce((sum, r) => sum + r.duration, 0);
    const totalWaterUsage = data.irrigation.reduce(
      (sum, r) => sum + r.duration * r.systemDischarge,
      0,
    );
    const totalHarvest = data.harvest.reduce((sum, r) => sum + r.quantity, 0);
    const totalRevenue = data.harvest.reduce((sum, r) => sum + r.quantity * (r.price || 0), 0);
    const totalExpenses = data.expense.reduce((sum, r) => sum + r.cost, 0);

    return {
      totalRecords:
        data.irrigation.length +
        data.spray.length +
        data.fertigation.length +
        data.harvest.length +
        data.expense.length,
      dateRange: `${data.dateRange.from} to ${data.dateRange.to}`,
      totalIrrigationHours: Math.round(totalIrrigationHours * 10) / 10,
      totalWaterUsage: Math.round(totalWaterUsage),
      totalHarvest: Math.round(totalHarvest * 10) / 10,
      totalRevenue: Math.round(totalRevenue),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(totalRevenue - totalExpenses),
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

    // Header
    rows.push(`Farm Report - ${data.farmName}`);
    rows.push(`Report Type: ${this.formatReportType(reportType)}`);
    rows.push(`Region: ${data.farmRegion}`);
    rows.push(`Area: ${convertAreaFromAcres(data.farmArea, areaUnit)} ${areaUnitLabel}`);
    rows.push(`Date Range: ${data.dateRange.from} to ${data.dateRange.to}`);
    rows.push(`Season: ${this.formatSeasonContextLabel(data.seasonContext)}`);
    if (data.seasonContext?.mode === 'season') {
      rows.push(
        `Season Window: ${data.seasonContext.seasonStart ?? '-'} to ${data.seasonContext.seasonEnd ?? 'Active'}`,
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
          `Date,Season ID,Season Name,Duration (hrs),Area (${areaUnitLabel}),Growth Stage,Moisture Status,System Discharge (L/h),Notes`,
        );
        data.irrigation.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${r.seasonId ?? ''},${this.escapeCSV(r.seasonName ?? '')},${r.duration},${convertAreaFromAcres(r.area, areaUnit)},${this.escapeCSV(r.growthStage)},${this.escapeCSV(r.moistureStatus)},${r.systemDischarge},${this.escapeCSV(r.notes || '')}`,
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
        rows.push(
          `Date,Season ID,Season Name,Chemical,Dose,Area (${areaUnitLabel}),Weather,Operator,Notes`,
        );
        data.spray.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${r.seasonId ?? ''},${this.escapeCSV(r.seasonName ?? '')},${this.escapeCSV(r.chemical)},${this.escapeCSV(r.dose)},${convertAreaFromAcres(r.area, areaUnit)},${this.escapeCSV(r.weather)},${this.escapeCSV(r.operator)},${this.escapeCSV(r.notes || '')}`,
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
        rows.push(`Date,Season ID,Season Name,Fertilizers,Area (${areaUnitLabel}),Notes`);
        data.fertigation.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${r.seasonId ?? ''},${this.escapeCSV(r.seasonName ?? '')},${this.escapeCSV(r.fertilizers)},${convertAreaFromAcres(r.area, areaUnit)},${this.escapeCSV(r.notes || '')}`,
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
        rows.push('Date,Season ID,Season Name,Quantity (kg),Grade,Price,Buyer,Notes');
        data.harvest.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${r.seasonId ?? ''},${this.escapeCSV(r.seasonName ?? '')},${r.quantity},${this.escapeCSV(r.grade)},${r.price || ''},${this.escapeCSV(r.buyer || '')},${this.escapeCSV(r.notes || '')}`,
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
        rows.push('Date,Season ID,Season Name,Type,Cost,Remarks');
        data.expense.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.date)},${r.seasonId ?? ''},${this.escapeCSV(r.seasonName ?? '')},${this.escapeCSV(r.type)},${r.cost},${this.escapeCSV(r.remarks || '')}`,
          );
        });
        rows.push('');
      }
    }

    if (visibleSections.has('stock')) {
      if (data.stock.length === 0) {
        pushEmptySection('STOCK USAGE SUMMARY');
      } else {
        rows.push('STOCK USAGE SUMMARY');
        rows.push(
          'Item,Type,Total Quantity Used,Unit,Total Area Treated,Usage Count,Current Stock,Estimated Opening Stock,Estimated Consumed %,Match',
        );
        data.stock.forEach((r) => {
          rows.push(
            `${this.escapeCSV(r.itemName)},${r.type},${r.quantityUsed},${r.unit},${r.areaTreated},${r.usageCount},${r.currentStockQuantity ?? ''},${r.estimatedOpeningStockQuantity ?? ''},${r.estimatedConsumedPercent ?? ''},${r.matchStrategy ?? ''}`,
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
      ...(visibleSections.has('expense')
        ? [
            {
              label: 'Revenue',
              value: formatCurrency(summary.totalRevenue, preferredCurrency, {
                minimumFractionDigits: 0,
              }),
              className: '',
            },
            {
              label: 'Expenses',
              value: formatCurrency(summary.totalExpenses, preferredCurrency, {
                minimumFractionDigits: 0,
              }),
              className: '',
            },
          ]
        : []),
      {
        label: 'Net Profit',
        value: formatCurrency(summary.netProfit, preferredCurrency, { minimumFractionDigits: 0 }),
        className: summary.netProfit >= 0 ? 'profit' : 'loss',
      },
    ];

    let html = `
      <!DOCTYPE html>
      <html>
      <head>${styles}</head>
      <body>
        <div class="header">
          <h1>🍇 ${data.farmName}</h1>
          <p class="meta">
            Report Type: ${this.formatReportType(reportType)}<br>
            Region: ${data.farmRegion} | Area: ${convertAreaFromAcres(data.farmArea, areaUnit)} ${areaUnitLabel}<br>
            Report Period: ${data.dateRange.from} to ${data.dateRange.to}<br>
            Season: ${this.formatSeasonContextLabel(data.seasonContext)}
            ${
              data.seasonContext?.mode === 'season'
                ? `<br>Season Window: ${data.seasonContext.seasonStart ?? '-'} to ${data.seasonContext.seasonEnd ?? 'Active'}`
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
          <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
          ${rowMarkup.join('')}
        </table>
        ${hiddenCount > 0 ? `<p class="more-records">... and ${hiddenCount} more records</p>` : ''}
      `;
    };

    if (visibleSections.has('irrigation')) {
      const visibleRows = data.irrigation.slice(0, maxRowsPerSection);
      appendSectionTable(
        `💧 Irrigation Records (${data.irrigation.length})`,
        ['Date', 'Season', 'Duration', `Area (${areaUnitLabel})`, 'Growth Stage', 'Discharge'],
        visibleRows.map(
          (r) =>
            `<tr><td>${r.date}</td><td>${this.formatSeasonCell(r.seasonId, r.seasonName)}</td><td>${r.duration}h</td><td>${convertAreaFromAcres(r.area, areaUnit)}</td><td>${r.growthStage}</td><td>${r.systemDischarge} L/h</td></tr>`,
        ),
        Math.max(0, data.irrigation.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('spray')) {
      const visibleRows = data.spray.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🧪 Spray Records (${data.spray.length})`,
        ['Date', 'Season', 'Chemical', 'Dose', `Area (${areaUnitLabel})`, 'Weather'],
        visibleRows.map(
          (r) =>
            `<tr><td>${r.date}</td><td>${this.formatSeasonCell(r.seasonId, r.seasonName)}</td><td>${r.chemical}</td><td>${r.dose}</td><td>${convertAreaFromAcres(r.area, areaUnit)}</td><td>${r.weather}</td></tr>`,
        ),
        Math.max(0, data.spray.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('fertigation')) {
      const visibleRows = data.fertigation.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🧴 Fertigation Records (${data.fertigation.length})`,
        ['Date', 'Season', 'Fertilizers', `Area (${areaUnitLabel})`],
        visibleRows.map(
          (r) =>
            `<tr><td>${r.date}</td><td>${this.formatSeasonCell(r.seasonId, r.seasonName)}</td><td>${r.fertilizers}</td><td>${convertAreaFromAcres(r.area, areaUnit)}</td></tr>`,
        ),
        Math.max(0, data.fertigation.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('harvest')) {
      const visibleRows = data.harvest.slice(0, maxRowsPerSection);
      appendSectionTable(
        `🍇 Harvest Records (${data.harvest.length})`,
        ['Date', 'Season', 'Quantity', 'Grade', 'Price', 'Buyer'],
        visibleRows.map(
          (r) =>
            `<tr><td>${r.date}</td><td>${this.formatSeasonCell(r.seasonId, r.seasonName)}</td><td>${r.quantity} kg</td><td>${r.grade}</td><td>${r.price ? formatCurrency(r.price, preferredCurrency, { minimumFractionDigits: 0 }) : '-'}</td><td>${r.buyer || '-'}</td></tr>`,
        ),
        Math.max(0, data.harvest.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('expense')) {
      const visibleRows = data.expense.slice(0, maxRowsPerSection);
      appendSectionTable(
        `💰 Expense Records (${data.expense.length})`,
        ['Date', 'Season', 'Type', 'Cost', 'Remarks'],
        visibleRows.map(
          (r) =>
            `<tr><td>${r.date}</td><td>${this.formatSeasonCell(r.seasonId, r.seasonName)}</td><td>${r.type}</td><td>${formatCurrency(r.cost, preferredCurrency, { minimumFractionDigits: 0 })}</td><td>${r.remarks || '-'}</td></tr>`,
        ),
        Math.max(0, data.expense.length - maxRowsPerSection),
      );
    }

    if (visibleSections.has('stock')) {
      const visibleRows = data.stock.slice(0, maxRowsPerSection);
      appendSectionTable(
        `📦 Stock Usage Summary (${data.stock.length})`,
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
            `<tr><td>${r.itemName}</td><td>${r.type}</td><td>${r.quantityUsed}</td><td>${r.unit}</td><td>${r.areaTreated}</td><td>${r.usageCount}</td><td>${r.currentStockQuantity ?? '-'}</td><td>${r.estimatedOpeningStockQuantity ?? '-'}</td><td>${r.estimatedConsumedPercent != null ? `${r.estimatedConsumedPercent}%` : '-'}</td><td>${r.matchStrategy ?? '-'}</td></tr>`,
        ),
        Math.max(0, data.stock.length - maxRowsPerSection),
      );
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
    const csv = this.generateCSV(data, reportType, areaUnit);
    const safeFarmName = this.sanitizeFileNamePart(data.farmName);
    const uniqueness = safeFarmName === 'farm' ? `_${Date.now()}` : '';
    const filename = `${safeFarmName}${uniqueness}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    if (!cacheDirectory) {
      throw new Error('Cache directory is not available on this device');
    }
    const fileUri = cacheDirectory.endsWith('/')
      ? `${cacheDirectory}${filename}`
      : `${cacheDirectory}/${filename}`;
    try {
      await writeAsStringAsync(fileUri, csv);
    } catch (error) {
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

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Unable to open print window. Please allow pop-ups and try again.');
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      return;
    }

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
}
