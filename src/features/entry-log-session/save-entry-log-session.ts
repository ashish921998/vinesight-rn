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

export interface EntryLogSessionAdapters extends EntryLogSubmitters {
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

function buildFarmContext(
  farmItem: Farm,
  preferredAreaUnit: AreaUnitPreference,
): EntryLogFarmContext {
  return {
    id: farmItem.id ?? 0,
    area: farmItem.area,
    areaUnit: preferredAreaUnit,
    system_discharge: farmItem.system_discharge,
    date_of_pruning: farmItem.date_of_pruning,
  };
}

async function rollbackCreatedRecords(
  created: EntryLogCreatedRecord[],
  adapters: EntryLogSessionAdapters,
  dateStr: string,
): Promise<EntryLogRollbackFailure[]> {
  const failures: EntryLogRollbackFailure[] = [];
  const rollbackEntry = async (entry: EntryLogCreatedRecord) => {
    try {
      const id = entry.recordId as number;
      switch (entry.type) {
        case 'irrigation':
          await adapters.deleteIrrigation({ id, farmId: entry.farmId });
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
              notes: entry.previousDailyNote.notes ?? null,
            });
          } else if (typeof id === 'number') {
            await adapters.deleteDailyNote({ id, farmId: entry.farmId, date: dateStr });
          } else {
            throw new Error('Cannot roll back note: no record ID and no previous note to restore');
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
  };

  const entries = created.filter((entry) => entry.recordId !== null || entry.type === 'note');
  await Promise.all(entries.filter((entry) => entry.type !== 'note').map(rollbackEntry));
  for (const entry of entries.filter((item) => item.type === 'note').reverse()) {
    await rollbackEntry(entry);
  }
  return failures;
}

function collectCreatedRecordFromResult(params: {
  log: EntryLogSessionDraft;
  farmId: number;
  result: PromiseSettledResult<{ pendingLogId: string; type: LogTypeId; recordId: number | null }>;
  previousDailyNote?: DailyNoteRecord | null;
}): EntryLogCreatedRecord | null {
  const { log, farmId, result, previousDailyNote } = params;
  if (result.status === 'fulfilled') {
    return {
      pendingLogId: log.id,
      type: log.type,
      recordId: result.value.recordId,
      farmId,
      previousDailyNote,
    };
  }

  return null;
}

async function submitLogWithSnapshot(params: {
  log: EntryLogSessionDraft;
  dateStr: string;
  farm: EntryLogFarmContext;
  adapters: EntryLogSessionAdapters;
  linkedIrrigationRecordId?: number | null;
}): Promise<{
  result: { pendingLogId: string; type: LogTypeId; recordId: number | null };
  previousDailyNote: DailyNoteRecord | null;
}> {
  const { log, dateStr, farm, adapters, linkedIrrigationRecordId } = params;
  const previousDailyNote =
    log.type === 'note' ? await adapters.getDailyNote({ farmId: farm.id, date: dateStr }) : null;
  const result = await submitEntryPendingLog({
    log,
    dateStr,
    farm,
    submitters: adapters,
    linkedIrrigationRecordId,
  });
  return { result, previousDailyNote };
}

async function settleSequentially<T>(
  tasks: Array<() => Promise<T>>,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (const task of tasks) {
    try {
      results.push({ status: 'fulfilled', value: await task() });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return results;
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
  // Logs are submitted strictly in array order, so a fertigation log that was added
  // alongside an irrigation log can read the created irrigation record id (the irrigation
  // log is always enqueued first) and stamp it onto its own record to link the two.
  const createdRecordIdByPendingLogId = new Map<string, number | null>();
  const results = await settleSequentially(
    pendingLogs.map((log) => async () => {
      // A fertigation log linked to an irrigation can only resolve its partner's
      // record id if the irrigation task already succeeded (it runs first and sets
      // the map on success). A missing key means the irrigation failed, so fail
      // fast here rather than silently persisting the fertigation as standalone —
      // throwing before submit means no unlinked record is ever created/rolled back.
      let linkedIrrigationRecordId: number | null = null;
      if (log.type === 'fertigation' && log.linkIrrigationFromPendingLogId) {
        const sourcePendingLogId = log.linkIrrigationFromPendingLogId;
        if (!createdRecordIdByPendingLogId.has(sourcePendingLogId)) {
          throw new Error(
            `Missing linked irrigation pending log result for fertigation log ${log.id}`,
          );
        }
        linkedIrrigationRecordId = createdRecordIdByPendingLogId.get(sourcePendingLogId) ?? null;
      }
      const outcome = await submitLogWithSnapshot({
        log,
        dateStr,
        farm: farmContext,
        adapters,
        linkedIrrigationRecordId,
      });
      createdRecordIdByPendingLogId.set(log.id, outcome.result.recordId);
      return outcome;
    }),
  );
  const failures: EntryLogSubmissionFailure[] = [];
  const createdRecords: EntryLogCreatedRecord[] = [];

  results.forEach((result, index) => {
    const log = pendingLogs[index];
    if (!log) return;
    const created = collectCreatedRecordFromResult({
      log,
      farmId,
      result:
        result.status === 'fulfilled'
          ? { status: 'fulfilled', value: result.value.result }
          : result,
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
