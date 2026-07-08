import { supabase } from '@/lib/supabase';
import type {
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  DailyNoteRecord,
} from '@/types/database';
import type { Farm } from '@/types';
import type {
  IrrigationFormData,
  SprayFormData,
  FertigationFormData,
  HarvestFormData,
  NoteFormData,
} from '@/components/forms';
import { isFertigationUnitRecognized } from '@/constants/fertilizer-units';
import { calculateNutrientTotalsForLog } from '@/services/nutrient-flow-service';
import { PHI_CALC_VERSION } from '@/services/phi-service';
import { resolveAreaUnitPreference, type AreaUnitPreference } from '@/utils/preferences';

export type ProfessionalRole = 'owner' | 'admin' | 'agronomist';
export type DelegatedLogType = 'irrigation' | 'spray' | 'fertigation' | 'harvest' | 'note';

/**
 * UI-level context that says "this screen is logging on behalf of a farmer
 * client" (consultant / agronomist use case). Owned by the routes that mount
 * `ReceiptLogScreen` / `EntryForm` in delegated mode; both screens read the
 * `farm` field directly and route saves through {@link createDelegatedLog}.
 */
export interface DelegatedContext {
  organizationId: string;
  organizationName: string;
  clientUserId: string;
  clientName: string;
  farm: Farm;
  /**
   * The CLIENT's area-unit preference (`profiles.area_unit_preference` for the
   * farm owner), so the delegated save path computes acres on the same basis
   * the plan/record was written against — not the signed-in consultant's.
   * Matches the server-side resolution in `stamp_fertilizer_plan_farm_area`.
   */
  clientAreaUnitPreference?: AreaUnitPreference | null;
}
export interface ProfessionalFarm {
  id: number;
  name: string;
  region: string;
  area: number;
  crop: string;
  crop_variety: string;
}
export interface ProfessionalClient {
  user_id: string;
  full_name: string;
  phone: string | null;
  area_unit_preference?: AreaUnitPreference | null;
  farms: ProfessionalFarm[];
}
export interface ProfessionalWorkspace {
  organization_id: string;
  organization_name: string;
  role: ProfessionalRole;
  clients: ProfessionalClient[];
}
export type DelegatedActivityRecord =
  | IrrigationRecord
  | SprayRecord
  | FertigationRecord
  | HarvestRecord
  | DailyNoteRecord;
export interface DelegatedActivityItem {
  record_type: DelegatedLogType;
  record_data: DelegatedActivityRecord;
}

export function isValidDelegatedLogInput(
  recordType: DelegatedLogType,
  date: string,
  primary: string,
  hasSelectedCatalogMix = false,
  secondary = '',
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (recordType === 'spray') return hasSelectedCatalogMix;
  const value = primary.trim();
  if (!value) return false;
  if (recordType === 'irrigation' || recordType === 'harvest') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
  }
  if (recordType === 'fertigation') {
    const numericQuantity = Number(secondary.trim());
    return Number.isFinite(numericQuantity) && numericQuantity > 0;
  }
  return true;
}

/**
 * Farm context needed to build a delegated-log payload. Mirrors the subset of
 * {@link EntryLogFarmContext} that the farmer save path reads. `date_of_pruning`
 * is intentionally absent — the RPC sources it server-side from the farm row.
 */
export interface DelegatedLogFarmContext {
  area: number;
  areaUnit?: AreaUnitPreference | null;
}

export type DelegatedLogFormInput =
  | { type: 'irrigation'; data: IrrigationFormData }
  | { type: 'spray'; data: SprayFormData }
  | { type: 'fertigation'; data: FertigationFormData }
  | { type: 'harvest'; data: HarvestFormData }
  | { type: 'note'; data: NoteFormData };

/**
 * Convert a reusable farmer FormData shape into the `create_delegated_log`
 * payload. This is the delegated-path counterpart to `submitEntryPendingLog`
 * (src/utils/entry-log-submission.ts) — the two MUST stay in sync so that a
 * delegated record is stored identically to a farmer-created one. Keys the RPC
 * coalesces server-side (growth_stage, weather, operator) and `date_of_pruning`
 * (sourced from the farm row) are deliberately omitted.
 */
