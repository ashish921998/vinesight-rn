import type {
  ExpenseRecordInsert,
  FertigationRecordInsert,
  HarvestRecordInsert,
  IrrigationRecordInsert,
  SprayRecordInsert,
} from '@/types';
import type { ExpenseTypeId, LogTypeId } from '@/constants/calculator-models';
import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  NoteFormData,
  SprayFormData,
} from '@/components/forms';
import { isFertigationUnitRecognized } from '@/constants/fertilizer-units';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import { PHI_CALC_VERSION } from '@/services/phi-service';
import { mapExpenseTypeIdToRecordType } from '@/utils/expense-type';
import { resolveAreaUnitPreference } from '@/utils/preferences';
import type { AreaUnitPreference } from '@/utils/preferences';

export interface EntryPendingLogSubmission {
  id: string;
  type: LogTypeId;
  data:
    | IrrigationFormData
    | SprayFormData
    | HarvestFormData
    | ExpenseFormData
    | FertigationFormData
    | NoteFormData;
  /**
   * For a fertigation log that was added together with an irrigation log, the `id` of that
   * irrigation pending log. The session orchestrator resolves it to the created irrigation
   * record id and stamps it onto this fertigation record so the two stay linked.
   */
  linkIrrigationFromPendingLogId?: string;
}

export interface EntryLogFarmContext {
  id: number;
  area?: number | null;
  areaUnit?: AreaUnitPreference | null;
  system_discharge?: number | null;
  date_of_pruning?: string | null;
}

export interface EntryLogSubmitters {
  createIrrigation: (payload: IrrigationRecordInsert) => Promise<{ id?: number | null }>;
  createSpray: (payload: SprayRecordInsert) => Promise<{ id?: number | null }>;
  createHarvest: (payload: HarvestRecordInsert) => Promise<{ id?: number | null }>;
  createExpense: (payload: ExpenseRecordInsert) => Promise<{ id?: number | null }>;
  createFertigation: (payload: FertigationRecordInsert) => Promise<{ id?: number | null }>;
  upsertDailyNote: (payload: {
    farm_id: number;
    date: string;
    notes: string | null;
  }) => Promise<{ id?: number | null }>;
}

export interface EntryLogSubmissionResult {
  pendingLogId: string;
  type: LogTypeId;
  recordId: number | null;
}

export async function submitEntryPendingLog(params: {
  log: EntryPendingLogSubmission;
  dateStr: string;
  farm: EntryLogFarmContext;
  submitters: EntryLogSubmitters;
  /** Resolved irrigation record id to link a co-logged fertigation record to. */
  linkedIrrigationRecordId?: number | null;
}): Promise<EntryLogSubmissionResult> {
  const { log, dateStr, farm, submitters, linkedIrrigationRecordId } = params;
  const farmId = farm.id;
  const areaUnit = resolveAreaUnitPreference(farm.areaUnit ?? 'acres');
  const farmArea =
    typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0 ? farm.area : 0;
  const perAreaToPerAcreFactor = areaUnit === 'hectares' ? 0.404686 : 1;

  switch (log.type) {
    case 'irrigation': {
      const data = log.data as IrrigationFormData;
      const duration = data.duration;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Invalid irrigation duration');
      }
      const created = await submitters.createIrrigation({
        farm_id: farmId,
        date: dateStr,
        duration,
        area: farmArea,
        growth_stage: '',
        moisture_status: '',
        system_discharge: farm.system_discharge ?? 0,
        date_of_pruning: farm.date_of_pruning,
      });

      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }

    case 'spray': {
      const data = log.data as SprayFormData;
      const hasCatalogMix = typeof data.catalogMixId === 'number';
      const hasResolvedPhi =
        hasCatalogMix && data.safeHarvestDate != null && data.governingPhiDays != null;
      const chemicalStr = data.chemicals
        .map((c) => `${c.name} (${c.quantity} ${c.unit})`)
        .join(', ');
      const chemicalItems = data.chemicals
        .filter((c) => c.name.trim() && c.quantity !== undefined && c.quantity > 0)
        .map((c) => {
          const quantityBasis = c.quantityBasis ?? 'total';
          const quantity =
            quantityBasis === 'per_acre' ? c.quantity! * perAreaToPerAcreFactor : c.quantity!;
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
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: chemicalItems,
        areaAcre: farmArea,
        waterVolumeL: data.waterVolume ?? null,
      });
      const noteParts: string[] = [];
      if (data.phiOverride) {
        noteParts.push('[PHI_OVERRIDE] Harvest safety conflict override acknowledged in app.');
      }
      if (hasCatalogMix && !hasResolvedPhi) {
        noteParts.push('[PHI_UNAVAILABLE] Saved without resolved PHI metadata.');
      }
      const trimmedNotes = data.notes?.trim();
      if (trimmedNotes) noteParts.push(trimmedNotes);
      const notes = noteParts.join(' ').trim();

      const normalizedPhiStatus = hasResolvedPhi
        ? data.phiStatus && data.phiStatus !== 'unknown'
          ? data.phiStatus
          : 'verified'
        : hasCatalogMix
          ? 'legacy_unverified'
          : (data.phiStatus ?? 'unknown');
      const created = await submitters.createSpray({
        farm_id: farmId,
        date: dateStr,
        catalog_mix_id: data.catalogMixId ?? null,
        chemical: chemicalStr,
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
        weather: '',
        operator: '',
        date_of_pruning: farm.date_of_pruning,
        notes: notes || undefined,
      });
      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }

    case 'harvest': {
      const data = log.data as HarvestFormData;
      const created = await submitters.createHarvest({
        farm_id: farmId,
        date: dateStr,
        quantity: data.quantity!,
        grade: data.grade,
        price: data.price || undefined,
        buyer: data.buyer || undefined,
        date_of_pruning: farm.date_of_pruning,
      });
      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }

    case 'expense': {
      const data = log.data as ExpenseFormData;
      const expenseType = (data.type || 'Other') as ExpenseTypeId;
      const created = await submitters.createExpense({
        farm_id: farmId,
        date: dateStr,
        type: mapExpenseTypeIdToRecordType(expenseType),
        cost: data.cost!,
        date_of_pruning: farm.date_of_pruning,
        remarks: data.remarks || undefined,
      });
      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }

    case 'fertigation': {
      const data = log.data as FertigationFormData;
      const fertilizers = data.fertilizers
        .filter((f) => f.name.trim() && f.quantity !== undefined && f.quantity > 0)
        .map((f) => {
          const quantityBasis = f.quantityBasis ?? 'total';
          const quantity =
            quantityBasis === 'per_acre' ? f.quantity! * perAreaToPerAcreFactor : f.quantity!;
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
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: fertilizers,
        areaAcre: farmArea,
      });
      const created = await submitters.createFertigation({
        farm_id: farmId,
        date: dateStr,
        fertilizers,
        irrigation_record_id: linkedIrrigationRecordId ?? null,
        nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
        nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
        nutrient_calc_coverage: nutrientTotals.coveragePercent,
        area: farmArea,
        date_of_pruning: farm.date_of_pruning,
      });
      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }

    case 'note': {
      const data = log.data as NoteFormData;
      const notes = data.notes?.trim();
      if (!notes) {
        throw new Error('Invalid note');
      }
      const created = await submitters.upsertDailyNote({
        farm_id: farmId,
        date: dateStr,
        notes,
      });
      return { pendingLogId: log.id, type: log.type, recordId: created.id ?? null };
    }
  }
}
