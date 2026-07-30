import type {
  CatalogMappingSource,
  CatalogMappingStatus,
  MasterCatalogProduct,
  NutrientCompositionItem,
  WarehouseItem,
  WarehouseItemInsert,
  WarehouseItemType,
  WarehouseUnit,
} from '@/types';
import { isValidExpiryDate } from '@/features/purchase/product-form-data';

/**
 * Editable composition row state held by {@link WarehouseItemForm}. The percent
 * is kept as a string until submit so the input can represent in-progress and
 * empty values without coercing them to `0`.
 */
export interface CompositionRow {
  id: string;
  nutrient_code: string;
  percent: string;
}

/**
 * Parse composition rows into the persisted nutrient items, dropping rows that
 * are empty or out of range. Mirrors the package-label guarantee semantics: a
 * row only counts when it has a nutrient code and a positive percent ≤ 100.
 */
export function parseComposition(rows: CompositionRow[]): NutrientCompositionItem[] {
  return rows.reduce<NutrientCompositionItem[]>((result, row) => {
    const nutrientCode = row.nutrient_code.trim().toUpperCase();
    const rawPercent = row.percent?.trim() ?? '';
    if (!rawPercent) {
      return result;
    }

    const parsedPercent = Number(rawPercent);
    if (
      nutrientCode.length > 0 &&
      Number.isFinite(parsedPercent) &&
      parsedPercent > 0 &&
      parsedPercent <= 100
    ) {
      result.push({
        nutrient_code: nutrientCode,
        percent: parsedPercent,
        basis: 'declared',
        notes: null,
      });
    }
    return result;
  }, []);
}

/** Validation error codes produced by {@link validateWarehouseItemForm}. */
export type WarehouseItemFormError =
  | 'missing_name'
  | 'invalid_quantity'
  | 'invalid_unit_price'
  | 'invalid_expiry_date'
  | 'missing_composition'
  | 'missing_density';

/** Result of parsing/validating the warehouse item form: either an error or the
 * ready-to-persist payload. */
export type WarehouseItemFormResult =
  { ok: true; payload: WarehouseItemInsert } | { ok: false; error: WarehouseItemFormError };

/** Form field values and catalog/edit context needed to validate and build the
 * warehouse item payload. */
export interface ValidateWarehouseItemFormInput {
  name: string;
  type: WarehouseItemType;
  quantity: string;
  unit: WarehouseUnit;
  unitPrice: string;
  reorderQuantity: string;
  notes: string;
  manufacturer: string;
  densityKgPerL: string;
  expiryDate: string;
  compositionRows: CompositionRow[];
  compositionSource: 'manual' | 'preset';
  selectedCatalogProductId: number | null;
  selectedCatalogProduct: MasterCatalogProduct | null;
  catalogSelectionTouched: boolean;
  editingItem: WarehouseItem | null;
}

/**
 * Pure parsing/validation path for the warehouse item form. Runs the same
 * ordered checks the submit handler used to inline, and on success builds the
 * exact {@link WarehouseItemInsert} payload (catalog mapping, density, and
 * composition semantics preserved). Used for both the submit handler and the
 * save-button validity so the two can never disagree.
 *
 * @param now Timestamp used for `composition_updated_at` / `catalog_mapped_at`.
 *   Defaults to `new Date()` to preserve the prior submit-time behavior; pass a
 *   fixed value for deterministic tests.
 */
export function validateWarehouseItemForm(
  input: ValidateWarehouseItemFormInput,
  now: Date = new Date(),
): WarehouseItemFormResult {
  const {
    name,
    type,
    quantity,
    unit,
    unitPrice,
    reorderQuantity,
    notes,
    manufacturer,
    densityKgPerL,
    expiryDate,
    compositionRows,
    compositionSource,
    selectedCatalogProductId,
    selectedCatalogProduct,
    catalogSelectionTouched,
    editingItem,
  } = input;

  if (!name.trim()) {
    return { ok: false, error: 'missing_name' };
  }
  const quantityValue = Number(quantity);
  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const unitPriceValue = Number(unitPrice);
  if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
    return { ok: false, error: 'invalid_unit_price' };
  }
  if (!isValidExpiryDate(expiryDate)) {
    return { ok: false, error: 'invalid_expiry_date' };
  }

  const composition = parseComposition(compositionRows);
  if (type === 'fertilizer' && composition.length === 0) {
    return { ok: false, error: 'missing_composition' };
  }

  const densityRequired = unit === 'liter' || unit === 'ml';
  const densityValue = Number(densityKgPerL);
  const parsedDensity =
    densityKgPerL.trim().length > 0 && Number.isFinite(densityValue) && densityValue > 0
      ? densityValue
      : null;
  if (densityRequired && parsedDensity == null) {
    return { ok: false, error: 'missing_density' };
  }

  const previousCatalogProductId = editingItem?.catalog_product_id ?? null;
  const previousCatalogMappingStatus = editingItem?.catalog_mapping_status ?? 'unmapped';
  const previousCatalogMappingSource = editingItem?.catalog_mapping_source ?? 'manual';
  const previousCatalogMappedAt = editingItem?.catalog_mapped_at ?? null;
  const preservePreviousCatalogMapping =
    selectedCatalogProductId != null &&
    !selectedCatalogProduct &&
    previousCatalogProductId != null &&
    previousCatalogProductId === selectedCatalogProductId;
  const resolvedCatalogProductId =
    selectedCatalogProduct?.id ??
    (catalogSelectionTouched
      ? selectedCatalogProductId
      : (selectedCatalogProductId ?? previousCatalogProductId));

  const payload: WarehouseItemInsert = {
    name: name.trim(),
    type,
    quantity: quantityValue,
    unit,
    unit_price: unitPriceValue,
    reorder_quantity: reorderQuantity ? parseFloat(reorderQuantity) : null,
    notes: notes.trim() || null,
    manufacturer: manufacturer.trim() || null,
    density_kg_per_l: parsedDensity,
    expiry_date: expiryDate.trim() || null,
    composition,
    composition_source: compositionSource,
    composition_updated_at: now.toISOString(),
    catalog_product_id: resolvedCatalogProductId,
    catalog_mapping_status: (selectedCatalogProduct
      ? selectedCatalogProduct.verification_tier === 'verified'
        ? 'mapped_verified'
        : 'mapped_provisional'
      : preservePreviousCatalogMapping
        ? previousCatalogMappingStatus
        : 'unmapped') as CatalogMappingStatus,
    catalog_mapping_source: (selectedCatalogProduct
      ? 'preset'
      : preservePreviousCatalogMapping
        ? previousCatalogMappingSource
        : 'manual') as CatalogMappingSource,
    catalog_mapped_at: selectedCatalogProduct
      ? now.toISOString()
      : preservePreviousCatalogMapping
        ? previousCatalogMappedAt
        : null,
  };

  return { ok: true, payload };
}