export function buildDelegatedLogPayload(
  input: DelegatedLogFormInput,
  farm: DelegatedLogFarmContext,
): Record<string, unknown> {
  const farmArea =
    typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0 ? farm.area : 0;
  const areaUnit = resolveAreaUnitPreference(farm.areaUnit ?? 'acres');
  const perAreaToPerAcreFactor = areaUnit === 'hectares' ? 0.404686 : 1;

  switch (input.type) {
    case 'irrigation': {
      const { data } = input;
      const trimmedNotes = data.notes?.trim();
      return { duration: data.duration, notes: trimmedNotes || undefined };
    }

    case 'spray': {
      const { data } = input;
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

      return {
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
        notes: notes || undefined,
      };
    }

    case 'fertigation': {
      const { data } = input;
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
            // Delegated composers offer no plan section today, so this is
            // always null — written anyway so the serializer stays total over
            // FertilizerEntry and can't silently drop a future plan pick.
            plan_item_id: f.planItemId ?? null,
            composition_snapshot: f.compositionSnapshot ?? null,
            density_kg_per_l: f.densityKgPerL ?? null,
          };
        });
      const nutrientTotals = calculateNutrientTotalsForLog({
        items: fertilizers,
        areaAcre: farmArea,
      });
      const trimmedNotes = data.notes?.trim();
      return {
        fertilizers,
        nutrient_totals_elemental: nutrientTotals.nutrientTotalsElemental,
        nutrient_totals_elemental_per_acre: nutrientTotals.nutrientTotalsElementalPerAcre,
        nutrient_calc_coverage: nutrientTotals.coveragePercent,
        area: farmArea,
        notes: trimmedNotes || undefined,
      };
    }

    case 'harvest': {
      const { data } = input;
      const trimmedNotes = data.notes?.trim();
      return {
        quantity: data.quantity,
        grade: data.grade,
        price: data.price || undefined,
        buyer: data.buyer || undefined,
        notes: trimmedNotes || undefined,
      };
    }

    case 'note': {
      const { data } = input;
      return { notes: data.notes?.trim() };
    }
  }
}

export async function getProfessionalWorkspace(): Promise<ProfessionalWorkspace | null> {
  const { data, error } = await supabase.rpc('get_professional_workspace');
  if (error) throw error;
  return data as ProfessionalWorkspace | null;
}

export async function createDelegatedLog(input: {
  organizationId: string;
  clientUserId: string;
  farmId: number;
  recordType: DelegatedLogType;
  date: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('create_delegated_log', {
    p_organization_id: input.organizationId,
    p_client_user_id: input.clientUserId,
    p_farm_id: input.farmId,
    p_record_type: input.recordType,
    p_date: input.date,
    p_payload: input.payload,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function getDelegatedFarmActivity(input: {
  organizationId: string;
  clientUserId: string;
  farmId: number;
}): Promise<DelegatedActivityItem[]> {
  const { data, error } = await supabase.rpc('get_delegated_farm_activity', {
    p_organization_id: input.organizationId,
    p_client_user_id: input.clientUserId,
    p_farm_id: input.farmId,
  });
  if (error) throw error;
  return (data ?? []) as DelegatedActivityItem[];
}

export async function updateDelegatedLog(
  recordType: DelegatedLogType,
  recordId: number,
  notes: string,
) {
  const { data, error } = await supabase.rpc('update_delegated_log', {
    p_record_type: recordType,
    p_record_id: recordId,
    p_payload: { notes },
  });
  if (error) throw error;
  return data;
}

export async function deleteDelegatedLog(recordType: DelegatedLogType, recordId: number) {
  const { error } = await supabase.rpc('delete_delegated_log', {
    p_record_type: recordType,
    p_record_id: recordId,
  });
  if (error) throw error;
}
