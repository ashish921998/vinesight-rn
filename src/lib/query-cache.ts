import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUERY_CACHE_KEY = 'VINESIGHT_REACT_QUERY_CACHE';
export const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

export const queryClient = new QueryClient({
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

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
});
