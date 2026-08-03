/**
 * Form-data → update-payload builders for edit flows.
 *
 * Inverse of {@link ./record-to-form}. Create paths use
 * {@link ./entry-log-fields} (which may scale per-acre quantities and write PHI
 * columns); edit paths preserve the quantities the user sees and only rewrite
 * the fields the editor owns. One module so QuickLogSheet and ActivityEditForm
 * cannot drift.
 */

import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  SprayFormData,
} from '@/components/forms';
import type { ExpenseTypeId } from '@/constants/calculator-models';
import { isFertigationUnitRecognized } from '@/constants/fertilizer-units';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import type {
  ExpenseRecordUpdate,
  FertigationRecordUpdate,
  HarvestRecordUpdate,
  IrrigationRecordUpdate,
  SprayRecordUpdate,
} from '@/types';
import { mapExpenseTypeIdToRecordType } from '@/utils/expense-type';

export function buildIrrigationUpdate(
  data: IrrigationFormData,
  date: string,
): IrrigationRecordUpdate {
  return {
    duration: data.duration,
    date,
  };
}

export function buildSprayUpdate(
  data: SprayFormData,
  date: string,
  farmAreaAcres: number | null | undefined,
): SprayRecordUpdate {
  const chemicalItems = data.chemicals
    .filter((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
    .map((c) => ({
      name: c.name.trim(),
      unit: c.unit,
      quantity: c.quantity!,
      quantity_basis: c.quantityBasis ?? 'total',
      warehouse_item_id: c.warehouseItemId ?? null,
      catalog_product_id: c.catalogProductId ?? null,
      plan_item_id: c.planItemId ?? null,
      composition_snapshot: c.compositionSnapshot ?? null,
      density_kg_per_l: c.densityKgPerL ?? null,
    }));
  const nutrientTotals = calculateNutrientTotalsForLog({
    items: chemicalItems,
    areaAcre: farmAreaAcres ?? 0,
    waterVolumeL: data.waterVolume ?? null,
  });
  return {
    chemical: data.chemicals.map((c) => `${c.name} (${c.quantity} ${c.unit})`).join(', '),
    chemical_items: chemicalItems,
    dose: data.waterVolume != null ? `Water: ${data.waterVolume}L` : '',
    nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
    nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
    nutrient_calc_coverage: nutrientTotals.coveragePercent,
    date,
  };
}

export function buildHarvestUpdate(data: HarvestFormData, date: string): HarvestRecordUpdate {
  return {
    quantity: data.quantity,
    grade: data.grade,
    price: data.price || undefined,
    buyer: data.buyer || undefined,
    date,
  };
}

export function buildExpenseUpdate(data: ExpenseFormData, date: string): ExpenseRecordUpdate {
  return {
    type: mapExpenseTypeIdToRecordType((data.type || 'Other') as ExpenseTypeId),
    cost: data.cost,
    remarks: data.remarks || undefined,
    date,
  };
}

/**
 * Fertigation update payload (standalone edit or linked-to-irrigation edit).
 * Maps every row the form holds (including quantity 0) so a cleared quantity
 * is not silently dropped from the stored list.
 */
export function buildFertigationUpdate(
  data: FertigationFormData,
  date: string,
  farmAreaAcres: number | null | undefined,
): FertigationRecordUpdate {
  const fertilizerItems = data.fertilizers.map((f) => ({
    name: f.name.trim(),
    // Testimony rule (issue #192): stored verbatim; kernel-unknown strings are
    // flagged for review, never coerced to kg.
    unit: f.unit,
    quantity: f.quantity ?? 0,
    quantity_basis: f.quantityBasis ?? 'total',
    ...(isFertigationUnitRecognized(f.unit) ? {} : { unit_unrecognized: true }),
    warehouse_item_id: f.warehouseItemId ?? null,
    catalog_product_id: f.catalogProductId ?? null,
    plan_item_id: f.planItemId ?? null,
    composition_snapshot: f.compositionSnapshot ?? null,
    density_kg_per_l: f.densityKgPerL ?? null,
  }));
  const nutrientTotals = calculateNutrientTotalsForLog({
    items: fertilizerItems,
    areaAcre: farmAreaAcres ?? 0,
  });
  return {
    fertilizers: fertilizerItems,
    nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
    nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
    nutrient_calc_coverage: nutrientTotals.coveragePercent,
    date,
  };
}
