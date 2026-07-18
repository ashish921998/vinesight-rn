import type {
  ExpenseFormData,
  FertigationFormData,
  FertilizerEntry,
  HarvestFormData,
  IrrigationFormData,
  NoteFormData,
  ChemicalEntry,
  SprayFormData,
} from '@/components/forms';
import type { ExpenseTypeId } from '@/constants/calculator-models';
import { isFertigationUnitRecognized } from '@/constants/fertilizer-units';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import { PHI_CALC_VERSION } from '@/services/phi-service';
import type {
  ExpenseRecordInsert,
  FertigationRecordInsert,
  HarvestRecordInsert,
  SprayRecordInsert,
} from '@/types';
import { mapExpenseTypeIdToRecordType } from '@/utils/expense-type';
import {
  convertAreaToAcres,
  resolveAreaUnitPreference,
  type AreaUnitPreference,
} from '@/utils/preferences';

const ACRES_TO_HECTARES = 0.404686;

export type EntryLogFormInput =
  | { type: 'irrigation'; data: IrrigationFormData }
  | { type: 'spray'; data: SprayFormData }
  | { type: 'harvest'; data: HarvestFormData }
  | { type: 'expense'; data: ExpenseFormData }
  | { type: 'fertigation'; data: FertigationFormData }
  | { type: 'note'; data: NoteFormData };

export interface EntryLogFieldContext {
  area?: number | null;
  areaUnit?: AreaUnitPreference | null;
}

type SprayFields = Omit<
  SprayRecordInsert,
  'farm_id' | 'date' | 'weather' | 'operator' | 'date_of_pruning'
>;
type HarvestFields = Omit<HarvestRecordInsert, 'farm_id' | 'date' | 'date_of_pruning'>;
type ExpenseFields = Omit<ExpenseRecordInsert, 'farm_id' | 'date' | 'date_of_pruning'>;
type FertigationFields = Omit<
  FertigationRecordInsert,
  'farm_id' | 'date' | 'date_of_pruning' | 'irrigation_record_id'
>;

export type EntryLogRecordFields =
  | { type: 'irrigation'; fields: { duration: number } }
  | { type: 'spray'; fields: SprayFields }
  | { type: 'harvest'; fields: HarvestFields }
  | { type: 'expense'; fields: ExpenseFields }
  | { type: 'fertigation'; fields: FertigationFields }
  | { type: 'note'; fields: { notes: string } };

/** Multiplier that converts a per-acre quantity into the farm's preferred area unit.
 *  For hectares-preference farms, a per-acre rate is normalized by ×0.404686
 *  (1 acre = 0.404686 ha) so the stored quantity matches the per-hectare scale. */
export function perAcreFactor(areaUnit: AreaUnitPreference | null | undefined): number {
  return resolveAreaUnitPreference(areaUnit ?? 'acres') === 'hectares' ? ACRES_TO_HECTARES : 1;
}

/** Human-readable "Name (qty unit), ..." summary stored on the spray record. */
export function buildSprayChemicalSummary(chemicals: ChemicalEntry[]): string {
  return chemicals.map((c) => `${c.name} (${c.quantity} ${c.unit})`).join(', ');
}

