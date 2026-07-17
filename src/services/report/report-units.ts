import { parseUnit } from '@/lib/quantity';
import { parseSprayWaterVolumeL } from '../nutrient-flow-service';
import {
  SprayRecord,
  SprayChemicalItem,
  FertigationRecord,
  FertilizerItem,
  QuantityBasis,
} from '../../types/database';
import { measureUnitLabel } from './report-format';

export function normalizeUnit(value: string): {
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
      normalizedUnit: measureUnitLabel(parsed.measure),
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

export function resolveAppliedQuantity(
  quantity: number,
  unit: string,
  quantityBasis: QuantityBasis | null | undefined,
  area: number,
): { quantity: number; normalizedUnit: string } | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const normalized = normalizeUnit(unit);
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
export function parseWaterVolumeFromDose(dose: string | null | undefined): number | null {
  return parseSprayWaterVolumeL(dose);
}

export function positiveOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Parse legacy spray string format: "Name (Quantity Unit), Name2 (Quantity Unit)"
 */
function parseStockItems(itemStr: string): Array<{ name: string; quantity: number; unit: string }> {
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

export function resolveSprayUsageItems(record: SprayRecord): Array<{
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

  return parseStockItems(record.chemical).map((item) => ({
    ...item,
    quantityBasis: 'total' as const,
    warehouseItemId: null,
    catalogProductId: null,
    planItemId: null,
  }));
}

export function resolveFertigationUsageItems(record: FertigationRecord): Array<{
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

export function toRounded(value: number, precision: number = 4): number {
  const scale = Math.pow(10, precision);
  return Math.round(value * scale) / scale;
}
