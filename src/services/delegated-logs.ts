import { supabase } from '@/lib/supabase';
import type {
  IrrigationRecord,
  SprayRecord,
  FertigationRecord,
  HarvestRecord,
  DailyNoteRecord,
} from '@/types/database';

export type ProfessionalRole = 'owner' | 'admin' | 'agronomist';
export type DelegatedLogType = 'irrigation' | 'spray' | 'fertigation' | 'harvest' | 'note';
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
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (recordType === 'spray') return hasSelectedCatalogMix;
  const value = primary.trim();
  if (!value) return false;
  if (recordType === 'irrigation' || recordType === 'harvest') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
  }
  return true;
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
