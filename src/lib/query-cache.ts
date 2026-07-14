import { dehydrate, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createMMKV } from 'react-native-mmkv';
import {
  flushPausedRecordWriteMutations,
  registerRecordWriteMutationDefaults,
} from '@/features/offline/record-write-queue';

export const QUERY_CACHE_KEY = 'VINESIGHT_REACT_QUERY_CACHE';
export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

class OfflineQueryClient extends QueryClient {
  resumePausedMutations() {
    return flushPausedRecordWriteMutations(this, () => super.resumePausedMutations());
  }
}

export const queryClient = new OfflineQueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: QUERY_CACHE_MAX_AGE_MS, // must be >= persister maxAge
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

registerRecordWriteMutationDefaults(queryClient);

const PERSISTED_QUERY_ROOTS = new Set([
  'irrigationRecords',
  'sprayRecords',
  'fertigationRecords',
  'harvestRecords',
  'expenseRecords',
  'chemicalCatalog',
  'farmSeasons',
]);

function buildQueryPersister(userId: string | null) {
  const storage = createMMKV({ id: `vinesight-query-cache:${userId ?? 'signed-out'}` });
  return createAsyncStoragePersister({
    storage: {
      getItem: async (key) => storage.getString(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async (key) => {
        storage.remove(key);
      },
    },
    key: `${QUERY_CACHE_KEY}:${userId ?? 'signed-out'}`,
    throttleTime: 250,
  });
}

export let queryPersister = buildQueryPersister(null);

export function createQueryPersister(userId: string | null) {
  queryPersister = buildQueryPersister(userId);
  return queryPersister;
}

export async function persistQueryCacheForUser(userId: string) {
  const clientState = dehydrate(queryClient, queryDehydrateOptions);
  const persister = buildQueryPersister(userId);
  if (clientState.mutations.length === 0) {
    await persister.removeClient();
    return;
  }
  await persister.persistClient({
    buster: '',
    timestamp: Date.now(),
    clientState,
  });
}

export async function removeQueryCacheForUser(userId: string) {
  await buildQueryPersister(userId).removeClient();
}

export const queryDehydrateOptions = {
  shouldDehydrateMutation: (mutation: {
    options: { mutationKey?: readonly unknown[] };
    state: { isPaused: boolean };
  }) => mutation.state.isPaused && mutation.options.mutationKey?.[0] === 'record-write',
  shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
    query.state.status === 'success' &&
    typeof query.queryKey[0] === 'string' &&
    PERSISTED_QUERY_ROOTS.has(query.queryKey[0]),
};
