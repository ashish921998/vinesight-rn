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
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import {
  mapAppliedItems,
  buildChemicalSummary,
  buildWaterDoseString,
} from '@/utils/applied-input-mapper';
import { PHI_CALC_VERSION } from '@/services/phi-service';
import { mapExpenseTypeIdToRecordType } from '@/utils/expense-type';
import { resolveAreaUnitPreference, perAcreNormalizationFactor } from '@/utils/preferences';
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
}

export interface EntryLogFarmContext {
  id: number;
  area?: number | null;
  areaUnit?: AreaUnitPreference | null;
  total_tank_capacity?: number | null;
  system_discharge?: number | null;
  remaining_water?: number | null;
  date_of_pruning?: string | null;
}

export interface EntryLogSubmitters {
  /**
   * Atomically inserts an irrigation record and applies its water-balance delta
   * (server-side). Returns the new record id plus the exact amount added to
   * remaining_water so a rollback can subtract it precisely.
   */
  logIrrigation: (
    payload: IrrigationRecordInsert,
  ) => Promise<{ id?: number | null; waterDelta?: number }>;
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
  /** Exact water delta applied by an irrigation log; used for precise rollback. */
  waterDelta?: number;
}

export async function submitEntryPendingLog(params: {
  log: EntryPendingLogSubmission;
  dateStr: string;
  farm: EntryLogFarmContext;
  submitters: EntryLogSubmitters;
}): Promise<EntryLogSubmissionResult> {
  const { log, dateStr, farm, submitters } = params;
  const farmId = farm.id;
  const areaUnit = resolveAreaUnitPreference(farm.areaUnit ?? 'acres');
  const farmArea =
    typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0 ? farm.area : 0;
  const perAreaToPerAcreFactor = perAcreNormalizationFactor(areaUnit);

  switch (log.type) {
    case 'irrigation': {
      const data = log.data as IrrigationFormData;
      const duration = data.duration;
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
        throw new Error('Invalid irrigation duration');
      }
      // Atomic server-side insert + water-balance delta (water-ledger / log_irrigation):
      // either both the record and the water update land, or neither does. No client
      // read-modify-write of remaining_water, so no orphaned record to compensate for.
      const created = await submitters.logIrrigation({
        farm_id: farmId,
        date: dateStr,
        duration,
        area: farmArea,
        growth_stage: '',
        moisture_status: '',
        system_discharge: farm.system_discharge ?? 0,
        date_of_pruning: farm.date_of_pruning,
      });

      return {
        pendingLogId: log.id,
        type: log.type,
        recordId: created.id ?? null,
        waterDelta: created.waterDelta ?? 0,
      };
    }

    case 'spray': {
      const data = log.data as SprayFormData;
      const hasCatalogMix = typeof data.catalogMixId === 'number';
      const hasResolvedPhi =
        hasCatalogMix && data.safeHarvestDate != null && data.governingPhiDays != null;
      const chemicalStr = buildChemicalSummary(data.chemicals);
      const chemicalItems = mapAppliedItems(data.chemicals, { perAreaToPerAcreFactor });
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
        dose: buildWaterDoseString(data.waterVolume),
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
      const fertilizers = mapAppliedItems(data.fertilizers, { perAreaToPerAcreFactor });
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: fertilizers,
        areaAcre: farmArea,
        waterVolumeL: data.waterVolume ?? null,
      });
      const created = await submitters.createFertigation({
        farm_id: farmId,
        date: dateStr,
        fertilizers,
        water_volume: data.waterVolume,
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
