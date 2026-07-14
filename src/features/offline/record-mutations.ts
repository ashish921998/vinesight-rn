import { resolveOrCreateSeasonIdForDate } from '@/lib/season-context';
import { idempotentCreate, targetedDelete, targetedUpdate, type RecordRef } from './record-writes';

export const RECORD_WRITE_OPERATIONS = ['create', 'update', 'delete'] as const;
export type RecordWriteOperation = (typeof RECORD_WRITE_OPERATIONS)[number];

export const RECORD_WRITE_TABLES = [
  'irrigation_records',
  'spray_records',
  'fertigation_records',
  'harvest_records',
  'expense_records',
] as const;

export type RecordWriteTable = (typeof RECORD_WRITE_TABLES)[number];
export type RecordWriteMutationKey = readonly [
  'record-write',
  RecordWriteTable,
  RecordWriteOperation,
];

export function getRecordWriteMutationKey(
  table: RecordWriteTable,
  operation: RecordWriteOperation,
): RecordWriteMutationKey {
  return ['record-write', table, operation];
}

interface CreateVariables {
  farm_id: number;
  date: string;
  season_id?: number | null;
  client_uuid?: string | null;
}

interface UpdateVariables extends RecordRef {
  updates: Record<string, unknown>;
}

interface DeleteVariables extends RecordRef {
  farmId: number;
}

export async function executeRecordWriteMutation(
  table: RecordWriteTable,
  operation: RecordWriteOperation,
  variables: unknown,
): Promise<unknown> {
  if (operation === 'create') {
    const record = variables as CreateVariables;
    const created = await idempotentCreate(table, {
      ...record,
      season_id: record.season_id ?? null,
    });
    if (typeof created.season_id === 'number') return created;

    const season_id = await resolveOrCreateSeasonIdForDate({
      farmId: record.farm_id,
      date: record.date,
    });
    if (season_id === null) return created;

    return targetedUpdate(
      table,
      {
        id: typeof created.id === 'number' ? created.id : null,
        clientUuid:
          typeof created.client_uuid === 'string'
            ? created.client_uuid
            : (record.client_uuid ?? null),
        farmId: record.farm_id,
      },
      { season_id },
    );
  }

  if (operation === 'update') {
    const { id, clientUuid, farmId, updates } = variables as UpdateVariables;
    return targetedUpdate(table, { id, clientUuid, farmId }, updates);
  }

  const { id, clientUuid, farmId } = variables as DeleteVariables;
  return targetedDelete(table, { id, clientUuid, farmId });
}
