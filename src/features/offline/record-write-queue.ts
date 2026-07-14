import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/query-keys';
import { compactQueuedOps, type CompactableOp } from './compaction';
import { recordFlushFailure, recordFlushSuccess } from './online-manager';
import {
  executeRecordWriteMutation,
  getRecordWriteMutationKey,
  RECORD_WRITE_OPERATIONS,
  RECORD_WRITE_TABLES,
  type RecordWriteOperation,
  type RecordWriteTable,
} from './record-mutations';

let flushInProgress = false;

export function isRecordWriteFlushInProgress() {
  return flushInProgress;
}

type QueuedMutation = {
  options: { mutationKey?: readonly unknown[] };
  state: { variables?: unknown; isPaused?: boolean };
};

interface QueueItem {
  mutation: QueuedMutation;
  table: RecordWriteTable;
  operation: RecordWriteOperation;
  variables: Record<string, unknown>;
  handle: string;
  op: CompactableOp;
}

function parseRecordWriteMutation(mutation: QueuedMutation): QueueItem | null {
  const key = mutation.options.mutationKey;
  if (!key || key.length !== 3 || key[0] !== 'record-write') return null;
  const [, table, operation] = key;
  if (
    typeof table !== 'string' ||
    !RECORD_WRITE_TABLES.includes(table as RecordWriteTable) ||
    typeof operation !== 'string' ||
    !RECORD_WRITE_OPERATIONS.includes(operation as RecordWriteOperation) ||
    !mutation.state.variables ||
    typeof mutation.state.variables !== 'object'
  ) {
    return null;
  }

  const variables = mutation.state.variables as Record<string, unknown>;
  const clientUuid =
    operation === 'create'
      ? variables.client_uuid
      : (variables.clientUuid ?? variables.client_uuid);
  const id = variables.id;
  const handle =
    typeof clientUuid === 'string'
      ? `uuid:${clientUuid}`
      : typeof id === 'number'
        ? `id:${id}`
        : null;
  if (!handle) return null;

  const compactHandle = `${table}:${handle}`;
  const op =
    operation === 'create'
      ? { kind: 'create' as const, handle: compactHandle, data: variables }
      : operation === 'update'
        ? {
            kind: 'update' as const,
            handle: compactHandle,
            patch: (variables.updates as Record<string, unknown>) ?? {},
          }
        : { kind: 'delete' as const, handle: compactHandle };

  return {
    mutation,
    table: table as RecordWriteTable,
    operation: operation as RecordWriteOperation,
    variables,
    handle,
    op,
  };
}

function variablesForCompactedOp(
  item: QueueItem,
  compacted: CompactableOp,
): Record<string, unknown> {
  if (compacted.kind === 'create') return compacted.data;
  if (compacted.kind === 'update') return { ...item.variables, updates: compacted.patch };
  return item.variables;
}

export function compactPausedRecordWriteMutations(queryClient: QueryClient) {
  const mutationCache = queryClient.getMutationCache();
  const items = mutationCache
    .getAll()
    .filter((mutation) => mutation.state.isPaused)
    .map((mutation) => parseRecordWriteMutation(mutation))
    .filter((item): item is QueueItem => item !== null);
  if (items.length < 2) return;

  const compacted = compactQueuedOps(items.map((item) => item.op));
  const retained = new Set<QueuedMutation>();

  for (const compactedOp of compacted) {
    const matching = items.filter((item) => item.op.handle === compactedOp.handle);
    const operation = compactedOp.kind;
    const selected = [...matching].reverse().find((item) => item.operation === operation);
    if (!selected) continue;
    selected.mutation.state.variables = variablesForCompactedOp(selected, compactedOp);
    retained.add(selected.mutation);
  }

  for (const item of items) {
    if (retained.has(item.mutation)) continue;
    mutationCache.remove(item.mutation as Parameters<typeof mutationCache.remove>[0]);
  }
}

export function registerRecordWriteMutationDefaults(queryClient: QueryClient) {
  for (const table of RECORD_WRITE_TABLES) {
    for (const operation of RECORD_WRITE_OPERATIONS) {
      queryClient.setMutationDefaults(getRecordWriteMutationKey(table, operation), {
        mutationFn: (variables) => executeRecordWriteMutation(table, operation, variables),
      });
    }
  }
}

export async function flushPausedRecordWriteMutations(queryClient: QueryClient) {
  compactPausedRecordWriteMutations(queryClient);
  flushInProgress = true;
  try {
    await queryClient.resumePausedMutations();
    recordFlushSuccess();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sprayRecords.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.fertigationRecords.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.harvestRecords.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecords.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    ]);
  } catch (error) {
    recordFlushFailure();
    throw error;
  } finally {
    flushInProgress = false;
  }
}
