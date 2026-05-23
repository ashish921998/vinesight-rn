import type { DailyNoteRecord, Farm } from '@/types';
import type { LogTypeId } from '@/constants/calculator-models';
import {
  submitEntryPendingLog,
  type EntryPendingLogSubmission,
  type EntryLogFarmContext,
  type EntryLogSubmitters,
} from '@/utils/entry-log-submission';
import type { AreaUnitPreference } from '@/utils/preferences';

export type EntryLogSessionBlockReason =
  | 'mixed_scopes'
  | 'no_farms'
  | 'all_farms_expense_only'
  | 'mixed_farms'
  | 'missing_farm';

export type EntryLogCreatedRecord = {
  pendingLogId: string;
  type: LogTypeId;
  recordId: number | null;
  farmId: number;
  farmContext?: EntryLogFarmContext;
  previousDailyNote?: DailyNoteRecord | null;
};

export type EntryLogRollbackFailure = {
  pendingLogId: string;
  type: LogTypeId;
  recordId: number;
  farmId: number;
  error: string;
};

export type EntryLogSubmissionFailure = {
  pendingLogId: string;
  type: LogTypeId;
  farmId: number | null;
  error: unknown;
};

export interface EntryLogSessionDraft extends EntryPendingLogSubmission {
  scope: 'single_farm' | 'all_farms';
  farmId: number | null;
  displayDescription: string;
  isSourceTaskLog?: boolean;
}

export type SaveEntryLogSessionResult =
  | {
      status: 'saved';
      createdRecords: EntryLogCreatedRecord[];
      farmId: number | null;
      sourceTaskRecord: {
        pendingLogId: string;
        type: LogTypeId;
        recordId: number;
      } | null;
    }
  | {
      status: 'blocked';
      reason: EntryLogSessionBlockReason;
    }
  | {
      status: 'failed';
      failedCount: number;
      firstFailedError: unknown;
      firstFailedLog: EntryLogSessionDraft | null;
      failures: EntryLogSubmissionFailure[];
      rollbackFailures: EntryLogRollbackFailure[];
    };

export interface EntryLogSessionAdapters extends Omit<EntryLogSubmitters, 'deleteIrrigation'> {
  getDailyNote: (payload: { farmId: number; date: string }) => Promise<DailyNoteRecord | null>;
  deleteIrrigation: (payload: { id: number; farmId: number }) => Promise<unknown>;
  deleteSpray: (payload: { id: number; farmId: number }) => Promise<unknown>;
  deleteHarvest: (payload: { id: number; farmId: number }) => Promise<unknown>;
  deleteExpense: (payload: { id: number; farmId: number }) => Promise<unknown>;
  deleteFertigation: (payload: { id: number; farmId: number }) => Promise<unknown>;
  deleteDailyNote: (payload: { id: number; farmId: number; date: string }) => Promise<unknown>;
}

export interface SaveEntryLogSessionParams {
  pendingLogs: EntryLogSessionDraft[];
  dateStr: string;
  currentFarm: Farm | null;
  farms: Farm[];
  preferredAreaUnit: AreaUnitPreference;
  adapters: EntryLogSessionAdapters;
}

function buildFarmContext(farmItem: Farm, preferredAreaUnit: AreaUnitPreference): EntryLogFarmContext {
  return {
    id: farmItem.id ?? 0,
    area: farmItem.area,
    areaUnit: preferredAreaUnit,
    total_tank_capacity: farmItem.total_tank_capacity,
    system_discharge: farmItem.system_discharge,
    remaining_water: farmItem.remaining_water,
    date_of_pruning: farmItem.date_of_pruning,
  };
}

