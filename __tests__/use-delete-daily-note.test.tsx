import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useDeleteDailyNote } from '@/hooks/use-records';

jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockedFrom = supabase.from as jest.Mock;

/**
 * Build a chainable delete-query mock. Every `.eq(col, val)` is recorded so the
 * test can assert WHICH key the note was deleted by (id vs date fallback). The
 * chain is thenable so `await query` resolves to the given result.
 */
function makeDeleteChain(result: { error: unknown } = { error: null }) {
  const eqCalls: Array<[string, unknown]> = [];
  const chain: Record<string, unknown> = {};
  chain.then = (onFulfilled: ((v: unknown) => unknown) | null) =>
    Promise.resolve(result).then(onFulfilled);
  chain.delete = jest.fn(() => chain);
  chain.eq = jest.fn((col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return chain;
  });
  return { chain, eqCalls };
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDeleteDailyNote', () => {
  beforeEach(() => {
    mockedFrom.mockReset();
  });

  it('deletes by id when id > 0', async () => {
    const { chain, eqCalls } = makeDeleteChain();
    mockedFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 42, farmId: 7, date: '2026-06-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eqCalls).toContainEqual(['farm_id', 7]);
    expect(eqCalls).toContainEqual(['id', 42]);
    expect(eqCalls).not.toContainEqual(['date', '2026-06-01']);
  });

  it('falls back to farm_id + date when id === 0 (receipt-screen note)', async () => {
    const { chain, eqCalls } = makeDeleteChain();
    mockedFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 0, farmId: 7, date: '2026-06-01' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(eqCalls).toContainEqual(['farm_id', 7]);
    expect(eqCalls).toContainEqual(['date', '2026-06-01']);
    expect(eqCalls).not.toContainEqual(['id', 0]);
  });

  it('throws when supabase returns an error', async () => {
    const { chain } = makeDeleteChain({ error: new Error('delete failed') });
    mockedFrom.mockReturnValue(chain);

    const { result } = renderHook(() => useDeleteDailyNote(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 5, farmId: 7, date: '2026-06-01' }),
      ).rejects.toThrow('delete failed');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