export function buildSprayChemicalItems(chemicals: ChemicalEntry[], factor: number) {
  return chemicals
    .filter((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
    .map((c) => {
      const quantityBasis = c.quantityBasis ?? 'total';
      const quantity = quantityBasis === 'per_acre' ? c.quantity! * factor : c.quantity!;
      return {
        name: c.name.trim(),
        unit: c.unit,
        quantity,
        quantity_basis: quantityBasis,
        warehouse_item_id: c.warehouseItemId ?? null,
        catalog_product_id: c.catalogProductId ?? null,
        plan_item_id: c.planItemId ?? null,
        composition_snapshot: c.compositionSnapshot ?? null,
        density_kg_per_l: c.densityKgPerL ?? null,
      };
    });
}

export function buildFertigationItems(fertilizers: FertilizerEntry[], factor: number) {
  return fertilizers
    .filter((f) => f.name.trim() && f.quantity !== undefined && f.quantity > 0)
    .map((f) => {
      const quantityBasis = f.quantityBasis ?? 'total';
      const quantity = quantityBasis === 'per_acre' ? f.quantity! * factor : f.quantity!;
      return {
        name: f.name.trim(),
        // Testimony rule (issue #192): the unit string is stored verbatim.
        // Kernel-unknown strings are flagged for review, never coerced to kg.
        unit: f.unit,
        quantity,
        quantity_basis: quantityBasis,
        ...(isFertigationUnitRecognized(f.unit) ? {} : { unit_unrecognized: true }),
        warehouse_item_id: f.warehouseItemId ?? null,
        catalog_product_id: f.catalogProductId ?? null,
        plan_item_id: f.planItemId ?? null,
        composition_snapshot: f.compositionSnapshot ?? null,
        density_kg_per_l: f.densityKgPerL ?? null,
      };
    });
}

export interface SprayPhiResolution {
  hasCatalogMix: boolean;
  hasResolvedPhi: boolean;
  normalizedPhiStatus: 'verified' | 'legacy_unverified' | 'unknown';
  /** PHI marker notes ([PHI_OVERRIDE] / [PHI_UNAVAILABLE]); '' when none apply. */
  notes: string;
}

export function resolveSprayPhi(data: SprayFormData): SprayPhiResolution {
  const hasCatalogMix = typeof data.catalogMixId === 'number';
  const hasResolvedPhi =
    hasCatalogMix && data.safeHarvestDate != null && data.governingPhiDays != null;

  const noteParts: string[] = [];
  if (data.phiOverride) {
    noteParts.push('[PHI_OVERRIDE] Harvest safety conflict override acknowledged in app.');
  }
  if (hasCatalogMix && !hasResolvedPhi) {
    noteParts.push('[PHI_UNAVAILABLE] Saved without resolved PHI metadata.');
  }

  const normalizedPhiStatus = hasResolvedPhi
    ? data.phiStatus && data.phiStatus !== 'unknown'
      ? data.phiStatus
      : 'verified'
    : hasCatalogMix
      ? 'legacy_unverified'
      : (data.phiStatus ?? 'unknown');

  return { hasCatalogMix, hasResolvedPhi, normalizedPhiStatus, notes: noteParts.join(' ').trim() };
}

export function buildEntryLogRecordFields(
  input: EntryLogFormInput,
  context: EntryLogFieldContext,
): EntryLogRecordFields {
  const farmArea =
    typeof context.area === 'number' && Number.isFinite(context.area) && context.area > 0
      ? context.area
      : 0;
  const factor = perAcreFactor(context.areaUnit);
  // record.area is stored RAW in the farm's preferred unit (acres OR hectares),
  // but the nutrient kernel's per-acre denominator expects canonical acres.
  // Feeding raw hectares leaves per-acre totals ~2.47× too high on hectares
  // farms. Convert once here; the persisted `area` field stays raw `farmArea`
  // (contract preserved — see report-compute.ts:290).
  const areaUnit = resolveAreaUnitPreference(context.areaUnit);
  const farmAreaAcres = convertAreaToAcres(farmArea, areaUnit);

  switch (input.type) {
    case 'irrigation': {
      const duration = input.data.duration;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Invalid irrigation duration');
      }
      return { type: input.type, fields: { duration } };
    }

    case 'spray': {
      const { data } = input;
      const { hasResolvedPhi, normalizedPhiStatus, notes } = resolveSprayPhi(data);
      const chemicalItems = buildSprayChemicalItems(data.chemicals, factor);
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: chemicalItems,
        areaAcre: farmAreaAcres,
        waterVolumeL: data.waterVolume ?? null,
      });
      return {
        type: input.type,
        fields: {
          catalog_mix_id: data.catalogMixId ?? null,
          chemical: buildSprayChemicalSummary(data.chemicals),
          chemical_items: chemicalItems,
          dose: data.waterVolume != null ? `Water: ${data.waterVolume}L` : '',
          governing_phi_days: hasResolvedPhi ? (data.governingPhiDays ?? null) : null,
          safe_harvest_date: hasResolvedPhi ? (data.safeHarvestDate ?? null) : null,
          phi_calc_version: hasResolvedPhi ? PHI_CALC_VERSION : null,
          phi_blocking_component: hasResolvedPhi ? (data.phiBlockingComponent ?? null) : null,
          phi_status: normalizedPhiStatus,
          nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
          nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
          nutrient_calc_coverage: nutrientTotals.coveragePercent,
          area: farmArea,
          notes: notes || undefined,
        },
      };
    }

    case 'harvest':
      return {
        type: input.type,
        fields: {
          quantity: input.data.quantity!,
          grade: input.data.grade,
          price: input.data.price || undefined,
          buyer: input.data.buyer || undefined,
        },
      };

    case 'expense': {
      const expenseType = (input.data.type || 'Other') as ExpenseTypeId;
      return {
        type: input.type,
        fields: {
          type: mapExpenseTypeIdToRecordType(expenseType),
          cost: input.data.cost!,
          remarks: input.data.remarks || undefined,
        },
      };
    }

    case 'fertigation': {
      const fertilizers = buildFertigationItems(input.data.fertilizers, factor);
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: fertilizers,
        areaAcre: farmAreaAcres,
      });
      return {
        type: input.type,
        fields: {
          fertilizers,
          nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
          nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
          nutrient_calc_coverage: nutrientTotals.coveragePercent,
          area: farmArea,
        },
      };
    }

    case 'note': {
      const notes = input.data.notes?.trim();
      if (!notes) throw new Error('Invalid note');
      return { type: input.type, fields: { notes } };
    }
  }
}
