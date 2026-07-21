import { getDataAccess } from '@/data-access';
import type {
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  DailyNoteRecord,
} from '@/types/database';
import type { Farm } from '@/types';
import type { LogTypeId } from '@/constants/calculator-models';
import { buildEntryLogRecordFields, type EntryLogFormInput } from '@/utils/entry-log-fields';
import { type AreaUnitPreference } from '@/utils/preferences';

export type ProfessionalRole = 'owner' | 'admin' | 'agronomist';
export type DelegatedLogType = Exclude<LogTypeId, 'expense'>;

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
  IrrigationRecord | SprayRecord | FertigationRecord | HarvestRecord | DailyNoteRecord;
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

export type DelegatedLogFormInput = Extract<EntryLogFormInput, { type: DelegatedLogType }>;

/** Convert shared form data into the payload consumed by `create_delegated_log`. */
export function buildDelegatedLogPayload(
  input: DelegatedLogFormInput,
  farm: DelegatedLogFarmContext,
): Record<string, unknown> {
  const mapped = buildEntryLogRecordFields(input, farm);
  return { ...mapped.fields };
}

export async function getProfessionalWorkspace(): Promise<ProfessionalWorkspace | null> {
  return (await getDataAccess().delegatedLogs.getProfessionalWorkspace()) as ProfessionalWorkspace | null;
}

export async function createDelegatedLog(input: {
  organizationId: string;
  clientUserId: string;
  farmId: number;
  recordType: DelegatedLogType;
  date: string;
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return (await getDataAccess().delegatedLogs.createDelegatedLog({
    p_organization_id: input.organizationId,
    p_client_user_id: input.clientUserId,
    p_farm_id: input.farmId,
    p_record_type: input.recordType,
    p_date: input.date,
    p_payload: input.payload,
  })) as Record<string, unknown>;
}

export async function getDelegatedFarmActivity(input: {
  organizationId: string;
  clientUserId: string;
  farmId: number;
}): Promise<DelegatedActivityItem[]> {
  const data = await getDataAccess().delegatedLogs.getDelegatedFarmActivity({
    p_organization_id: input.organizationId,
    p_client_user_id: input.clientUserId,
    p_farm_id: input.farmId,
  });
  return data as DelegatedActivityItem[];
}

export async function updateDelegatedLog(
  recordType: DelegatedLogType,
  recordId: number,
  notes: string,
) {
  return getDataAccess().delegatedLogs.updateDelegatedLog({
    p_record_type: recordType,
    p_record_id: recordId,
    p_payload: { notes },
  });
}

export async function deleteDelegatedLog(recordType: DelegatedLogType, recordId: number) {
  await getDataAccess().delegatedLogs.deleteDelegatedLog({
    p_record_type: recordType,
    p_record_id: recordId,
  });
}