async function rollbackCreatedRecords(
  created: EntryLogCreatedRecord[],
  adapters: EntryLogSessionAdapters,
  dateStr: string,
): Promise<EntryLogRollbackFailure[]> {
  const failures: EntryLogRollbackFailure[] = [];
  const tasks = created
    .filter((entry) => entry.recordId !== null)
    .map(async (entry) => {
      try {
        const id = entry.recordId as number;
        switch (entry.type) {
          case 'irrigation':
            await adapters.deleteIrrigation({ id, farmId: entry.farmId });
            if (entry.farmContext) {
              const farm = entry.farmContext;
              if (
                farm.total_tank_capacity &&
                farm.system_discharge &&
                farm.total_tank_capacity > 0 &&
                farm.system_discharge > 0
              ) {
                await adapters.updateWaterLevel({
                  farmId: entry.farmId,
                  remainingWater: farm.remaining_water ?? 0,
                });
              }
            }
            break;
          case 'spray':
            await adapters.deleteSpray({ id, farmId: entry.farmId });
            break;
          case 'harvest':
            await adapters.deleteHarvest({ id, farmId: entry.farmId });
            break;
          case 'expense':
            await adapters.deleteExpense({ id, farmId: entry.farmId });
            break;
          case 'fertigation':
            await adapters.deleteFertigation({ id, farmId: entry.farmId });
            break;
          case 'note':
            if (entry.previousDailyNote) {
              await adapters.upsertDailyNote({
                farm_id: entry.farmId,
                date: dateStr,
                notes: entry.previousDailyNote.notes ?? '',
              });
            } else {
              await adapters.deleteDailyNote({ id, farmId: entry.farmId, date: dateStr });
            }
            break;
        }
      } catch (rollbackError) {
        failures.push({
          pendingLogId: entry.pendingLogId,
          type: entry.type,
          recordId: entry.recordId as number,
          farmId: entry.farmId,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    });
  await Promise.all(tasks);
  return failures;
}

function collectCreatedRecordFromResult(params: {
  log: EntryLogSessionDraft;
  farmId: number;
  farmContext: EntryLogFarmContext;
  result: PromiseSettledResult<{ pendingLogId: string; type: LogTypeId; recordId: number | null }>;
  previousDailyNote?: DailyNoteRecord | null;
}): EntryLogCreatedRecord | null {
  const { log, farmId, farmContext, result, previousDailyNote } = params;
  if (result.status === 'fulfilled') {
    return {
      pendingLogId: log.id,
      type: log.type,
      recordId: result.value.recordId,
      farmId,
      farmContext,
      previousDailyNote,
    };
  }

  if (log.type !== 'irrigation') return null;
  const orphanedRecordId = (result.reason as { recordId?: number | null } | null)?.recordId ?? null;
  if (orphanedRecordId === null) return null;
  return {
    pendingLogId: log.id,
    type: log.type,
    recordId: orphanedRecordId,
    farmId,
    farmContext,
    previousDailyNote,
  };
}

async function submitLogWithSnapshot(params: {
  log: EntryLogSessionDraft;
  dateStr: string;
  farm: EntryLogFarmContext;
  adapters: EntryLogSessionAdapters;
}): Promise<{
  result: { pendingLogId: string; type: LogTypeId; recordId: number | null };
  previousDailyNote: DailyNoteRecord | null;
}> {
  const { log, dateStr, farm, adapters } = params;
  const previousDailyNote =
    log.type === 'note' ? await adapters.getDailyNote({ farmId: farm.id, date: dateStr }) : null;
  const result = await submitEntryPendingLog({
    log,
    dateStr,
    farm,
    submitters: adapters,
  });
  return { result, previousDailyNote };
}

function buildFailedResult(params: {
  pendingLogs: EntryLogSessionDraft[];
  failures: EntryLogSubmissionFailure[];
  rollbackFailures: EntryLogRollbackFailure[];
}): SaveEntryLogSessionResult {
  const { pendingLogs, failures, rollbackFailures } = params;
  const firstFailure = failures[0] ?? null;
  return {
    status: 'failed',
    failedCount: failures.length,
    firstFailedError: firstFailure?.error ?? null,
    firstFailedLog: firstFailure
      ? (pendingLogs.find((log) => log.id === firstFailure.pendingLogId) ?? null)
      : null,
    failures,
    rollbackFailures,
  };
}

export async function saveEntryLogSession(
  params: SaveEntryLogSessionParams,
): Promise<SaveEntryLogSessionResult> {
  const { pendingLogs, dateStr, currentFarm, farms, preferredAreaUnit, adapters } = params;
  const hasAllFarmsDrafts = pendingLogs.some((log) => log.scope === 'all_farms');
  const hasSingleFarmDrafts = pendingLogs.some((log) => log.scope === 'single_farm');

  if (hasAllFarmsDrafts && hasSingleFarmDrafts) {
    return { status: 'blocked', reason: 'mixed_scopes' };
  }

  if (hasAllFarmsDrafts) {
    const farmsToUse = farms.filter((farmItem) => typeof farmItem.id === 'number');
    if (farmsToUse.length === 0) {
      return { status: 'blocked', reason: 'no_farms' };
    }

    if (pendingLogs.some((log) => log.type !== 'expense')) {
      return { status: 'blocked', reason: 'all_farms_expense_only' };
    }

    const submissions = farmsToUse.flatMap((farmItem) =>
      pendingLogs.map((log) => {
        const farmId = farmItem.id as number;
        const farmContext = buildFarmContext(farmItem, preferredAreaUnit);
        return {
          log,
          farmId,
          farmContext,
          promise: submitLogWithSnapshot({
            log,
            dateStr,
            farm: farmContext,
            adapters,
          }),
        };
      }),
    );

    const results = await Promise.allSettled(submissions.map((submission) => submission.promise));
    const failures: EntryLogSubmissionFailure[] = [];
    const createdRecords: EntryLogCreatedRecord[] = [];

    results.forEach((result, index) => {
      const submission = submissions[index];
      if (!submission) return;
      const created = collectCreatedRecordFromResult({
        ...submission,
        result:
          result.status === 'fulfilled'
            ? { status: 'fulfilled', value: result.value.result }
            : result,
        previousDailyNote:
          result.status === 'fulfilled' ? result.value.previousDailyNote : undefined,
      });
      if (created) createdRecords.push(created);
      if (result.status === 'rejected') {
        failures.push({
          pendingLogId: submission.log.id,
          type: submission.log.type,
          farmId: submission.farmId,
          error: result.reason,
        });
      }
    });

    if (failures.length > 0) {
      const rollbackFailures = await rollbackCreatedRecords(createdRecords, adapters, dateStr);
      return buildFailedResult({ pendingLogs, failures, rollbackFailures });
    }

    return {
      status: 'saved',
      createdRecords,
      farmId: null,
      sourceTaskRecord: null,
    };
  }

  const singleFarmIds = Array.from(
    new Set(
      pendingLogs
        .filter((log) => log.scope === 'single_farm')
        .map((log) => log.farmId)
        .filter((farmId): farmId is number => typeof farmId === 'number'),
    ),
  );
  if (singleFarmIds.length !== 1) {
    return { status: 'blocked', reason: 'mixed_farms' };
  }

  const farmId = singleFarmIds[0] ?? null;
  const singleFarmContext =
    (currentFarm && currentFarm.id === farmId ? currentFarm : null) ??
    farms.find((farmItem) => farmItem.id === farmId) ??
    null;
  if (!farmId || !singleFarmContext) {
    return { status: 'blocked', reason: 'missing_farm' };
  }

  const farmContext = buildFarmContext(singleFarmContext, preferredAreaUnit);
  const results = await Promise.allSettled(
    pendingLogs.map((log) =>
      submitLogWithSnapshot({
        log,
        dateStr,
        farm: farmContext,
        adapters,
      }),
    ),
  );
  const failures: EntryLogSubmissionFailure[] = [];
  const createdRecords: EntryLogCreatedRecord[] = [];

  results.forEach((result, index) => {
    const log = pendingLogs[index];
    if (!log) return;
    const created = collectCreatedRecordFromResult({
      log,
      farmId,
      farmContext,
      result:
        result.status === 'fulfilled' ? { status: 'fulfilled', value: result.value.result } : result,
      previousDailyNote: result.status === 'fulfilled' ? result.value.previousDailyNote : undefined,
    });
    if (created) createdRecords.push(created);
    if (result.status === 'rejected') {
      failures.push({
        pendingLogId: log.id,
        type: log.type,
        farmId,
        error: result.reason,
      });
    }
  });

  if (failures.length > 0) {
    const rollbackFailures = await rollbackCreatedRecords(createdRecords, adapters, dateStr);
    return buildFailedResult({ pendingLogs, failures, rollbackFailures });
  }

  const sourceTaskLogId = pendingLogs.find((log) => log.isSourceTaskLog)?.id;
  const matchingSourceRecord = sourceTaskLogId
    ? createdRecords.find(
        (record) => record.pendingLogId === sourceTaskLogId && record.recordId !== null,
      )
    : null;

  return {
    status: 'saved',
    createdRecords,
    farmId,
    sourceTaskRecord:
      matchingSourceRecord && matchingSourceRecord.recordId !== null
        ? {
            pendingLogId: matchingSourceRecord.pendingLogId,
            type: matchingSourceRecord.type,
            recordId: matchingSourceRecord.recordId,
          }
        : null,
  };
}
