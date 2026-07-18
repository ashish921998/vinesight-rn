import type {
  ExpenseRecordInsert,
  FertigationRecordInsert,
  HarvestRecordInsert,
  IrrigationRecordInsert,
  SprayRecordInsert,
} from '@/types';
import type { LogTypeId } from '@/constants/calculator-models';
import type {
  ExpenseFormData,
  FertigationFormData,
  HarvestFormData,
  IrrigationFormData,
  NoteFormData,
  SprayFormData,
} from '@/components/forms';
import { buildEntryLogRecordFields, type EntryLogFormInput } from '@/utils/entry-log-fields';
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

interface CreatedRecordIdentity {
  id?: number | null;
  client_uuid?: string | null;
}

export interface EntryLogSubmitters {
  createIrrigation: (payload: IrrigationRecordInsert) => Promise<CreatedRecordIdentity>;
  createSpray: (payload: SprayRecordInsert) => Promise<CreatedRecordIdentity>;
  createHarvest: (payload: HarvestRecordInsert) => Promise<CreatedRecordIdentity>;
  createExpense: (payload: ExpenseRecordInsert) => Promise<CreatedRecordIdentity>;
  createFertigation: (payload: FertigationRecordInsert) => Promise<CreatedRecordIdentity>;
  upsertDailyNote: (payload: {
    farm_id: number;
    date: string;
    notes: string | null;
  }) => Promise<CreatedRecordIdentity>;
}

export interface EntryLogSubmissionResult {
  pendingLogId: string;
  type: LogTypeId;
  recordId: number | null;
  clientUuid?: string | null;
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
  // PendingLog predates the discriminated form union; EntryForm maintains its type/data pairing.
  const mapped = buildEntryLogRecordFields(log as EntryLogFormInput, farm);
  const envelope = { farm_id: farm.id, date: dateStr };
  const toResult = (created: CreatedRecordIdentity): EntryLogSubmissionResult => ({
    pendingLogId: log.id,
    type: mapped.type,
    recordId: created.id ?? null,
    ...(created.client_uuid != null ? { clientUuid: created.client_uuid } : {}),
  });

  switch (mapped.type) {
    case 'irrigation':
      return toResult(
        await submitters.createIrrigation({
          ...envelope,
          ...mapped.fields,
          area:
            typeof farm.area === 'number' && Number.isFinite(farm.area) && farm.area > 0
              ? farm.area
              : 0,
          growth_stage: '',
          moisture_status: '',
          system_discharge: farm.system_discharge ?? 0,
          date_of_pruning: farm.date_of_pruning,
        }),
      );

    case 'spray':
      return toResult(
        await submitters.createSpray({
          ...envelope,
          ...mapped.fields,
          weather: '',
          operator: '',
          date_of_pruning: farm.date_of_pruning,
        }),
      );

    case 'harvest':
      return toResult(
        await submitters.createHarvest({
          ...envelope,
          ...mapped.fields,
          date_of_pruning: farm.date_of_pruning,
        }),
      );

    case 'expense':
      return toResult(
        await submitters.createExpense({
          ...envelope,
          ...mapped.fields,
          date_of_pruning: farm.date_of_pruning,
        }),
      );

    case 'fertigation':
      return toResult(
        await submitters.createFertigation({
          ...envelope,
          ...mapped.fields,
          irrigation_record_id: linkedIrrigationRecordId ?? null,
          date_of_pruning: farm.date_of_pruning,
        }),
      );

    case 'note':
      return toResult(
        await submitters.upsertDailyNote({
          ...envelope,
          notes: mapped.fields.notes,
        }),
      );
  }
}
