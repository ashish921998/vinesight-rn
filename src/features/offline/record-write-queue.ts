import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/query-keys';
import { compactQueuedOps, type CompactableOp } from './compaction';
import {
  executeRecordWriteMutation,
  getRecordWriteMutationKey,
  RECORD_WRITE_OPERATIONS,
  RECORD_WRITE_TABLES,
  type RecordWriteOperation,
  type RecordWriteTable,
} from './record-mutations';

let flushInProgress = false;
let activeFlush: Promise<unknown> | null = null;
let flushGeneration = 0;

export function isRecordWriteFlushInProgress() {
  return flushInProgress;
}

export function resetRecordWriteFlushState() {
  flushGeneration += 1;
  flushInProgress = false;
  activeFlush = null;
}

type QueuedMutation = {
  options: { mutationKey?: readonly unknown[] };
  state: { variables?: unknown; isPaused?: boolean; status?: string };
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

// Rebuild a record-write as a fresh paused+pending mutation so resumePausedMutations
// replays it. Rebuilding (not mutating state) avoids a stale retryer closed over old
// variables. The registered mutationDefaults supply the mutationFn for the key.
function rebuildAsPausedRecordWrite(
  queryClient: QueryClient,
  table: RecordWriteTable,
  operation: RecordWriteOperation,
  variables: Record<string, unknown>,
) {
  queryClient.getMutationCache().build(
    queryClient,
    { mutationKey: getRecordWriteMutationKey(table, operation) },
    {
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      variables,
      submittedAt: Date.now(),
    },
  );
}

// Errored writes parked across sign-out/restore are unsynced but react-query's
// resumePausedMutations only touches paused ones. Re-queue them as paused so the
// next resume replays them to Supabase.
// ponytail: retries on every flush; a permanently-rejected write (e.g. 400) will
// re-error each reconnect. Add dead-letter/give-up-after-N if that becomes noise.
function requeueFailedRecordWriteMutations(queryClient: QueryClient) {
  const mutationCache = queryClient.getMutationCache();
  const failed = mutationCache
    .getAll()
    .filter((mutation) => mutation.state.status === 'error')
    .map((mutation) => parseRecordWriteMutation(mutation))
    .filter((item): item is QueueItem => item !== null);
  for (const item of failed) {
    rebuildAsPausedRecordWrite(queryClient, item.table, item.operation, item.variables);
    mutationCache.remove(item.mutation as Parameters<typeof mutationCache.remove>[0]);
  }
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
  const compactedByHandle = new Map(compacted.map((operation) => [operation.handle, operation]));
  const itemsByHandle = new Map<string, QueueItem[]>();
  for (const item of items) {
    const matching = itemsByHandle.get(item.op.handle) ?? [];
    matching.push(item);
    itemsByHandle.set(item.op.handle, matching);
  }
  const replaced = new Set<QueueItem>();

  for (const [handle, matching] of itemsByHandle) {
    if (matching.length < 2) continue;

    const compactedOp = compactedByHandle.get(handle);
    const selected = compactedOp
      ? [...matching].reverse().find((item) => item.operation === compactedOp.kind)
      : undefined;
    if (compactedOp && selected) {
      rebuildAsPausedRecordWrite(
        queryClient,
        selected.table,
        selected.operation,
        variablesForCompactedOp(selected, compactedOp),
      );
    }

    matching.forEach((item) => replaced.add(item));
  }

  for (const item of replaced) {
    mutationCache.remove(item.mutation as Parameters<typeof mutationCache.remove>[0]);
  }
}

function hasPausedRecordWriteMutations(queryClient: QueryClient) {
  return queryClient
    .getMutationCache()
    .getAll()
    .some((mutation) => mutation.state.isPaused && parseRecordWriteMutation(mutation) !== null);
}

function hasFailedRecordWriteMutations(queryClient: QueryClient) {
  return queryClient
    .getMutationCache()
    .getAll()
    .some((mutation) => mutation.state.status === 'error' && parseRecordWriteMutation(mutation));
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

export function flushPausedRecordWriteMutations(
  queryClient: QueryClient,
  resumePausedMutations: () => Promise<unknown>,
) {
  if (activeFlush) return activeFlush;

  const generation = flushGeneration;
  activeFlush = (async () => {
    requeueFailedRecordWriteMutations(queryClient);
    compactPausedRecordWriteMutations(queryClient);
    const hasRecordWrites = hasPausedRecordWriteMutations(queryClient);
    flushInProgress = hasRecordWrites;
    try {
      const result = await resumePausedMutations();
      if (
        generation === flushGeneration &&
        hasRecordWrites &&
        !hasPausedRecordWriteMutations(queryClient) &&
        !hasFailedRecordWriteMutations(queryClient)
      ) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.irrigationRecords.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.sprayRecords.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.fertigationRecords.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.harvestRecords.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.expenseRecords.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
        ]);
      }
      return result;
    } finally {
      if (generation === flushGeneration) {
        flushInProgress = false;
        activeFlush = null;
      }
    }
  })();

  return activeFlush;
}
