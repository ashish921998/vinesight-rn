import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  fetchWorkerAttendanceByDateRange,
  useWorkerAttendanceByDateRange,
  useCreateWorkerAttendance,
  useUpdateWorkerAttendance,
  useDeleteWorkerAttendance,
  useSaveAttendanceBatch,
} from '@/hooks/use-workers';
import { queryKeys } from '@/hooks/query-keys';

// ── Chain mock for the Supabase-style query builder ──────────────────────
function makeReadChain(result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.delete = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(result));
  // Thenable so `await chain` resolves to result (used by delete path).
  chain.then = (
    onF: ((v: { data?: unknown; error?: unknown }) => unknown) | null,
    onR?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(onF, onR);
  return chain;
}

const mockFrom = jest.fn();
jest.mock('@/data-access', () => ({
  getDataAccess: jest.fn(() => ({
    from: mockFrom,
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
  })),
}));

function createWrapper(client?: QueryClient) {
  const c =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={c}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

// ── fetchWorkerAttendanceByDateRange ─────────────────────────────────────

describe('fetchWorkerAttendanceByDateRange', () => {
  it('queries with worker_id, date gte/lte, ascending order', async () => {
    const records = [{ id: 1, worker_id: 5, date: '2026-07-01', work_status: 'full_day' }];
    const chain = makeReadChain({ data: records, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchWorkerAttendanceByDateRange(5, '2026-07-01', '2026-07-31');

    expect(result).toEqual(records);
    expect(chain.eq).toHaveBeenCalledWith('worker_id', 5);
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-07-01');
    expect(chain.lte).toHaveBeenCalledWith('date', '2026-07-31');
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: true });
  });

  it('returns empty array when no data', async () => {
    const chain = makeReadChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await fetchWorkerAttendanceByDateRange(5, '2026-07-01', '2026-07-31');
    expect(result).toEqual([]);
  });

  it('throws when the query returns an error', async () => {
    const chain = makeReadChain({ data: null, error: { message: 'boom' } });
    mockFrom.mockReturnValue(chain);

    await expect(fetchWorkerAttendanceByDateRange(5, '2026-07-01', '2026-07-31')).rejects.toEqual({
      message: 'boom',
    });
  });
});

// ── useWorkerAttendanceByDateRange ───────────────────────────────────────

describe('useWorkerAttendanceByDateRange', () => {
  it('fetches and returns attendance records', async () => {
    const records = [{ id: 1, worker_id: 5, date: '2026-07-01', work_status: 'full_day' }];
    const chain = makeReadChain({ data: records, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(
      () => useWorkerAttendanceByDateRange(5, '2026-07-01', '2026-07-31'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(records);
  });

  it('is disabled when workerId is undefined', async () => {
    const { result } = renderHook(
      () => useWorkerAttendanceByDateRange(undefined, '2026-07-01', '2026-07-31'),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── Mutation invalidation keeps date-range queries fresh ─────────────────

describe('attendance mutation invalidation covers date-range keys', () => {
  it('create mutation invalidates the date-range query prefix', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    const newRecord = { id: 10, worker_id: 5, date: '2026-07-02', work_status: 'full_day' };
    const chain = makeReadChain({ data: newRecord, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useCreateWorkerAttendance(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        worker_id: 5,
        farm_ids: [1],
        date: '2026-07-02',
        work_status: 'full_day',
        work_type: 'other',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // At least one invalidation must target the shared list prefix
    // that covers listByWorkerDateRange keys.
    const listPrefix = queryKeys.workerAttendance.lists();
    const matchedPrefix = invalidateSpy.mock.calls.some(([opts]) => {
      const key = (opts as { queryKey: unknown[] }).queryKey;
      return listPrefix.every((segment, i) => key[i] === segment);
    });
    expect(matchedPrefix).toBe(true);

    invalidateSpy.mockRestore();
  });

  it('delete mutation invalidates the date-range query prefix', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    const chain = makeReadChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useDeleteWorkerAttendance(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 99, workerId: 5 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const listPrefix = queryKeys.workerAttendance.lists();
    const matchedPrefix = invalidateSpy.mock.calls.some(([opts]) => {
      const key = (opts as { queryKey: unknown[] }).queryKey;
      return listPrefix.every((segment, i) => key[i] === segment);
    });
    expect(matchedPrefix).toBe(true);

    invalidateSpy.mockRestore();
  });

  it('update mutation invalidates the date-range query prefix', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    const updated = { id: 10, worker_id: 5, date: '2026-07-02', work_status: 'half_day' };
    const chain = makeReadChain({ data: updated, error: null });
    mockFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useUpdateWorkerAttendance(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 10, updates: { work_status: 'half_day' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const listPrefix = queryKeys.workerAttendance.lists();
    const matchedPrefix = invalidateSpy.mock.calls.some(([opts]) => {
      const key = (opts as { queryKey: unknown[] }).queryKey;
      return listPrefix.every((segment, i) => key[i] === segment);
    });
    expect(matchedPrefix).toBe(true);

    invalidateSpy.mockRestore();
  });
});

// ── useSaveAttendanceBatch ────────────────────────────────────────────────

describe('useSaveAttendanceBatch', () => {
  it('invalidates exactly once for a batch of N operations', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    // Each call to from() returns a chain that resolves successfully.
    mockFrom.mockReturnValue(makeReadChain({ data: null, error: null }));

    const { result } = renderHook(() => useSaveAttendanceBatch(), {
      wrapper: createWrapper(client),
    });

    const operations = [
      {
        kind: 'create' as const,
        date: '2026-07-01',
        data: {
          worker_id: 5,
          farm_ids: [1],
          date: '2026-07-01',
          work_status: 'full_day' as const,
          work_type: 'other',
        },
      },
      {
        kind: 'update' as const,
        date: '2026-07-02',
        id: 10,
        updates: { work_status: 'half_day' as const },
      },
      {
        kind: 'delete' as const,
        date: '2026-07-03',
        id: 20,
      },
    ];

    await act(async () => {
      await result.current.mutateAsync(operations);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // All three DB operations executed.
    expect(mockFrom).toHaveBeenCalledTimes(3);

    // Only one invalidation call (the batch onSuccess), not three.
    const invalidationCount = invalidateSpy.mock.calls.filter(([opts]) => {
      const key = (opts as { queryKey: unknown[] }).queryKey;
      return queryKeys.workerAttendance.lists().every((segment, i) => key[i] === segment);
    }).length;
    expect(invalidationCount).toBe(1);

    invalidateSpy.mockRestore();
  });

  it('collects per-cell errors and still invalidates once', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);

    // First call errors, second succeeds.
    mockFrom
      .mockReturnValueOnce(makeReadChain({ data: null, error: { message: 'insert failed' } }))
      .mockReturnValueOnce(makeReadChain({ data: null, error: null }));

    const { result } = renderHook(() => useSaveAttendanceBatch(), {
      wrapper: createWrapper(client),
    });

    const operations = [
      {
        kind: 'create' as const,
        date: '2026-07-01',
        data: {
          worker_id: 5,
          farm_ids: [1],
          date: '2026-07-01',
          work_status: 'full_day' as const,
          work_type: 'other',
        },
      },
      {
        kind: 'delete' as const,
        date: '2026-07-02',
        id: 20,
      },
    ];

    let returnedErrors: Array<{ date: string; error: unknown }> = [];
    await act(async () => {
      returnedErrors = await result.current.mutateAsync(operations);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // First operation failed, second succeeded — mutation still resolves.
    expect(returnedErrors).toHaveLength(1);
    expect(returnedErrors[0].date).toBe('2026-07-01');

    // Still only one invalidation.
    const invalidationCount = invalidateSpy.mock.calls.filter(([opts]) => {
      const key = (opts as { queryKey: unknown[] }).queryKey;
      return queryKeys.workerAttendance.lists().every((segment, i) => key[i] === segment);
    }).length;
    expect(invalidationCount).toBe(1);

    invalidateSpy.mockRestore();
  });
});
